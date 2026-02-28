/**
 * 实时余额更新服务 v2
 * 每秒更新正在进行合约挖矿中的用户的比特币余额
 * 只针对有活跃挖矿合约的用户，降低计算压力
 * 
 * 动态倍数计算：
 * - 等级倍数：从Redis动态获取（用户升级时自动生效）
 * - 国家倍数：从数据库动态获取
 * - 签到加成：从Redis动态检查（仅对签到合约有效）
 */

const sequelize = require('../config/database');
const LevelService = require('./levelService');
const redisClient = require('../config/redis');

class RealtimeBalanceService {
  
  /**
   * 获取所有正在挖矿中的用户
   * 只查询合约未结束的用户
   */
  static async getActiveMiningUsers() {
    try {
      const users = await sequelize.query(`
        SELECT DISTINCT user_id
        FROM (
          -- 免费合约（广告、签到、邀请）
          SELECT DISTINCT user_id 
          FROM free_contract_records 
          WHERE free_contract_end_time > NOW()
          
          UNION
          
          -- 付费合约
          SELECT DISTINCT user_id 
          FROM mining_contracts 
          WHERE contract_end_time > NOW()
        ) AS active_users
      `, {
        type: sequelize.QueryTypes.SELECT
      });
      
      return users.map(u => u.user_id);
    } catch (error) {
      console.error('❌ 获取活跃挖矿用户失败:', error);
      return [];
    }
  }

  /**
   * 计算用户当前每秒的比特币收益（动态倍数版本）
   * 
   * 计算公式：finalSpeed = base_hashrate × level_multiplier × country_multiplier × daily_bonus
   * 
   * @param {number} userId - 用户ID
   * @returns {number} 每秒收益（BTC）
   */
  static async calculateUserPerSecondRevenue(userId) {
    try {
      let totalPerSecond = 0;

      // === 1. 获取用户的动态倍数 ===
      
      // 1.1 从Redis获取等级倍数（缓存60分钟，升级时自动清除）
      let levelMultiplier = 1.0;
      try {
        const cachedLevel = await redisClient.getUserLevel(userId);
        if (cachedLevel && cachedLevel.speedMultiplier) {
          levelMultiplier = parseFloat(cachedLevel.speedMultiplier);
        } else {
          // Redis未命中，查数据库并缓存
          const userLevel = await LevelService.getUserLevel(userId);
          if (userLevel && userLevel.speedMultiplier) {
            levelMultiplier = parseFloat(userLevel.speedMultiplier);
          }
        }
      } catch (error) {
        console.error(`获取用户 ${userId} 等级倍数失败，使用默认值1.0`, error);
      }

      // 1.2 从数据库获取国家倍数
      let countryMultiplier = 1.0;
      try {
        const [userInfo] = await sequelize.query(`
          SELECT country_multiplier 
          FROM user_information 
          WHERE id = ?
        `, {
          replacements: [userId],
          type: sequelize.QueryTypes.SELECT
        });
        
        if (userInfo && userInfo.country_multiplier) {
          countryMultiplier = parseFloat(userInfo.country_multiplier);
        }
      } catch (error) {
        console.error(`获取用户 ${userId} 国家倍数失败，使用默认值1.0`, error);
      }

      // === 2. 计算免费合约收益（广告、签到、邀请、绑定推荐人） ===
      const freeContracts = await sequelize.query(`
        SELECT 
          base_hashrate,
          hashrate,
          has_daily_bonus,
          free_contract_type
        FROM free_contract_records 
        WHERE user_id = ? 
        AND free_contract_end_time > NOW()
      `, {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      });

      for (const contract of freeContracts) {
        // 优先使用 base_hashrate，回退到 hashrate（兼容旧数据）
        const baseSpeed = contract.base_hashrate 
          ? parseFloat(contract.base_hashrate) 
          : parseFloat(contract.hashrate);
        
        // 签到合约：has_daily_bonus = 1，固定使用1.36倍加成
        // 其他合约：不使用签到加成
        const bonus = (contract.has_daily_bonus === 1) ? 1.36 : 1.0;
        
        // 动态计算最终速率
        const finalSpeed = baseSpeed * levelMultiplier * countryMultiplier * bonus;
        totalPerSecond += finalSpeed;
      }

      // === 3. 计算付费合约收益（固定收益，不受等级/国家影响） ===
      const paidContracts = await sequelize.query(`
        SELECT base_hashrate, hashrate
        FROM mining_contracts 
        WHERE user_id = ? 
        AND contract_end_time > NOW()
      `, {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      });

      for (const contract of paidContracts) {
        // 付费合约使用固定速率（不应用等级/国家倍数，用户付费购买的是固定收益）
        const fixedSpeed = contract.base_hashrate 
          ? parseFloat(contract.base_hashrate) 
          : parseFloat(contract.hashrate);
        
        totalPerSecond += fixedSpeed;
      }

      return totalPerSecond;
    } catch (error) {
      console.error(`❌ 计算用户 ${userId} 每秒收益失败:`, error);
      return 0;
    }
  }

