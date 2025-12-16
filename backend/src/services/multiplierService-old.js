/**
 * 实时倍率计算服务
 * 负责计算用户的挖矿倍率,包括:
 * - 等级倍率
 * - 国家倍率
 * - 每日加成倍率
 */

const UserInformation = require('../models/userInformation');
const LevelService = require('./levelService');
const CountryService = require('./countryService');
const redis = require('../config/redis');

class MultiplierService {
  /**
   * 计算用户的实时挖矿倍率
   * 公式: 实时倍率 = 基础倍率 × 等级倍率 × 国家倍率 × 每日加成倍率
   * 
   * @param {string} userId - 用户ID
   * @returns {Object} 倍率详情
   */
  static async calculateMultiplier(userId) {
    try {
      // 1. 获取用户信息
      const user = await UserInformation.findByPk(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 2. 基础倍率 (默认1.0)
      const baseMultiplier = 1.0;

      // 3. 获取等级倍率
      const levelInfo = await LevelService.getUserLevel(userId);
      const levelMultiplier = levelInfo?.speedMultiplier || 1.0;

      // 4. 获取国家倍率
      const countryCode = user.country || 'CN';
      const countryInfo = await CountryService.getCountryByCode(countryCode);
      const countryMultiplier = countryInfo?.mining_speed_multiplier || 1.0;

      // 5. 获取每日加成倍率
      let dailyBonusMultiplier = 1.0;
      const isDailyBonusActive = await redis.isDailyBonusActive(userId);
      if (isDailyBonusActive) {
        // 每日加成激活时,额外增加50%倍率
        dailyBonusMultiplier = 1.5;
      }

      // 6. 计算总倍率
      const totalMultiplier = baseMultiplier * levelMultiplier * countryMultiplier * dailyBonusMultiplier;

      // 7. 返回详细信息
      return {
        totalMultiplier: parseFloat(totalMultiplier.toFixed(2)),
        breakdown: {
          base: baseMultiplier,
          level: levelMultiplier,
          country: countryMultiplier,
          dailyBonus: dailyBonusMultiplier
        },
        details: {
          currentLevel: levelInfo?.level || 1,
          countryCode: countryCode,
          countryName: countryInfo?.country_name || '中国',
          dailyBonusActive: isDailyBonusActive
        }
      };
    } catch (error) {
      console.error('计算倍率失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户倍率到数据库
   * 
   * @param {string} userId - 用户ID
   * @returns {boolean} 是否成功
   */
  static async updateMultiplier(userId) {
    try {
      // 计算倍率
      const multiplierInfo = await this.calculateMultiplier(userId);

      // 更新到数据库
      await UserInformation.update(
        { currentMultiplier: multiplierInfo.totalMultiplier },
        { where: { id: userId } }
      );

      console.log(`✅ 用户 ${userId} 倍率已更新为 ${multiplierInfo.totalMultiplier}x`);
      return true;
    } catch (error) {
      console.error('更新倍率失败:', error);
      return false;
    }
  }

  /**
   * 获取用户当前倍率
   * 
   * @param {string} userId - 用户ID
   * @returns {Object} 倍率信息
   */
  static async getMultiplier(userId) {
    try {
      const user = await UserInformation.findByPk(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 如果数据库中没有倍率,计算并更新
      if (!user.currentMultiplier || user.currentMultiplier === 0) {
        const multiplierInfo = await this.calculateMultiplier(userId);
        await this.updateMultiplier(userId);
        return multiplierInfo;
      }

      // 返回数据库中的倍率和详细计算
      const multiplierInfo = await this.calculateMultiplier(userId);
      return multiplierInfo;
    } catch (error) {
      console.error('获取倍率失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新所有用户的倍率
   * 用于定时任务或系统维护
   * 
   * @returns {Object} 更新结果
   */
  static async updateAllMultipliers() {
    try {
      const users = await UserInformation.findAll({
        attributes: ['id']
      });

      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          await this.updateMultiplier(user.id);
          successCount++;
        } catch (error) {
          console.error(`更新用户 ${user.id} 倍率失败:`, error.message);
          failCount++;
        }
      }

      console.log(`✅ 批量更新完成: 成功 ${successCount}, 失败 ${failCount}`);
      return { successCount, failCount, total: users.length };
    } catch (error) {
      console.error('批量更新倍率失败:', error);
      throw error;
    }
  }

  /**
   * 当用户等级、国家或每日加成状态变化时,触发倍率更新
   * 
   * @param {string} userId - 用户ID
   * @param {string} reason - 更新原因
   */
  static async triggerMultiplierUpdate(userId, reason = '未知') {
    try {
      console.log(`🔄 触发倍率更新: 用户 ${userId}, 原因: ${reason}`);
      await this.updateMultiplier(userId);
    } catch (error) {
      console.error('触发倍率更新失败:', error);
    }
  }
}

module.exports = MultiplierService;
