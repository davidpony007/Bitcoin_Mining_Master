/**
 * 挖矿合约路由
 * 处理四种免费挖矿合约的相关请求
 */

const express = require('express');
const router = express.Router();
const AdMiningContractService = require('../services/adMiningContractService');
const CheckInMiningContractService = require('../services/checkInMiningContractService');
const InvitationMiningContractService = require('../services/invitationMiningContractService');
const RefereeMiningContractService = require('../services/refereeMiningContractService');

/**
 * POST /api/mining-contracts/ad/watch
 * 观看广告并创建/延长普通广告挖矿合约
 * 请求体: { user_id: "用户ID" }
 */
router.post('/ad/watch', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    const result = await AdMiningContractService.watchAdAndExtendMining(user_id.trim());
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (err) {
    console.error('❌ 观看广告并延长挖矿失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

/**
 * GET /api/mining-contracts/ad/status/:userId
 * 获取普通广告挖矿合约状态
 */
router.get('/ad/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    const result = await AdMiningContractService.getContractStatus(userId.trim());
    res.json(result);

  } catch (err) {
    console.error('❌ 获取广告挖矿合约状态失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

/**
 * POST /api/mining-contracts/checkin
 * 每日签到并创建签到挖矿合约
 * 请求体: { user_id: "用户ID" }
 */
router.post('/checkin', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    const result = await CheckInMiningContractService.checkInAndCreateMiningContract(user_id.trim());
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (err) {
    console.error('❌ 签到并创建挖矿合约失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

/**
 * GET /api/mining-contracts/checkin/status/:userId
 * 获取签到挖矿合约状态
 */
router.get('/checkin/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    const result = await CheckInMiningContractService.getContractStatus(userId.trim());
    res.json(result);

  } catch (err) {
    console.error('❌ 获取签到挖矿合约状态失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

/**
 * GET /api/mining-contracts/invitation/status/:userId
 * 获取邀请挖矿合约状态
 */
router.get('/invitation/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    const result = await InvitationMiningContractService.getContractStatus(userId.trim());
    res.json(result);

  } catch (err) {
    console.error('❌ 获取邀请挖矿合约状态失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

/**
 * GET /api/mining-contracts/bind-referrer/status/:userId
 * 获取绑定推荐人挖矿合约状态
 */
router.get('/bind-referrer/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    const result = await RefereeMiningContractService.getContractStatus(userId.trim());
    res.json(result);

  } catch (err) {
    console.error('❌ 获取绑定推荐人挖矿合约状态失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

module.exports = router;
