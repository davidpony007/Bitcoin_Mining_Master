/**
 * 广告观看服务
 * 负责广告观看记录、积分奖励、下级用户广告观看计数等功能
 */

const db = require('../config/database');
const redisClient = require('../config/redis');
const LevelService = require('./levelService');
const InvitationRewardService = require('./invitationRewardService');

class AdService {
  /**
   * 广告奖励配置
   */
  static AD_REWARD_POINTS = 1; // 每次观看广告奖励1积分
  static DAILY_AD_LIMIT = 20; // 每日广告观看上限20次
  static REFERRAL_AD_MILESTONE = 10; // 下级用户每看10次广告，邀请人获得1积分
  static MIN_AD_WATCH_FOR_INVITE = 5; // 被邀请人需观看5次广告才能触发邀请奖励

  /**
   * 记录广告观看
   */
  static async recordAdWatch(userId, adType = 'REWARD_AD', adUnitId = null, watchDuration = 30, isCompleted = true) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 插入广告观看记录
      const [insertResult] = await connection.query(
        `INSERT INTO ad_watch_record (
          user_id,
          ad_type,
          ad_unit_id,
          points_earned,
          watch_duration,
          is_completed
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, adType, adUnitId, this.AD_REWARD_POINTS, watchDuration, isCompleted]
      );

      const adRecordId = insertResult.insertId;

      // 2. 检查今日观看次数是否已达上限
      let todayAdCount = 0;
      if (redisClient.isReady()) {
        todayAdCount = await redisClient.getTodayAdCount(userId);
      }

      // 3. 增加用户积分 (仅在完整观看且未达上限时)
      let pointsEarned = 0;
      if (isCompleted && todayAdCount < this.DAILY_AD_LIMIT) {
        await connection.query(
          'CALL sp_add_user_points(?, ?, ?, ?, NULL, ?)',
          [userId, this.AD_REWARD_POINTS, '观看广告奖励', 'AD_WATCH', adRecordId]
        );
        pointsEarned = this.AD_REWARD_POINTS;

        // 增加今日观看计数 (Redis)
        if (redisClient.isReady()) {
          todayAdCount = await redisClient.incrementTodayAdCount(userId);
        }
      }

      // 4. 查询用户的邀请人
      const [userInfo] = await connection.query(
        'SELECT referrer_invitation_code FROM user_information WHERE user_id = ?',
        [userId]
      );

      let referrerReward = null;

      if (userInfo.length > 0 && userInfo[0].referrer_invitation_code) {
        // 5. 查询邀请人 ID
        const [referrerInfo] = await connection.query(
          'SELECT user_id FROM user_information WHERE invitation_code = ?',
          [userInfo[0].referrer_invitation_code]
        );

        if (referrerInfo.length > 0) {
          const referrerId = referrerInfo[0].user_id;

          // 6. 更新或插入下级用户广告观看计数
          await connection.query(
            `INSERT INTO referral_ad_watch_count (
              referrer_id,
              referral_id,
              total_ad_count,
              rewarded_count,
              last_ad_watch_at
            ) VALUES (?, ?, 1, 0, NOW())
            ON DUPLICATE KEY UPDATE
              total_ad_count = total_ad_count + 1,
              last_ad_watch_at = NOW()`,
            [referrerId, userId]
          );

          // 7. 查询当前计数
          const [countRecord] = await connection.query(
            'SELECT total_ad_count, rewarded_count FROM referral_ad_watch_count WHERE referrer_id = ? AND referral_id = ?',
            [referrerId, userId]
          );

          if (countRecord.length > 0) {
            const totalCount = countRecord[0].total_ad_count;
            const rewardedCount = countRecord[0].rewarded_count;

            // 8. 检查是否达到奖励里程碑 (每10次)
            const newRewards = Math.floor(totalCount / this.REFERRAL_AD_MILESTONE) - rewardedCount;

            if (newRewards > 0) {
              // 9. 给邀请人发放奖励
              const rewardPoints = newRewards * 1; // 每10次广告 +1 积分
              await connection.query(
                'CALL sp_add_user_points(?, ?, ?, ?, ?, ?)',
                [
                  referrerId,
                  rewardPoints,
                  `下级用户 ${userId} 观看广告奖励 (${newRewards}次里程碑)`,
                  'REFERRAL_AD_WATCH',
                  userId,
                  adRecordId
                ]
              );

              // 10. 更新已奖励计数
              await connection.query(
                'UPDATE referral_ad_watch_count SET rewarded_count = rewarded_count + ? WHERE referrer_id = ? AND referral_id = ?',
                [newRewards, referrerId, userId]
              );

              referrerReward = {
                referrerId,
                rewardPoints,
                milestoneCount: newRewards,
                totalAdCount: totalCount
              };

              // 11. 清除邀请人的等级缓存
              if (redisClient.isReady()) {
                await redisClient.deleteUserLevel(referrerId);
              }
            }

            // 12. 更新 Redis 计数
            if (redisClient.isReady()) {
              await redisClient.incrementReferralAdCount(referrerId, userId);
            }
          }
        }
      }

      await connection.commit();

      // 13. 检查是否完成第5次广告（触发邀请奖励）
      let invitationRewardResult = null;
      if (isCompleted) {
        const [adCountResult] = await connection.query(
          'SELECT COUNT(*) as count FROM ad_watch_record WHERE user_id = ? AND is_completed = TRUE',
          [userId]
        );
        
        if (adCountResult[0].count === this.MIN_AD_WATCH_FOR_INVITE) {
          // 触发邀请奖励发放
          try {
            invitationRewardResult = await InvitationRewardService.processInvitationReward(userId);
          } catch (error) {
            console.error('❌ 处理邀请奖励失败:', error);
          }
        }
      }

      // 14. 清除用户等级缓存 (积分已变化)
      if (redisClient.isReady() && isCompleted) {
        await redisClient.deleteUserLevel(userId);
      }

      // 15. 获取最新用户等级信息
      const levelInfo = isCompleted ? await LevelService.getUserLevel(userId) : null;

      return {
        success: true,
        message: '广告观看记录成功',
        adRecordId,
        pointsEarned,
        todayAdCount,
        dailyLimitReached: todayAdCount >= this.DAILY_AD_LIMIT,
        userLevel: levelInfo ? levelInfo.level : null,
        userPoints: levelInfo ? levelInfo.points : null,
        referrerReward,
        invitationRewardTriggered: invitationRewardResult !== null
      };

    } catch (error) {
      await connection.rollback();
      console.error('❌ 记录广告观看失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取今日广告观看次数
   */
  static async getTodayAdCount(userId) {
    try {
      // 优先从 Redis 获取
      if (redisClient.isReady()) {
        const count = await redisClient.getTodayAdCount(userId);
        return count;
      }

      // 从数据库获取
      const today = new Date().toISOString().split('T')[0];
      const [result] = await db.query(
        'SELECT COUNT(*) as count FROM ad_watch_record WHERE user_id = ? AND DATE(watched_at) = ?',
        [userId, today]
      );

      return result[0].count;

    } catch (error) {
      console.error('❌ 获取今日广告观看次数失败:', error);
      return 0;
    }
  }

  /**
   * 获取广告观看统计
   */
  static async getAdWatchStatistics(userId) {
    try {
      const [stats] = await db.query(
        `SELECT 
          COUNT(*) as total_ads_watched,
          SUM(points_earned) as total_points_from_ads,
          SUM(watch_duration) as total_watch_time,
          COUNT(DISTINCT DATE(watched_at)) as total_watch_days
        FROM ad_watch_record
        WHERE user_id = ? AND is_completed = TRUE`,
        [userId]
      );

      // 获取今日观看次数
      const todayCount = await this.getTodayAdCount(userId);

      return {
        totalAdsWatched: stats[0].total_ads_watched || 0,
        totalPointsFromAds: stats[0].total_points_from_ads || 0,
        totalWatchTime: stats[0].total_watch_time || 0,
        totalWatchDays: stats[0].total_watch_days || 0,
        todayAdCount: todayCount
      };

    } catch (error) {
      console.error('❌ 获取广告观看统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取广告观看历史
   */
  static async getAdWatchHistory(userId, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;

      // 获取总数
      const [countResult] = await db.query(
        'SELECT COUNT(*) as total FROM ad_watch_record WHERE user_id = ?',
        [userId]
      );
      const total = countResult[0].total;

      // 获取分页数据
      const [records] = await db.query(
        `SELECT 
          id,
          ad_type,
          ad_unit_id,
          points_earned,
          watch_duration,
          is_completed,
          watched_at
        FROM ad_watch_record
        WHERE user_id = ?
        ORDER BY watched_at DESC
        LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      return {
        history: records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      console.error('❌ 获取广告观看历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取下级用户广告观看进度 (邀请人视角)
   */
  static async getReferralAdProgress(referrerId) {
    try {
      const [records] = await db.query(
        `SELECT 
          r.referral_id,
          r.total_ad_count,
          r.rewarded_count,
          r.last_ad_watch_at,
          u.google_account,
          u.country,
          u.created_at as referral_join_date
        FROM referral_ad_watch_count r
        LEFT JOIN user_information u ON r.referral_id = u.user_id
        WHERE r.referrer_id = ?
        ORDER BY r.total_ad_count DESC`,
        [referrerId]
      );

      const totalReferrals = records.length;
      const totalAdWatches = records.reduce((sum, r) => sum + r.total_ad_count, 0);
      const totalRewardsEarned = records.reduce((sum, r) => sum + r.rewarded_count, 0);

      return {
        referrals: records.map(r => ({
          referralId: r.referral_id,
          googleAccount: r.google_account,
          country: r.country_code,
          totalAdCount: r.total_ad_count,
          rewardedCount: r.rewarded_count,
          pendingMilestone: r.total_ad_count % this.REFERRAL_AD_MILESTONE,
          nextMilestoneIn: this.REFERRAL_AD_MILESTONE - (r.total_ad_count % this.REFERRAL_AD_MILESTONE),
          lastAdWatchAt: r.last_ad_watch_at,
          joinedAt: r.referral_join_date
        })),
        summary: {
          totalReferrals,
          totalAdWatches,
          totalRewardsEarned,
          pendingRewards: Math.floor(totalAdWatches / this.REFERRAL_AD_MILESTONE) - totalRewardsEarned
        }
      };

    } catch (error) {
      console.error('❌ 获取下级用户广告观看进度失败:', error);
      throw error;
    }
  }
}

module.exports = AdService;
