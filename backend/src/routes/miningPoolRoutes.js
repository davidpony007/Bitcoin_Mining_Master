/**
 * Mining Pool路由 - 管理用户的挖矿能量电池
 * 每个电池可以为Free Ad Reward合约增加1小时挖矿时间
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/database_native'); // 使用原生MySQL连接池
const { Op } = require('sequelize');
const PointsService = require('../services/pointsService'); // 📌 导入积分服务

/**
 * POST /api/mining-pool/use-battery
 * 使用一个电池为Free Ad Reward合约增加1小时挖矿时间
 * 
 * 请求体:
 * {
 *   "user_id": "U2026011910532521846",
 *   "battery_count": 1  // 使用的电池数量，默认1
 * }
 */
router.post('/use-battery', async (req, res) => {
  let connection;
  
  try {
    const { user_id, battery_count = 1 } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (battery_count < 1 || battery_count > 24) {
      return res.status(400).json({
        success: false,
        message: 'Battery count must be between 1 and 24'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 查找用户当前活跃的Ad Free Contract
      const [contracts] = await connection.query(
        `SELECT id, free_contract_end_time 
         FROM free_contract_records 
         WHERE user_id = ? 
         AND free_contract_type = 'Free Ad Reward'
         AND free_contract_end_time > NOW()
         ORDER BY free_contract_creation_time DESC
         LIMIT 1`,
        [user_id]
      );

      if (contracts.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'No active Ad Free Contract found. Please create one first.'
        });
      }

      const contract = contracts[0];
      const contractId = contract.id;

      // 2. 计算新的结束时间（增加电池数量对应的小时数）
      const hoursToAdd = battery_count; // 每个电池1小时

      // 3. 更新合约结束时间
      await connection.query(
        `UPDATE free_contract_records 
         SET free_contract_end_time = DATE_ADD(free_contract_end_time, INTERVAL ? HOUR)
         WHERE id = ?`,
        [hoursToAdd, contractId]
      );
      
      // 查询更新后的结束时间
      const [updated] = await connection.query(
        'SELECT free_contract_end_time FROM free_contract_records WHERE id = ?',
        [contractId]
      );
      const newEndTime = new Date(updated[0].free_contract_end_time);

      await connection.commit();
      connection.release();

      // 5. 计算新的剩余时间（秒）
      const now = new Date();
      const remainingSeconds = Math.max(0, Math.floor((newEndTime - now) / 1000));

      return res.json({
        success: true,
        message: `Successfully added ${hoursToAdd} hour(s) to your Ad Free Contract`,
        data: {
          contract_id: contractId,
          battery_used: battery_count,
          hours_added: hoursToAdd,
          new_end_time: newEndTime,
          remaining_seconds: remainingSeconds,
          remaining_hours: Math.floor(remainingSeconds / 3600)
        }
      });

    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    if (connection) connection.release();
    console.error('使用电池增加挖矿时间失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to use battery',
      error: error.message
    });
  }
});

/**
 * GET /api/mining-pool/battery-count/:userId
 * 获取用户当前拥有的电池数量
 * 
 * 注意：这是一个占位API，实际电池数量应该从游戏积分系统或其他系统获取
 * 现在暂时返回固定数量用于测试
 */
router.get('/battery-count/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // TODO: 实际应该从积分系统或电池表中查询
    // 现在返回模拟数据用于测试
    const mockBatteryCount = 5; // 假设用户有5个电池

    return res.json({
      success: true,
      data: {
        user_id: userId,
        battery_count: mockBatteryCount,
        note: 'This is mock data. Implement actual battery system later.'
      }
    });

  } catch (error) {
    console.error('获取电池数量失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get battery count',
      error: error.message
    });
  }
});

/**
 * POST /api/mining-pool/extend-contract
 * 延长Free Ad Reward合约时间（使用电池）
 * 如果没有活跃合约，会创建一个新的2小时合约
 * 
 * 请求体:
 * {
 *   "user_id": "U2026011910532521846",
 *   "hours": 2  // 要增加的小时数（等于电池数量）
 * }
 */
