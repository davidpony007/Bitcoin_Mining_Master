/**
 * 合约状态路由 - 检查用户是否有活跃合约
 */
const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { Op } = require('sequelize');

/**
 * GET /api/contract-status/has-active/:userId
 * 检查用户是否有任何活跃的挖矿合约
 */
router.get('/has-active/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const now = new Date();

    // 检查免费合约（ad, daily sign-in, invitation）
    const [freeResults] = await sequelize.query(
      `SELECT COUNT(*) as count 
       FROM free_contract_records 
       WHERE user_id = ? 
       AND mining_status = 'mining' 
       AND free_contract_end_time > ?`,
      {
        replacements: [userId, now],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // 检查付费合约
    const [paidResults] = await sequelize.query(
      `SELECT COUNT(*) as count 
       FROM mining_contracts 
       WHERE user_id = ? 
       AND mining_status = 'mining' 
       AND contract_end_time > ?`,
      {
        replacements: [userId, now],
        type: sequelize.QueryTypes.SELECT
      }
    );

    const freeCount = freeResults?.count || 0;
    const paidCount = paidResults?.count || 0;
    const hasActiveContract = (freeCount > 0) || (paidCount > 0);

    return res.json({
      success: true,
      data: {
        hasActiveContract,
        freeContractCount: freeCount,
        paidContractCount: paidCount,
        totalActiveContracts: freeCount + paidCount
      }
    });

  } catch (error) {
    console.error('检查活跃合约失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check active contracts',
      error: error.message
    });
  }
});

/**
 * GET /api/contract-status/my-contracts/:userId
 * 获取用户的合约详情（用于My Contract页面显示）
 * 返回: Daily Check-in和Free Ad Reward合约的状态和剩余时间
 */
router.get('/my-contracts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const now = new Date();

    // 查询Daily Check-in合约（7.5Gh/s）
    const dailyCheckInContract = await sequelize.query(
      `SELECT 
        id,
        free_contract_type,
        hashrate,
        free_contract_creation_time,
        free_contract_end_time,
        mining_status,
        TIMESTAMPDIFF(SECOND, NOW(), free_contract_end_time) as remaining_seconds
       FROM free_contract_records 
       WHERE user_id = ? 
       AND free_contract_type = 'daily sign-in free contract'
       AND mining_status = 'mining' 
       AND free_contract_end_time > NOW()
       ORDER BY free_contract_creation_time DESC
       LIMIT 1`,
      {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // 查询Free Ad Reward合约（5.5Gh/s）
    const adRewardContract = await sequelize.query(
      `SELECT 
        id,
        free_contract_type,
        hashrate,
        free_contract_creation_time,
        free_contract_end_time,
        mining_status,
        TIMESTAMPDIFF(SECOND, NOW(), free_contract_end_time) as remaining_seconds
       FROM free_contract_records 
       WHERE user_id = ? 
       AND free_contract_type = 'ad free contract'
       AND mining_status = 'mining' 
       AND free_contract_end_time > NOW()
       ORDER BY free_contract_creation_time DESC
       LIMIT 1`,
      {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    return res.json({
      success: true,
      data: {
        dailyCheckIn: {
          isActive: dailyCheckInContract.length > 0,
          hashrate: '7.5Gh/s',
          remainingSeconds: dailyCheckInContract[0]?.remaining_seconds || 0,
          endTime: dailyCheckInContract[0]?.free_contract_end_time || null,
          contractId: dailyCheckInContract[0]?.id || null
        },
        adReward: {
          isActive: adRewardContract.length > 0,
          hashrate: '5.5Gh/s',
          remainingSeconds: adRewardContract[0]?.remaining_seconds || 0,
          endTime: adRewardContract[0]?.free_contract_end_time || null,
          contractId: adRewardContract[0]?.id || null
        }
      }
    });

  } catch (error) {
    console.error('获取用户合约详情失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user contracts',
      error: error.message
    });
  }
});

module.exports = router;
