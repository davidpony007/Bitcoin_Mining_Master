/**
 * 实时余额更新服务
 * 每秒更新正在进行合约挖矿中的用户的比特币余额
 * 只针对有活跃挖矿合约的用户，降低计算压力
 */

const sequelize = require('../config/database');
const LevelService = require('./levelService');

class RealtimeBalanceService {
  
  /**
   * 获取所有正在挖矿中的用户
   * 只查询mining_status = 'mining'且合约未结束的用户
   */
  static async getActiveMiningUsers() {
    try {
      const users = await sequelize.query(`
        SELECT DISTINCT user_id
        FROM (
          -- 免费合约（广告、签到、邀请）
          SELECT DISTINCT user_id 
          FROM free_contract_records 
          WHERE mining_status = 'mining' 
          AND free_contract_end_time > NOW()
          
          UNION
          
          -- 付费合约
          SELECT DISTINCT user_id 
          FROM mining_contracts 
          WHERE mining_status = 'mining' 
          AND contract_end_time > NOW()
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
   * 计算用户当前每秒的比特币收益
   * 包括所有类型合约的收益总和
   */
  static async calculateUserPerSecondRevenue(userId) {
    try {
      let totalPerSecond = 0;

      // 1. 获取用户基础挖矿速度（应用等级、加成、国家系数）
      const speedInfo = await LevelService.calculateMiningSpeed(userId);
      const baseSpeedPerSecond = speedInfo.finalSpeedWithCountry;

      // 2. 计算免费合约收益（广告、签到、邀请）
      const freeContracts = await sequelize.query(`
        SELECT 
          free_contract_type,
          COUNT(*) as count
        FROM free_contract_records 
        WHERE user_id = ? 
        AND mining_status = 'mining' 
        AND free_contract_end_time > NOW()
        GROUP BY free_contract_type
      `, {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      });

      for (const contract of freeContracts) {
        const count = contract.count;
        
        // 签到合约有1.36倍加成
        if (contract.free_contract_type === 'daily sign-in free contract') {
          totalPerSecond += baseSpeedPerSecond * 1.36 * count;
        } else {
          totalPerSecond += baseSpeedPerSecond * count;
        }
      }

      // 3. 计算付费合约收益（使用固定hashrate，不受国家系数影响）
      const paidContracts = await sequelize.query(`
        SELECT hashrate
        FROM mining_contracts 
        WHERE user_id = ? 
        AND mining_status = 'mining' 
        AND contract_end_time > NOW()
      `, {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      });

      for (const contract of paidContracts) {
        totalPerSecond += parseFloat(contract.hashrate);
      }

      return totalPerSecond;
    } catch (error) {
      console.error(`❌ 计算用户 ${userId} 每秒收益失败:`, error);
      return 0;
    }
  }

  /**
   * 更新单个用户的余额
   */
  static async updateUserBalance(userId, revenuePerSecond) {
    try {
      if (revenuePerSecond <= 0) return false;

      // 直接更新余额，增加每秒收益
      await sequelize.query(`
        UPDATE user_status 
        SET 
          current_bitcoin_balance = current_bitcoin_balance + ?,
          bitcoin_accumulated_amount = bitcoin_accumulated_amount + ?
        WHERE user_id = ?
      `, {
        replacements: [revenuePerSecond, revenuePerSecond, userId],
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
   * 每秒执行一次
   */
  static async updateAllActiveBalances() {
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
            const updated = await this.updateUserBalance(userId, revenue);
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
   * 每秒执行一次
   */
  static startRealtimeUpdates() {
    console.log('⚡ 启动实时余额更新服务（每秒执行）...');
    
    // 立即执行一次
    this.updateAllActiveBalances();
    
    // 每秒执行一次
    this.updateInterval = setInterval(async () => {
      await this.updateAllActiveBalances();
    }, 1000);
    
    console.log('✓ 实时余额更新服务已启动');
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
