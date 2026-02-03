/**
 * 倍率计算服务
 * 负责计算用户的挖矿速度倍率
 * 倍率来源:
 * 1. 国家倍率 (存储在 user_information.country_multiplier)
 * 2. 等级倍率 (从 LevelService 获取)
 * 3. 每日加成倍率 (从 LevelService 获取)
 */

const UserInformation = require('../models/userInformation');
const LevelService = require('./levelService');

class MultiplierService {
  /**
   * 获取用户的完整倍率信息
   * @param {string} userId - 用户ID
   * @returns {Object} 倍率详情
   */
  static async getUserMultiplier(userId) {
    try {
      // 获取用户信息(包含国家倍率)
      const user = await UserInformation.findOne({
        where: { user_id: userId },
        attributes: ['user_id', 'country', 'country_multiplier']
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 获取等级信息(包含等级倍率和每日加成)
      const levelInfo = await LevelService.getUserLevel(userId);

      // 计算倍率
      const countryMultiplier = parseFloat(user.country_multiplier) || 1.00;
      const levelMultiplier = levelInfo.speedMultiplier || 1.00;
      const dailyBonusMultiplier = levelInfo.dailyBonusActive ? 2.00 : 1.00;

      // 总倍率 = 国家倍率 × 等级倍率 × 每日加成倍率
      const totalMultiplier = countryMultiplier * levelMultiplier * dailyBonusMultiplier;

      return {
        userId: userId,
        country: user.country_code || 'Unknown',
        countryMultiplier: countryMultiplier,
        level: levelInfo.level,
        levelMultiplier: levelMultiplier,
        dailyBonusActive: levelInfo.dailyBonusActive,
        dailyBonusMultiplier: dailyBonusMultiplier,
        totalMultiplier: parseFloat(totalMultiplier.toFixed(2)),
        breakdown: {
          country: `${countryMultiplier.toFixed(2)}x`,
          level: `${levelMultiplier.toFixed(2)}x`,
          dailyBonus: `${dailyBonusMultiplier.toFixed(2)}x`,
          total: `${totalMultiplier.toFixed(2)}x`
        }
      };
    } catch (error) {
      console.error('获取用户倍率失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户的国家倍率
   * @param {string} userId - 用户ID
   * @param {number} multiplier - 新的倍率值
   * @returns {boolean} 是否成功
   */
  static async updateCountryMultiplier(userId, multiplier) {
    try {
      const user = await UserInformation.findOne({
        where: { user_id: userId }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 验证倍率范围 (0.01 - 99.99)
      const validMultiplier = Math.max(0.01, Math.min(99.99, parseFloat(multiplier)));

      await user.update({
        country_multiplier: validMultiplier
      });

      console.log(`用户 ${userId} 的国家倍率已更新为 ${validMultiplier}x`);
      return true;
    } catch (error) {
      console.error('更新国家倍率失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新某个国家的倍率
   * @param {string} country - 国家代码
   * @param {number} multiplier - 新的倍率值
   * @returns {number} 更新的用户数
   */
  static async updateCountryMultiplierByCountry(country, multiplier) {
    try {
      // 验证倍率范围
      const validMultiplier = Math.max(0.01, Math.min(99.99, parseFloat(multiplier)));

      const [affectedCount] = await UserInformation.update(
        { country_multiplier: validMultiplier },
        { where: { country_code: country } }
      );

      console.log(`已更新 ${country} 的 ${affectedCount} 个用户倍率为 ${validMultiplier}x`);
      return affectedCount;
    } catch (error) {
      console.error('批量更新国家倍率失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有国家的倍率统计
   * @returns {Array} 国家倍率列表
   */
  static async getCountryMultiplierStats() {
    try {
      const { QueryTypes } = require('sequelize');
      const sequelize = require('../config/database');

      const stats = await sequelize.query(`
        SELECT 
          country,
          country_multiplier,
          COUNT(*) as user_count
        FROM user_information
        WHERE country IS NOT NULL
        GROUP BY country, country_multiplier
        ORDER BY country, country_multiplier DESC
      `, { type: QueryTypes.SELECT });

      return stats;
    } catch (error) {
      console.error('获取国家倍率统计失败:', error);
      throw error;
    }
  }
}

module.exports = MultiplierService;
