/**
 * 国家挖矿配置服务
 * 
 * 功能说明:
 * - 获取指定国家的挖矿倍率
 * - 更新国家挖矿倍率配置
 * - 批量管理国家配置
 * - 提供默认倍率策略
 * 
 * 业务逻辑:
 * 1. 根据用户国家代码获取对应的挖矿倍率
 * 2. 如果国家未配置,返回默认倍率 (1.00)
 * 3. 如果国家配置被禁用,返回默认倍率
 * 4. 支持管理员动态调整各国倍率
 */

const CountryMiningConfig = require('../models/countryMiningConfig');
const redisClient = require('../config/redis');

class CountryMiningService {
  /**
   * 获取指定国家的挖矿倍率
   * 
   * @param {string} countryCode - 国家代码 (2位大写字母)
   * @returns {Promise<number>} 挖矿倍率 (默认 1.00)
   * 
   * @example
   * const multiplier = await CountryMiningService.getMiningMultiplier('US');
   * console.log(multiplier); // 26
   */
  static async getMiningMultiplier(countryCode) {
    try {
      if (!countryCode || typeof countryCode !== 'string') {
        console.warn('⚠️  国家代码无效,使用默认倍率');
        return 1.00;
      }

      // 转换为大写
      const code = countryCode.toUpperCase();

      // 1. 尝试从缓存获取
      const cacheKey = `country:mining:${code}`;
      const cached = await redisClient.get(cacheKey);

      if (cached !== null) {
        return parseFloat(cached);
      }

      // 2. 从数据库查询
      const config = await CountryMiningConfig.findOne({
        where: {
          country_code: code,
          is_active: true
        },
        attributes: ['mining_multiplier']
      });

      let multiplier = 1.00;

      if (config) {
        multiplier = parseFloat(config.mining_multiplier);
        
        // 缓存 1 小时
        await redisClient.set(cacheKey, multiplier.toString(), 3600);
      } else {
        // 未配置的国家,缓存默认值 (5分钟)
        await redisClient.set(cacheKey, '1.00', 300);
      }

      return multiplier;

    } catch (error) {
      console.error('❌ 获取国家挖矿倍率失败:', error.message);
      return 1.00; // 降级返回默认值
    }
  }

  /**
   * 获取所有国家的挖矿配置
   * 
   * @param {Object} options - 查询选项
   * @param {boolean} options.activeOnly - 只返回启用的配置
   * @returns {Promise<Array>} 国家配置列表
   * 
   * @example
   * const configs = await CountryMiningService.getAllConfigs({ activeOnly: true });
   */
  static async getAllConfigs(options = {}) {
    try {
      const { activeOnly = false } = options;

      const where = {};
      if (activeOnly) {
        where.is_active = true;
      }

      const configs = await CountryMiningConfig.findAll({
        where,
        order: [
          ['mining_multiplier', 'DESC'],
          ['country_code', 'ASC']
        ]
      });

      return configs.map(config => ({
        countryCode: config.country_code,
        countryName: config.country_name,
        countryNameCn: config.country_name_cn,
        miningMultiplier: parseFloat(config.mining_multiplier),
        isActive: config.is_active,
        updatedAt: config.updated_at
      }));

    } catch (error) {
      console.error('❌ 获取国家配置列表失败:', error.message);
      throw error;
    }
  }

  /**
   * 更新国家挖矿倍率
   * 
   * @param {string} countryCode - 国家代码
   * @param {number} multiplier - 新的挖矿倍率
   * @returns {Promise<Object>} 更新结果
   * 
   * @example
   * await CountryMiningService.updateMultiplier('US', 30);
   */
  static async updateMultiplier(countryCode, multiplier) {
    try {
      const code = countryCode.toUpperCase();

      // 验证倍率范围
      if (multiplier < 0.01 || multiplier > 999.99) {
        throw new Error('挖矿倍率必须在 0.01 到 999.99 之间');
      }

      // 更新数据库
      const [affectedRows] = await CountryMiningConfig.update(
        { 
          mining_multiplier: multiplier,
          updated_at: new Date()
        },
        {
          where: { country_code: code }
        }
      );

      if (affectedRows === 0) {
        throw new Error(`国家代码 ${code} 不存在`);
      }

      // 删除缓存
      const cacheKey = `country:mining:${code}`;
      await redisClient.del(cacheKey);

      return {
        success: true,
        countryCode: code,
        newMultiplier: multiplier,
        message: '更新成功'
      };

    } catch (error) {
      console.error('❌ 更新国家挖矿倍率失败:', error.message);
      throw error;
    }
  }

  /**
   * 批量更新多个国家的倍率
   * 
   * @param {Array} updates - 更新列表 [{countryCode, multiplier}, ...]
   * @returns {Promise<Object>} 批量更新结果
   * 
   * @example
   * await CountryMiningService.batchUpdateMultipliers([
   *   { countryCode: 'US', multiplier: 30 },
   *   { countryCode: 'UK', multiplier: 20 }
   * ]);
   */
  static async batchUpdateMultipliers(updates) {
    try {
      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      for (const update of updates) {
        try {
          await this.updateMultiplier(update.countryCode, update.multiplier);
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            countryCode: update.countryCode,
            error: error.message
          });
        }
      }

