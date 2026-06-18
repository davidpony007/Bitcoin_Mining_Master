'use strict';

const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

function markerForContract(contractId) {
  return `[REFUND_DEDUCT][contract:${contractId}]`;
}

async function reclaimForOriginalTransactionId(originalTransactionId, source = 'refund_event') {
  if (!originalTransactionId) {
    return { success: false, message: 'originalTransactionId 不能为空' };
  }

  const tx = await sequelize.transaction();
  try {
    const contracts = await sequelize.query(
      `SELECT id, user_id, contract_creation_time, contract_end_time, cancelled_at, is_cancelled
       FROM mining_contracts
       WHERE contract_type = 'paid contract'
         AND original_transaction_id = ?
       ORDER BY id ASC`,
      { replacements: [originalTransactionId], type: QueryTypes.SELECT, transaction: tx }
    );

    if (!contracts.length) {
      await tx.commit();
      return { success: true, message: '未找到需要处理的退款合约', contractCount: 0 };
    }

    await sequelize.query(
      `UPDATE mining_contracts
       SET is_cancelled = 1,
           cancelled_at = COALESCE(cancelled_at, NOW()),
           contract_end_time = CASE
             WHEN contract_end_time IS NULL OR contract_end_time > NOW() THEN NOW()
             ELSE contract_end_time
           END
       WHERE contract_type = 'paid contract'
         AND original_transaction_id = ?`,
      { replacements: [originalTransactionId], type: QueryTypes.UPDATE, transaction: tx }
    );

    let deductedBtcTotal = 0;
    let deductedPointsTotal = 0;

    for (const c of contracts) {
      const marker = markerForContract(c.id);

      const [btcEarnedRow] = await sequelize.query(
        `SELECT COALESCE(SUM(transaction_amount), 0) AS earned
         FROM bitcoin_transaction_records
         WHERE user_id = ?
           AND transaction_type = 'mining_reward'
           AND transaction_amount > 0
           AND transaction_creation_time >= ?
           AND transaction_creation_time <= COALESCE(?, NOW())`,
        {
          replacements: [
            c.user_id,
            c.contract_creation_time,
            c.cancelled_at || c.contract_end_time,
          ],
          type: QueryTypes.SELECT,
          transaction: tx,
        }
      );

      const [btcDeductedRow] = await sequelize.query(
        `SELECT COALESCE(ABS(SUM(transaction_amount)), 0) AS deducted
         FROM bitcoin_transaction_records
         WHERE user_id = ?
           AND transaction_type = 'admin_deduct'
           AND description LIKE ?`,
        {
          replacements: [c.user_id, `%${marker}%`],
          type: QueryTypes.SELECT,
          transaction: tx,
        }
      );

      const earned = parseFloat(btcEarnedRow?.earned || 0);
      const alreadyDeducted = parseFloat(btcDeductedRow?.deducted || 0);
      const btcNet = parseFloat(Math.max(0, earned - alreadyDeducted).toFixed(18));

      if (btcNet > 0) {
        const [balRow] = await sequelize.query(
          `SELECT current_bitcoin_balance
           FROM user_status
           WHERE user_id = ?
           LIMIT 1`,
          { replacements: [c.user_id], type: QueryTypes.SELECT, transaction: tx }
        );

        if (balRow) {
          const currentBalance = parseFloat(balRow.current_bitcoin_balance || 0);
          const newBalance = Math.max(0, currentBalance - btcNet);

          await sequelize.query(
            `INSERT INTO bitcoin_transaction_records
               (user_id, transaction_type, transaction_amount, transaction_status, balance_after, description)
             VALUES (?, 'admin_deduct', ?, 'success', ?, ?)`,
            {
              replacements: [
                c.user_id,
                -btcNet,
                newBalance,
                `退款合约自动追回BTC ${marker}[source:${source}][tx:${originalTransactionId}]`,
              ],
              type: QueryTypes.INSERT,
              transaction: tx,
            }
          );

          await sequelize.query(
            `UPDATE user_status
             SET current_bitcoin_balance   = GREATEST(0, current_bitcoin_balance - ?),
                 bitcoin_accumulated_amount = GREATEST(0, bitcoin_accumulated_amount - ?),
                 last_balance_update_time   = NOW()
             WHERE user_id = ?`,
            {
              replacements: [btcNet, btcNet, c.user_id],
              type: QueryTypes.UPDATE,
              transaction: tx,
            }
          );

          deductedBtcTotal += btcNet;
        }
      }

      const [subscribePtsRow] = await sequelize.query(
        `SELECT COALESCE(SUM(points_change), 0) AS pts
         FROM points_transaction
         WHERE user_id = ?
           AND points_type LIKE 'SUBSCRIBE%'
           AND ABS(TIMESTAMPDIFF(MINUTE, created_at, ?)) <= 60`,
        {
          replacements: [c.user_id, c.contract_creation_time],
          type: QueryTypes.SELECT,
          transaction: tx,
        }
      );

      const [pointsDeductedRow] = await sequelize.query(
        `SELECT COALESCE(ABS(SUM(points_change)), 0) AS deducted
         FROM points_transaction
         WHERE user_id = ?
           AND points_type = 'MANUAL_DEDUCT'
           AND description LIKE ?`,
        {
          replacements: [c.user_id, `%${marker}%`],
          type: QueryTypes.SELECT,
          transaction: tx,
        }
      );

      const subPoints = parseInt(subscribePtsRow?.pts || 0, 10);
      const pointsAlreadyDeducted = parseInt(pointsDeductedRow?.deducted || 0, 10);
      const pointsNet = Math.max(0, subPoints - pointsAlreadyDeducted);

      if (pointsNet > 0) {
        const [ptRow] = await sequelize.query(
          `SELECT available_points
           FROM user_points
           WHERE user_id = ?
           LIMIT 1`,
          { replacements: [c.user_id], type: QueryTypes.SELECT, transaction: tx }
        );

        if (ptRow) {
          const availablePoints = parseInt(ptRow.available_points || 0, 10);
          const newPoints = Math.max(0, availablePoints - pointsNet);

          await sequelize.query(
            `INSERT INTO points_transaction
               (user_id, points_change, points_type, balance_after, description)
             VALUES (?, ?, 'MANUAL_DEDUCT', ?, ?)`,
            {
              replacements: [
                c.user_id,
                -pointsNet,
                newPoints,
                `退款合约自动追回积分 ${marker}[source:${source}][tx:${originalTransactionId}]`,
              ],
              type: QueryTypes.INSERT,
              transaction: tx,
            }
          );

          await sequelize.query(
            `UPDATE user_points
             SET available_points = GREATEST(0, available_points - ?),
                 total_points     = GREATEST(0, total_points - ?)
             WHERE user_id = ?`,
            {
              replacements: [pointsNet, pointsNet, c.user_id],
              type: QueryTypes.UPDATE,
              transaction: tx,
            }
          );

          deductedPointsTotal += pointsNet;
        }
      }
    }

    await tx.commit();
    return {
      success: true,
      contractCount: contracts.length,
      deductedBtcTotal,
      deductedPointsTotal,
    };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

module.exports = {
  reclaimForOriginalTransactionId,
};
