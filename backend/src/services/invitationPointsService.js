/**
 * 邀请奖励积分服务（增强版）
 * 负责邀请好友奖励、里程碑奖励等功能
 */

const db = require('../config/database');
const PointsService = require('./pointsService');
const AdPointsService = require('./adPointsService');

class InvitationPointsService {
  /**
   * 邀请奖励配置
   */
  static FIRST_FRIEND_REWARD = 6;   // 邀请第1个好友奖励6积分
  static TEN_FRIENDS_REWARD = 30;   // 每邀请满10个好友奖励30积分（可重复）
  static REFERRAL_AD_REQUIREMENT = 5; // 被邀请人需观看5次广告才能触发奖励

  /**
   * 处理邀请奖励（当被邀请人完成5次广告观看时触发）
   */
  static async processReferralReward(refereeUserId, referrerId) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 检查被邀请人是否完成5次广告观看
      const [adCountRows] = await connection.query(
        'SELECT SUM(view_count) as total_views FROM ad_view_record WHERE user_id = ?',
        [refereeUserId]
      );

      const totalViews = adCountRows[0]?.total_views || 0;
      if (totalViews < this.REFERRAL_AD_REQUIREMENT) {
        await connection.rollback();
        return {
          success: false,
          error: 'REQUIREMENT_NOT_MET',
          message: `被邀请人需观看至少${this.REFERRAL_AD_REQUIREMENT}次广告`
        };
      }

      // 2. 检查是否已奖励过这个邀请
      const [existingRows] = await connection.query(
        `SELECT id FROM points_transaction 
         WHERE user_id = ? 
         AND related_user_id = ? 
         AND points_type = ?`,
        [referrerId, refereeUserId, PointsService.POINTS_TYPES.REFERRAL_1]
      );

      if (existingRows.length > 0) {
        await connection.rollback();
        return {
          success: false,
          error: 'ALREADY_REWARDED',
          message: '该邀请奖励已发放'
        };
      }

      // 3. 发放首邀奖励（6积分）
      await PointsService.addPoints(
        referrerId,
        this.FIRST_FRIEND_REWARD,
        PointsService.POINTS_TYPES.REFERRAL_1,
        `成功邀请好友 ${refereeUserId}`,
        refereeUserId
      );

      // 4. 记录邀请里程碑
      await connection.query(
        `INSERT INTO referral_milestone (user_id, milestone_type, milestone_count, total_referrals_at_claim, points_earned)
         VALUES (?, '1_FRIEND', 1, 1, ?)`,
        [referrerId, this.FIRST_FRIEND_REWARD]
      );

      await connection.commit();

      console.log(`✅ 用户 ${referrerId} 获得首次邀请奖励 ${this.FIRST_FRIEND_REWARD} 积分（被邀请人：${refereeUserId}）`);

