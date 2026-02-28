// contractRewardService.js
// 合约奖励计算和发放服务
// 每2小时UTC整点计算一次，统计所有类型合约产生的收益

const pool = require('../config/database').pool;
const LevelService = require('./levelService');

class ContractRewardService {
  
  /**
   * 获取有活跃合约的用户列表
   * 包括所有类型：普通广告、签到广告、邀请好友、付费合约
   */
  static async getUsersWithActiveContracts(startTime, endTime) {
    try {
      const [users] = await pool.query(`
        SELECT DISTINCT user_id
        FROM (
          -- 免费合约（广告、签到、邀请）
          SELECT DISTINCT user_id 
          FROM free_contract_records 
          WHERE free_contract_end_time > ?
          
          UNION
          
          -- 付费合约
          SELECT DISTINCT user_id 
          FROM mining_contracts 
          WHERE contract_end_time > ?
        ) AS all_users
      `, [startTime, startTime]);
      
      return users.map(u => u.user_id);
    } catch (error) {
      console.error('❌ 获取有活跃合约的用户失败:', error);
      return [];
    }
  }

  /**
   * 计算用户在指定时间段内的合约收益
   * @param {string} userId - 用户ID
   * @param {Date} startTime - 开始时间
   * @param {Date} endTime - 结束时间
   */
  static async calculateUserRewards(userId, startTime, endTime) {
    try {
      let totalRevenue = 0;
      const details = {
        adFreeContracts: 0,
        dailySignInContracts: 0,
        invitationContracts: 0,
        bindReferrerContracts: 0,
        paidContracts: 0
      };

      // 1. 获取用户挖矿速度（应用公式）
      const speedInfo = await LevelService.calculateMiningSpeed(userId);
      const speedPerSecond = speedInfo.finalSpeedWithCountry;

      // 2. 计算免费广告合约收益
      const adRevenue = await this.calculateFreeContractRevenue(
        userId, 
        'Free Ad Reward', 
        startTime, 
        endTime,
        speedPerSecond
      );
      details.adFreeContracts = adRevenue;
      totalRevenue += adRevenue;

      // 3. 计算签到合约收益
      const signInRevenue = await this.calculateFreeContractRevenue(
        userId, 
        'Daily Check-in Reward', 
        startTime, 
        endTime,
        speedPerSecond
      );
      details.dailySignInContracts = signInRevenue;
      totalRevenue += signInRevenue;

      // 4. 计算邀请好友合约收益
      const invitationRevenue = await this.calculateFreeContractRevenue(
        userId, 
        'Invite Friend Reward', 
        startTime, 
        endTime,
        speedPerSecond
      );
      details.invitationContracts = invitationRevenue;
      totalRevenue += invitationRevenue;

      // 5. 计算绑定推荐人合约收益
      const bindReferrerRevenue = await this.calculateFreeContractRevenue(
        userId, 
        'Bind Referrer Reward', 
        startTime, 
        endTime,
        speedPerSecond
      );
      details.bindReferrerContracts = bindReferrerRevenue;
      totalRevenue += bindReferrerRevenue;

      // 6. 计算付费合约收益（不使用国家系数）
      const paidRevenue = await this.calculatePaidContractRevenue(
        userId, 
        startTime, 
        endTime
      );
      details.paidContracts = paidRevenue;
      totalRevenue += paidRevenue;

      return {
        userId,
        totalRevenue,
        details,
        speedInfo: {
          baseSpeed: speedInfo.baseSpeed,
          levelMultiplier: speedInfo.levelMultiplier,
          dailyBonusMultiplier: speedInfo.dailyBonusMultiplier,
          countryMultiplier: speedInfo.countryMultiplier,
          finalSpeed: speedPerSecond
        }
      };
    } catch (error) {
      console.error(`❌ 计算用户 ${userId} 收益失败:`, error);
      return {
        userId,
        totalRevenue: 0,
        details: {},
        error: error.message
      };
    }
  }

  /**
   * 计算免费合约收益
   */
  static async calculateFreeContractRevenue(userId, contractType, startTime, endTime, speedPerSecond) {
    try {
      const [contracts] = await pool.query(`
        SELECT 
          id,
          hashrate,
          free_contract_creation_time,
          free_contract_end_time
        FROM free_contract_records
        WHERE user_id = ?
          AND free_contract_type = ?
          AND free_contract_end_time > ?
      `, [userId, contractType, startTime]);

      let totalRevenue = 0;

      for (const contract of contracts) {
        // 计算合约在时间段内的有效挖矿时长
        const contractStart = new Date(contract.free_contract_creation_time);
        const contractEnd = new Date(contract.free_contract_end_time);
        
        // 取交集时间段
        const effectiveStart = contractStart > startTime ? contractStart : startTime;
        const effectiveEnd = contractEnd < endTime ? contractEnd : endTime;
        
        if (effectiveStart >= effectiveEnd) continue;
        
        // 计算秒数
        const seconds = Math.floor((effectiveEnd - effectiveStart) / 1000);
        
        // 计算收益：使用合约的hashrate（已应用公式）
        const revenue = contract.hashrate * seconds;
        totalRevenue += revenue;

        console.log(`  ${contractType}: ${seconds}秒 × ${contract.hashrate} = ${revenue} BTC`);
      }

      return totalRevenue;
    } catch (error) {
      console.error(`❌ 计算免费合约收益失败 (${contractType}):`, error);
      return 0;
    }
  }

