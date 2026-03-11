// adminRoutes.js
// 管理员相关接口路由，负责后台统计和管理操作
const express = require('express'); // 引入 express 框架
const router = express.Router(); // 创建路由实例
const authenticateToken = require('../middleware/auth'); // JWT 认证中间件
const { requireAdmin } = require('../middleware/role'); // 管理员权限校验中间件
const CountryMiningService = require('../services/countryMiningService'); // 国家挖矿配置服务
const pool = require('../config/database_native');
const PointsService = require('../services/pointsService');
const AdPointsService = require('../services/adPointsService');

// GET /api/admin/stats
// 获取后台统计信息（需管理员权限）
router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
  res.json({ users: 100, miningNodes: 10, revenue: 12345 }); // 示例数据，实际应从数据库获取
});

// POST /api/admin/action
// 管理员操作接口（需管理员权限）
router.post('/action', authenticateToken, requireAdmin, (req, res) => {
  // 实际管理员操作逻辑应在此实现
  res.json({ message: 'Admin action executed' });
});

/**
 * @route   PUT /api/admin/country/:countryCode/multiplier
 * @desc    更新国家挖矿速率倍数（管理员）
 * @access  Admin
 * @param   {string} countryCode - 国家代码
 * @body    {number} multiplier - 新的挖矿速率倍数
 */
router.put('/country/:countryCode/multiplier', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { multiplier } = req.body;

    if (!multiplier || multiplier <= 0) {
      return res.status(400).json({
        success: false,
        message: '倍数必须大于0'
      });
    }

    const result = await CountryMiningService.updateMultiplier(countryCode, multiplier);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('更新国家配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/country/cache/clear
 * @desc    清除所有国家配置缓存（管理员）
 * @access  Admin
 */
router.post('/country/cache/clear', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await CountryMiningService.clearAllCache();
    res.json({
      success: true,
      message: '缓存清除成功'
    });
  } catch (error) {
    console.error('清除缓存失败:', error);
    res.status(500).json({
      success: false,
      message: '清除缓存失败',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/fix-referral-reward
 * @desc    手动补发指定被邀请人对应的邀请积分奖励（用于修复历史遗漏）
 * @access  Admin
 * @body    { refereeUserId: string }  被邀请人用户ID
 */
router.post('/fix-referral-reward', authenticateToken, requireAdmin, async (req, res) => {
  const { refereeUserId } = req.body;
  if (!refereeUserId) {
    return res.status(400).json({ success: false, message: '缺少参数: refereeUserId' });
  }

  const connection = await pool.getConnection();
  try {
    // 查找邀请关系
    const [relRows] = await connection.query(
      'SELECT referrer_user_id FROM invitation_relationship WHERE user_id = ?',
      [refereeUserId]
    );
    if (relRows.length === 0 || !relRows[0].referrer_user_id) {
      connection.release();
      return res.status(404).json({ success: false, message: '未找到邀请关系' });
    }
    const referrerId = relRows[0].referrer_user_id;

    // 检查被邀请人广告观看次数
    const [viewRows] = await connection.query(
      'SELECT SUM(view_count) as total FROM ad_view_record WHERE user_id = ?',
      [refereeUserId]
    );
    const totalViews = parseInt(viewRows[0].total || 0);
    if (totalViews < AdPointsService.REFERRAL_REQUIRED_ADS) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: `被邀请人广告观看次数不足（当前 ${totalViews} 次，需 ${AdPointsService.REFERRAL_REQUIRED_ADS} 次）`
      });
    }

    // 检查是否已发放过
    const [existRows] = await connection.query(
      'SELECT id FROM points_transaction WHERE user_id = ? AND related_user_id = ? AND points_type = ?',
      [referrerId, refereeUserId, PointsService.POINTS_TYPES.REFERRAL_1]
    );
    if (existRows.length > 0) {
      connection.release();
      return res.json({ success: false, message: '该邀请奖励已发放过，无需补发', referrerId, refereeUserId });
    }

    connection.release();

    // 发放积分
    const InvitationPointsService = require('../services/invitationPointsService');
    await PointsService.addPoints(
      referrerId,
      InvitationPointsService.FIRST_FRIEND_REWARD,
      PointsService.POINTS_TYPES.REFERRAL_1,
      `管理员补发邀请奖励（被邀请人 ${refereeUserId}）`,
      refereeUserId
    );

    console.log(`✅ 管理员手动补发邀请奖励：${referrerId} <- ${refereeUserId}, ${InvitationPointsService.FIRST_FRIEND_REWARD} 积分`);
    res.json({
      success: true,
      message: `补发成功：已向 ${referrerId} 补发 ${InvitationPointsService.FIRST_FRIEND_REWARD} 积分`,
      referrerId,
      refereeUserId,
      pointsAwarded: InvitationPointsService.FIRST_FRIEND_REWARD
    });
  } catch (error) {
    console.error('补发邀请奖励失败:', error);
    res.status(500).json({ success: false, message: '补发失败', error: error.message });
  }
});

/**
 * @route   POST /api/admin/scan-fix-missing-referral-rewards
 * @desc    扫描所有满足条件但未获得邀请奖励的邀请人，批量补发
 * @access  Admin
 */
router.post('/scan-fix-missing-referral-rewards', authenticateToken, requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    // 查找：被邀请人已看 >= 5 次广告，但邀请人从未收到 REFERRAL_1 积分
    const [missedRows] = await connection.query(`
      SELECT ir.referrer_user_id, ir.user_id AS referee_user_id,
             SUM(avr.view_count) AS total_views
      FROM invitation_relationship ir
      JOIN ad_view_record avr ON avr.user_id = ir.user_id
      LEFT JOIN points_transaction pt ON pt.user_id = ir.referrer_user_id
        AND pt.related_user_id = ir.user_id
        AND pt.points_type = 'REFERRAL_1'
      WHERE pt.id IS NULL
      GROUP BY ir.referrer_user_id, ir.user_id
      HAVING total_views >= 5
    `);

    connection.release();

    if (missedRows.length === 0) {
      return res.json({ success: true, message: '没有遗漏的邀请奖励', fixed: 0 });
    }

    const InvitationPointsService = require('../services/invitationPointsService');
    let fixed = 0;
    const details = [];

    for (const row of missedRows) {
      try {
        await PointsService.addPoints(
          row.referrer_user_id,
          InvitationPointsService.FIRST_FRIEND_REWARD,
          PointsService.POINTS_TYPES.REFERRAL_1,
          `系统补发邀请奖励（被邀请人 ${row.referee_user_id}）`,
          row.referee_user_id
        );
        fixed++;
        details.push({ referrerId: row.referrer_user_id, refereeUserId: row.referee_user_id, points: InvitationPointsService.FIRST_FRIEND_REWARD });
        console.log(`✅ 批量补发：${row.referrer_user_id} <- ${row.referee_user_id}`);
      } catch (e) {
        console.error(`补发失败 ${row.referrer_user_id} <- ${row.referee_user_id}:`, e.message);
        details.push({ referrerId: row.referrer_user_id, refereeUserId: row.referee_user_id, error: e.message });
      }
    }

    res.json({ success: true, message: `扫描完成，补发 ${fixed}/${missedRows.length} 条`, fixed, total: missedRows.length, details });
  } catch (error) {
    console.error('批量补发失败:', error);
    res.status(500).json({ success: false, message: '批量补发失败', error: error.message });
  }
});

// 导出路由模块，供主应用挂载
module.exports = router;
