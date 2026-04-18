// bitcoinTransactionRoutes.js
// 比特币交易记录路由
const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const auth = require('../middleware/auth');

/**
 * GET /api/bitcoin-transactions/records
 * 获取用户的比特币交易记录
 * 
 * Query参数:
 * - userId: 用户ID(必需)
 * - type: 交易类型筛选(可选): all, mining, withdrawal, rebate等
 * - limit: 每页记录数(默认20, 最大100)
 * - offset: 偏移量(默认0)
 */
router.get('/records', async (req, res) => {
  try {
    const { userId, type = 'all', limit = 20, offset = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId parameter'
      });
    }

    // 验证limit参数
    const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);

    const replacements = { userId, limit: safeLimit, offset: safeOffset };

    // 主查询 SQL：bitcoin_transaction_records（不限时间，全量分页）
    let btrWhere = 'WHERE btr.user_id = :userId';
    if (type !== 'all') {
      btrWhere += ' AND btr.transaction_type = :type';
      replacements.type = type;
    }

    // 是否需要包含 withdrawal_records 中的存量旧数据（只在 withdrawal_records、不在 bitcoin_transaction_records 的记录）
    const includeWithdrawal = (type === 'all' || type === 'withdrawal');

    // UNION 补充 withdrawal_records 中不存在于 bitcoin_transaction_records 的记录
    // 用 wr.id 做唯一标识（负数避免与主表 id 碰撞），只在 records 查询中 SELECT 完整列
    const unionRecordsPart = includeWithdrawal ? `
      UNION ALL
      SELECT
        (0 - wr.id)                                           AS id,
        wr.user_id,
        'withdrawal'                                          AS transaction_type,
        wr.withdrawal_request_amount                          AS transaction_amount,
        NULL                                                  AS balance_after,
        CASE
          WHEN wr.wallet_address REGEXP '^[0-9]{6,12}$'
            THEN CONCAT('Withdrawal to Binance UID: ', wr.wallet_address)
          ELSE CONCAT('Withdrawal to ', SUBSTRING(wr.wallet_address,1,10), '...',
               SUBSTRING(wr.wallet_address, LENGTH(wr.wallet_address)-6))
        END                                                   AS description,
        wr.created_at                                         AS transaction_creation_time,
        wr.withdrawal_status                                  AS transaction_status
      FROM withdrawal_records wr
      WHERE wr.user_id = :userId
        AND NOT EXISTS (
          SELECT 1 FROM bitcoin_transaction_records btr2
          WHERE btr2.user_id = wr.user_id
            AND btr2.transaction_type = 'withdrawal'
            AND btr2.transaction_creation_time = wr.created_at
        )` : '';

    // count 查询使用相同逻辑，但两侧均只 SELECT id（列数一致，避免 MySQL UNION 列数不匹配报错）
    const unionCountPart = includeWithdrawal ? `
      UNION ALL
      SELECT (0 - wr.id) AS id
      FROM withdrawal_records wr
      WHERE wr.user_id = :userId
        AND NOT EXISTS (
          SELECT 1 FROM bitcoin_transaction_records btr2
          WHERE btr2.user_id = wr.user_id
            AND btr2.transaction_type = 'withdrawal'
            AND btr2.transaction_creation_time = wr.created_at
        )` : '';

    // 查询交易记录
    const records = await sequelize.query(
      `SELECT id, user_id, transaction_type, transaction_amount, balance_after,
              description, transaction_creation_time, transaction_status
       FROM bitcoin_transaction_records btr
       ${btrWhere}
       ${unionRecordsPart}
       ORDER BY transaction_creation_time DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    );

    // 查询总记录数（两侧 SELECT 均只取 id，列数一致，含3天限制）
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM (
        SELECT id FROM bitcoin_transaction_records btr
        ${btrWhere}
        ${unionCountPart}
      ) AS combined`,
      {
        replacements: { ...replacements },
        type: QueryTypes.SELECT
      }
    );

    // 格式化返回数据
    const formattedRecords = records.map(record => ({
      id: record.id,
      userId: record.user_id,
      type: record.transaction_type,
      amount: parseFloat(record.transaction_amount),
      balanceAfter: record.balance_after != null ? parseFloat(record.balance_after) : null,
      description: record.description || null,
      createdAt: record.transaction_creation_time,
      status: record.transaction_status,
      // 添加类型描述
      typeLabel: getTypeLabel(record.transaction_type)
    }));

    res.json({
      success: true,
      data: {
        records: formattedRecords,
        pagination: {
          total: countResult.total,
          limit: safeLimit,
          offset: safeOffset,
          hasMore: safeOffset + safeLimit < countResult.total
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching bitcoin transaction records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction records',
      message: error.message
    });
  }
});

/**
 * GET /api/bitcoin-transactions/summary
 * 获取用户交易统计摘要
 */
router.get('/summary', auth, async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId parameter'
      });
    }

    // 查询各类型交易统计
    const [summary] = await sequelize.query(
      `SELECT 
        COUNT(*) as totalCount,
        SUM(CASE WHEN transaction_type IN ('Free Ad Reward', 'Daily Check-in Reward', 'Invite Friend Reward', 'Bind Referrer Reward', 'contract_4.99', 'contract_6.99', 'contract_9.99', 'contract_19.99') THEN transaction_amount ELSE 0 END) as totalMiningReward,
        SUM(CASE WHEN transaction_type = 'subordinate rebate' THEN transaction_amount ELSE 0 END) as totalRebate,
        SUM(CASE WHEN transaction_type = 'withdrawal' AND transaction_status = 'success' THEN transaction_amount ELSE 0 END) as totalWithdrawal,
        COUNT(CASE WHEN transaction_type IN ('Free Ad Reward', 'Daily Check-in Reward', 'Invite Friend Reward', 'Bind Referrer Reward', 'contract_4.99', 'contract_6.99', 'contract_9.99', 'contract_19.99') THEN 1 END) as miningCount,
        COUNT(CASE WHEN transaction_type = 'subordinate rebate' THEN 1 END) as rebateCount,
        COUNT(CASE WHEN transaction_type = 'withdrawal' AND transaction_status = 'success' THEN 1 END) as withdrawalCount
       FROM bitcoin_transaction_records
       WHERE user_id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT
      }
    );

    res.json({
      success: true,
      data: {
        totalCount: summary.totalCount || 0,
        totalMiningReward: parseFloat(summary.totalMiningReward) || 0,
        totalRebate: parseFloat(summary.totalRebate) || 0,
        totalWithdrawal: parseFloat(summary.totalWithdrawal) || 0,
        miningCount: summary.miningCount || 0,
        rebateCount: summary.rebateCount || 0,
        withdrawalCount: summary.withdrawalCount || 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching transaction summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction summary'
    });
  }
});

/**
 * 获取交易类型的显示标签
 */
function getTypeLabel(type) {
  const labels = {
    'Free Ad Reward':               'Free Ad Reward',
    'Daily Check-in Reward':        'Daily Check-in Reward',
    'Invite Friend Reward':         'Invite Friend Reward',
    'Bind Referrer Reward':         'Bind Referrer Reward',
    'contract_4.99':                'Contract ($4.99)',
    'contract_6.99':                'Contract ($6.99)',
    'contract_9.99':                'Contract ($9.99)',
    'contract_19.99':               'Contract ($19.99)',
    'withdrawal':                   'Withdrawal',
    'subordinate rebate':           'Referral Rebate',
    'refund for withdrawal failure':'Withdrawal Refund',
    'mining_reward':                'Subscription Mining Reward',
  };
  return labels[type] || type;
}

module.exports = router;
