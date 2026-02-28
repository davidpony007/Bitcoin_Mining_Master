/**
 * 邀请奖励服务
 * 负责邀请关系管理、邀请奖励发放、里程碑奖励等功能
 */

const db = require('../config/database');
const redisClient = require('../config/redis');

class InvitationRewardService {
  /**
   * 邀请奖励配置
   */
  static REWARDS = {
    NEW_REFERRAL: 6,        // 每邀请1人（且完成5次广告）+6积分
    MILESTONE_10: 30        // 每邀请10人（且完成5次广告）额外 +30积分（可多次领取）
  };

  static MIN_AD_WATCH_COUNT = 5; // 被邀请人需完成的最少广告观看次数

  /**
   * 检查被邀请人是否满足奖励条件（观看了5次广告）
   */
  static async checkReferralQualified(referralId) {
    const connection = await db.getConnection();
    try {
      const [result] = await connection.query(
        'SELECT COUNT(*) as ad_count FROM ad_watch_record WHERE user_id = ? AND is_completed = TRUE',
        [referralId]
      );
      return result[0].ad_count >= this.MIN_AD_WATCH_COUNT;
    } finally {
      connection.release();
    }
  }

  /**
   * 处理新用户注册 (记录邀请关系，暂不发放奖励)
   * 注意: 奖励将在被邀请人完成5次广告观看后发放
   */
  static async handleNewReferral(_referrerId, _referralId, _referralInvitationCode) {
    // 只记录邀请关系，不立即发放奖励
    return {
      baseReward: 0,
      message: '邀请关系已建立，待好友完成5次广告观看后可获得奖励',
      milestoneReward: null
    };
  }

  /**
   * 检查并发放邀请奖励（当被邀请人完成第5次广告时调用）
   */
  static async processInvitationReward(referralId) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 检查被邀请人的广告观看次数
      const [adCount] = await connection.query(
        'SELECT COUNT(*) as count FROM ad_watch_record WHERE user_id = ? AND is_completed = TRUE',
        [referralId]
      );

      if (adCount[0].count !== this.MIN_AD_WATCH_COUNT) {
        // 只在第5次观看时处理
        await connection.rollback();
        return null;
      }

      // 2. 查询邀请人信息
      const [referralInfo] = await connection.query(
        'SELECT referrer_invitation_code FROM user_information WHERE user_id = ?',
        [referralId]
      );

      if (!referralInfo.length || !referralInfo[0].referrer_invitation_code) {
        await connection.rollback();
        return null;
      }

      const [referrerInfo] = await connection.query(
        'SELECT user_id FROM user_information WHERE invitation_code = ?',
        [referralInfo[0].referrer_invitation_code]
      );

      if (!referrerInfo.length) {
        await connection.rollback();
        return null;
      }

      const referrerId = referrerInfo[0].user_id;

      // 3. 检查是否已经发放过此被邀请人的奖励
      const [rewardCheck] = await connection.query(
        'SELECT id FROM points_transaction WHERE user_id = ? AND reason_type = ? AND related_user_id = ?',
        [referrerId, 'INVITE', referralId]
      );

      if (rewardCheck.length > 0) {
        // 已经发放过
        await connection.rollback();
        return null;
      }

      // 4. 给邀请人发放基础邀请奖励 (+6积分)
      await connection.query(
        'CALL sp_add_user_points(?, ?, ?, ?, ?, NULL)',
        [
          referrerId,
          this.REWARDS.NEW_REFERRAL,
          `邀请新用户 ${referralId} (已完成5次广告)`,
          'INVITE',
          referralId
        ]
      );

      // 5. 查询邀请人已获得奖励的邀请总数（有效邀请数）
      const [validInviteCount] = await connection.query(
        'SELECT COUNT(DISTINCT related_user_id) as count FROM points_transaction WHERE user_id = ? AND reason_type = ?',
        [referrerId, 'INVITE']
      );

      const totalValidInvites = validInviteCount[0].count;

      // 6. 检查并发放10人里程碑奖励（可多次领取）
      let milestoneReward = null;

