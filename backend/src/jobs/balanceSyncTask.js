/**
 * 余额同步定时任务
 * 每2小时执行一次：批量计算和持久化所有活跃用户的挖矿收益
 * 执行时间：00:00, 02:00, 04:00, 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00 (UTC)
 */

const cron = require('node-cron');
const pool = require('../config/database_native');
const RealtimeBalanceService = require('../services/realtimeBalanceService');

class BalanceSyncTask {
  /**
   * 启动定时任务
   */
  static start() {
    // 每2小时的整点执行
    cron.schedule('0 */2 * * *', async () => {
      console.log('🕐 [定时任务] 开始执行2小时收益结算...');
      const startTime = new Date();
      
      try {
        // 0. 将已过期的免费合约状态更新为 completed
        await this.markExpiredContractsCompleted();

        // 1. 获取所有有活跃合约的用户
        const users = await this.getActiveUsers();
        console.log(`📊 找到 ${users.length} 个活跃用户需要结算`);
        
        if (users.length === 0) {
          console.log('ℹ️  无活跃用户需要结算');
          return;
        }
        
        let successCount = 0;
        let failCount = 0;
        let totalRewards = 0;
        
        // 2. 批量处理用户收益
        for (const user of users) {
          try {
            const reward = await this.settleUserRewards(user.user_id);
            if (reward > 0) {
              totalRewards += reward;
              successCount++;
            }
          } catch (err) {
            console.error(`❌ 用户 ${user.user_id} 结算失败:`, err.message);
            failCount++;
          }
        }
        
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log('✅ [定时任务] 2小时收益结算完成');
        console.log(`   - 成功: ${successCount} 人`);
        console.log(`   - 失败: ${failCount} 人`);
        console.log(`   - 总奖励: ${totalRewards.toFixed(18)} BTC`);
        console.log(`   - 耗时: ${duration} 秒`);
        
      } catch (err) {
        console.error('❌ [定时任务] 2小时收益结算失败:', err);
      }
    });
    
    console.log('⏰ 2小时收益结算定时任务已启动 (每2小时整点执行)');
  }
  
  /**
   * 将已过期的免费挖矿合约状态更新为 completed，并计算实际收益写入 free_contract_revenue
   * 收益公式：base_hashrate × level_multiplier × country_multiplier × daily_bonus × duration(秒)
   * 每次定时结算前调用，确保 mining_status 和 free_contract_revenue 字段与实际一致
   */
  static async markExpiredContractsCompleted() {
    try {
      const [result] = await pool.query(`
        UPDATE free_contract_records f
        INNER JOIN user_information u ON f.user_id = u.user_id
        LEFT JOIN level_config l ON u.user_level = l.level
        SET
          f.mining_status = 'completed',
          f.free_contract_revenue =
            COALESCE(f.base_hashrate, f.hashrate)
            * COALESCE(l.speed_multiplier, 1.0)
            * COALESCE(u.country_multiplier, 1.0)
            * IF(f.has_daily_bonus = 1, 1.36, 1.0)
            * TIMESTAMPDIFF(SECOND, f.free_contract_creation_time, f.free_contract_end_time)
        WHERE f.free_contract_end_time <= NOW()
          AND (f.mining_status = 'mining' OR f.mining_status IS NULL)
      `);
      if (result.affectedRows > 0) {
        console.log(`⏹️  [定时任务] 已将 ${result.affectedRows} 条过期合约更新为 completed 并写入收益`);
      }
    } catch (err) {
      console.error('❌ [定时任务] 更新过期合约状态失败:', err.message);
      // 不抛出异常，不影响主结算流程
    }
  }

