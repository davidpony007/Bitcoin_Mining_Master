/**
 * 每日签到挖矿合约服务
 * 负责每日签到挖矿合约的创建和管理
 * 特点：每日签到创建独立的2小时挖矿合约，使用1.36倍特殊加成系数
 */

const FreeContractRecord = require('../models/freeContractRecord');
const UserInformation = require('../models/userInformation');
const LevelService = require('./levelService');
const CheckInService = require('./checkInService');

class CheckInMiningContractService {
  /**
   * 签到挖矿时长（2小时）
   */
  static CHECKIN_MINING_DURATION = 2 * 60 * 60 * 1000; // 2小时（毫秒）

  /**
   * 每日签到并创建挖矿合约
   * 业务逻辑：
   * 1. 每日只能签到一次（UTC+00:00重置）
   * 2. 签到成功后创建独立的2小时挖矿合约
   * 3. 该合约使用1.36倍特殊加成系数
   * 4. 📌 重要：不影响普通广告挖矿合约的时间
   * 5. 📌 重要：不会增加电池数量显示（电池只显示Ad Reward合约）
   */
  static async checkInAndCreateMiningContract(userId) {
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

      // 2. 执行签到（CheckInService会验证今天是否已签到）
      const checkInResult = await CheckInService.checkIn(userId);

      if (!checkInResult.success) {
        return checkInResult; // 返回签到失败的结果（如：今天已签到）
      }

      // 3. 计算挖矿速度（基础奖励 × 国家系数 × 矿工等级速率系数 × 1.36倍签到加成）
      const speedInfo = await LevelService.calculateMiningSpeed(userId);

      // 4. 创建签到挖矿合约（独立队列，使用特殊加成速度）
      const now = new Date();
      const endTime = new Date(now.getTime() + this.CHECKIN_MINING_DURATION);

      const contract = await FreeContractRecord.create({
        user_id: userId,
        free_contract_type: 'daily sign-in free contract',
        free_contract_revenue: 0,
        free_contract_creation_time: now,
        free_contract_end_time: endTime,
        hashrate: speedInfo.finalSpeedWithBonus, // 使用包含1.36倍签到加成的速度
        mining_status: 'mining'
      });

      console.log(`✅ 创建签到挖矿合约: 用户 ${userId}, 结束时间 ${endTime}, 速度 ${speedInfo.finalSpeedWithBonus} BTC/s (包含1.36個加成)`);

      return {
        success: true,
        message: '签到成功，开始挖矿2小时（含1.36倍加成）',
        checkInInfo: {
          consecutiveDays: checkInResult.consecutiveDays,
          pointsEarned: checkInResult.pointsEarned,
          dailyBonusActive: checkInResult.dailyBonusActive,
          dailyBonusExpire: checkInResult.dailyBonusExpire,
          dailyBonusMultiplier: checkInResult.dailyBonusMultiplier
        },
        contract: {
          id: contract.id,
          type: 'daily sign-in free contract',
          startTime: contract.free_contract_creation_time,
          endTime: contract.free_contract_end_time,
          hashrate: contract.hashrate,
          miningStatus: contract.mining_status
        },
        speedInfo: {
          baseSpeed: speedInfo.baseSpeed,
          baseHashrate: speedInfo.baseHashrateGhs + ' Gh/s',
          levelMultiplier: speedInfo.levelMultiplier,
          dailyBonusMultiplier: speedInfo.dailyBonusMultiplier, // 1.36倍特殊加成
          countryMultiplier: speedInfo.countryMultiplier,
          finalSpeed: speedInfo.finalSpeedWithBonus // 包含1.36倍加成的速度
        }
      };

    } catch (err) {
      console.error('❌ 签到并创建挖矿合约失败:', err);
      throw err;
    }
  }

  /**
   * 获取用户当前的签到挖矿合约状态
   */
  static async getContractStatus(userId) {
    try {
      const contract = await FreeContractRecord.findOne({
        where: {
          user_id: userId,
          free_contract_type: 'daily sign-in free contract',
          mining_status: 'mining'
        },
        order: [['free_contract_creation_time', 'DESC']]
      });

      if (!contract) {
        return {
          hasActiveContract: false,
          message: '暂无活跃的签到挖矿合约'
        };
      }

      const now = new Date();
      const endTime = new Date(contract.free_contract_end_time);
      const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));

      return {
        hasActiveContract: true,
        contract: {
          id: contract.id,
          type: 'daily sign-in free contract',
          startTime: contract.free_contract_creation_time,
          endTime: contract.free_contract_end_time,
          hashrate: contract.hashrate,
          remainingSeconds,
          remainingFormatted: this.formatDuration(remainingSeconds)
        }
      };

    } catch (err) {
      console.error('❌ 获取签到挖矿合约状态失败:', err);
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

module.exports = CheckInMiningContractService;
