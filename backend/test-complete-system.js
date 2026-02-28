/**
 * 完整系统功能测试
 * 测试余额同步、推荐返利、实时余额API的完整流程
 */

require('dotenv').config();
const pool = require('./src/config/database_native');
const BalanceSyncTask = require('./src/jobs/balanceSyncTask');
const ReferralRebateTask = require('./src/jobs/referralRebateTask');
const RealtimeBalanceService = require('./src/services/realtimeBalanceService');
const redisClient = require('./src/config/redis');

async function testCompleteSystem() {
  console.log('\n========== 完整系统功能测试 ==========\n');

  try {
    // 1. 连接Redis
    await redisClient.connect();
    console.log('✓ Redis连接成功\n');

    // 2. 查询有活跃合约的用户
    const [activeUsers] = await pool.query(`
      SELECT DISTINCT user_id
      FROM (
        SELECT user_id FROM free_contract_records 
        WHERE mining_status = 'active' 
          AND free_contract_end_time > NOW()
        UNION
        SELECT user_id FROM mining_contracts 
        WHERE contract_status = 'active' 
          AND contract_end_time > NOW()
      ) AS active_users
      LIMIT 3
    `);

    if (activeUsers.length === 0) {
      console.log('⚠️  当前没有活跃合约的用户，请先创建测试合约');
      return;
    }

    console.log(`找到 ${activeUsers.length} 个有活跃合约的用户\n`);

    // 3. 测试实时余额服务
    console.log('--- 测试实时余额服务 ---');
    for (const user of activeUsers) {
      try {
        const balanceData = await RealtimeBalanceService.getUserBalance(user.user_id);
        console.log(`用户 ${user.user_id}:`);
        console.log(`  当前余额: ${balanceData.balance.toFixed(16)} BTC`);
        console.log(`  挖矿速率: ${balanceData.speedPerSecond.toFixed(16)} BTC/秒`);
        console.log(`  上次更新: ${balanceData.lastUpdateTime.toISOString()}`);
        console.log(`  增量收益: ${balanceData.incrementalRevenue.toFixed(16)} BTC`);
        console.log(`  下次同步: ${Math.floor(balanceData.nextSyncIn / 60)} 分钟后\n`);
      } catch (error) {
        console.error(`  ❌ 获取用户 ${user.user_id} 余额失败:`, error.message);
      }
    }

    // 4. 测试挖矿速率缓存
    console.log('\n--- 测试Redis缓存 ---');
    const testUserId = activeUsers[0].user_id;
    
    // 清除缓存
    await redisClient.deleteMiningSpeed(testUserId);
    console.log(`✓ 清除用户 ${testUserId} 的缓存`);

    // 第一次查询（应该从数据库计算）
    const start1 = Date.now();
    const speed1 = await RealtimeBalanceService.calculateUserPerSecondRevenue(testUserId, true);
    const time1 = Date.now() - start1;
    console.log(`✓ 第一次查询耗时: ${time1}ms (从数据库计算)`);

    // 第二次查询（应该从缓存读取）
    const start2 = Date.now();
    const speed2 = await RealtimeBalanceService.calculateUserPerSecondRevenue(testUserId, true);
    const time2 = Date.now() - start2;
    console.log(`✓ 第二次查询耗时: ${time2}ms (从缓存读取)`);
    console.log(`✓ 速率一致性: ${speed1 === speed2 ? '通过' : '失败'}\n`);

    // 5. 测试余额同步任务（手动触发）
    console.log('\n--- 测试余额同步任务 ---');
    console.log('手动触发余额同步...');
    await BalanceSyncTask.triggerManually();
    console.log('✓ 余额同步任务执行完成\n');

    // 6. 查询邀请关系
    const [referrers] = await pool.query(`
      SELECT DISTINCT referrer_user_id, COUNT(*) as subordinate_count
      FROM invitation_relationship
      WHERE referrer_user_id IS NOT NULL
      GROUP BY referrer_user_id
      LIMIT 3
    `);

    if (referrers.length > 0) {
      console.log('\n--- 测试推荐返利任务 ---');
      console.log(`找到 ${referrers.length} 个有下级的用户\n`);
      
      for (const referrer of referrers) {
        console.log(`推荐人 ${referrer.referrer_user_id}:`);
        console.log(`  下级数量: ${referrer.subordinate_count}`);
        
        // 查询下级的广告合约
        const [adContracts] = await pool.query(`
          SELECT COUNT(*) as ad_contract_count
          FROM free_contract_records fcr
          JOIN invitation_relationship ir ON fcr.user_id = ir.invited_user_id
          WHERE ir.referrer_user_id = ?
            AND fcr.free_contract_type = 'ad free contract'
            AND fcr.mining_status = 'active'
            AND fcr.free_contract_end_time > NOW()
        `, [referrer.referrer_user_id]);
        
        console.log(`  下级活跃广告合约: ${adContracts[0].ad_contract_count}`);
      }

      console.log('\n手动触发推荐返利任务...');
      await ReferralRebateTask.triggerManually();
      console.log('✓ 推荐返利任务执行完成\n');
    } else {
      console.log('⚠️  当前没有邀请关系，跳过返利测试\n');
    }

    // 7. 查询最近的交易记录
    console.log('\n--- 查询最近的交易记录 ---');
    const [transactions] = await pool.query(`
      SELECT 
        user_id,
        transaction_type,
        amount,
        created_at,
        description
      FROM bitcoin_transaction_records
      WHERE transaction_type IN ('mining_reward', 'referral_rebate')
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (transactions.length > 0) {
      console.log(`最近 ${transactions.length} 条交易:\n`);
      transactions.forEach(tx => {
        console.log(`用户 ${tx.user_id}:`);
        console.log(`  类型: ${tx.transaction_type}`);
        console.log(`  金额: ${parseFloat(tx.amount).toFixed(16)} BTC`);
        console.log(`  时间: ${tx.created_at}`);
        console.log(`  说明: ${tx.description}\n`);
      });
    } else {
      console.log('暂无交易记录\n');
    }

    // 8. 统计信息
    console.log('\n--- 系统统计信息 ---');
    
    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM free_contract_records WHERE mining_status = 'active') as active_free_contracts,
        (SELECT COUNT(*) FROM mining_contracts WHERE contract_status = 'active') as active_paid_contracts,
        (SELECT COUNT(DISTINCT user_id) FROM user_status WHERE bitcoin_balance > 0) as users_with_balance,
        (SELECT COUNT(*) FROM bitcoin_transaction_records WHERE transaction_type = 'mining_reward' AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)) as mining_rewards_24h,
        (SELECT COUNT(*) FROM bitcoin_transaction_records WHERE transaction_type = 'referral_rebate' AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)) as referral_rebates_24h
    `);

    console.log(`活跃免费合约: ${stats[0].active_free_contracts}`);
    console.log(`活跃付费合约: ${stats[0].active_paid_contracts}`);
    console.log(`有余额的用户: ${stats[0].users_with_balance}`);
    console.log(`24小时挖矿奖励: ${stats[0].mining_rewards_24h} 笔`);
    console.log(`24小时推荐返利: ${stats[0].referral_rebates_24h} 笔\n`);

    console.log('========== 测试完成 ==========\n');

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    // 断开连接
    await redisClient.disconnect();
    await pool.end();
  }
}

// 运行测试
testCompleteSystem();
