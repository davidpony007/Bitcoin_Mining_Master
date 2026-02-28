// bitcoinTransactionRoutes.js
// 比特币交易记录路由
const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');

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

    // 构建WHERE条件
    let whereClause = 'WHERE user_id = :userId';
    const replacements = { userId, limit: safeLimit, offset: safeOffset };

    if (type !== 'all') {
      whereClause += ' AND transaction_type = :type';
      replacements.type = type;
    }

    // 查询交易记录
    const records = await sequelize.query(
      `SELECT 
        id,
        user_id,
        transaction_type,
        transaction_amount,
        transaction_creation_time,
        transaction_status
       FROM bitcoin_transaction_records
       ${whereClause}
       ORDER BY transaction_creation_time DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    );

    // 查询总记录数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total
       FROM bitcoin_transaction_records
       ${whereClause}`,
      {
        replacements: { userId, type: type !== 'all' ? type : undefined },
        type: QueryTypes.SELECT
      }
    );

    // 格式化返回数据
    const formattedRecords = records.map(record => ({
      id: record.id,
      userId: record.user_id,
      type: record.transaction_type,
      amount: parseFloat(record.transaction_amount),
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
router.get('/summary', async (req, res) => {
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
 * 获取交易类型的中文标签
 */
function getTypeLabel(type) {
  const labels = {
    'Free Ad Reward': 'Ad Reward',
    'Daily Check-in Reward': 'Daily Check-in',
    'Invite Friend Reward': 'Invitation Reward',
    'Bind Referrer Reward': 'Referral Reward',
    'paid contract': 'Paid Contract',
    'withdrawal': 'Withdrawal',
    'subordinate rebate': 'Referral Rebate',
    'refund for withdrawal failure': 'Refund'
  };
  return labels[type] || type;
}

module.exports = router;
