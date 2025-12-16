/**
 * 邀请奖励系统 API 路由
 * 提供邀请进度、被邀请用户列表、邀请统计、排行榜等接口
 */

const express = require('express');
const router = express.Router();
const InvitationRewardService = require('../services/invitationRewardService');
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
 * @desc    获取邀请统计信息
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

    const stats = await InvitationRewardService.getInvitationStatistics(user_id);

    res.json({
      success: true,
      data: stats
    });

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
