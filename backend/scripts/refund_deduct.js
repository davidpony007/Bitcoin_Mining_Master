/**
 * 退款合约追溯扣除脚本
 * 对所有 order_status='refund successful' 的订单，扣除其合约期间挖矿产出的 BTC 和订阅积分
 *
 * 用法：
 *   DRY_RUN=true  node scripts/refund_deduct.js   ← 仅打印不执行
 *   DRY_RUN=false node scripts/refund_deduct.js   ← 真实执行
 */

const DRY_RUN = process.env.DRY_RUN !== 'false';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Sequelize, QueryTypes } = require('sequelize');
const sequelize = require('../src/config/database');

async function run() {
  console.log(`\n========================================`);
  console.log(`退款合约追溯扣除脚本 [${DRY_RUN ? 'DRY RUN' : '*** 真实执行 ***'}]`);
  console.log(`========================================\n`);

  const t = DRY_RUN ? null : await sequelize.transaction();
  try {
    // ─── 1. 查出所有退款合约及其挖矿收益 ─────────────────────────
    const contracts = await sequelize.query(`
      SELECT
        mc.id          AS contract_id,
        mc.user_id,
        mc.product_id,
        mc.platform,
        mc.contract_creation_time,
        COALESCE(mc.cancelled_at, mc.contract_end_time, NOW()) AS period_end,
        ROUND(COALESCE((
          SELECT SUM(btr.transaction_amount)
          FROM bitcoin_transaction_records btr
          WHERE btr.user_id = mc.user_id
            AND btr.transaction_type = 'mining_reward'
            AND btr.transaction_amount > 0
            AND btr.transaction_creation_time >= mc.contract_creation_time
            AND btr.transaction_creation_time <= COALESCE(mc.cancelled_at, mc.contract_end_time, NOW())
        ), 0), 18) AS btc_earned
      FROM user_orders o
      INNER JOIN mining_contracts mc
        ON (mc.original_transaction_id = o.payment_network_id
            OR mc.original_transaction_id = o.payment_gateway_id)
        AND mc.user_id = o.user_id
        AND mc.contract_type = 'paid contract'
        AND mc.is_cancelled = 1
      WHERE o.order_status = 'refund successful'
      GROUP BY mc.id, mc.user_id, mc.product_id, mc.platform,
               mc.contract_creation_time, period_end
      ORDER BY mc.user_id, mc.contract_creation_time
    `, { type: QueryTypes.SELECT, transaction: t });

    console.log(`找到 ${contracts.length} 条退款合约\n`);

    // ─── 2. 查出退款合约对应的订阅积分（创建时间 ±60 分钟内） ──────
    const subPoints = await sequelize.query(`
      SELECT
        pt.id         AS pt_id,
        pt.user_id,
        pt.points_change,
        pt.points_type,
        pt.created_at,
        mc.id         AS contract_id
      FROM points_transaction pt
      INNER JOIN (
        SELECT DISTINCT mc.id, mc.user_id, mc.contract_creation_time
        FROM user_orders o
        INNER JOIN mining_contracts mc
          ON (mc.original_transaction_id = o.payment_network_id
              OR mc.original_transaction_id = o.payment_gateway_id)
          AND mc.user_id = o.user_id
          AND mc.contract_type = 'paid contract'
          AND mc.is_cancelled = 1
        WHERE o.order_status = 'refund successful'
      ) mc ON mc.user_id COLLATE utf8mb4_unicode_ci = pt.user_id COLLATE utf8mb4_unicode_ci
           AND ABS(TIMESTAMPDIFF(MINUTE, pt.created_at, mc.contract_creation_time)) <= 60
      WHERE pt.points_type LIKE 'SUBSCRIBE%'
      ORDER BY pt.user_id, pt.created_at
    `, { type: QueryTypes.SELECT, transaction: t });

    console.log(`找到 ${subPoints.length} 条匹配的订阅积分记录\n`);

    // ─── 3. 按用户聚合 BTC，扣除已有的 admin_deduct ───────────────
    const btcByUser = {};
    for (const c of contracts) {
      const earned = parseFloat(c.btc_earned);
      if (earned > 0) {
        btcByUser[c.user_id] = (btcByUser[c.user_id] || 0) + earned;
        console.log(`  [BTC] user=${c.user_id}  contract=${c.contract_id}  earned=${earned.toFixed(8)}`);
      }
    }

    // 查出所有用户已有的 admin_deduct 总额（避免重复扣除）
    // 不在 SQL 里传数组参数（Sequelize IN(:arr) 有兼容性问题），JS 端过滤
    const allAdminDeductRows = await sequelize.query(`
      SELECT user_id, ROUND(ABS(SUM(transaction_amount)), 18) AS already_deducted
      FROM bitcoin_transaction_records
      WHERE transaction_type = 'admin_deduct'
      GROUP BY user_id
    `, { type: QueryTypes.SELECT, transaction: t });
    const alreadyDeducted = {};
    for (const r of allAdminDeductRows) {
      alreadyDeducted[r.user_id] = parseFloat(r.already_deducted);
    }
    console.log(`\n已有 admin_deduct 记录:`, JSON.stringify(alreadyDeducted));

    // ─── 4. 按用户聚合积分 ────────────────────────────────────────
    const ptsByUser = {};
    for (const p of subPoints) {
      ptsByUser[p.user_id] = (ptsByUser[p.user_id] || 0) + parseInt(p.points_change);
      console.log(`  [PTS] user=${p.user_id}  type=${p.points_type}  points=${p.points_change}`);
    }

    console.log(`\n─── 扣除汇总 ─────────────────────────────────────────────`);
    const allUsers = new Set([...Object.keys(btcByUser), ...Object.keys(ptsByUser)]);
    for (const uid of allUsers) {
      const earned = btcByUser[uid] || 0;
      const prev   = alreadyDeducted[uid] || 0;
      const net    = Math.max(0, earned - prev);
      const pts    = ptsByUser[uid] || 0;
      console.log(`  ${uid}  BTC earned=${earned.toFixed(8)}  already=${prev.toFixed(8)}  net=-${net.toFixed(8)}  Points -${pts}`);
    }

    if (DRY_RUN) {
      console.log(`\n[DRY RUN] 以上为预览，未做任何修改。`);
      console.log(`执行真实扣除请运行: DRY_RUN=false node scripts/refund_deduct.js\n`);
      return;
    }

    // ─── 5. 真实执行 BTC 扣除 ─────────────────────────────────────
    for (const [userId, totalBtc] of Object.entries(btcByUser)) {
      const prev  = alreadyDeducted[userId] || 0;
      const netBtc = parseFloat((totalBtc - prev).toFixed(18));
      if (netBtc <= 0) {
        console.log(`  ⏭️  BTC skip (already fully deducted): user=${userId}  prev=${prev.toFixed(8)}`);
        continue;
      }
      const [balRow] = await sequelize.query(
        'SELECT current_bitcoin_balance FROM user_status WHERE user_id = ?',
        { replacements: [userId], type: QueryTypes.SELECT, transaction: t }
      );
      if (!balRow) { console.warn(`  ⚠️  未找到 user_status: ${userId}`); continue; }

      const newBal = Math.max(0, parseFloat(balRow.current_bitcoin_balance) - netBtc);

      await sequelize.query(
        `INSERT INTO bitcoin_transaction_records
           (user_id, transaction_type, transaction_amount, transaction_status, balance_after, description)
         VALUES (?, 'admin_deduct', ?, 'success', ?, '退款合约追溯扣除挖矿收益')`,
        { replacements: [userId, -netBtc, newBal], type: QueryTypes.INSERT, transaction: t }
      );

      await sequelize.query(
        `UPDATE user_status
         SET current_bitcoin_balance  = GREATEST(0, current_bitcoin_balance  - ?),
             bitcoin_accumulated_amount= GREATEST(0, bitcoin_accumulated_amount- ?),
             last_balance_update_time = NOW()
         WHERE user_id = ?`,
        { replacements: [netBtc, netBtc, userId], type: QueryTypes.UPDATE, transaction: t }
      );

      console.log(`  ✅ BTC deducted: user=${userId}  net=-${netBtc.toFixed(8)}  new_balance=${newBal.toFixed(8)}`);
    }

    // ─── 6. 真实执行积分扣除 ──────────────────────────────────────
    for (const [userId, totalPts] of Object.entries(ptsByUser)) {
      const [ptRow] = await sequelize.query(
        'SELECT available_points FROM user_points WHERE user_id = ?',
        { replacements: [userId], type: QueryTypes.SELECT, transaction: t }
      );
      if (!ptRow) { console.warn(`  ⚠️  未找到 user_points: ${userId}`); continue; }

      const newPts = Math.max(0, ptRow.available_points - totalPts);

      await sequelize.query(
        `INSERT INTO points_transaction
           (user_id, points_change, points_type, balance_after, description)
         VALUES (?, ?, 'MANUAL_DEDUCT', ?, '退款合约追溯扣除订阅积分')`,
        { replacements: [userId, -totalPts, newPts], type: QueryTypes.INSERT, transaction: t }
      );

      await sequelize.query(
        `UPDATE user_points
         SET available_points = GREATEST(0, available_points - ?),
             total_points      = GREATEST(0, total_points      - ?)
         WHERE user_id = ?`,
        { replacements: [totalPts, totalPts, userId], type: QueryTypes.UPDATE, transaction: t }
      );

      console.log(`  ✅ Points deducted: user=${userId}  -${totalPts}  new_balance=${newPts}`);
    }

    await t.commit();
    console.log(`\n✅ 全部扣除完成，事务已提交。\n`);

  } catch (err) {
    if (t) await t.rollback();
    console.error(`\n❌ 执行失败，事务已回滚:`, err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
