/**
 * 简化测试：直接在服务器上执行
 * 测试余额同步和返利系统
 */

const mysql = require('mysql2/promise');

async function testOnServer() {
  let connection;
  
  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'fe2c82a2e5b8e2a3',
      database: 'bitcoin_mining_master',
      timezone: '+00:00'
    });

    console.log('✓ 数据库连接成功\n');

    // 1. 查询活跃合约用户
    const [activeUsers] = await connection.query(`
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
      LIMIT 5
    `);

    console.log(`找到 ${activeUsers.length} 个有活跃合约的用户`);
    activeUsers.forEach(u => console.log(`  用户ID: ${u.user_id}`));
    console.log('');

    // 2. 查询用户余额和更新时间
    if (activeUsers.length > 0) {
      console.log('--- 用户余额信息 ---');
      for (const user of activeUsers) {
        const [balanceInfo] = await connection.query(`
          SELECT 
            us.bitcoin_balance,
            us.last_balance_update_time,
            TIMESTAMPDIFF(SECOND, us.last_balance_update_time, NOW()) as seconds_since_update
          FROM user_status us
          WHERE us.user_id = ?
        `, [user.user_id]);

        if (balanceInfo.length > 0) {
          const info = balanceInfo[0];
          console.log(`用户 ${user.user_id}:`);
          console.log(`  当前余额: ${parseFloat(info.bitcoin_balance).toFixed(16)} BTC`);
          console.log(`  上次更新: ${info.last_balance_update_time}`);
          console.log(`  距上次更新: ${info.seconds_since_update} 秒\n`);
        }
      }
    }

    // 3. 查询邀请关系
    const [referrers] = await connection.query(`
      SELECT 
        referrer_user_id,
        COUNT(*) as subordinate_count
      FROM invitation_relationship
      WHERE referrer_user_id IS NOT NULL
      GROUP BY referrer_user_id
      LIMIT 5
    `);

    console.log(`--- 邀请关系统计 ---`);
    console.log(`找到 ${referrers.length} 个有下级的用户`);
    
    for (const ref of referrers) {
      // 查询下级的广告合约数
      const [adContracts] = await connection.query(`
        SELECT COUNT(*) as ad_count
        FROM free_contract_records fcr
        JOIN invitation_relationship ir ON fcr.user_id = ir.invited_user_id
        WHERE ir.referrer_user_id = ?
          AND fcr.free_contract_type = 'ad free contract'
          AND fcr.mining_status = 'active'
          AND fcr.free_contract_end_time > NOW()
      `, [ref.referrer_user_id]);

      console.log(`推荐人 ${ref.referrer_user_id}:`);
      console.log(`  下级总数: ${ref.subordinate_count}`);
      console.log(`  下级活跃广告合约: ${adContracts[0].ad_count}\n`);
    }

    // 4. 查询最近的交易记录
    const [recentTx] = await connection.query(`
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

    console.log(`--- 最近交易记录 (${recentTx.length}条) ---`);
    recentTx.forEach(tx => {
      console.log(`用户 ${tx.user_id} | ${tx.transaction_type} | ${parseFloat(tx.amount).toFixed(16)} BTC | ${tx.created_at}`);
    });
    console.log('');

    // 5. 系统统计
    const [stats] = await connection.query(`
      SELECT 
        (SELECT COUNT(*) FROM free_contract_records WHERE mining_status = 'active') as active_free,
        (SELECT COUNT(*) FROM mining_contracts WHERE contract_status = 'active') as active_paid,
        (SELECT COUNT(DISTINCT user_id) FROM user_status WHERE bitcoin_balance > 0) as users_with_balance,
        (SELECT COUNT(*) FROM bitcoin_transaction_records WHERE transaction_type = 'mining_reward' AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)) as mining_24h,
        (SELECT COUNT(*) FROM bitcoin_transaction_records WHERE transaction_type = 'referral_rebate' AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)) as rebate_24h
    `);

    console.log('--- 系统统计 ---');
    console.log(`活跃免费合约: ${stats[0].active_free}`);
    console.log(`活跃付费合约: ${stats[0].active_paid}`);
    console.log(`有余额的用户: ${stats[0].users_with_balance}`);
    console.log(`24小时挖矿奖励: ${stats[0].mining_24h} 笔`);
    console.log(`24小时推荐返利: ${stats[0].rebate_24h} 笔\n`);

    console.log('测试完成！');

  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testOnServer();
