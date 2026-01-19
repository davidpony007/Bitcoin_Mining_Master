/**
 * 被邀请人（绑定推荐人）挖矿合约服务
 * 负责被邀请人绑定推荐人后获得挖矿合约
 * 特点：
 * - 仅在用户首次绑定推荐人时触发
 * - 用户只能绑定一次推荐人，无法更改
 * - 获得2小时挖矿合约
 * - 该奖励每个用户只能使用一次，用完后永久失效
 */

const FreeContractRecord = require('../models/freeContractRecord');
const UserInformation = require('../models/userInformation');
const InvitationRelationship = require('../models/invitationRelationship');
const LevelService = require('./levelService');

class RefereeMiningContractService {
  /**
   * 绑定推荐人的挖矿时长（2小时，仅一次）
   */
  static BIND_REFERRER_MINING_DURATION = 2 * 60 * 60 * 1000; // 2小时（毫秒）

  /**
   * 被邀请人绑定推荐人后创建挖矿合约
   * 业务逻辑：
   * 1. 验证用户是否已绑定过推荐人（只能绑定一次）
   * 2. 为被邀请人创建2小时挖矿合约
   * 3. 该合约仅能获得一次，不可重复领取
   * 
   * @param {string} refereeId - 被邀请人ID（绑定推荐人的用户）
   * @param {string} referrerId - 推荐人ID
   */
  static async onBindReferrer(refereeId, referrerId) {
    try {
      // 1. 验证被邀请人存在
      const referee = await UserInformation.findOne({
        where: { user_id: refereeId }
      });

      if (!referee) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      // 2. 验证是否已经有推荐人（防止重复绑定）
      const existingRelation = await InvitationRelationship.findOne({
        where: { user_id: refereeId }
      });

      if (!existingRelation) {
        return {
          success: false,
          message: '邀请关系不存在，无法创建绑定奖励合约'
        };
      }

      // 3. 检查是否已经领取过绑定奖励（防止重复领取）
      const existingBindContract = await FreeContractRecord.findOne({
        where: {
          user_id: refereeId,
          free_contract_type: 'bind referrer free contract'
        }
      });

      if (existingBindContract) {
        return {
          success: false,
          message: '您已经领取过绑定推荐人奖励，该奖励每个用户只能领取一次',
          alreadyClaimed: true
        };
      }

      // 4. 计算挖矿速度（基础奖励 × 国家系数 × 矿工等级速率系数，不含签到加成）
      const speedInfo = await LevelService.calculateMiningSpeed(refereeId);

      // 5. 创建绑定推荐人挖矿合约
      const now = new Date();
      const endTime = new Date(now.getTime() + this.BIND_REFERRER_MINING_DURATION);

      const contract = await FreeContractRecord.create({
        user_id: refereeId,
        free_contract_type: 'bind referrer free contract',
        free_contract_revenue: 0,
        free_contract_creation_time: now,
        free_contract_end_time: endTime,
        hashrate: speedInfo.finalSpeedWithoutBonus, // 使用不含签到加成的标准速度
        mining_status: 'mining'
      });

      console.log(`✅ 创建绑定推荐人挖矿合约: 被邀请人 ${refereeId}, 结束时间 ${endTime}`);

      return {
        success: true,
        message: '成功绑定推荐人，获得2小时挖矿合约',
        contract: {
          id: contract.id,
          type: 'bind referrer free contract',
          startTime: contract.free_contract_creation_time,
          endTime: contract.free_contract_end_time,
          hashrate: contract.hashrate,
          miningStatus: contract.mining_status
        },
        speedInfo: {
          baseSpeed: speedInfo.baseSpeed,
          baseHashrate: speedInfo.baseHashrateGhs + ' Gh/s',
          levelMultiplier: speedInfo.levelMultiplier,
          dailyBonusMultiplier: speedInfo.dailyBonusMultiplier,
          countryMultiplier: speedInfo.countryMultiplier,
          finalSpeed: speedInfo.finalSpeedWithoutBonus // 不包含签到加成
        },
        reminder: '此奖励每个用户只能领取一次，请珍惜挖矿时间'
      };

    } catch (err) {
      console.error('❌ 创建绑定推荐人挖矿合约失败:', err);
      throw err;
    }
  }

  /**
   * 获取用户的绑定推荐人合约状态
   * @param {string} userId - 用户ID
   */
  static async getContractStatus(userId) {
    try {
      const contract = await FreeContractRecord.findOne({
        where: {
          user_id: userId,
          free_contract_type: 'bind referrer free contract'
        }
      });

      if (!contract) {
        return {
          hasContract: false,
          message: '暂未领取绑定推荐人奖励'
        };
      }

      const now = new Date();
      const endTime = new Date(contract.free_contract_end_time);
      const isMining = contract.mining_status === 'mining' && endTime > now;
      const remainingSeconds = isMining ? Math.max(0, Math.floor((endTime - now) / 1000)) : 0;

      return {
        hasContract: true,
        contract: {
          id: contract.id,
          type: 'bind referrer free contract',
          startTime: contract.free_contract_creation_time,
          endTime: contract.free_contract_end_time,
          hashrate: contract.hashrate,
          miningStatus: contract.mining_status,
          isMining,
          remainingSeconds,
          remainingFormatted: this.formatDuration(remainingSeconds)
        },
        reminder: isMining ? '挖矿进行中' : '挖矿已完成'
      };

    } catch (err) {
      console.error('❌ 获取绑定推荐人合约状态失败:', err);
      throw err;
    }
  }

  /**
   * 格式化剩余时间
   */
  static formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}小时 ${minutes}分钟 ${secs}秒`;
  }
}

module.exports = RefereeMiningContractService;
