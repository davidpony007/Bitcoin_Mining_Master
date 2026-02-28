/**
 * 普通广告挖矿合约服务
 * 负责普通广告挖矿合约的创建、延长时间等功能
 * 特点：每次观看广告增加2小时挖矿时间，每日限制20次
 */

const FreeContractRecord = require('../models/freeContractRecord');
const UserInformation = require('../models/userInformation');
const LevelService = require('./levelService');
const AdPointsService = require('./adPointsService');
const { Op } = require('sequelize');

class AdMiningContractService {
  /**
   * 每次广告增加的挖矿时长（2小时）
   */
  static AD_MINING_DURATION = 2 * 60 * 60 * 1000; // 2小时（毫秒）
  static DAILY_AD_LIMIT = 20; // 每日广告观看上限

  /**
   * 观看广告并创建或延长挖矿合约
   * 业务逻辑：
   * 1. 如果用户没有活跃的普通广告挖矿合约，创建新合约（2小时）
   * 2. 如果用户已有活跃合约，延长2小时（最多20次/天）
   * 3. UTC+00:00每日重置观看次数
   */
  static async watchAdAndExtendMining(userId) {
    try {
      // 1. 验证用户存在
      const user = await UserInformation.findOne({
        where: { user_id: userId }
      });

      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      // 2. 检查今日广告观看次数
      const todayStats = await AdPointsService.getDailyAdStats(userId);
      
      if (todayStats.isLimitReached) {
        return {
          success: false,
          message: `今日广告观看已达上限（${this.DAILY_AD_LIMIT}次），请明天再来`,
          todayViews: todayStats.viewCount,
          dailyLimit: this.DAILY_AD_LIMIT
        };
      }

      // 3. 查找用户当前的普通广告挖矿合约
      const now = new Date();
      const existingContract = await FreeContractRecord.findOne({
        where: {
          user_id: userId,
          free_contract_type: 'Free Ad Reward',
          free_contract_end_time: {
            [Sequelize.Op.gt]: now
          }
        },
        order: [['free_contract_creation_time', 'DESC']]
      });

      // 4. 获取纯基础挖矿速率（不含任何倍数）
      const BASE_HASHRATE = 0.000000000000139;

      // 5. 计算当前的速度信息（仅用于返回给前端显示）
      const speedInfo = await LevelService.calculateMiningSpeed(userId);

      let contract;
      let isNewContract = false;

      if (existingContract) {
        // 延长现有合约（确保base_hashrate正确）
        const currentEndTime = new Date(existingContract.free_contract_end_time);
        const newEndTime = new Date(currentEndTime.getTime() + this.AD_MINING_DURATION);

        await existingContract.update({
          free_contract_end_time: newEndTime,
          base_hashrate: BASE_HASHRATE,  // 更新基础速率
          has_daily_bonus: 0,  // 广告合约不含签到加成
          hashrate: BASE_HASHRATE  // 兼容字段
        });

        contract = existingContract;

        console.log(`✅ 延长广告挖矿合约: 用户 ${userId}, 从 ${currentEndTime} 延长到 ${newEndTime}`);
      } else {
        // 创建新合约（只存储基础速率）
        const endTime = new Date(now.getTime() + this.AD_MINING_DURATION);

        contract = await FreeContractRecord.create({
          user_id: userId,
          free_contract_type: 'Free Ad Reward',
          free_contract_creation_time: now,
          free_contract_end_time: endTime,
          base_hashrate: BASE_HASHRATE,  // 新字段：纯基础速率
          has_daily_bonus: 0,  // 标记：不含签到加成
          hashrate: BASE_HASHRATE  // 兼容字段
        });

        isNewContract = true;

        console.log(`✅ 创建广告挖矿合约: 用户 ${userId}, 结束时间 ${endTime}, 基础速率 ${BASE_HASHRATE.toExponential(2)} BTC/s (将动态应用等级/国家加成)`);
      }

      // 6. 记录广告观看（增加积分）
      await AdPointsService.recordAdViewAndReward(userId);

      // 7. 重新获取今日统计
      const updatedStats = await AdPointsService.getDailyAdStats(userId);

      return {
        success: true,
        message: isNewContract ? '观看广告成功，开始挖矿2小时' : '观看广告成功，挖矿时间延长2小时',
        contract: {
          id: contract.id,
          startTime: contract.free_contract_creation_time,
          endTime: contract.free_contract_end_time,
          hashrate: contract.hashrate
        },
        speedInfo: {
          baseSpeed: speedInfo.baseSpeed,
          baseHashrate: speedInfo.baseHashrateGhs + ' Gh/s',
          levelMultiplier: speedInfo.levelMultiplier,
          dailyBonusMultiplier: speedInfo.dailyBonusMultiplier,
          countryMultiplier: speedInfo.countryMultiplier,
          finalSpeed: speedInfo.finalSpeedWithoutBonus // 不包含签到加成
        },
        adStats: {
          todayViews: updatedStats.viewCount,
          dailyLimit: this.DAILY_AD_LIMIT,
          remainingViews: updatedStats.remainingViews,
          isLimitReached: updatedStats.isLimitReached
        },
        isNewContract
      };

    } catch (err) {
      console.error('❌ 观看广告并延长挖矿合约失败:', err);
      throw err;
    }
  }

  /**
   * 获取用户当前的广告挖矿合约状态
   */
  static async getContractStatus(userId) {
    try {
      const now = new Date();
      const contract = await FreeContractRecord.findOne({
        where: {
          user_id: userId,
          free_contract_type: 'Free Ad Reward',
          free_contract_end_time: {
            [Sequelize.Op.gt]: now
          }
        },
        order: [['free_contract_creation_time', 'DESC']]
      });

      if (!contract) {
        return {
          hasActiveContract: false,
          message: '暂无活跃的广告挖矿合约'
        };
      }

      const endTime = new Date(contract.free_contract_end_time);
      const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));

      return {
        hasActiveContract: true,
        contract: {
          id: contract.id,
          startTime: contract.free_contract_creation_time,
          endTime: contract.free_contract_end_time,
          hashrate: contract.hashrate,
          remainingSeconds,
          remainingFormatted: this.formatDuration(remainingSeconds)
        }
      };

    } catch (err) {
      console.error('❌ 获取广告挖矿合约状态失败:', err);
      throw err;
    }
  }

  /**
   * 格式化时长显示
   */
  static formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}小时${minutes}分${secs}秒`;
  }
}

module.exports = AdMiningContractService;
