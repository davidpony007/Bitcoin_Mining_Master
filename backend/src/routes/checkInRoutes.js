/**
 * 签到系统 API 路由
 * 提供签到、查询签到状态、签到历史等接口
 */

const express = require('express');
const router = express.Router();
const CheckInService = require('../services/checkInService');
const authenticate = require('../middleware/auth');

/**
 * @route   POST /api/checkin
 * @desc    用户签到
 * @access  Private
 * @body    user_id - 用户ID
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const result = await CheckInService.checkIn(user_id);

    res.json(result);

  } catch (error) {
    console.error('签到失败:', error);
    res.status(500).json({
      success: false,
      message: '签到失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/checkin/status
 * @desc    获取签到状态
 * @access  Private
 * @query   user_id - 用户ID
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const status = await CheckInService.getCheckInStatus(user_id);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('获取签到状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到状态失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/checkin/history
 * @desc    获取签到历史
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
    const history = await CheckInService.getCheckInHistory(user_id, daysNumber);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('获取签到历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到历史失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/checkin/statistics
 * @desc    获取签到统计
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

    const stats = await CheckInService.getCheckInStatistics(user_id);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('获取签到统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到统计失败',
      error: error.message
    });
  }
});

module.exports = router;
