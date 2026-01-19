const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const CheckInMiningContractService = require('../services/checkInMiningContractService');

/**
 * POST /api/check-in/daily
 * 用户每日签到并创建2小时挖矿合约
 */
router.post('/daily', authenticateToken, async (req, res) => {
  try {
    // JWT token中存储的是user_id字段
    const userId = req.user.user_id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID无效'
      });
    }

    // 调用签到挖矿合约服务
    const result = await CheckInMiningContractService.checkInAndCreateMiningContract(userId);

    res.status(200).json({
      success: true,
      message: '签到成功，已获得2小时挖矿合约',
      data: result
    });
  } catch (error) {
    console.error('签到失败:', error);
    
    // 处理特定错误
    if (error.message && error.message.includes('今日已签到')) {
      return res.status(400).json({
        success: false,
        message: '今日已签到，请明天再来'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || '签到失败，请稍后重试'
    });
  }
});

module.exports = router;
