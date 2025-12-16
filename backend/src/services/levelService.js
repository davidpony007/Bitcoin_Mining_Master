/**
 * 等级系统服务
 * 负责用户等级计算、积分管理、挖矿速率倍数计算
 */

const { QueryTypes } = require('sequelize');
const db = require('../config/database');
const redisClient = require('../config/redis');

class LevelService {
  /**
   * 等级配置表 (从数据库加载)
   */
  static LEVEL_CONFIG = null;

  /**
   * 初始化等级配置 (从数据库加载)
   */
  static async initLevelConfig() {
    try {
      const [rows] = await db.query(
        'SELECT level, min_points, max_points, speed_multiplier, level_name, description FROM level_config ORDER BY level ASC'
      );
      this.LEVEL_CONFIG = rows;
      console.log(`✅ 等级配置加载成功: ${rows.length} 个等级`);
      return this.LEVEL_CONFIG;
    } catch (error) {
      console.error('❌ 加载等级配置失败:', error);
      // 使用默认配置
      this.LEVEL_CONFIG = [
        { level: 1, min_points: 0, max_points: 20, speed_multiplier: 1.0000, level_name: 'LV.1 新手矿工' },
        { level: 2, min_points: 21, max_points: 50, speed_multiplier: 1.1000, level_name: 'LV.2 初级矿工' },
        { level: 3, min_points: 51, max_points: 100, speed_multiplier: 1.2000, level_name: 'LV.3 中级矿工' },
        { level: 4, min_points: 101, max_points: 200, speed_multiplier: 1.3500, level_name: 'LV.4 高级矿工' },
        { level: 5, min_points: 201, max_points: 400, speed_multiplier: 1.5000, level_name: 'LV.5 专家矿工' },
        { level: 6, min_points: 401, max_points: 800, speed_multiplier: 1.7000, level_name: 'LV.6 大师矿工' },
        { level: 7, min_points: 801, max_points: 1600, speed_multiplier: 2.0000, level_name: 'LV.7 传奇矿工' },
        { level: 8, min_points: 1601, max_points: 3000, speed_multiplier: 2.4000, level_name: 'LV.8 史诗矿工' },
        { level: 9, min_points: 3001, max_points: 999999, speed_multiplier: 3.0000, level_name: 'LV.9 神话矿工' }
      ];
      return this.LEVEL_CONFIG;
    }
  }

  /**
   * 根据积分计算等级
   */
  static calculateLevel(points) {
    if (!this.LEVEL_CONFIG) {
      throw new Error('等级配置未初始化，请先调用 initLevelConfig()');
    }

    for (const config of this.LEVEL_CONFIG) {
      if (points >= config.min_points && points <= config.max_points) {
        return {
          level: config.level,
          levelName: config.level_name,
          speedMultiplier: parseFloat(config.speed_multiplier),
          minPoints: config.min_points,
          maxPoints: config.max_points,
          description: config.description
        };
      }
    }

    // 如果没有匹配，返回最高等级
    const maxLevel = this.LEVEL_CONFIG[this.LEVEL_CONFIG.length - 1];
    return {
      level: maxLevel.level,
      levelName: maxLevel.level_name,
      speedMultiplier: parseFloat(maxLevel.speed_multiplier),
      minPoints: maxLevel.min_points,
      maxPoints: maxLevel.max_points,
      description: maxLevel.description
    };
  }

  /**
   * 获取用户等级信息 (优先从 Redis 缓存获取)
   */
  static async getUserLevel(userId) {
    try {
      // 1. 尝试从 Redis 获取
      if (redisClient.isReady()) {
        const cachedLevel = await redisClient.getUserLevel(userId);
        if (cachedLevel) {
          console.log(`✅ 从 Redis 获取用户 ${userId} 等级信息`);
          return cachedLevel;
        }
      }

      // 2. 从数据库获取
      const rows = await db.query(
        'SELECT user_level, user_points, mining_speed_multiplier FROM user_information WHERE user_id = ?',
        {
          replacements: [userId],
          type: QueryTypes.SELECT
        }
      );

      if (rows.length === 0) {
        throw new Error('用户不存在');
      }

      const userInfo = rows[0];
      const levelInfo = this.calculateLevel(userInfo.user_points);

      const result = {
        level: userInfo.user_level,
        points: userInfo.user_points,
        speedMultiplier: parseFloat(userInfo.mining_speed_multiplier),
        levelName: levelInfo.levelName,
        minPoints: levelInfo.minPoints,
        maxPoints: levelInfo.maxPoints,
        pointsToNextLevel: levelInfo.maxPoints === 999999 ? 0 : Math.max(0, levelInfo.maxPoints - userInfo.user_points + 1),
        progressPercentage: this.calculateLevelProgress(userInfo.user_points, levelInfo.minPoints, levelInfo.maxPoints)
      };

      // 3. 缓存到 Redis
      if (redisClient.isReady()) {
        await redisClient.cacheUserLevel(userId, {
          level: result.level,
          points: result.points,
          speedMultiplier: result.speedMultiplier,
          dailyBonusActive: false,
          dailyBonusExpire: null
        });
      }

      return result;
    } catch (error) {
      console.error('❌ 获取用户等级信息失败:', error);
      throw error;
    }
  }

