/**
 * 积分系统 API 路由
 * 提供积分余额、交易记录、统计、排行榜等接口
 */

const express = require('express');
const router = express.Router();
const PointsService = require('../services/pointsService');
const LevelService = require('../services/levelService');
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

/**
 * @route   GET /api/points/balance
 * @desc    获取用户积分余额
 * @access  Public
 * @query   user_id - 用户ID
 */
router.get('/balance', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const result = await PointsService.getUserPoints(user_id);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取积分余额失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分余额失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/points/transactions
 * @desc    获取用户积分交易记录
 * @access  Public
 * @query   user_id - 用户ID
 * @query   page - 页码 (默认1)
 * @query   limit - 每页数量 (默认20)
 * @query   type - 积分类型筛选 (可选)
 */
router.get('/transactions', async (req, res) => {
  try {
    const { user_id, page, limit, type } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 20;

    const result = await PointsService.getPointsTransactions(
      user_id,
      pageNumber,
      limitNumber,
      type || null
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取积分交易记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分交易记录失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/points/history (兼容旧接口)
 * @desc    获取用户积分历史 (重定向到transactions)
 * @access  Public
 * @query   user_id - 用户ID
 * @query   page - 页码 (默认1)
 * @query   limit - 每页数量 (默认20)
 */
router.get('/history', async (req, res) => {
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

    // 使用新的PointsService
    const result = await PointsService.getPointsTransactions(
      user_id,
      pageNumber,
      limitNumber,
      null
    );

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
 * @route   GET /api/points/statistics
 * @desc    获取用户积分统计（按类型汇总）
 * @access  Public
 * @query   user_id - 用户ID
 */
router.get('/statistics', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const result = await PointsService.getPointsStatistics(user_id);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取积分统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分统计失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/points/leaderboard
 * @desc    获取积分排行榜
 * @access  Public
 * @query   limit - 返回数量 (默认100)
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit } = req.query;
    const limitNumber = parseInt(limit) || 100;

    const result = await PointsService.getLeaderboard(limitNumber);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取积分排行榜失败:', error);
    res.status(500).json({
      success: false,
      message: '获取积分排行榜失败',
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
 * @body    description - 原因说明
 */
router.post('/add', authenticate, requireAdmin, async (req, res) => {
  try {
    const { user_id, points, description } = req.body;

    if (!user_id || !points || !description) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id, points, description'
      });
    }

    const result = await PointsService.addPoints(
      user_id,
      parseInt(points),
      PointsService.POINTS_TYPES.MANUAL_ADD,
      description,
      null
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

/**
 * @route   POST /api/points/deduct
 * @desc    手动扣除用户积分 (管理员功能)
 * @access  Private (需要管理员权限)
 * @body    user_id - 用户ID
 * @body    points - 积分数量
 * @body    description - 原因说明
 */
router.post('/deduct', authenticate, requireAdmin, async (req, res) => {
  try {
    const { user_id, points, description } = req.body;

    if (!user_id || !points || !description) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id, points, description'
      });
    }

    const result = await PointsService.deductPoints(
      user_id,
      parseInt(points),
      PointsService.POINTS_TYPES.MANUAL_DEDUCT,
      description,
      null
    );

    res.json({
      success: true,
      data: result,
      message: '积分扣除成功'
    });

  } catch (error) {
    console.error('扣除积分失败:', error);
    res.status(500).json({
      success: false,
      message: error.message === 'INSUFFICIENT_BALANCE' ? '积分余额不足' : '扣除积分失败',
      error: error.message
    });
  }
});

module.exports = router;
