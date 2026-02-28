const express = require('express');
const router = express.Router();
const CheckInMiningContractService = require('../services/checkInMiningContractService');
const CheckInPointsService = require('../services/checkInPointsService');

/**
 * GET /api/check-in/status
 * 检查用户今日是否已经签到
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.query.user_id || req.body.user_id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID无效'
      });
    }

    // 检查今日是否已签到
    const alreadyCheckedIn = await CheckInPointsService.hasCheckedInToday(userId);

    res.status(200).json({
      success: true,
      data: {
        alreadyCheckedIn: alreadyCheckedIn,
        userId: userId
      }
    });
  } catch (error) {
    console.error('检查签到状态失败:', error);
    res.status(500).json({
      success: false,
      message: '检查签到状态失败'
    });
  }
});

/**
 * POST /api/check-in/daily
 * 用户每日签到并创建2小时挖矿合约 + 增加积分 + 记录广告观看
 */
router.post('/daily', async (req, res) => {
  const pool = require('../config/database_native');
  let connection;
  
  try {
    // 从请求体中获取user_id
    const userId = req.body.user_id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID无效'
      });
    }

    // 1. 先执行积分签到（会验证今日是否已签到）
    const pointsResult = await CheckInPointsService.performCheckIn(userId);
    
    if (!pointsResult.success) {
      // 如果已经签到过，直接返回错误
      return res.status(400).json({
        success: false,
        message: pointsResult.message || '今日已签到',
        data: {
          alreadyCheckedIn: true
        }
      });
    }

    // 2. 签到成功后，创建挖矿合约
    const result = await CheckInMiningContractService.checkInAndCreateMiningContract(userId);

    // 3. 记录广告观看到 ad_view_record 表
    try {
      connection = await pool.getConnection();
      const today = new Date().toISOString().split('T')[0];
      const adType = 'Daily Check-in Reward';
      
      // 检查今日该类型是否已有记录
      const [existingRecords] = await connection.query(
        'SELECT id, view_count FROM ad_view_record WHERE user_id = ? AND view_date = ? AND ad_type = ?',
        [userId, today, adType]
      );

      if (existingRecords.length > 0) {
        // 更新现有记录
        await connection.query(
          'UPDATE ad_view_record SET view_count = view_count + 1, updated_at = NOW() WHERE user_id = ? AND view_date = ? AND ad_type = ?',
          [userId, today, adType]
        );
      } else {
        // 创建新记录
        await connection.query(
          'INSERT INTO ad_view_record (user_id, ad_type, view_date, view_count, points_earned, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [userId, adType, today, 1, 0]
        );
      }
      
      // 更新用户总广告观看次数
      await connection.query(
        'UPDATE user_information SET total_ad_views = total_ad_views + 1 WHERE user_id = ?',
        [userId]
      );
      
      console.log(`✅ [Daily Check-in] 已记录广告观看: userId=${userId}, date=${today}`);
    } catch (adRecordError) {
      console.error('❌ 记录广告观看失败:', adRecordError);
      // 不影响主流程
    } finally {
      if (connection) connection.release();
    }

    res.status(200).json({
      success: true,
      message: '签到成功，已获得2小时挖矿合约和积分奖励',
      data: {
        ...result,
        points: {
          earned: pointsResult.pointsAwarded || 4,
          cumulativeDays: pointsResult.cumulativeDays
        }
      }
    });
  } catch (error) {
    console.error('签到失败:', error);
    
    // 处理特定错误
    if (error.message && error.message.includes('今日已签到')) {
      return res.status(400).json({
        success: false,
        message: '今日已签到，请明天再来'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || '签到失败，请稍后重试'
    });
  }
});

module.exports = router;