  /**
   * 计算等级进度百分比
   */
  static calculateLevelProgress(currentPoints, minPoints, maxPoints) {
    if (maxPoints === 999999) {
      return 100.00;
    }
    const progress = ((currentPoints - minPoints) / (maxPoints - minPoints)) * 100;
    return Math.min(100, Math.max(0, progress)).toFixed(2);
  }

  /**
   * 增加用户积分 (使用数据库存储过程，保证事务一致性)
   */
  static async addPoints(userId, points, reason, reasonType, relatedUserId = null, relatedRecordId = null) {
    try {
      // 调用存储过程
      const [result] = await db.query(
        'CALL sp_add_user_points(?, ?, ?, ?, ?, ?)',
        [userId, points, reason, reasonType, relatedUserId, relatedRecordId]
      );

      const transactionResult = result[0][0];

      // 清除 Redis 缓存
      if (redisClient.isReady()) {
        await redisClient.deleteUserLevel(userId);
      }

      return {
        success: true,
        beforePoints: transactionResult.before_points,
        afterPoints: transactionResult.after_points,
        beforeLevel: transactionResult.before_level,
        afterLevel: transactionResult.after_level,
        levelUp: transactionResult.level_up === 1,
        newMultiplier: parseFloat(transactionResult.new_multiplier),
        pointsChange: points
      };
    } catch (error) {
      console.error('❌ 增加用户积分失败:', error);
      throw error;
    }
  }

  /**
   * 减少用户积分
   */
  static async deductPoints(userId, points, reason, reasonType) {
    return await this.addPoints(userId, -points, reason, reasonType);
  }

  /**
   * 计算最终挖矿速率 (等级倍数 × 签到加成倍数 × 国家倍数)
   */
  static async calculateMiningSpeed(userId, baseSpeed = 0.00000001) {
    try {
      // 1. 获取用户等级倍数
      const levelInfo = await this.getUserLevel(userId);
      let finalMultiplier = levelInfo.speedMultiplier;

      // 2. 检查是否有每日签到加成 (1.36倍，2小时有效)
      let dailyBonusMultiplier = 1.0;
      if (redisClient.isReady()) {
        const isActive = await redisClient.isDailyBonusActive(userId);
        if (isActive) {
          dailyBonusMultiplier = 1.36;
          finalMultiplier *= dailyBonusMultiplier;
          console.log(`✅ 用户 ${userId} 每日签到加成激活`);
        }
      }

      // 3. 获取用户国家倍数
      let countryMultiplier = 1.0;
      try {
        const CountryConfigService = require('./countryConfigService');
        
        // 从数据库获取用户国家
        const [userInfo] = await db.query(
          'SELECT country FROM user_information WHERE user_id = ?',
          [userId]
        );
        
        if (userInfo.length > 0 && userInfo[0].country) {
          countryMultiplier = await CountryConfigService.getMiningSpeedMultiplier(userInfo[0].country);
          finalMultiplier *= countryMultiplier;
          console.log(`✅ 用户 ${userId} 国家倍数 (${userInfo[0].country}): ${countryMultiplier}`);
        }
      } catch (error) {
        console.warn('获取国家倍数失败，使用默认值 1.0:', error.message);
      }

      // 4. 计算最终速率
      const finalSpeed = baseSpeed * finalMultiplier;

      return {
        baseSpeed,
        levelMultiplier: levelInfo.speedMultiplier,
        dailyBonusMultiplier,
        countryMultiplier,
        finalMultiplier,
        finalSpeed,
        dailyBonusActive: dailyBonusMultiplier > 1.0
      };
    } catch (error) {
      console.error('❌ 计算挖矿速率失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户积分历史记录
   */
  static async getPointsHistory(userId, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;

      // 获取总数
      const [countResult] = await db.query(
        'SELECT COUNT(*) as total FROM points_transaction WHERE user_id = ?',
        [userId]
      );
      const total = countResult[0].total;

      // 获取分页数据
      const [transactions] = await db.query(
        `SELECT 
          id,
          points_change,
          reason,
          reason_type,
          related_user_id,
          before_points,
          after_points,
          before_level,
          after_level,
          created_at
        FROM points_transaction
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('❌ 获取积分历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取等级配置列表 (供客户端展示)
   */
  static async getLevelConfigList() {
    if (!this.LEVEL_CONFIG) {
      await this.initLevelConfig();
    }
    return this.LEVEL_CONFIG.map(config => ({
      level: config.level,
      levelName: config.level_name,
      minPoints: config.min_points,
      maxPoints: config.max_points,
      speedMultiplier: parseFloat(config.speed_multiplier),
      speedBonus: `+${((parseFloat(config.speed_multiplier) - 1) * 100).toFixed(0)}%`,
      description: config.description
    }));
  }

  /**
   * 获取用户等级排行榜 (Top 100)
   */
  static async getLevelLeaderboard(limit = 100) {
    try {
      const [rows] = await db.query(
        `SELECT 
          user_id,
          user_level,
          user_points,
          mining_speed_multiplier,
          created_at
        FROM user_information
        WHERE user_level > 0
        ORDER BY user_level DESC, user_points DESC
        LIMIT ?`,
        [limit]
      );

      return rows.map((row, index) => ({
        rank: index + 1,
        userId: row.user_id,
        level: row.level,
        points: row.user_points,
        speedMultiplier: parseFloat(row.mining_speed_multiplier),
        joinedAt: row.created_at
      }));
    } catch (error) {
      console.error('❌ 获取等级排行榜失败:', error);
      throw error;
    }
  }
}

module.exports = LevelService;
