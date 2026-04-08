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
 * @access  Private
 */
router.get('/balance', authenticate, async (req, res) => {
  try {
    const user_id = req.user.user_id;

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
 * @access  Private
 * @query   page - 页码 (默认1)
 * @query   limit - 每页数量 (默认20)
 * @query   type - 积分类型筛选 (可选)
 */
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { page, limit, type } = req.query;

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
 * @access  Private
 * @query   page - 页码 (默认1)
 * @query   limit - 每页数量 (默认20)
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { page, limit } = req.query;

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
 * @access  Private
 */
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const user_id = req.user.user_id;

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

/**
 * @route   POST /api/points/claim-app-rating
 * @desc    用户领取应用评分一次性奖励 (+10 积分)，服务端幂等防重复
 * @access  Private
 */
router.post('/claim-app-rating', authenticate, async (req, res) => {
  const pool = require('../config/database_native');
  try {
    const user_id = req.user.user_id;

    // 服务端幂等：检查是否已领取过（points_transaction 表）
    const connection = await pool.getConnection();
    try {
      const [existing] = await connection.query(
        "SELECT id FROM points_transaction WHERE user_id = ? AND points_type = 'APP_RATING' LIMIT 1",
        [user_id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'App rating reward already claimed' });
      }
    } finally {
      connection.release();
    }

    const result = await PointsService.addPoints(
      user_id,
      10,
      PointsService.POINTS_TYPES.APP_RATING,
      'App rating reward',
      null
    );

    res.json({ success: true, data: result, message: '+10 points added' });
  } catch (error) {
    console.error('领取评分积分失败:', error);
    res.status(500).json({ success: false, message: '领取评分积分失败', error: error.message });
  }
});

module.exports = router;
