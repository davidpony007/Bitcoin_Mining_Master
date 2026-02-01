/**
 * 邀请关系验证服务
 * 确保邀请关系的单向性，防止循环邀请
 */

const InvitationRelationship = require('../models/invitationRelationship');
const UserInformation = require('../models/userInformation');
const sequelize = require('../config/database');

class InvitationValidationService {
  /**
   * 验证邀请关系是否合法
   * @param {string} userId - 要绑定推荐人的用户ID
   * @param {string} referrerInvitationCode - 推荐人的邀请码
   * @returns {Object} { valid: boolean, error: string, errorCode: string }
   */
  static async validateInvitationRelationship(userId, referrerInvitationCode) {
    try {
      // 1. 查找推荐人信息
      const referrer = await UserInformation.findOne({
        where: { invitation_code: referrerInvitationCode }
      });

      if (!referrer) {
        return {
          valid: false,
          error: '邀请码不存在',
          errorCode: 'INVALID_INVITATION_CODE'
        };
      }

      // 2. 检查是否是自己的邀请码
      const currentUser = await UserInformation.findOne({
        where: { user_id: userId }
      });

      if (!currentUser) {
        return {
          valid: false,
          error: '用户不存在',
          errorCode: 'USER_NOT_FOUND'
        };
      }

      if (currentUser.invitation_code === referrerInvitationCode) {
        return {
          valid: false,
          error: '不能使用自己的邀请码',
          errorCode: 'CANNOT_INVITE_SELF'
        };
      }

      // 3. 检查当前用户是否已经有推荐人
      const existingRelation = await InvitationRelationship.findOne({
        where: { user_id: userId }
      });

      if (existingRelation) {
        return {
          valid: false,
          error: '您已经绑定过推荐人，每个用户只能绑定一次',
          errorCode: 'ALREADY_HAS_REFERRER'
        };
      }

      // 4. 检查是否会形成循环邀请（反向邀请）
      // 检查推荐人是否是当前用户的下级（直接或间接）
      const wouldCreateCycle = await this.checkForCycle(userId, referrer.user_id);
      
      if (wouldCreateCycle) {
        return {
          valid: false,
          error: '不能邀请您的下级成员，这会形成循环邀请关系',
          errorCode: 'CIRCULAR_INVITATION'
        };
      }

      // 5. 所有验证通过
      return {
        valid: true,
        referrer: {
          user_id: referrer.user_id,
          invitation_code: referrer.invitation_code,
          nickname: referrer.nickname
        }
      };

    } catch (error) {
      console.error('验证邀请关系失败:', error);
      return {
        valid: false,
        error: '系统错误，请稍后重试',
        errorCode: 'SYSTEM_ERROR'
      };
    }
  }

  /**
   * 检查是否会形成循环邀请
   * 递归检查推荐人是否在当前用户的下级链中
   * @param {string} userId - 当前用户ID
   * @param {string} potentialReferrerId - 潜在推荐人ID
   * @param {number} maxDepth - 最大递归深度（防止无限递归）
   * @returns {boolean} true表示会形成循环
   */
  static async checkForCycle(userId, potentialReferrerId, maxDepth = 10) {
    if (maxDepth <= 0) {
      console.warn('检查循环邀请超过最大深度');
      return true; // 超过最大深度，认为可能有循环
    }

    try {
      // 查询当前用户的所有下级（直接邀请的人）
      const downlineUsers = await sequelize.query(
        `SELECT user_id FROM invitation_relationship WHERE referrer_user_id = ?`,
        {
          replacements: [userId],
          type: sequelize.QueryTypes.SELECT
        }
      );

      // 如果潜在推荐人在当前用户的直接下级中，形成循环
      const isDirectDownline = downlineUsers.some(
        user => user.user_id === potentialReferrerId
      );

      if (isDirectDownline) {
        console.log(`检测到循环邀请: ${potentialReferrerId} 是 ${userId} 的下级`);
        return true;
      }

      // 递归检查每个下级的下级
      for (const downlineUser of downlineUsers) {
        const cycleInSubtree = await this.checkForCycle(
          downlineUser.user_id,
          potentialReferrerId,
          maxDepth - 1
        );
        
        if (cycleInSubtree) {
          return true;
        }
      }

      // 没有发现循环
      return false;

    } catch (error) {
      console.error('检查循环邀请失败:', error);
      return true; // 出错时保守处理，拒绝邀请
    }
  }

  /**
   * 获取用户的邀请链路信息（用于调试）
   * @param {string} userId - 用户ID
   * @param {number} maxDepth - 最大深度
   * @returns {Object} 邀请链路信息
   */
  static async getInvitationChain(userId, maxDepth = 5) {
    try {
      const chain = {
        userId,
        upline: [],  // 上级链
        downline: []  // 下级链
      };

      // 获取上级链（从当前用户往上追溯）
      let currentUserId = userId;
      let depth = 0;
      
      while (currentUserId && depth < maxDepth) {
        const relation = await InvitationRelationship.findOne({
          where: { user_id: currentUserId }
        });

        if (relation) {
          chain.upline.push({
            user_id: relation.referrer_user_id,
            invitation_code: relation.referrer_invitation_code
          });
          currentUserId = relation.referrer_user_id;
        } else {
          break;
        }
        depth++;
      }

      // 获取直接下级
      const directDownline = await sequelize.query(
        `SELECT user_id, invitation_code FROM invitation_relationship WHERE referrer_user_id = ?`,
        {
          replacements: [userId],
          type: sequelize.QueryTypes.SELECT
        }
      );

      chain.downline = directDownline;

      return chain;

    } catch (error) {
      console.error('获取邀请链路失败:', error);
      return null;
    }
  }
}

module.exports = InvitationValidationService;
