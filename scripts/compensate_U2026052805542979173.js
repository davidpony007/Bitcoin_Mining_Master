'use strict';

/**
 * 补发脚本: 为手动修复的付费合约补发 BTC 挖矿收益和订阅积分
 *
 * 适用用户: U2026052805542979173
 * 产品: p0499 ($4.99) + p1999 ($19.99)
 *
 * BTC 补发逻辑:
 *   付费合约不使用国家系数，revenue = hashrate(BTC/s) × seconds
 *   补发时间段: user_creation_time → contract_creation_time (合约本应在购买时就创建)
 *
 * 积分补发:
 *   首次订阅每档位 +20 分 (SubscriptionPointsService 已幂等)
 *
 * 执行方式:
 *   docker cp compensate_U2026052805542979173.js bitcoin_backend_prod:/tmp/
 *   docker exec bitcoin_backend_prod node /tmp/compensate_U2026052805542979173.js
 */

const pool = require('/app/src/config/database_native');
const SubscriptionPointsService = require('/app/src/services/subscriptionPointsService');

const USER_ID = 'U2026052805542979173';

// 用户注册时间（视为购买时间下限）
const PURCHASE_TIME = new Date('2026-05-28T05:54:29.000Z');

// 手动补建的合约（与 fix 脚本一致）
const CONTRACTS = [
  { product_id: 'p0499', hashrate: 0.000000000004456 },
  { product_id: 'p1999', hashrate: 0.000000000033522 },
];

(async () => {
  console.log(`\n=== 补发 BTC 和积分: ${USER_ID} ===\n`);

  // ── 1. 查询合约实际创建时间 ────────────────────────────────────────
  const [[c0499]] = await pool.query(
    `SELECT contract_creation_time FROM mining_contracts
     WHERE user_id = ? AND product_id = 'p0499' AND contract_type = 'paid contract'
     ORDER BY id DESC LIMIT 1`,
    [USER_ID]
  );
  const [[c1999]] = await pool.query(
    `SELECT contract_creation_time FROM mining_contracts
     WHERE user_id = ? AND product_id = 'p1999' AND contract_type = 'paid contract'
     ORDER BY id DESC LIMIT 1`,
    [USER_ID]
  );

  if (!c0499 || !c1999) {
    console.error('❌ 未找到已创建的合约，请先运行 fix 脚本');
    process.exit(1);
  }

  // ── 2. 计算并补发 BTC ─────────────────────────────────────────────
  let totalBtc = 0;

  for (const { product_id, hashrate } of CONTRACTS) {
    const contractCreatedAt = product_id === 'p0499'
      ? new Date(c0499.contract_creation_time)
      : new Date(c1999.contract_creation_time);

    const seconds = Math.floor((contractCreatedAt - PURCHASE_TIME) / 1000);
    if (seconds <= 0) {
      console.log(`  ⚠️ ${product_id}: 无需补发（合约创建时间 <= 购买时间）`);
      continue;
    }

    const btc = hashrate * seconds;
    totalBtc += btc;

    console.log(`  ${product_id}: ${hashrate} BTC/s × ${seconds}s = ${btc.toFixed(18)} BTC`);
  }

  console.log(`\n  合计补发 BTC: ${totalBtc.toFixed(18)}`);

  if (totalBtc > 0) {
    // 更新余额
    await pool.query(
      `UPDATE user_status
       SET current_bitcoin_balance = current_bitcoin_balance + ?,
           bitcoin_accumulated_amount = bitcoin_accumulated_amount + ?,
           last_balance_update_time = NOW()
       WHERE user_id = ?`,
      [totalBtc, totalBtc, USER_ID]
    );

    // 查更新后余额
    const [[bal]] = await pool.query(
      'SELECT current_bitcoin_balance FROM user_status WHERE user_id = ?',
      [USER_ID]
    );
    const balanceAfter = bal ? parseFloat(bal.current_bitcoin_balance) : null;

    // 写入交易记录
    await pool.query(
      `INSERT INTO bitcoin_transaction_records
         (user_id, transaction_type, transaction_amount, balance_after,
          transaction_status, description, transaction_creation_time)
       VALUES (?, 'mining_reward', ?, ?, 'success', ?, NOW())`,
      [USER_ID, totalBtc, balanceAfter,
       `手动补发: 付费合约漏发挖矿收益补偿 (${PURCHASE_TIME.toISOString().slice(0,10)} 至合约创建)`]
    );

    console.log(`  ✅ BTC 补发成功, 当前余额: ${balanceAfter} BTC`);
  }

  // ── 3. 补发订阅积分 ───────────────────────────────────────────────
  console.log('\n--- 补发订阅积分 ---');
  let totalPts = 0;
  for (const { product_id } of CONTRACTS) {
    const result = await SubscriptionPointsService.awardSubscriptionPoints(USER_ID, product_id);
    if (result.awarded) {
      console.log(`  ✅ ${product_id}: +${result.pointsAwarded} 积分`);
      totalPts += result.pointsAwarded;
    } else {
      console.log(`  ⚠️ ${product_id}: 积分已发放过，跳过 (${result.reason || '已存在'})`);
    }
  }
  console.log(`  合计补发积分: ${totalPts}`);

  // ── 4. 验证结果 ────────────────────────────────────────────────────
  console.log('\n--- 验证 ---');
  const [[finalStatus]] = await pool.query(
    'SELECT current_bitcoin_balance, bitcoin_accumulated_amount FROM user_status WHERE user_id = ?',
    [USER_ID]
  );
  const [[finalPts]] = await pool.query(
    'SELECT user_points FROM user_information WHERE user_id = ?',
    [USER_ID]
  );
  console.log(`  BTC 余额: ${finalStatus?.current_bitcoin_balance}`);
  console.log(`  用户积分: ${finalPts?.user_points}`);

  console.log('\n=== 补发完成 ===\n');
  process.exit(0);
})().catch(e => {
  console.error('❌ 补发失败:', e.message);
  process.exit(1);
});