  /**
   * 更新单个用户的余额
   * @param {number} intervalSeconds - 更新间隔（秒），默认5秒
   */
  static async updateUserBalance(userId, revenuePerSecond, intervalSeconds = 5) {
    try {
      if (revenuePerSecond <= 0) return false;

      // 计算该时间间隔内的总收益
      const intervalRevenue = revenuePerSecond * intervalSeconds;

      // 直接更新余额，增加间隔时间内的收益
      await sequelize.query(`
        UPDATE user_status 
        SET 
          current_bitcoin_balance = current_bitcoin_balance + ?
        WHERE user_id = ?
      `, {
        replacements: [intervalRevenue, userId],
        type: sequelize.QueryTypes.UPDATE
      });

      return true;
    } catch (error) {
      console.error(`❌ 更新用户 ${userId} 余额失败:`, error);
      return false;
    }
  }

  /**
   * 批量更新所有活跃挖矿用户的余额
   * 每5秒执行一次
   */
  static async updateAllActiveBalances(intervalSeconds = 5) {
    try {
      const startTime = Date.now();
      
      // 1. 获取所有活跃挖矿用户
      const activeUsers = await this.getActiveMiningUsers();
      
      if (activeUsers.length === 0) {
        // 没有活跃用户时不输出日志，减少干扰
        return {
          success: true,
          userCount: 0,
          updatedCount: 0,
          executionTime: 0
        };
      }

      // 2. 批量计算和更新
      let updatedCount = 0;
      const updatePromises = [];

      for (const userId of activeUsers) {
        const promise = (async () => {
          const revenue = await this.calculateUserPerSecondRevenue(userId);
          if (revenue > 0) {
            const updated = await this.updateUserBalance(userId, revenue, intervalSeconds);
            if (updated) updatedCount++;
          }
        })();
        
        updatePromises.push(promise);
      }

      // 并发执行所有更新
      await Promise.all(updatePromises);

      const executionTime = Date.now() - startTime;

      // 只在有更新时输出日志
      if (updatedCount > 0) {
        console.log(
          `⚡ [实时余额] 更新 ${updatedCount}/${activeUsers.length} 用户 ` +
          `(${executionTime}ms)`
        );
      }

      return {
        success: true,
        userCount: activeUsers.length,
        updatedCount,
        executionTime
      };

    } catch (error) {
      console.error('❌ 批量更新余额失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 启动实时余额更新定时器
   * 每5秒执行一次（优化高并发性能）
   * 
   * 性能考量：
   * - 20000日活（6000并发）× 1秒 = 6000 QPS → 超出2核2GB服务器负载
   * - 调整为5秒后：1200 QPS → 在阿里云轻量服务器承受范围内
   * - 前端仍每秒刷新（通过公式计算），用户体验无损
   */
  static startRealtimeUpdates() {
    console.log('⚡ 启动实时余额更新服务（每5秒执行）...');
    
    // 立即执行一次
    this.updateAllActiveBalances();
    
    // 每5秒执行一次（针对高并发场景优化）
    this.updateInterval = setInterval(async () => {
      await this.updateAllActiveBalances();
    }, 5000);
    
    console.log('✓ 实时余额更新服务已启动（间隔5秒）');
  }

  /**
   * 停止实时余额更新
   */
  static stopRealtimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('⚡ 实时余额更新服务已停止');
    }
  }
}

// 用于存储定时器ID
RealtimeBalanceService.updateInterval = null;

module.exports = RealtimeBalanceService;
