/**
 * 用户设置 API 路由
 * 提供时区设置、倍率查询等接口
 */

const express = require('express');
const router = express.Router();
const TimezoneService = require('../services/timezoneService');
const MultiplierService = require('../services/multiplierService');
const authenticate = require('../middleware/auth');

/**
 * @route   POST /api/user-settings/timezone
 * @desc    设置用户时区
 * @access  Private
 */
router.post('/timezone', authenticate, async (req, res) => {
  try {
    const { user_id, timezone } = req.body;

    if (!user_id || !timezone) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id 和 timezone 都是必填项'
      });
    }

    // 设置时区
    await TimezoneService.setTimezone(user_id, timezone);

    // 获取设置后的本地时间信息
    const localTimeInfo = await TimezoneService.getLocalTime(user_id);

    res.json({
      success: true,
      message: '时区设置成功',
      data: {
        timezone: timezone,
        localTime: localTimeInfo
      }
    });

  } catch (error) {
    console.error('设置时区失败:', error);
    res.status(500).json({
      success: false,
      message: '设置时区失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/user-settings/timezone
 * @desc    获取用户时区和本地时间
 * @access  Private
 * @query   user_id - 用户ID
 */
router.get('/timezone', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const timezone = await TimezoneService.getTimezone(user_id);
    const localTimeInfo = await TimezoneService.getLocalTime(user_id);

    res.json({
      success: true,
      data: {
        timezone: timezone,
        localTime: localTimeInfo
      }
    });

  } catch (error) {
    console.error('获取时区失败:', error);
    res.status(500).json({
      success: false,
      message: '获取时区失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/user-settings/timezones
 * @desc    获取常用时区列表
 * @access  Public
 */
router.get('/timezones', async (req, res) => {
  try {
    const timezones = TimezoneService.getCommonTimezones();

    res.json({
      success: true,
      data: timezones
    });

  } catch (error) {
    console.error('获取时区列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取时区列表失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/user-settings/multiplier
 * @desc    获取用户实时倍率
 * @access  Private
 * @query   user_id - 用户ID
 */
router.get('/multiplier', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const multiplierInfo = await MultiplierService.getMultiplier(user_id);

    res.json({
      success: true,
      data: multiplierInfo
    });

  } catch (error) {
    console.error('获取倍率失败:', error);
    res.status(500).json({
      success: false,
      message: '获取倍率失败',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/user-settings/multiplier/update
 * @desc    手动更新用户倍率
 * @access  Private
 */
router.post('/multiplier/update', authenticate, async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    await MultiplierService.updateMultiplier(user_id);
    const multiplierInfo = await MultiplierService.getMultiplier(user_id);

    res.json({
      success: true,
      message: '倍率已更新',
      data: multiplierInfo
    });

  } catch (error) {
    console.error('更新倍率失败:', error);
    res.status(500).json({
      success: false,
      message: '更新倍率失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/user-settings/local-time
 * @desc    获取用户本地时间
 * @access  Private
 * @query   user_id - 用户ID
 */
router.get('/local-time', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const localTimeInfo = await TimezoneService.getLocalTime(user_id);

    res.json({
      success: true,
      data: localTimeInfo
    });

  } catch (error) {
    console.error('获取本地时间失败:', error);
    res.status(500).json({
      success: false,
      message: '获取本地时间失败',
      error: error.message
    });
  }
});

module.exports = router;