  /**
   * 获取所有有活跃合约的用户
   */
  static async getActiveUsers() {
    const [users] = await pool.query(`
      SELECT DISTINCT user_id
      FROM (
        -- 免费合约用户
        SELECT DISTINCT user_id 
        FROM free_contract_records 
        WHERE free_contract_end_time > NOW()
        
        UNION
        
        -- 付费合约用户
        SELECT DISTINCT user_id 
        FROM mining_contracts 
        WHERE contract_end_time > NOW()
      ) AS active_users
    `);
    
    return users;
  }
  
  /**
   * 结算单个用户的收益，按合约类型写入独立 transaction 记录
   */
  static async settleUserRewards(userId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. 获取用户当前状态
      const [userStatus] = await connection.query(
        `SELECT 
          current_bitcoin_balance, 
          last_balance_update_time 
        FROM user_status 
        WHERE user_id = ?`,
        [userId]
      );
      
      if (userStatus.length === 0) {
        throw new Error('用户不存在');
      }
      
      const lastUpdateTime = new Date(userStatus[0].last_balance_update_time || Date.now() - 2 * 60 * 60 * 1000);
      const now = new Date();
      const elapsedSeconds = Math.floor((now - lastUpdateTime) / 1000);

      if (elapsedSeconds <= 0) {
        await connection.rollback();
        return 0;
      }
      
      // 2. 按合约类型拆分计算收益
      const { total: speedPerSecond, byType } = await RealtimeBalanceService.calculateUserPerSecondRevenueByType(userId);
      const minedAmount = speedPerSecond * elapsedSeconds;
      
      if (minedAmount <= 0) {
        await connection.rollback();
        return 0; // 无收益，跳过
      }
      
      // 3. 更新用户余额
      await connection.query(`
        UPDATE user_status 
        SET 
          current_bitcoin_balance = current_bitcoin_balance + ?,
          bitcoin_accumulated_amount = bitcoin_accumulated_amount + ?,
          last_balance_update_time = NOW()
        WHERE user_id = ?
      `, [minedAmount, minedAmount, userId]);
      
      // 4. 按合约类型写入独立交易记录
      //    byType key: 'Free Ad Reward' | 'Daily Check-in Reward' | 'Invite Friend Reward'
      //                'Bind Referrer Reward' | 'paid_contract'
      //    paid_contract 对应 transaction_type = 'mining_reward'（付费合约聚合）
      let runningBalance = parseFloat(userStatus[0].current_bitcoin_balance);
      const typeEntries = Object.entries(byType);

      // 把 paid_contract → mining_reward，让客户端 type.contains('mining') 能匹配
      const typeLabel = (t) => t === 'paid_contract' ? 'mining_reward' : t;

      for (const [contractType, typeSpeed] of typeEntries) {
        if (typeSpeed <= 0) continue;
        const typeAmount = typeSpeed * elapsedSeconds;
        runningBalance += typeAmount;
        await connection.query(`
          INSERT INTO bitcoin_transaction_records (
            user_id, transaction_type, transaction_amount,
            balance_after, description, transaction_status, transaction_creation_time
          ) VALUES (?, ?, ?, ?, ?, 'success', NOW())
        `, [
          userId,
          typeLabel(contractType),
          typeAmount,
          runningBalance,
          `${elapsedSeconds}s × ${typeSpeed.toFixed(18)} BTC/s`
        ]);
      }
      
      await connection.commit();
      
      console.log(`✅ 用户 ${userId} 收益结算完成: +${minedAmount.toFixed(18)} BTC (${elapsedSeconds}秒, ${typeEntries.length}种合约)`);
      
      return minedAmount;
      
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
  
  /**
   * 手动触发结算（用于测试）
   */
  static async triggerManually() {
    console.log('🔧 [手动触发] 开始执行收益结算...');
    const users = await this.getActiveUsers();
    
    for (const user of users) {
      try {
        await this.settleUserRewards(user.user_id);
      } catch (err) {
        console.error(`❌ 用户 ${user.user_id} 结算失败:`, err);
      }
    }
    
    console.log('✅ [手动触发] 收益结算完成');
  }
}

module.exports = BalanceSyncTask;
