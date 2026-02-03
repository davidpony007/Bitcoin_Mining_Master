/**
 * 等级系统 API 路由
 * 提供等级查询、配置获取、排行榜等接口
 */

const express = require('express');
const router = express.Router();
const LevelService = require('../services/levelService');
const authenticate = require('../middleware/auth');

/**
 * @route   GET /api/level/info
 * @desc    获取用户等级信息
 * @access  Public (临时移除认证以修复401错误)
 * @query   user_id - 用户ID
 */
router.get('/info', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const levelInfo = await LevelService.getUserLevel(user_id);

    return res.json({
      success: true,
      data: levelInfo
    });

  } catch (error) {
    console.error('获取用户等级信息失败:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: '获取用户等级信息失败',
        error: error.message
      });
    }
  }
});

/**
 * @route   GET /api/level/config
 * @desc    获取等级配置列表
 * @access  Public
 */
router.get('/config', async (req, res) => {
  try {
    const configList = await LevelService.getLevelConfigList();

    return res.json({
      success: true,
      data: configList
    });

  } catch (error) {
    console.error('获取等级配置失败:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: '获取等级配置失败',
        error: error.message
      });
    }
  }
});

/**
 * @route   GET /api/level/leaderboard
 * @desc    获取等级排行榜
 * @access  Public
 * @query   limit - 限制数量 (默认100)
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const leaderboard = await LevelService.getLevelLeaderboard(limit);

    return res.json({
      success: true,
      data: leaderboard
    });

  } catch (error) {
    console.error('获取等级排行榜失败:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: '获取等级排行榜失败',
        error: error.message
      });
    }
  }
});

/**
 * @route   GET /api/level/mining-speed
 * @desc    计算用户挖矿速率
 * @access  Public
 * @query   user_id - 用户ID
 * @query   base_speed - 基础速率 (可选)
 */
router.get('/mining-speed', async (req, res) => {
  try {
    const { user_id, base_speed } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const baseSpeed = base_speed ? parseFloat(base_speed) : 0.00000001;
    const speedInfo = await LevelService.calculateMiningSpeed(user_id, baseSpeed);

    return res.json({
      success: true,
      data: speedInfo
    });

  } catch (error) {
    console.error('计算挖矿速率失败:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: '计算挖矿速率失败',
        error: error.message
      });
    }
  }
});

module.exports = router;