      return {
        success: true,
        milestoneType: '1_FRIEND',
        pointsEarned: this.FIRST_FRIEND_REWARD,
        referrerId,
        refereeUserId
      };

    } catch (error) {
      await connection.rollback();
      console.error('处理首次邀请奖励失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 处理每10人邀请里程碑奖励
   */
  static async handleTenFriendsMilestone(referrerId) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 统计有效邀请人数（完成5次广告观看）
      const [relationshipRows] = await connection.query(
        'SELECT user_id FROM invitation_relationship WHERE referrer_user_id = ?',
        [referrerId]
      );

      let validReferrals = 0;
      for (const row of relationshipRows) {
        const hasCompleted = await AdPointsService.hasCompletedReferralRequirement(row.user_id);
        if (hasCompleted) {
          validReferrals++;
        }
      }

      // 2. 检查已领取的10人里程碑奖励次数
      const [claimedRows] = await connection.query(
        `SELECT milestone_count 
         FROM referral_milestone 
         WHERE user_id = ? AND milestone_type = '10_FRIENDS'
         ORDER BY claimed_at DESC`,
        [referrerId]
      );

      const claimedCount = claimedRows.length; // 已领取次数
      const availableCount = Math.floor(validReferrals / 10); // 可领取次数

      if (availableCount <= claimedCount) {
        await connection.rollback();
        return {
          success: false,
          error: 'NO_REWARDS_AVAILABLE',
          message: '暂无可领取的10人邀请奖励',
          validReferrals,
          claimedCount,
          availableCount
        };
      }

      // 3. 发放未领取的奖励
      const rewardsToGrant = availableCount - claimedCount;
      let totalPoints = 0;

      for (let i = 0; i < rewardsToGrant; i++) {
        const milestoneNumber = claimedCount + i + 1;
        
        await connection.query(
          `INSERT INTO referral_milestone (user_id, milestone_type, milestone_count, total_referrals_at_claim, points_earned)
           VALUES (?, '10_FRIENDS', ?, ?, ?)`,
          [referrerId, milestoneNumber, validReferrals, this.TEN_FRIENDS_REWARD]
        );

        await PointsService.addPoints(
          referrerId,
          this.TEN_FRIENDS_REWARD,
          PointsService.POINTS_TYPES.REFERRAL_10,
          `邀请好友里程碑奖励（第${milestoneNumber}个10人）`,
          null
        );

        totalPoints += this.TEN_FRIENDS_REWARD;
      }

      await connection.commit();

      console.log(`✅ 用户 ${referrerId} 领取邀请里程碑奖励，发放${rewardsToGrant}次，总计 ${totalPoints} 积分`);

      return {
        success: true,
        referrerId,
        milestoneType: '10_FRIENDS',
        rewardsGranted: rewardsToGrant,
        totalPoints,
        validReferrals
      };

    } catch (error) {
      await connection.rollback();
      console.error('领取邀请里程碑奖励失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取邀请统计
   */
  static async getReferralStatistics(userId) {
    try {
      // 1. 统计邀请人数
      const [countRows] = await db.query(
        `SELECT COUNT(*) as total_referrals
         FROM invitation_relationship
         WHERE referrer_user_id = ?`,
        [userId]
      );

      const totalReferrals = countRows[0].total_referrals || 0;

      // 2. 统计有效邀请（完成5次广告观看）
      const [relationshipRows] = await db.query(
        'SELECT user_id FROM invitation_relationship WHERE referrer_user_id = ?',
        [userId]
      );

      let validReferrals = 0;
      for (const row of relationshipRows) {
        const hasCompleted = await AdPointsService.hasCompletedReferralRequirement(row.user_id);
        if (hasCompleted) {
          validReferrals++;
        }
      }

      // 3. 获取已领取的里程碑
      const [claimedRows] = await db.query(
        'SELECT milestone_type, milestone_count, points_earned, claimed_at FROM referral_milestone WHERE user_id = ? ORDER BY claimed_at DESC',
        [userId]
      );

      // 4. 计算可领取的里程碑
      const availableMilestones = [];

      // 首邀奖励（1人）
      if (validReferrals >= 1) {
        const claimed1Friend = claimedRows.find(r => r.milestone_type === '1_FRIEND');
        if (!claimed1Friend) {
          availableMilestones.push({
            type: '1_FRIEND',
            description: '邀请1位好友',
            points: this.FIRST_FRIEND_REWARD,
            currentCount: validReferrals,
            canClaim: true
          });
        }
      }

      // 10人里程碑（可重复领取）
      const claimed10Friends = claimedRows.filter(r => r.milestone_type === '10_FRIENDS');
      const claimed10Count = claimed10Friends.length;
      const available10Count = Math.floor(validReferrals / 10);

      if (available10Count > claimed10Count) {
        const unclaimedCount = available10Count - claimed10Count;
        availableMilestones.push({
          type: '10_FRIENDS',
          description: `邀请${available10Count * 10}位好友`,
          points: this.TEN_FRIENDS_REWARD * unclaimedCount,
          currentCount: validReferrals,
          claimableCount: unclaimedCount,
          canClaim: true
        });
      }

      return {
        success: true,
        totalReferrals,
        validReferrals,
        availableMilestones,
        claimedHistory: claimedRows
      };

    } catch (error) {
      console.error('获取邀请统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取下级用户列表及状态
   */
  static async getSubordinateList(userId, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;

      const [rows] = await db.query(
        `SELECT 
          ir.user_id,
          ui.invitation_code,
          ir.created_at as invited_at,
          COALESCE(SUM(avr.view_count), 0) as total_ad_views,
          CASE WHEN SUM(avr.view_count) >= 5 THEN 1 ELSE 0 END as is_valid
        FROM invitation_relationship ir
        LEFT JOIN user_information ui ON ir.user_id = ui.user_id
        LEFT JOIN ad_view_record avr ON ir.user_id = avr.user_id
        WHERE ir.referrer_user_id = ?
        GROUP BY ir.user_id, ui.invitation_code, ir.created_at
        ORDER BY ir.created_at DESC
        LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      const [countRows] = await db.query(
        'SELECT COUNT(*) as total FROM invitation_relationship WHERE referrer_user_id = ?',
        [userId]
      );

      return {
        success: true,
        data: rows,
        pagination: {
          page,
          limit,
          total: countRows[0].total,
          totalPages: Math.ceil(countRows[0].total / limit)
        }
      };

    } catch (error) {
      console.error('获取下级列表失败:', error);
      throw error;
    }
  }
}

module.exports = InvitationPointsService;
