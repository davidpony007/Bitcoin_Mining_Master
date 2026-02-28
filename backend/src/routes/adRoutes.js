/**
 * 广告系统 API 路由
 * 提供广告观看记录、积分奖励、查询广告数据等接口
 */

const express = require('express');
const router = express.Router();
const AdService = require('../services/adService');
const AdPointsService = require('../services/adPointsService');
const authenticate = require('../middleware/auth');

/**
 * @route   POST /api/ad/watch
 * @desc    记录广告观看并奖励积分（使用新的积分系统）
 * @access  Public
 * @body    user_id - 用户ID
 * @body    ad_type - 广告类型 (可选，默认REWARD_AD)
 */
router.post('/watch', async (req, res) => {
  try {
    const { user_id, ad_type = 'REWARD_AD' } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    // 使用新的AdPointsService，集成积分系统
    const result = await AdPointsService.recordAdViewAndReward(user_id);

    res.json(result);

  } catch (error) {
    console.error('记录广告观看失败:', error);
    res.status(500).json({
      success: false,
      message: '记录广告观看失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/today
 * @desc    获取今日广告观看记录（使用新的积分系统）
 * @access  Public
 * @query   user_id - 用户ID
 */
router.get('/today', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    // 使用新的AdPointsService
    const result = await AdPointsService.getTodayAdRecord(user_id);

    res.json(result);

  } catch (error) {
    console.error('获取今日广告记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取今日广告记录失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/count (兼容旧接口)
 * @desc    获取广告观看次数
 * @access  Public
 * @query   user_id - 用户ID
 */
router.get('/count', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const result = await AdPointsService.getTodayAdRecord(user_id);

    res.json({
      success: true,
      data: {
        todayCount: result.viewCount || 0,
        dailyLimit: result.dailyLimit,
        remainingViews: result.remainingViews
      }
    });

  } catch (error) {
    console.error('获取广告观看次数失败:', error);
    res.status(500).json({
      success: false,
      message: '获取广告观看次数失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/history
 * @desc    获取广告观看历史（使用新的积分系统）
 * @access  Private
 * @query   user_id - 用户ID
 * @query   days - 查询天数 (默认30天)
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const { user_id, days } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const daysNumber = parseInt(days) || 30;
    
    // 使用新的AdPointsService
    const result = await AdPointsService.getAdViewHistory(user_id, daysNumber);

    res.json(result);

  } catch (error) {
    console.error('获取广告历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取广告历史失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/subordinate
 * @desc    获取下级用户广告观看统计
 * @access  Private
 * @query   user_id - 用户ID (邀请人ID)
 */
router.get('/subordinate', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const result = await AdPointsService.getSubordinateAdStatistics(user_id);

    res.json(result);

  } catch (error) {
    console.error('获取下级广告统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取下级广告统计失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/statistics (兼容旧接口)
 * @desc    获取广告观看统计
 * @access  Private
 * @query   user_id - 用户ID
 */
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    // 使用新的AdPointsService获取历史数据
    const historyResult = await AdPointsService.getAdViewHistory(user_id, 30);

    res.json({
      success: true,
      data: historyResult.data.statistics
    });

  } catch (error) {
    console.error('获取广告统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取广告统计失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/referral-progress (兼容旧接口)
 * @desc    获取下级用户广告观看进度
 * @access  Private
 * @query   user_id - 用户ID (邀请人ID)
 */
router.get('/referral-progress', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const result = await AdPointsService.getSubordinateAdStatistics(user_id);

    res.json(result);

  } catch (error) {
    console.error('获取下级用户广告进度失败:', error);
    res.status(500).json({
      success: false,
      message: '获取下级用户广告进度失败',
      error: error.message
    });
  }
});

module.exports = router;
