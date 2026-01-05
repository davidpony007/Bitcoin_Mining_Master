/**
 * 国家配置服务
 * 负责获取不同国家的挖矿速率倍数配置
 */

const CountryConfig = require('../models/countryConfig');
const redisClient = require('../config/redis');

class CountryConfigService {
  // 默认国家代码
  static DEFAULT_COUNTRY = 'DEFAULT';
  
  // Redis 缓存键前缀
  static CACHE_PREFIX = 'country:config';
  
  // 缓存过期时间（24小时）
  static CACHE_EXPIRY = 24 * 60 * 60;

  /**
   * 加载所有国家配置到内存（启动时调用）
   */
  static async loadAllConfigs() {
    try {
      const configs = await CountryConfig.findAll({
        where: { is_active: true },
        attributes: ['country_code', 'country_name', 'mining_speed_multiplier'],
        order: [['mining_speed_multiplier', 'DESC']]
      });

      console.log(`✓ 国家配置加载成功，共 ${configs.length} 个国家`);
      return configs;
    } catch (error) {
      console.error('❌ 国家配置加载失败:', error.message);
      // 返回默认配置
      return [{ 
        country_code: this.DEFAULT_COUNTRY, 
        country_name: 'Default', 
        mining_speed_multiplier: 1.00 
      }];
    }
  }

  /**
   * 获取指定国家的挖矿速率倍数
   * @param {string} countryCode - 国家代码（如：US, CN, DEFAULT）
   * @returns {Promise<number>} 挖矿速率倍数
   */
  static async getMiningSpeedMultiplier(countryCode) {
    try {
      // 如果没有提供国家代码，使用默认值
      if (!countryCode) {
        countryCode = this.DEFAULT_COUNTRY;
      }

      // 尝试从 Redis 缓存获取
      const cacheKey = `${this.CACHE_PREFIX}:${countryCode}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return parseFloat(cached);
      }

      // 从数据库查询
      const config = await CountryConfig.findOne({
        where: { 
          country_code: countryCode.toUpperCase(),
          is_active: true 
        },
        attributes: ['mining_speed_multiplier']
      });

      let multiplier = 1.00;
      
      if (config) {
        multiplier = parseFloat(config.mining_speed_multiplier);
      } else {
        // 如果找不到该国家，尝试获取默认配置
        const defaultConfig = await CountryConfig.findOne({
          where: { 
            country_code: this.DEFAULT_COUNTRY,
            is_active: true 
          },
          attributes: ['mining_speed_multiplier']
        });
        
        if (defaultConfig) {
          multiplier = parseFloat(defaultConfig.mining_speed_multiplier);
        }
      }

      // 缓存结果
      await redisClient.setex(cacheKey, this.CACHE_EXPIRY, multiplier.toString());

      return multiplier;
    } catch (error) {
      console.error('获取国家挖矿倍数失败:', error);
      return 1.00; // 出错时返回默认值
    }
  }

  /**
   * 获取国家配置详情
   * @param {string} countryCode - 国家代码
   * @returns {Promise<Object>} 国家配置对象
   */
  static async getCountryConfig(countryCode) {
    try {
      if (!countryCode) {
        countryCode = this.DEFAULT_COUNTRY;
      }

      const config = await CountryConfig.findOne({
        where: { 
          country_code: countryCode.toUpperCase(),
          is_active: true 
        },
        attributes: ['country_code', 'country_name', 'mining_speed_multiplier']
      });

      if (config) {
        return {
          countryCode: config.country_code,
          countryName: config.country_name,
          miningSpeedMultiplier: parseFloat(config.mining_speed_multiplier)
        };
      }

      // 返回默认配置
      const defaultConfig = await CountryConfig.findOne({
        where: { country_code: this.DEFAULT_COUNTRY },
        attributes: ['country_code', 'country_name', 'mining_speed_multiplier']
      });

      return {
        countryCode: defaultConfig.country_code,
        countryName: defaultConfig.country_name,
        miningSpeedMultiplier: parseFloat(defaultConfig.mining_speed_multiplier)
      };
    } catch (error) {
      console.error('获取国家配置失败:', error);
      return {
        countryCode: this.DEFAULT_COUNTRY,
        countryName: 'Default',
        miningSpeedMultiplier: 1.00
      };
    }
  }

  /**
   * 获取所有国家配置列表
   * @returns {Promise<Array>} 国家配置列表
   */
  static async getAllCountries() {
    try {
      const configs = await CountryConfig.findAll({
        where: { is_active: true },
        attributes: ['country_code', 'country_name', 'mining_speed_multiplier'],
        order: [['mining_speed_multiplier', 'DESC']]
      });

      return configs.map(config => ({
        countryCode: config.country_code,
        countryName: config.country_name,
        miningSpeedMultiplier: parseFloat(config.mining_speed_multiplier)
      }));
    } catch (error) {
      console.error('获取国家列表失败:', error);
      return [];
    }
  }

  /**
   * 更新国家配置（管理员功能）
   * @param {string} countryCode - 国家代码
   * @param {number} multiplier - 新的挖矿速率倍数
   * @returns {Promise<Object>} 更新结果
   */
  static async updateCountryMultiplier(countryCode, multiplier) {
    try {
      const [updated] = await CountryConfig.update(
        { mining_speed_multiplier: multiplier },
        { 
          where: { 
            country_code: countryCode.toUpperCase(),
            is_active: true 
          } 
        }
      );

      if (updated > 0) {
        // 清除缓存
        const cacheKey = `${this.CACHE_PREFIX}:${countryCode.toUpperCase()}`;
        await redisClient.del(cacheKey);

        return {
          success: true,
          message: '国家配置更新成功',
          countryCode,
          newMultiplier: multiplier
        };
      }

      return {
        success: false,
        message: '未找到该国家配置'
      };
    } catch (error) {
      console.error('更新国家配置失败:', error);
      return {
        success: false,
        message: '更新失败',
        error: error.message
      };
    }
  }

  /**
   * 清除所有国家配置缓存
   */
  static async clearAllCache() {
    try {
      const configs = await CountryConfig.findAll({
        attributes: ['country_code']
      });

      for (const config of configs) {
        const cacheKey = `${this.CACHE_PREFIX}:${config.country_code}`;
        await redisClient.del(cacheKey);
      }

      console.log('✓ 国家配置缓存已清除');
      return { success: true };
    } catch (error) {
      console.error('清除缓存失败:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = CountryConfigService;