      if (totalValidInvites > 0 && totalValidInvites % 10 === 0) {
        // 每满10人发放一次
        const milestoneCount = Math.floor(totalValidInvites / 10);
        
        await connection.query(
          `INSERT INTO invitation_reward_progress (
            user_id,
            milestone_type,
            current_count,
            target_count,
            is_completed,
            completed_at,
            points_awarded
          ) VALUES (?, ?, ?, 10, TRUE, NOW(), ?)`,
          [referrerId, `INVITE_10_${milestoneCount}`, totalValidInvites, this.REWARDS.MILESTONE_10]
        );

        await connection.query(
          'CALL sp_add_user_points(?, ?, ?, ?, NULL, NULL)',
          [referrerId, this.REWARDS.MILESTONE_10, `邀请达成${totalValidInvites}人里程碑`, 'INVITE_MILESTONE_10']
        );

        milestoneReward = {
          milestone: totalValidInvites,
          points: this.REWARDS.MILESTONE_10,
          message: `恭喜! 邀请达成${totalValidInvites}人里程碑`
        };
      }

      await connection.commit();

      // 7. 清除邀请人的缓存
      if (redisClient.isReady()) {
        await redisClient.deleteUserLevel(referrerId);
        await redisClient.deleteInvitationProgress(referrerId);
      }

