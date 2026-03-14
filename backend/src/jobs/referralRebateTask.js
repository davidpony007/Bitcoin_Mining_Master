/**
 * 下级返利定时任务
 * 每2小时计算并发放下级返利
 * 规则：仅统计下级用户的 Free Ad Reward（广告挖矿）收益，
 *       乘以20%发放给上级。用 invitation_rebate 最新时间戳去重，防止重复发放。
 *       付费合约挖矿（mining_reward）和每日签到（Daily Check-in Reward）不计入返利。
 * 执行时间：比余额结算晚5分钟，确保余额已更新
 */

const cron = require('node-cron');
const pool = require('../config/database_native');

class ReferralRebateTask {
  /**
   * 启动定时任务
   */
  static start() {
    // 在PM2 cluster模式下，只在第一个实例运行返利任务
    const isClusterMode = process.env.NODE_APP_INSTANCE !== undefined;
    const instanceId = process.env.NODE_APP_INSTANCE || '0';
    
    if (isClusterMode && instanceId !== '0') {
      console.log(`⏰ [实例 ${instanceId}] PM2 cluster模式：跳过返利任务启动（仅实例0运行）`);
      return;
    }
    
    // 每2小时的5分执行（比余额结算晚5分钟）
    cron.schedule('5 */2 * * *', async () => {
      console.log('🎁 [定时任务] 开始执行下级返利发放...');
      const startTime = new Date();
      
      try {
        // 1. 获取所有有下级的用户
        const [referrers] = await pool.query(`
          SELECT DISTINCT referrer_user_id as user_id
          FROM invitation_relationship
          WHERE referrer_user_id IS NOT NULL
        `);
        
        console.log(`📊 找到 ${referrers.length} 个推荐人需要计算返利`);
        
        if (referrers.length === 0) {
          console.log('ℹ️  无推荐人需要计算返利');
          return;
        }
        
        let totalRebateAmount = 0;
        let successCount = 0;
        let failCount = 0;
        
        // 2. 为每个推荐人计算返利
        for (const referrer of referrers) {
          try {
            const rebateAmount = await this.calculateAndDistributeRebate(referrer.user_id);
            if (rebateAmount > 0) {
              totalRebateAmount += rebateAmount;
              successCount++;
            }
          } catch (err) {
            console.error(`❌ 推荐人 ${referrer.user_id} 返利计算失败:`, err.message);
            failCount++;
          }
        }
        
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log('✅ [定时任务] 下级返利发放完成');
        console.log(`   - 成功: ${successCount} 人`);
        console.log(`   - 失败: ${failCount} 人`);
        console.log(`   - 总返利: ${totalRebateAmount.toFixed(18)} BTC`);
        console.log(`   - 耗时: ${duration} 秒`);
        
      } catch (err) {
        console.error('❌ [定时任务] 下级返利发放失败:', err);
      }
    });
    
    console.log(`⏰ [实例 ${instanceId}] 下级返利发放定时任务已启动 (每2小时5分执行)`);
  }
  
