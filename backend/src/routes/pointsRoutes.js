/**
 * 积分系统 API 路由
 * 提供积分历史查询等接口
 */

const express = require('express');
const router = express.Router();
const LevelService = require('../services/levelService');
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

/**
 * @route   GET /api/points/history
 * @desc    获取用户积分历史
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

    const result = await LevelService.getPointsHistory(user_id, pageNumber, limitNumber);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取积分历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分历史失败',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/points/add
 * @desc    手动增加用户积分 (管理员功能)
 * @access  Private (需要管理员权限)
 * @body    user_id - 用户ID
 * @body    points - 积分数量
 * @body    reason - 原因说明
 */
router.post('/add', authenticate, requireAdmin, async (req, res) => {
  try {
    const { user_id, points, reason } = req.body;

    if (!user_id || !points || !reason) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id, points, reason'
      });
    }

    const result = await LevelService.addPoints(
      user_id,
      parseInt(points),
      reason,
      'MANUAL_ADD'
    );

    res.json({
      success: true,
      data: result,
      message: '积分添加成功'
    });

  } catch (error) {
    console.error('添加积分失败:', error);
    res.status(500).json({
      success: false,
      message: '添加积分失败',
      error: error.message
    });
  }
});

module.exports = router;