      return results;

    } catch (error) {
      console.error('❌ 批量更新失败:', error.message);
      throw error;
    }
  }

  /**
   * 启用或禁用国家配置
   * 
   * @param {string} countryCode - 国家代码
   * @param {boolean} isActive - 是否启用
   * @returns {Promise<Object>} 操作结果
   */
  static async setActiveStatus(countryCode, isActive) {
    try {
      const code = countryCode.toUpperCase();

      const [affectedRows] = await CountryMiningConfig.update(
        { 
          is_active: isActive,
          updated_at: new Date()
        },
        {
          where: { country_code: code }
        }
      );

      if (affectedRows === 0) {
        throw new Error(`国家代码 ${code} 不存在`);
      }

      // 删除缓存
      const cacheKey = `country:mining:${code}`;
      await redisClient.del(cacheKey);

      return {
        success: true,
        countryCode: code,
        isActive,
        message: isActive ? '已启用' : '已禁用'
      };

    } catch (error) {
      console.error('❌ 设置国家状态失败:', error.message);
      throw error;
    }
  }

  /**
   * 添加新的国家配置
   * 
   * @param {Object} config - 国家配置
   * @param {string} config.countryCode - 国家代码
   * @param {string} config.countryName - 英文名称
   * @param {string} config.countryNameCn - 中文名称
   * @param {number} config.miningMultiplier - 挖矿倍率
   * @returns {Promise<Object>} 新增结果
   */
  static async addCountry(config) {
    try {
      const { countryCode, countryName, countryNameCn, miningMultiplier } = config;

      const newConfig = await CountryMiningConfig.create({
        country_code: countryCode.toUpperCase(),
        country_name: countryName,
        country_name_cn: countryNameCn,
        mining_multiplier: miningMultiplier || 1.00,
        is_active: true
      });

      return {
        success: true,
        countryCode: newConfig.country_code,
        message: '添加成功'
      };

    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('国家代码已存在');
      }
      console.error('❌ 添加国家配置失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取挖矿倍率统计
   * 
   * @returns {Promise<Object>} 统计信息
   */
  static async getStatistics() {
    try {
      const stats = await CountryMiningConfig.findOne({
        attributes: [
          [CountryMiningConfig.sequelize.fn('COUNT', '*'), 'totalCountries'],
          [CountryMiningConfig.sequelize.fn('COUNT', CountryMiningConfig.sequelize.literal('DISTINCT mining_multiplier')), 'multiplierLevels'],
          [CountryMiningConfig.sequelize.fn('MIN', CountryMiningConfig.sequelize.col('mining_multiplier')), 'minMultiplier'],
          [CountryMiningConfig.sequelize.fn('MAX', CountryMiningConfig.sequelize.col('mining_multiplier')), 'maxMultiplier'],
          [CountryMiningConfig.sequelize.fn('AVG', CountryMiningConfig.sequelize.col('mining_multiplier')), 'avgMultiplier']
        ],
        where: {
          is_active: true
        },
        raw: true
      });

      return {
        totalCountries: parseInt(stats.totalCountries) || 0,
        multiplierLevels: parseInt(stats.multiplierLevels) || 0,
        minMultiplier: parseFloat(stats.minMultiplier) || 1.00,
        maxMultiplier: parseFloat(stats.maxMultiplier) || 1.00,
        avgMultiplier: parseFloat(stats.avgMultiplier) || 1.00
      };

    } catch (error) {
      console.error('❌ 获取统计信息失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取指定国家的详细配置
   * 
   * @param {string} countryCode - 国家代码
   * @returns {Promise<Object>} 国家详细信息
   */
  static async getCountryDetail(countryCode) {
    try {
      const code = countryCode.toUpperCase();

      const config = await CountryMiningConfig.findOne({
        where: {
          country_code: code,
          is_active: true
        }
      });

      if (!config) {
        return {
          countryCode: code,
          countryName: 'Unknown',
          countryNameCn: '未知',
          miningSpeedMultiplier: 1.00
        };
      }

      return {
        countryCode: config.country_code,
        countryName: config.country_name,
        countryNameCn: config.country_name_cn,
        miningSpeedMultiplier: parseFloat(config.mining_multiplier)
      };

    } catch (error) {
      console.error('❌ 获取国家详情失败:', error.message);
      throw error;
    }
  }

  /**
   * 清除所有国家配置缓存
   * 
   * @returns {Promise<Object>} 操作结果
   */
  static async clearAllCache() {
    try {
      const configs = await CountryMiningConfig.findAll({
        attributes: ['country_code']
      });

      for (const config of configs) {
        const cacheKey = `country:mining:${config.country_code}`;
        await redisClient.del(cacheKey);
      }

      console.log('✓ 国家配置缓存已清除');
      return { success: true, message: '缓存已清除' };

    } catch (error) {
      console.error('❌ 清除缓存失败:', error.message);
      throw error;
    }
  }
}

module.exports = CountryMiningService;
