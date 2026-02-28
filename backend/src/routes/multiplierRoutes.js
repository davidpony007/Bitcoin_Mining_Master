/**
 * 倍率系统 API 路由
 * 提供倍率查询和管理接口
 */

const express = require('express');
const router = express.Router();
const MultiplierService = require('../services/multiplierService');
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

/**
 * @route   GET /api/multiplier/user
 * @desc    获取用户的完整倍率信息
 * @access  Public
 * @query   user_id - 用户ID
 */
router.get('/user', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const multiplierInfo = await MultiplierService.getUserMultiplier(user_id);

    res.json({
      success: true,
      data: multiplierInfo
    });

  } catch (error) {
    console.error('获取用户倍率失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户倍率失败',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/multiplier/country
 * @desc    更新用户的国家倍率
 * @access  Admin
 * @body    user_id - 用户ID
 * @body    multiplier - 新的倍率值 (0.01 - 99.99)
 */
router.put('/country', authenticate, requireAdmin, async (req, res) => {
  try {
    const { user_id, multiplier } = req.body;

    if (!user_id || multiplier === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id 或 multiplier'
      });
    }

    await MultiplierService.updateCountryMultiplier(user_id, multiplier);

    res.json({
      success: true,
      message: '国家倍率更新成功',
      data: {
        userId: user_id,
        multiplier: parseFloat(multiplier)
      }
    });

  } catch (error) {
    console.error('更新国家倍率失败:', error);
    res.status(500).json({
      success: false,
      message: '更新国家倍率失败',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/multiplier/country/batch
 * @desc    批量更新某个国家的倍率
 * @access  Admin
 * @body    country - 国家代码
 * @body    multiplier - 新的倍率值
 */
router.put('/country/batch', authenticate, requireAdmin, async (req, res) => {
  try {
    const { country, multiplier } = req.body;

    if (!country || multiplier === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: country 或 multiplier'
      });
    }

    const affectedCount = await MultiplierService.updateCountryMultiplierByCountry(country, multiplier);

    res.json({
      success: true,
      message: `已更新 ${affectedCount} 个用户的倍率`,
      data: {
        country: country,
        multiplier: parseFloat(multiplier),
        affectedCount: affectedCount
      }
    });

  } catch (error) {
    console.error('批量更新国家倍率失败:', error);
    res.status(500).json({
      success: false,
      message: '批量更新国家倍率失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/multiplier/stats
 * @desc    获取所有国家的倍率统计
 * @access  Admin
 */
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const stats = await MultiplierService.getCountryMultiplierStats();

    res.json({
      success: true,
      data: stats,
      total: stats.length
    });

  } catch (error) {
    console.error('获取倍率统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取倍率统计失败',
      error: error.message
    });
  }
});

module.exports = router;
