/**
 * 广告系统 API 路由
 * 提供广告观看记录、查询广告数据等接口
 */

const express = require('express');
const router = express.Router();
const AdService = require('../services/adService');
const authenticate = require('../middleware/auth');

/**
 * @route   POST /api/ad/watch
 * @desc    记录广告观看
 * @access  Private
 * @body    user_id - 用户ID
 * @body    ad_type - 广告类型 (REWARD_AD, BANNER_AD等)
 * @body    ad_unit_id - 广告单元ID (可选)
 * @body    watch_duration - 观看时长(秒) (可选)
 * @body    is_completed - 是否看完 (可选，默认true)
 */
router.post('/watch', authenticate, async (req, res) => {
  try {
    const {
      user_id,
      ad_type = 'REWARD_AD',
      ad_unit_id = null,
      watch_duration = 30,
      is_completed = true
    } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const result = await AdService.recordAdWatch(
      user_id,
      ad_type,
      ad_unit_id,
      watch_duration,
      is_completed
    );

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
 * @route   GET /api/ad/count
 * @desc    获取广告观看次数
 * @access  Private
 * @query   user_id - 用户ID
 */
router.get('/count', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const todayCount = await AdService.getTodayAdCount(user_id);

    res.json({
      success: true,
      data: {
        todayCount
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
 * @route   GET /api/ad/statistics
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

    const stats = await AdService.getAdWatchStatistics(user_id);

    res.json({
      success: true,
      data: stats
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
 * @route   GET /api/ad/history
 * @desc    获取广告观看历史
 * @access  Private
 * @query   user_id - 用户ID
 * @query   page - 页码 (默认1)
 * @query   limit - 每页数量 (默认20)
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const { user_id, page, limit } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 20;

    const result = await AdService.getAdWatchHistory(user_id, pageNumber, limitNumber);

    res.json({
      success: true,
      data: result
    });

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
 * @route   GET /api/ad/referral-progress
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

    const progress = await AdService.getReferralAdProgress(user_id);

    res.json({
      success: true,
      data: progress
    });

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