  /**
   * 计算并发放单个推荐人的下级返利
   */
  static async calculateAndDistributeRebate(referrerId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. 获取推荐人的所有下级
      const [subordinates] = await connection.query(
        'SELECT user_id FROM invitation_relationship WHERE referrer_user_id = ?',
        [referrerId]
      );
      
      if (subordinates.length === 0) {
        await connection.rollback();
        return 0;
      }
      
      // 2. 基于 bitcoin_transaction_records 计算未发放的下级收益
      //    仅 Free Ad Reward（广告挖矿）计入返利
      //    以 invitation_rebate 最新时间戳为游标，避免重复发放
      let totalSubordinateMiningRevenue = 0;
      const subordinateDetails = [];

      for (const sub of subordinates) {
        // 查该下级上一次被计入返利的时间
        const [[lastRebateRow]] = await connection.query(
          `SELECT MAX(rebate_creation_time) AS last_time
           FROM invitation_rebate
           WHERE user_id = ? AND subordinate_user_id = ?`,
          [referrerId, sub.user_id]
        );
        const lastRebateTime = lastRebateRow?.last_time
          ? new Date(lastRebateRow.last_time)
          : new Date(0);

        // 仅累计该下级在 lastRebateTime 之后产生的 Free Ad Reward 收益
        const [[rewardRow]] = await connection.query(
          `SELECT COALESCE(SUM(transaction_amount), 0) AS total
           FROM bitcoin_transaction_records
           WHERE user_id = ?
             AND transaction_type = 'Free Ad Reward'
             AND transaction_status = 'success'
             AND transaction_creation_time > ?`,
          [sub.user_id, lastRebateTime]
        );
        const subRevenue = parseFloat(rewardRow.total) || 0;

        if (subRevenue > 0) {
          totalSubordinateMiningRevenue += subRevenue;
          subordinateDetails.push({
            userId: sub.user_id,
            revenue: subRevenue
          });
        }
      }

      // 3. 计算返利金额（20%）
      const rebateAmount = totalSubordinateMiningRevenue * 0.20;

      if (rebateAmount <= 0) {
        await connection.rollback();
        return 0;
      }

      // 4. 获取推荐人当前余额和邀请码
      const [referrerStatus] = await connection.query(
        'SELECT current_bitcoin_balance FROM user_status WHERE user_id = ?',
        [referrerId]
      );
      
      if (referrerStatus.length === 0) {
        throw new Error('推荐人不存在');
      }
      
      const [referrerInfo] = await connection.query(
        'SELECT invitation_code FROM user_information WHERE user_id = ?',
        [referrerId]
      );
      const invitationCode = referrerInfo[0]?.invitation_code || '';
      
      // 5. 发放返利给推荐人（更新余额和累计返利）
      await connection.query(`
        UPDATE user_status 
        SET 
          current_bitcoin_balance = current_bitcoin_balance + ?,
          bitcoin_accumulated_amount = bitcoin_accumulated_amount + ?,
          total_invitation_rebate = total_invitation_rebate + ?
        WHERE user_id = ?
      `, [rebateAmount, rebateAmount, rebateAmount, referrerId]);

      // 6. 记录每个下级的返利明细到 invitation_rebate 表，
      //    同时向 bitcoin_transaction_records 写入每条独立记录（按下级分开）
      let runningBalance = parseFloat(referrerStatus[0].current_bitcoin_balance);

      for (const sub of subordinateDetails) {
        const subRebate = sub.revenue * 0.20;
        runningBalance += subRebate;

        // 获取下级用户的邀请码
        const [subInfo] = await connection.query(
          'SELECT invitation_code FROM user_information WHERE user_id = ?',
          [sub.userId]
        );
        const subInvitationCode = subInfo[0]?.invitation_code || '';

        // invitation_rebate 明细记录
        await connection.query(`
          INSERT INTO invitation_rebate (
            user_id,
            invitation_code,
            subordinate_user_id,
            subordinate_user_invitation_code,
            subordinate_rebate_amount,
            rebate_creation_time
          ) VALUES (?, ?, ?, ?, ?, NOW())
        `, [referrerId, invitationCode, sub.userId, subInvitationCode, subRebate]);

        // bitcoin_transaction_records 每条下级独立一行，description 明确显示下级用户ID
        await connection.query(`
          INSERT INTO bitcoin_transaction_records (
            user_id,
            transaction_type,
            transaction_amount,
            balance_after,
            description,
            transaction_status,
            transaction_creation_time
          ) VALUES (?, 'subordinate rebate', ?, ?, ?, 'success', NOW())
        `, [referrerId, subRebate, runningBalance, `From: ${sub.userId}`]);
      }
      
      await connection.commit();
      
      console.log(`✅ 推荐人 ${referrerId} 获得返利: ${rebateAmount.toFixed(18)} BTC (下级挖矿收益: ${totalSubordinateMiningRevenue.toFixed(18)} BTC)`);
      
      return rebateAmount;
      
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
  
  /**
   * 手动触发返利计算（用于测试）
   */
  static async triggerManually() {
    console.log('🔧 [手动触发] 开始执行下级返利发放...');
    
    const [referrers] = await pool.query(`
      SELECT DISTINCT referrer_user_id as user_id
      FROM invitation_relationship
      WHERE referrer_user_id IS NOT NULL
    `);
    
    for (const referrer of referrers) {
      try {
        await this.calculateAndDistributeRebate(referrer.user_id);
      } catch (err) {
        console.error(`❌ 推荐人 ${referrer.user_id} 返利计算失败:`, err);
      }
    }
    
    console.log('✅ [手动触发] 下级返利发放完成');
  }
}

module.exports = ReferralRebateTask;