router.post('/extend-contract', async (req, res) => {
  let connection;
  
  try {
    const { user_id, hours = 1 } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (hours < 1 || hours > 24) {
      return res.status(400).json({
        success: false,
        message: 'Hours must be between 1 and 24'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 查找用户当前活跃的Ad Free Contract
      const [contracts] = await connection.query(
        `SELECT id, free_contract_end_time 
         FROM free_contract_records 
         WHERE user_id = ? 
         AND free_contract_type = 'Free Ad Reward'
         AND free_contract_end_time > NOW()
         ORDER BY free_contract_creation_time DESC
         LIMIT 1`,
        [user_id]
      );

      let contractId;
      let newEndTime;
      let isNewContract = false;
      
      // 📌 检查是否已达到48小时上限（48个电池槽）
      const MAX_HOURS = 48;
      const MAX_SECONDS = MAX_HOURS * 3600;

      if (contracts.length === 0) {
        // 没有活跃合约，创建新的合约（用户请求的小时数）
        const totalHours = Math.min(hours, MAX_HOURS);
        
        const [result] = await connection.query(
          `INSERT INTO free_contract_records 
           (user_id, free_contract_type, hashrate, mining_status, free_contract_creation_time, 
            free_contract_end_time)
           VALUES (?, 'Free Ad Reward', 0.000000000000139, 'mining', NOW(), DATE_ADD(NOW(), INTERVAL ? HOUR))`,
          [user_id, totalHours]
        );
        
        contractId = result.insertId;
        isNewContract = true;
        
        // 查询新创建的合约的结束时间
        const [newContract] = await connection.query(
          'SELECT free_contract_end_time FROM free_contract_records WHERE id = ?',
          [contractId]
        );
        newEndTime = new Date(newContract[0].free_contract_end_time);
      } else {
        // 已有活跃合约，检查剩余时间
        contractId = contracts[0].id;
        const currentEndTime = new Date(contracts[0].free_contract_end_time);
        const now = new Date();
        const remainingSeconds = Math.floor((currentEndTime - now) / 1000);
        
        // 📌 检查是否已达到48小时上限
        if (remainingSeconds >= MAX_SECONDS) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: 'The mining pool is full. Maximum 48 hours allowed.',
            data: {
              currentHours: Math.floor(remainingSeconds / 3600),
              maxHours: MAX_HOURS,
              remainingSeconds: remainingSeconds
            }
          });
        }
        
        // 计算可以增加的小时数（不超过48小时上限）
        const maxAdditionalSeconds = MAX_SECONDS - remainingSeconds;
        const maxAdditionalHours = Math.floor(maxAdditionalSeconds / 3600);
        const actualHours = Math.min(hours, maxAdditionalHours);
        
        if (actualHours <= 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: 'The mining pool is full. Maximum 48 hours allowed.',
            data: {
              currentHours: Math.floor(remainingSeconds / 3600),
              maxHours: MAX_HOURS
            }
          });
        }

        await connection.query(
          `UPDATE free_contract_records 
           SET free_contract_end_time = DATE_ADD(free_contract_end_time, INTERVAL ? HOUR)
           WHERE id = ?`,
          [actualHours, contractId]
        );
        
        // 查询更新后的结束时间
        const [updated] = await connection.query(
          'SELECT free_contract_end_time FROM free_contract_records WHERE id = ?',
          [contractId]
        );
        newEndTime = new Date(updated[0].free_contract_end_time);
      }

      await connection.commit();
      connection.release();
      connection = null; // 标记连接已释放

      // 📌 记录广告观看到 ad_view_record 表
      let adConnection;
      try {
        adConnection = await pool.getConnection();
        const today = new Date().toISOString().split('T')[0];
        const adType = 'Free Ad Reward';
        
        // 检查今日该类型是否已有记录
        const [existingRecords] = await adConnection.query(
          'SELECT id, view_count FROM ad_view_record WHERE user_id = ? AND view_date = ? AND ad_type = ?',
          [user_id, today, adType]
        );

        if (existingRecords.length > 0) {
          // 更新现有记录：view_count+1，points_earned+1（每日上限20分）
          await adConnection.query(
            'UPDATE ad_view_record SET view_count = view_count + 1, points_earned = LEAST(points_earned + 1, 20), updated_at = NOW() WHERE user_id = ? AND view_date = ? AND ad_type = ?',
            [user_id, today, adType]
          );
        } else {
          // 创建新记录：第一次观看，points_earned=1
          await adConnection.query(
            'INSERT INTO ad_view_record (user_id, ad_type, view_date, view_count, points_earned, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [user_id, adType, today, 1, 1]
          );
        }
        
        // 更新用户总广告观看次数
        await adConnection.query(
          'UPDATE user_information SET total_ad_views = total_ad_views + 1 WHERE user_id = ?',
          [user_id]
        );
        
        console.log(`✅ [Free Ad Reward] 已记录广告观看: userId=${user_id}, date=${today}`);
      } catch (adRecordError) {
        console.error('❌ 记录广告观看失败:', adRecordError);
        // 不影响主流程
      } finally {
        if (adConnection) adConnection.release();
      }

      // 📌 增加积分：观看广告获得1积分
      try {
        await PointsService.addPoints(
          user_id,
          1, // 每次观看广告获得1积分
          'AD_VIEW', // 积分类型（必须匹配ENUM值）
          `Watched ad and ${isNewContract ? 'created' : 'extended'} Free Ad Reward contract`
        );
        console.log(`✅ 用户 ${user_id} 观看广告获得1积分`);
      } catch (pointsError) {
        console.error('❌ 增加积分失败:', pointsError);
        console.error('错误详情:', pointsError.message, pointsError.stack);
        // 不影响主流程，仅记录错误
      }

      // 📌 检查邀请人两类奖励（需要邀请关系时统一查一次）
      try {
        const referralConn = await pool.getConnection();
        try {
          // 查找邀请人
          const [relRows] = await referralConn.query(
            'SELECT referrer_user_id FROM invitation_relationship WHERE user_id = ?',
            [user_id]
          );
          if (relRows.length > 0 && relRows[0].referrer_user_id) {
            const referrerId = relRows[0].referrer_user_id;

            // 统计被邀请人的总广告观看次数（所有 ad_type 累计）
            const [viewRows] = await referralConn.query(
              'SELECT SUM(view_count) as total_views FROM ad_view_record WHERE user_id = ?',
              [user_id]
            );
            const totalViews = parseInt(viewRows[0].total_views || 0);

            // ① REFERRAL_1：被邀请人累计满5次广告 → 邀请人得6积分（仅1次）
            if (totalViews >= 5) {
              const [existRows] = await referralConn.query(
                'SELECT id FROM points_transaction WHERE user_id = ? AND related_user_id = ? AND points_type = ?',
                [referrerId, user_id, 'REFERRAL_1']
              );
              if (existRows.length === 0) {
                await PointsService.addPoints(
                  referrerId,
                  6,
                  'REFERRAL_1',
                  `成功邀请好友 ${user_id}（完成5次广告观看）`,
                  user_id
                );
                console.log(`✅ 邀请人 ${referrerId} 获得邀请奖励 6 积分（被邀请人 ${user_id} 完成5次广告）`);
                try {
                  await referralConn.query(
                    `INSERT INTO referral_milestone (user_id, milestone_type, milestone_count, total_referrals_at_claim, points_earned)
                     VALUES (?, '1_FRIEND', 1, 1, 6)`,
                    [referrerId]
                  );
                } catch (_) { /* 非关键，忽略 */ }
              }
            }

            // ② SUBORDINATE_AD_VIEW：被邀请人每累计满10次广告 → 邀请人得1积分
            const newMilestones = Math.floor(totalViews / 10);
            if (newMilestones > 0) {
              const [alreadyRows] = await referralConn.query(
                'SELECT COUNT(*) as cnt FROM points_transaction WHERE user_id = ? AND related_user_id = ? AND points_type = ?',
                [referrerId, user_id, 'SUBORDINATE_AD_VIEW']
              );
              const alreadyRewarded = parseInt(alreadyRows[0].cnt || 0);
              const toReward = newMilestones - alreadyRewarded;
              if (toReward > 0) {
                await PointsService.addPoints(
                  referrerId,
                  toReward,
                  'SUBORDINATE_AD_VIEW',
                  `下级用户 ${user_id} 广告观看里程碑奖励（累计${totalViews}次）`,
                  user_id
                );
                console.log(`✅ 邀请人 ${referrerId} 获得下级广告里程碑奖励 ${toReward} 积分（被邀请人 ${user_id} 累计${totalViews}次广告）`);
              }
            }
          }
        } finally {
          referralConn.release();
        }
      } catch (referralError) {
        console.error('❌ 邀请奖励检查失败（不影响主流程）:', referralError.message);
      }

      const now = new Date();
      const remainingSeconds = Math.max(0, Math.floor((newEndTime - now) / 1000));

      return res.json({
        success: true,
        message: isNewContract 
          ? `Created new Ad Free Contract with ${hours} hour(s)`
          : `Extended Ad Free Contract by ${hours} hour(s)`,
        data: {
          contract_id: contractId,
          is_new_contract: isNewContract,
          hours_added: hours,
          new_end_time: newEndTime,
          remaining_seconds: remainingSeconds,
          remaining_hours: Math.floor(remainingSeconds / 3600)
        }
      });

    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }
      throw error;
    }

  } catch (error) {
    if (connection) connection.release();
    console.error('延长合约时间失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to extend contract',
      error: error.message
    });
  }
});

module.exports = router;