  /**
   * 计算付费合约收益
   * ⚠️ 注意：付费合约不使用国家系数，直接使用合约创建时确定的hashrate
   */
  static async calculatePaidContractRevenue(userId, startTime, endTime) {
    try {
      const [contracts] = await pool.query(`
        SELECT 
          id,
          hashrate,
          contract_creation_time,
          contract_end_time,
          mining_status
        FROM mining_contracts
        WHERE user_id = ?
          AND contract_type LIKE 'contract_%'
          AND (
            (mining_status = 'mining' AND contract_end_time > ?)
            OR (mining_status = 'completed' AND contract_end_time >= ? AND contract_end_time <= ?)
          )
      `, [userId, startTime, startTime, endTime]);

      let totalRevenue = 0;

      for (const contract of contracts) {
        const contractStart = new Date(contract.contract_creation_time);
        const contractEnd = new Date(contract.contract_end_time);
        
        const effectiveStart = contractStart > startTime ? contractStart : startTime;
        const effectiveEnd = contractEnd < endTime ? contractEnd : endTime;
        
        if (effectiveStart >= effectiveEnd) continue;
        
        const seconds = Math.floor((effectiveEnd - effectiveStart) / 1000);
        // ✅ 付费合约不使用国家系数，直接用contract.hashrate计算
        const revenue = contract.hashrate * seconds;
        totalRevenue += revenue;

        console.log(`  付费合约: ${seconds}秒 × ${contract.hashrate} BTC/s = ${revenue} BTC`);
      }

      return totalRevenue;
    } catch (error) {
      console.error('❌ 计算付费合约收益失败:', error);
      return 0;
    }
  }

  /**
   * 发放收益到用户账户
   */
  static async distributeReward(userId, amount, details) {
    if (amount <= 0) return false;

    try {
      // 更新用户余额
      await pool.query(`
        UPDATE user_information
        SET bitcoin_balance = bitcoin_balance + ?
        WHERE user_id = ?
      `, [amount, userId]);

      // 记录交易
      await pool.query(`
        INSERT INTO bitcoin_transaction_records (
          user_id,
          transaction_type,
          transaction_amount,
          transaction_status,
          transaction_time
        ) VALUES (?, 'mining_reward', ?, 'success', NOW())
      `, [userId, amount]);

      console.log(`✅ 用户 ${userId} 收益发放成功: ${amount} BTC`);
      return true;
    } catch (error) {
      console.error(`❌ 用户 ${userId} 收益发放失败:`, error);
      return false;
    }
  }

  /**
   * 执行一轮完整的奖励计算和发放
   */
  static async executeRewardDistribution() {
    const now = new Date();
    const endTime = now;
    const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2小时前

    console.log('\n========== 开始计算合约奖励 ==========');
    console.log(`时间段: ${startTime.toISOString()} 至 ${endTime.toISOString()}`);

    try {
      // 1. 获取有活跃合约的用户
      const userIds = await this.getUsersWithActiveContracts(startTime, endTime);
      console.log(`找到 ${userIds.length} 个有活跃合约的用户`);

      if (userIds.length === 0) {
        console.log('✓ 无需发放奖励');
        return;
      }

      let successCount = 0;
      let totalDistributed = 0;

      // 2. 逐个计算和发放
      for (const userId of userIds) {
        console.log(`\n处理用户: ${userId}`);
        
        const result = await this.calculateUserRewards(userId, startTime, endTime);
        
        if (result.error) {
          console.error(`  ❌ 计算失败: ${result.error}`);
          continue;
        }

        console.log(`  总收益: ${result.totalRevenue} BTC`);
        console.log(`  详情:`, result.details);

        if (result.totalRevenue > 0) {
          const distributed = await this.distributeReward(
            userId, 
            result.totalRevenue, 
            result.details
          );
          
          if (distributed) {
            successCount++;
            totalDistributed += result.totalRevenue;
          }
        } else {
          console.log(`  ⚠️ 无收益，跳过发放`);
        }
      }

      console.log('\n========== 奖励发放完成 ==========');
      console.log(`成功: ${successCount}/${userIds.length} 用户`);
      console.log(`总发放: ${totalDistributed} BTC`);
      console.log('======================================\n');

    } catch (error) {
      console.error('❌ 奖励发放过程出错:', error);
    }
  }
}

module.exports = ContractRewardService;
