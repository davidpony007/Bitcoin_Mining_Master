/**
 * 邀请奖励系统 API 路由
 * 提供邀请进度、被邀请用户列表、邀请统计、排行榜等接口
 */

const express = require('express');
const router = express.Router();
const InvitationRewardService = require('../services/invitationRewardService');
const InvitationPointsService = require('../services/invitationPointsService');
const authenticate = require('../middleware/auth');

/**
 * @route   GET /api/invitation/progress
 * @desc    获取邀请进度
 * @access  Private
 * @query   user_id - 用户ID
 */
router.get('/progress', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const progress = await InvitationRewardService.getInvitationProgress(user_id);

    res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    console.error('获取邀请进度失败:', error);
    res.status(500).json({
      success: false,
      message: '获取邀请进度失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invitation/referrals
 * @desc    获取被邀请用户列表
 * @access  Private
 * @query   user_id - 用户ID
 * @query   page - 页码 (默认1)
 * @query   limit - 每页数量 (默认20)
 */
router.get('/referrals', authenticate, async (req, res) => {
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

    const result = await InvitationRewardService.getReferralList(user_id, pageNumber, limitNumber);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取被邀请用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取被邀请用户列表失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invitation/statistics
 * @desc    获取邀请统计信息（集成新积分系统）
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

    // 使用新的InvitationPointsService
    const stats = await InvitationPointsService.getReferralStatistics(user_id);

    res.json(stats);

  } catch (error) {
    console.error('获取邀请统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取邀请统计失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invitation/subordinates
 * @desc    获取下级用户列表（集成新积分系统）
 * @access  Private
 * @query   user_id - 用户ID
 * @query   page - 页码 (默认1)
 * @query   limit - 每页数量 (默认20)
 */
router.get('/subordinates', authenticate, async (req, res) => {
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

    // 使用新的InvitationPointsService
    const result = await InvitationPointsService.getSubordinateList(user_id, pageNumber, limitNumber);

    res.json(result);

  } catch (error) {
    console.error('获取下级列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取下级列表失败',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invitation/claim-milestone
 * @desc    领取邀请里程碑奖励（10人里程碑）
 * @access  Private
 * @body    user_id - 用户ID
 */
router.post('/claim-milestone', authenticate, async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    // 使用新的InvitationPointsService
    const result = await InvitationPointsService.handleTenFriendsMilestone(user_id);

    res.json(result);

  } catch (error) {
    console.error('领取邀请里程碑失败:', error);
    res.status(500).json({
      success: false,
      message: '领取邀请里程碑失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invitation/leaderboard
 * @desc    获取邀请排行榜
 * @access  Public
 * @query   limit - 限制数量 (默认100)
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const leaderboard = await InvitationRewardService.getInvitationLeaderboard(limit);

    res.json({
      success: true,
      data: leaderboard
    });

  } catch (error) {
    console.error('获取邀请排行榜失败:', error);
    res.status(500).json({
      success: false,
      message: '获取邀请排行榜失败',
      error: error.message
    });
  }
});

module.exports = router;
