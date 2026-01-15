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

module.exports = router;
