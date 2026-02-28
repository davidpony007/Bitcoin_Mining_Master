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
          free_contract_type: 'Bind Referrer Reward'
        }
      });

      if (existingBindContract) {
        return {
          success: false,
          message: '您已经领取过绑定推荐人奖励，该奖励每个用户只能领取一次',
          alreadyClaimed: true
        };
      }

      // 4. 获取纯基础挖矿速率（不含任何倍数）
      const BASE_HASHRATE = 0.000000000000139;
      
      // 5. 计算当前的速度信息（仅用于返回给前端显示）
      const speedInfo = await LevelService.calculateMiningSpeed(refereeId);

      // 6. 创建绑定推荐人挖矿合约（只存储基础速率）
      const now = new Date();
      const endTime = new Date(now.getTime() + this.BIND_REFERRER_MINING_DURATION);

      const contract = await FreeContractRecord.create({
        user_id: refereeId,
        free_contract_type: 'Bind Referrer Reward',
        free_contract_creation_time: now,
        free_contract_end_time: endTime,
        base_hashrate: BASE_HASHRATE,  // 新字段：纯基础速率
        has_daily_bonus: 0,  // 标记：不含签到加成
        hashrate: BASE_HASHRATE  // 兼容字段
      });

      console.log(`✅ 创建绑定推荐人挖矿合约: 被邀请人 ${refereeId}, 结束时间 ${endTime}, 基础速率 ${BASE_HASHRATE.toExponential(2)} BTC/s`);

      return {
        success: true,
        message: '成功绑定推荐人，获得2小时挖矿合约',
        contract: {
          id: contract.id,
          type: 'Bind Referrer Reward',
          startTime: contract.free_contract_creation_time,
          endTime: contract.free_contract_end_time,
          hashrate: speedInfo.finalSpeedWithoutBonus  // 返回当前计算的速率（用于显示）
        },
        speedInfo: {
          baseSpeed: speedInfo.baseSpeed,
          baseHashrateDisplay: speedInfo.baseHashrateGhs + ' Gh/s',
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
          free_contract_type: 'Bind Referrer Reward'
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
      const isMining = endTime > now;
      const remainingSeconds = isMining ? Math.max(0, Math.floor((endTime - now) / 1000)) : 0;

      return {
        hasContract: true,
        contract: {
          id: contract.id,
          type: 'Bind Referrer Reward',
          startTime: contract.free_contract_creation_time,
          endTime: contract.free_contract_end_time,
          hashrate: contract.hashrate,
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
