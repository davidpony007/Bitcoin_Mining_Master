/**
 * 广告积分服务（增强版）
 * 负责广告观看记录、积分奖励、每日限制、下级奖励等功能
 */

const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const pool = require('../config/database_native'); // 使用原生MySQL连接池
const redisClient = require('../config/redis');
const PointsService = require('./pointsService');

class AdPointsService {
  /**
   * 广告奖励配置
   */
  static AD_REWARD_POINTS = 1;      // 每次观看广告奖励1积分
  static DAILY_AD_LIMIT = 20;       // 每日广告观看上限20次（封顶20积分）
  static SUBORDINATE_MILESTONE = 10; // 下级每看10次广告，邀请人获得1积分
  static REFERRAL_REQUIRED_ADS = 5;  // 被邀请人需观看5次广告才能触发邀请奖励

  /**
   * 记录广告观看并奖励积分
   */
  static async recordAdViewAndReward(userId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (UTC)

      // 1. 获取或创建今日观看记录
      let [todayRecord] = await connection.query(
        'SELECT id, view_count, points_earned FROM ad_view_record WHERE user_id = ? AND view_date = ? FOR UPDATE',
        [userId, today]
      );

      let viewCount = 0;
      let totalPointsToday = 0;

      if (todayRecord.length === 0) {
        // 首次观看，创建记录
        await connection.query(
          `INSERT INTO ad_view_record (user_id, view_date, view_count, points_earned) 
           VALUES (?, ?, 1, ?)`,
          [userId, today, this.AD_REWARD_POINTS]
        );
        viewCount = 1;
        totalPointsToday = this.AD_REWARD_POINTS;
      } else {
        // 更新观看次数
        viewCount = todayRecord[0].view_count + 1;
        
        // 判断是否已达每日上限
        if (todayRecord[0].view_count < this.DAILY_AD_LIMIT) {
          totalPointsToday = todayRecord[0].points_earned + this.AD_REWARD_POINTS;
          
          await connection.query(
            'UPDATE ad_view_record SET view_count = ?, points_earned = ?, updated_at = NOW() WHERE user_id = ? AND view_date = ?',
            [viewCount, totalPointsToday, userId, today]
          );
        } else {
          // 已达上限，只增加观看次数，不增加积分
          await connection.query(
            'UPDATE ad_view_record SET view_count = ?, updated_at = NOW() WHERE user_id = ? AND view_date = ?',
            [viewCount, userId, today]
          );
        }
      }

      // 2. 增加用户积分（仅在未达上限时）
      let pointsAwarded = 0;
      if (viewCount <= this.DAILY_AD_LIMIT) {
        await PointsService.addPoints(
          userId,
          this.AD_REWARD_POINTS,
          PointsService.POINTS_TYPES.AD_VIEW,
          `观看广告奖励（第${viewCount}次）`,
          null
        );
        pointsAwarded = this.AD_REWARD_POINTS;
      }

      // 2.5. 累加用户总广告观看次数（所有渠道）
      await connection.query(
        'UPDATE user_information SET total_ad_views = total_ad_views + 1 WHERE user_id = ?',
        [userId]
      );

      // 3. 处理邀请人奖励（下级每看10次广告，邀请人获得1积分）
      const subordinateReward = await this.handleSubordinateAdReward(userId, connection);

      // 4. 检查是否触发单个好友邀请奖励（被邀请人完成5次广告观看）
      let referralReward = null;
      const totalViews = await this.getTotalViewCount(userId, connection);
      
      if (totalViews === this.REFERRAL_REQUIRED_ADS) {
        // 刚好达到5次，触发邀请奖励
        referralReward = await this.handleReferralReward(userId, connection);
      }

      await connection.commit();

      // 4. 更新 Redis 缓存
      if (redisClient.isReady()) {
        await redisClient.setTodayAdCount(userId, viewCount);
      }

      const result = {
        success: true,
        userId,
        viewCount,
        totalPointsToday,
        pointsAwarded,
        dailyLimit: this.DAILY_AD_LIMIT,
        remainingViews: Math.max(0, this.DAILY_AD_LIMIT - viewCount),
        isLimitReached: viewCount >= this.DAILY_AD_LIMIT,
        subordinateReward,
        referralReward
      };

      console.log(`✅ 用户 ${userId} 观看广告，今日第${viewCount}次，获得${pointsAwarded}积分`);

      return result;

    } catch (error) {
      await connection.rollback();
      console.error('记录广告观看失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 处理下级用户广告观看奖励
   * 下级每看10次广告，邀请人获得1积分
   */
  static async handleSubordinateAdReward(subordinateUserId, connection) {
    try {
      // 1. 查找邀请人
      const [relationshipRows] = await connection.query(
        `SELECT ir.user_id as referrer_user_id, ir.referrer_user_id as referrer_id
         FROM invitation_relationship ir
         WHERE ir.user_id = ?`,
        [subordinateUserId]
      );

      if (relationshipRows.length === 0 || !relationshipRows[0].referrer_id) {
        return null; // 没有邀请人
      }

      const referrerId = relationshipRows[0].referrer_id;

      // 2. 统计下级用户的总观看次数
      const [adCountRows] = await connection.query(
        'SELECT SUM(view_count) as total_views FROM ad_view_record WHERE user_id = ?',
        [subordinateUserId]
      );

      // 转换为数字类型，防止字符串导致计算错误
      const totalViews = parseInt(adCountRows[0].total_views || 0);

      // 3. 计算应该奖励的次数（每10次1积分）
      const rewardedMilestones = Math.floor(totalViews / this.SUBORDINATE_MILESTONE);

      // 4. 查询已经奖励过的次数
      const [rewardedRows] = await connection.query(
        `SELECT COUNT(*) as rewarded_count 
         FROM points_transaction 
         WHERE user_id = ? 
         AND related_user_id = ? 
         AND points_type = ?`,
        [referrerId, subordinateUserId, PointsService.POINTS_TYPES.SUBORDINATE_AD_VIEW]
      );

      const alreadyRewarded = rewardedRows[0].rewarded_count;

      // 5. 计算需要新增的奖励
      const newRewards = rewardedMilestones - alreadyRewarded;

      if (newRewards > 0) {
        // 发放奖励
        const rewardPoints = newRewards * 1; // 每10次1积分
        
        await PointsService.addPoints(
          referrerId,
          rewardPoints,
          PointsService.POINTS_TYPES.SUBORDINATE_AD_VIEW,
          `下级用户 ${subordinateUserId} 观看广告里程碑奖励（${totalViews}次）`,
          subordinateUserId
        );

        console.log(`✅ 邀请人 ${referrerId} 获得下级广告奖励 ${rewardPoints} 积分`);

        return {
          referrerId,
          subordinateUserId,
          totalViews,
          rewardPoints,
          newMilestones: newRewards
        };
      }

      return null;

    } catch (error) {
      console.error('处理下级广告奖励失败:', error);
      return null;
    }
  }

  /**
   * 获取今日观看记录
   */
  static async getTodayAdRecord(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 优先从 Redis 获取
      if (redisClient.isReady()) {
        const count = await redisClient.getTodayAdCount(userId);
        if (count !== null) {
          return {
            success: true,
            userId,
            date: today,
            viewCount: count,
            pointsEarned: Math.min(count, this.DAILY_AD_LIMIT),
            dailyLimit: this.DAILY_AD_LIMIT,
            remainingViews: Math.max(0, this.DAILY_AD_LIMIT - count),
            isLimitReached: count >= this.DAILY_AD_LIMIT
          };
        }
      }

      // 从数据库获取
      const rows = await sequelize.query(
        'SELECT view_count, points_earned FROM ad_view_record WHERE user_id = :userId AND view_date = :today',
        {
          replacements: { userId, today },
          type: QueryTypes.SELECT
        }
      );

      if (rows.length === 0) {
        return {
          success: true,
          userId,
          date: today,
          viewCount: 0,
          pointsEarned: 0,
          dailyLimit: this.DAILY_AD_LIMIT,
          remainingViews: this.DAILY_AD_LIMIT,
          isLimitReached: false
        };
      }

      const record = {
        success: true,
        userId,
        date: today,
        viewCount: rows[0].view_count,
        pointsEarned: rows[0].points_earned,
        dailyLimit: this.DAILY_AD_LIMIT,
        remainingViews: Math.max(0, this.DAILY_AD_LIMIT - rows[0].view_count),
        isLimitReached: rows[0].view_count >= this.DAILY_AD_LIMIT
      };

      // 缓存到 Redis
      if (redisClient.isReady()) {
        await redisClient.setTodayAdCount(userId, record.viewCount);
      }

      return record;

    } catch (error) {
      console.error('获取今日观看记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取广告观看历史（最近N天）
   */
  static async getAdViewHistory(userId, days = 30) {
    try {
      const rows = await sequelize.query(
        `SELECT 
          view_date,
          view_count,
          points_earned,
          created_at
        FROM ad_view_record
        WHERE user_id = :userId
        AND view_date >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
        ORDER BY view_date DESC`,
        {
          replacements: { userId, days },
          type: QueryTypes.SELECT
        }
      );

      // 计算统计
      const totalViews = rows.reduce((sum, row) => sum + row.view_count, 0);
      const totalPoints = rows.reduce((sum, row) => sum + row.points_earned, 0);

      return {
        success: true,
        data: {
          history: rows,
          statistics: {
            days,
            totalViews,
            totalPoints,
            averageViewsPerDay: rows.length > 0 ? (totalViews / rows.length).toFixed(2) : 0
          }
        }
      };

    } catch (error) {
      console.error('获取广告观看历史失败:', error);
      throw error;
    }
  }

  /**
   * 检查用户是否完成邀请所需的广告观看
   */
  static async hasCompletedReferralRequirement(userId) {
    try {
      const [rows] = await sequelize.query(
        'SELECT SUM(view_count) as total_views FROM ad_view_record WHERE user_id = ?',
        [userId]
      );

      const totalViews = rows[0].total_views || 0;
      return totalViews >= this.REFERRAL_REQUIRED_ADS;

    } catch (error) {
      console.error('检查邀请要求失败:', error);
      return false;
    }
  }

  /**
   * 获取用户总观看次数（使用连接）
   */
  static async getTotalViewCount(userId, connection) {
    try {
      const [rows] = await connection.query(
        'SELECT SUM(view_count) as total_views FROM ad_view_record WHERE user_id = ?',
        [userId]
      );
      // 转换为数字类型,防止字符串比较问题
      const totalViews = parseInt(rows[0].total_views || 0);
      return totalViews;
    } catch (error) {
      console.error('获取总观看次数失败:', error);
      return 0;
    }
  }

  /**
   * 处理单个好友邀请奖励（当被邀请人完成5次广告观看时自动触发）
   */
  static async handleReferralReward(refereeUserId, connection) {
    try {
      // 引入 InvitationPointsService（避免循环依赖，在方法内部引入）
      const InvitationPointsService = require('./invitationPointsService');

      // 查找邀请人
      const [relationshipRows] = await connection.query(
        'SELECT referrer_user_id FROM invitation_relationship WHERE user_id = ?',
        [refereeUserId]
      );

      if (relationshipRows.length === 0 || !relationshipRows[0].referrer_user_id) {
        return null; // 没有邀请人
      }

      const referrerId = relationshipRows[0].referrer_user_id;

      // 检查是否已奖励过
      const [existingRows] = await connection.query(
        `SELECT id FROM points_transaction 
         WHERE user_id = ? 
         AND related_user_id = ? 
         AND points_type = ?`,
        [referrerId, refereeUserId, PointsService.POINTS_TYPES.REFERRAL_1]
      );

      if (existingRows.length > 0) {
        return null; // 已奖励
      }

      // 发放奖励
      await PointsService.addPoints(
        referrerId,
        InvitationPointsService.FIRST_FRIEND_REWARD,
        PointsService.POINTS_TYPES.REFERRAL_1,
        `成功邀请好友 ${refereeUserId}（完成5次广告观看）`,
        refereeUserId
      );

      // 记录里程碑
      await connection.query(
        `INSERT INTO referral_milestone (user_id, milestone_type, milestone_count, total_referrals_at_claim, points_earned)
         VALUES (?, '1_FRIEND', 1, 1, ?)`,
        [referrerId, InvitationPointsService.FIRST_FRIEND_REWARD]
      );

      console.log(`✅ 自动触发：用户 ${referrerId} 获得邀请奖励 ${InvitationPointsService.FIRST_FRIEND_REWARD} 积分（被邀请人 ${refereeUserId} 完成5次广告）`);

      return {
        referrerId,
        refereeUserId,
        pointsEarned: InvitationPointsService.FIRST_FRIEND_REWARD,
        triggered: true
      };

    } catch (error) {
      console.error('处理邀请奖励失败:', error);
      return null;
    }
  }

  /**
   * 检查用户是否完成邀请所需的广告观看
   */
  static async hasCompletedReferralRequirement(userId) {
    try {
      const [rows] = await sequelize.query(
        'SELECT SUM(view_count) as total_views FROM ad_view_record WHERE user_id = ?',
        [userId]
      );

      const totalViews = rows[0].total_views || 0;
      return totalViews >= this.REFERRAL_REQUIRED_ADS;

    } catch (error) {
      console.error('检查邀请要求失败:', error);
      return false;
    }
  }

  /**
   * 获取下级用户广告观看统计
   */
  static async getSubordinateAdStatistics(referrerId) {
    try {
      const rows = await sequelize.query(
        `SELECT 
          ir.user_id as subordinate_id,
          ui.invitation_code,
          SUM(avr.view_count) as total_views,
          MAX(avr.view_date) as last_view_date,
          FLOOR(SUM(avr.view_count) / 10) as milestone_count
        FROM invitation_relationship ir
        LEFT JOIN user_information ui ON ir.user_id = ui.user_id
        LEFT JOIN ad_view_record avr ON ir.user_id = avr.user_id
        WHERE ir.referrer_user_id = :referrerId
        GROUP BY ir.user_id, ui.invitation_code
        ORDER BY total_views DESC`,
        {
          replacements: { referrerId },
          type: QueryTypes.SELECT
        }
      );

      return {
        success: true,
        data: rows
      };

    } catch (error) {
      console.error('获取下级广告统计失败:', error);
      throw error;
    }
  }
}

module.exports = AdPointsService;
