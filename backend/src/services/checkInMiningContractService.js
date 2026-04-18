/**
 * 每日签到挖矿合约服务
 * 负责每日签到挖矿合约的创建和管理
 * 特点：每日签到创建独立的2小时挖矿合约，使用1.36倍特殊加成系数
 */

const FreeContractRecord = require('../models/freeContractRecord');
const UserInformation = require('../models/userInformation');
const LevelService = require('./levelService');
const CheckInService = require('./checkInService');
const MiningConfigService = require('./miningConfigService');
const redisClient = require('../config/redis');
const { Op } = require('sequelize');

class CheckInMiningContractService {
  /**
   * 签到挖矿时长（2小时）
   */
  static CHECKIN_MINING_DURATION = 2 * 60 * 60 * 1000; // 2小时（毫秒）

  /**
   * 创建签到挖矿合约（不验证签到，由调用方负责）
   * 业务逻辑：
   * 1. 创建独立的2小时挖矿合约
   * 2. 该合约使用1.36倍特殊加成系数
   * 3. 📌 重要：不影响普通广告挖矿合约的时间
   * 4. 📌 重要：不会增加电池数量显示（电池只显示Ad Reward合约）
   * 5. 📌 签到验证由调用方（路由层）负责
   */
  static async checkInAndCreateMiningContract(userId, requestIp = null, clientCountry = null) {
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

      // 1.5 国家检测：只在用户尚无国家记录时才写入（防止VPN登录覆盖正确值）
      // clientCountry 来自 Flutter Platform.localeName，与 AdMob 归因国家口径最接近
      const hasCountry = user.country_code && user.country_code.trim() !== '';

      if (!hasCountry) {
        // 用户尚无国家记录，尝试首次写入
        const clientCountryUpper = clientCountry ? clientCountry.trim().toUpperCase() : null;
        let targetCountry = clientCountryUpper; // 设备locale最优先

        if (!targetCountry && requestIp && requestIp !== '未知') {
          try {
            const geoip = require('geoip-lite');
            const geo = geoip.lookup(requestIp);
            if (geo && geo.country) targetCountry = geo.country.toUpperCase();
          } catch (_) {}
        }

        if (targetCountry) {
          try {
            const CountryMiningConfig = require('../models/countryMiningConfig');
            const countryConfig = await CountryMiningConfig.findOne({
              where: { country_code: targetCountry, is_active: true },
              raw: true
            });
            const newMultiplier = countryConfig ? parseFloat(countryConfig.mining_multiplier) : 1.00;
            const source = clientCountryUpper ? 'device-locale' : 'ip-geoip';
            console.log(`🌍 [签到-首次] 用户 ${userId}: [${source}]首次写入国家=${targetCountry}(${newMultiplier}x)`);
            const updateFields = { country_code: targetCountry, country_multiplier: newMultiplier };
            if (countryConfig && countryConfig.country_name_cn) {
              updateFields.country_name_cn = countryConfig.country_name_cn;
            }
            await user.update(updateFields);
          } catch (geoErr) {
            console.warn(`⚠️ [签到-首次] 国家写入失败: ${geoErr.message}`);
          }
        }
      } else {
        console.log(`🌍 [签到] 用户 ${userId}: 已有国家记录(${user.country_code})，跳过覆盖`);
      }

      // 2. 获取纯基础挖矿速率（不含任何倍数，从 DB/Redis 动态读取）
      const BASE_HASHRATE = await MiningConfigService.getBaseHashrate();

      // 3. 创建签到挖矿合约（只存储基础速率，倍数动态应用）
      const now = new Date();
      const endTime = new Date(now.getTime() + this.CHECKIN_MINING_DURATION);

      const contract = await FreeContractRecord.create({
        user_id: userId,
        free_contract_type: 'Daily Check-in Reward',
        free_contract_creation_time: now,
        free_contract_end_time: endTime,
        base_hashrate: BASE_HASHRATE,  // 新字段：纯基础速率
        has_daily_bonus: 1,  // 标记：该合约包含签到加成
        mining_status: 'mining',  // 合约创建时立即处于挖矿状态
        hashrate: BASE_HASHRATE  // 兼容字段
      });

      console.log(`✅ 创建签到挖矿合约: 用户 ${userId}, 结束时间 ${endTime}, 基础速率 ${BASE_HASHRATE.toExponential(2)} BTC/s (将动态应用等级/国家/签到加成)`);

      // 4. 激活签到加成 Redis 缓存（2小时有效期，与合约到期时间对齐）
      try {
        if (redisClient.isReady()) {
          const expireTimestamp = endTime.getTime();
          await redisClient.addDailyBonusUser(userId, expireTimestamp);
          console.log(`✅ 签到加成Redis已激活: 用户 ${userId}, 过期时间 ${endTime}`);
        }
      } catch (redisErr) {
        console.error(`⚠️ 设置签到加成Redis缓存失败(不影响合约): ${redisErr.message}`);
      }

      // 5. 计算当前的速度信息（仅用于返回给前端显示）
      const speedInfo = await LevelService.calculateMiningSpeed(userId);
      const finalHashrate = speedInfo.finalSpeedWithoutBonus * 1.36;  // 用于显示


      return {
        success: true,
        message: '签到成功，开始挖矿2小时（含1.36倍加成）',
        checkInInfo: {
          dailyBonusActive: true,
          dailyBonusMultiplier: 1.36  // 明确返回1.36倍加成
        },
        contract: {
          id: contract.id,
          type: 'Daily Check-in Reward',
          startTime: contract.free_contract_creation_time,
          endTime: contract.free_contract_end_time,
          hashrate: contract.hashrate,
          miningStatus: contract.mining_status
        },
        speedInfo: {
          baseSpeed: speedInfo.baseSpeed,
          baseHashrate: speedInfo.baseHashrateGhs + ' Gh/s',
          levelMultiplier: speedInfo.levelMultiplier,
          dailyBonusMultiplier: 1.36, // 签到合约固定使用1.36倍加成
          countryMultiplier: speedInfo.countryMultiplier,
          finalSpeed: finalHashrate // 包含1.36倍加成的速度
        }
      };

    } catch (err) {
      console.error('❌ 创建签到挖矿合约失败:', err);
      throw err;
    }
  }

  /**
   * 获取用户当前的签到挖矿合约状态
   */
  static async getContractStatus(userId) {
    try {
      const now = new Date();
      const contract = await FreeContractRecord.findOne({
        where: {
          user_id: userId,
          free_contract_type: 'Daily Check-in Reward',
          free_contract_end_time: {
            [Op.gt]: now
          }
        },
        order: [['free_contract_creation_time', 'DESC']]
      });

      if (!contract) {
        return {
          hasActiveContract: false,
          message: '暂无活跃的签到挖矿合约'
        };
      }

      const endTime = new Date(contract.free_contract_end_time);
      const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));

      return {
        hasActiveContract: true,
        contract: {
          id: contract.id,
          type: 'Daily Check-in Reward',
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
