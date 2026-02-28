/**
 * 签到系统 API 路由
 * 提供签到、查询签到状态、签到历史、里程碑奖励等接口
 */

const express = require('express');
const router = express.Router();
const CheckInService = require('../services/checkInService');
const CheckInPointsService = require('../services/checkInPointsService');
const authenticate = require('../middleware/auth');

/**
 * @route   POST /api/checkin
 * @desc    用户签到（使用新的积分系统）
 * @access  Public
 * @body    user_id - 用户ID
 */
router.post('/', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    // 使用新的CheckInPointsService
    const result = await CheckInPointsService.performCheckIn(user_id);

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
 * @desc    获取签到状态（使用新的积分系统）
 * @access  Public
 * @query   user_id - 用户ID
 */
router.get('/status', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    // 使用新的CheckInPointsService
    const status = await CheckInPointsService.getCheckInStatus(user_id);

    // 包装数据以符合Flutter API期望的格式
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
 * @desc    获取签到历史（使用新的积分系统）
 * @access  Public
 * @query   user_id - 用户ID
 * @query   days - 查询天数 (默认30天)
 */
router.get('/history', async (req, res) => {
  try {
    const { user_id, days } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const daysNumber = parseInt(days) || 30;
    
    // 使用新的CheckInPointsService
    const history = await CheckInPointsService.getCheckInHistory(user_id, daysNumber);

    res.json(history);

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
 * @route   GET /api/checkin/milestones
 * @desc    获取可领取的签到里程碑奖励
 * @access  Public
 * @query   user_id - 用户ID
 */
router.get('/milestones', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const result = await CheckInPointsService.getAvailableMilestones(user_id);

    res.json(result);

  } catch (error) {
    console.error('获取签到里程碑失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到里程碑失败',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/checkin/claim-milestone
 * @desc    领取累计签到里程碑奖励（可以不连续）
 * @access  Public
 * @body    user_id - 用户ID
 * @body    cumulative_days - 累计天数 (3/7/15/30)
 */
router.post('/claim-milestone', async (req, res) => {
  try {
    const { user_id, cumulative_days } = req.body;

    if (!user_id || !cumulative_days) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id, cumulative_days'
      });
    }

    const result = await CheckInPointsService.claimCumulativeMilestone(
      user_id,
      parseInt(cumulative_days)
    );

    res.json(result);

  } catch (error) {
    console.error('领取里程碑奖励失败:', error);
    res.status(500).json({
      success: false,
      message: '领取里程碑奖励失败'
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

/**
 * @route   GET /api/checkin/calendar
 * @desc    获取30天签到日历数据
 * @access  Private
 * @query   user_id - 用户ID
 */
router.get('/calendar', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const calendar = await CheckInPointsService.get30DayCalendar(user_id);

    res.json(calendar);

  } catch (error) {
    console.error('获取30天日历失败:', error);
    res.status(500).json({
      success: false,
      message: '获取30天日历失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/checkin/config
 * @desc    获取签到系统配置（奖励规则）
 * @access  Public
 */
router.get('/config', async (req, res) => {
  try {
    const config = CheckInPointsService.getMilestoneConfig();
    res.json(config);

  } catch (error) {
    console.error('获取签到配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取签到配置失败',
      error: error.message
    });
  }
});

module.exports = router;