      return {
        success: true,
        baseReward: this.REWARDS.NEW_REFERRAL,
        totalValidInvites,
        milestoneReward
      };

    } catch (error) {
      await connection.rollback();
      console.error('❌ 处理新用户邀请奖励失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取邀请进度
   */
  static async getInvitationProgress(userId) {
    try {
      // 1. 尝试从 Redis 获取
      if (redisClient.isReady()) {
        const cachedProgress = await redisClient.getInvitationProgress(userId);
        if (cachedProgress) {
          return cachedProgress;
        }
      }

      // 2. 从数据库获取
      // 获取用户的邀请码
      const [userInfo] = await db.query(
        'SELECT invitation_code FROM user_information WHERE user_id = ?',
        [userId]
      );

      if (userInfo.length === 0) {
        throw new Error('用户不存在');
      }

      const invitationCode = userInfo[0].invitation_code;

      // 获取邀请总数
      const [inviteCount] = await db.query(
        'SELECT COUNT(*) as count FROM user_information WHERE referrer_invitation_code = ?',
        [invitationCode]
      );

      const totalCount = inviteCount[0].count;

      // 获取里程碑完成情况
      const [milestones] = await db.query(
        'SELECT milestone_type, is_completed, points_awarded FROM invitation_reward_progress WHERE user_id = ?',
        [userId]
      );

      const milestone5 = milestones.find(m => m.milestone_type === 'INVITE_5');
      const milestone10 = milestones.find(m => m.milestone_type === 'INVITE_10');

      // 获取下级用户广告观看奖励总数
      const [adRewards] = await db.query(
        'SELECT SUM(rewarded_count) as total FROM referral_ad_watch_count WHERE referrer_id = ?',
        [userId]
      );

      const result = {
        totalInvited: totalCount,
        milestone5: {
          target: 5,
          current: Math.min(totalCount, 5),
          claimed: milestone5 ? milestone5.is_completed : false,
          points: this.REWARDS.MILESTONE_5
        },
        milestone10: {
          target: 10,
          current: Math.min(totalCount, 10),
          claimed: milestone10 ? milestone10.is_completed : false,
          points: this.REWARDS.MILESTONE_10
        },
        referralAdRewards: adRewards[0].total || 0,
        totalPointsEarned: (
          (totalCount * this.REWARDS.NEW_REFERRAL) +
          (milestone5 && milestone5.is_completed ? this.REWARDS.MILESTONE_5 : 0) +
          (milestone10 && milestone10.is_completed ? this.REWARDS.MILESTONE_10 : 0) +
          (adRewards[0].total || 0)
        )
      };

      // 3. 缓存到 Redis
      if (redisClient.isReady()) {
        await redisClient.cacheInvitationProgress(userId, {
          totalCount: result.totalInvited,
          milestone5Claimed: result.milestone5.claimed,
          milestone10Claimed: result.milestone10.claimed,
          referralAdRewards: result.referralAdRewards
        });
      }

      return result;

    } catch (error) {
      console.error('❌ 获取邀请进度失败:', error);
      throw error;
    }
  }

  /**
   * 获取被邀请用户列表
   */
  static async getReferralList(userId, page = 1, limit = 20) {
    try {
      // 获取用户的邀请码
      const [userInfo] = await db.query(
        'SELECT invitation_code FROM user_information WHERE user_id = ?',
        [userId]
      );

      if (userInfo.length === 0) {
        throw new Error('用户不存在');
      }

      const invitationCode = userInfo[0].invitation_code;
      const offset = (page - 1) * limit;

      // 获取总数
      const [countResult] = await db.query(
        'SELECT COUNT(*) as total FROM user_information WHERE referrer_invitation_code = ?',
        [invitationCode]
      );
      const total = countResult[0].total;

      // 获取分页数据
      const [referrals] = await db.query(
        `SELECT 
          u.user_id,
          u.google_account,
          u.country,
          u.user_level,
          u.user_points,
          u.created_at,
          u.last_login_time,
          COALESCE(r.total_ad_count, 0) as ad_watch_count
        FROM user_information u
        LEFT JOIN referral_ad_watch_count r ON u.user_id = r.referral_id AND r.referrer_id = ?
        WHERE u.referrer_invitation_code = ?
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?`,
        [userId, invitationCode, limit, offset]
      );

      return {
        referrals: referrals.map(r => ({
          userId: r.user_id,
          googleAccount: r.google_account,
          country: r.country_code,
          level: r.user_level,
          points: r.user_points,
          adWatchCount: r.ad_watch_count,
          joinedAt: r.created_at,
          lastLoginTime: r.last_login_time
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      console.error('❌ 获取被邀请用户列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取邀请统计信息
   */
  static async getInvitationStatistics(userId) {
    try {
      const progress = await this.getInvitationProgress(userId);

      // 获取本月邀请数
      const [userInfo] = await db.query(
        'SELECT invitation_code FROM user_information WHERE user_id = ?',
        [userId]
      );

      const invitationCode = userInfo[0].invitation_code;

      const [monthlyCount] = await db.query(
        `SELECT COUNT(*) as count 
        FROM user_information 
        WHERE referrer_invitation_code = ? 
        AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
        [invitationCode]
      );

      // 获取本周邀请数
      const [weeklyCount] = await db.query(
        `SELECT COUNT(*) as count 
        FROM user_information 
        WHERE referrer_invitation_code = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
        [invitationCode]
      );

      // 获取今日邀请数
      const [todayCount] = await db.query(
        `SELECT COUNT(*) as count 
        FROM user_information 
        WHERE referrer_invitation_code = ? 
        AND DATE(created_at) = CURDATE()`,
        [invitationCode]
      );

      return {
        totalInvited: progress.totalInvited,
        monthlyInvited: monthlyCount[0].count,
        weeklyInvited: weeklyCount[0].count,
        todayInvited: todayCount[0].count,
        totalPointsEarned: progress.totalPointsEarned,
        milestones: {
          milestone5: progress.milestone5,
          milestone10: progress.milestone10
        },
        referralAdRewards: progress.referralAdRewards
      };

    } catch (error) {
      console.error('❌ 获取邀请统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取邀请排行榜 (Top 100)
   */
  static async getInvitationLeaderboard(limit = 100) {
    try {
      const [rows] = await db.query(
        `SELECT 
          u.user_id,
          u.invitation_code,
          COUNT(r.id) as total_invited,
          u.user_level,
          u.user_points,
          u.created_at
        FROM user_information u
        LEFT JOIN user_information r ON u.invitation_code = r.referrer_invitation_code
        GROUP BY u.user_id
        HAVING total_invited > 0
        ORDER BY total_invited DESC, u.user_points DESC
        LIMIT ?`,
        [limit]
      );

      return rows.map((row, index) => ({
        rank: index + 1,
        userId: row.user_id,
        invitationCode: row.invitation_code,
        totalInvited: row.total_invited,
        userLevel: row.user_level,
        userPoints: row.user_points,
        joinedAt: row.created_at
      }));

    } catch (error) {
      console.error('❌ 获取邀请排行榜失败:', error);
      throw error;
    }
  }
}

module.exports = InvitationRewardService;
