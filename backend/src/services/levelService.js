/**
 * 等级系统服务
 * 负责用户等级计算、积分管理、挖矿速率倍数计算
 */

const pool = require('../config/database_native');
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
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.query(
        'SELECT level, min_points, max_points, speed_multiplier, level_name, description FROM level_config ORDER BY level ASC'
      );
      this.LEVEL_CONFIG = rows;
      console.log(`✅ 等级配置加载成功: ${rows.length} 个等级`);
      return this.LEVEL_CONFIG;
    } catch (error) {
      console.error('❌ 加载等级配置失败:', error);
      // 使用默认配置
      this.LEVEL_CONFIG = [
        { level: 1, min_points: 0, max_points: 20, speed_multiplier: 1.0000, level_name: 'LV.1 Novice Miner' },
        { level: 2, min_points: 0, max_points: 30, speed_multiplier: 1.1000, level_name: 'LV.2 Junior Miner' },
        { level: 3, min_points: 0, max_points: 50, speed_multiplier: 1.2000, level_name: 'LV.3 Intermediate Miner' },
        { level: 4, min_points: 0, max_points: 100, speed_multiplier: 1.3500, level_name: 'LV.4 Senior Miner' },
        { level: 5, min_points: 0, max_points: 200, speed_multiplier: 1.5000, level_name: 'LV.5 Expert Miner' },
        { level: 6, min_points: 0, max_points: 400, speed_multiplier: 1.7000, level_name: 'LV.6 Master Miner' },
        { level: 7, min_points: 0, max_points: 800, speed_multiplier: 2.0000, level_name: 'LV.7 Legendary Miner' },
        { level: 8, min_points: 0, max_points: 1600, speed_multiplier: 2.4000, level_name: 'LV.8 Epic Miner' },
        { level: 9, min_points: 0, max_points: 999999, speed_multiplier: 3.0000, level_name: 'LV.9 Mythic Miner' }
      ];
      return this.LEVEL_CONFIG;
    } finally {
      connection.release();
    }
  }

  /**
   * 根据等级和积分计算等级信息
   * 注意：每个等级的积分是独立的，升级后从0开始
   * 这个方法主要用于显示用户当前等级信息，不处理升级逻辑（升级由存储过程处理）
   */
  static calculateLevelInfo(level, points) {
    if (!this.LEVEL_CONFIG) {
      throw new Error('等级配置未初始化，请先调用 initLevelConfig()');
    }

    // 查找当前等级配置
    const config = this.LEVEL_CONFIG.find(c => c.level === level);
    if (!config) {
      // 如果找不到，返回最高等级
      const maxLevel = this.LEVEL_CONFIG[this.LEVEL_CONFIG.length - 1];
      return {
        level: maxLevel.level,
        levelName: maxLevel.level_name,
        speedMultiplier: parseFloat(maxLevel.speed_multiplier),
        minPoints: maxLevel.min_points,
        maxPoints: maxLevel.max_points,
        description: maxLevel.description,
        pointsToNextLevel: 0,
        progressPercentage: 100.00
      };
    }

    // LV.9 特殊处理
    if (level === 9) {
      return {
        level: 9,
        levelName: config.level_name,
        speedMultiplier: parseFloat(config.speed_multiplier),
        minPoints: 0,
        maxPoints: 999999,
        description: config.description,
        pointsToNextLevel: 0,
        progressPercentage: 100.00
      };
    }

    // 计算升级进度
    const pointsToNextLevel = Math.max(0, config.max_points - points);
    const progressPercentage = ((points / config.max_points) * 100).toFixed(2);

    return {
      level: level,
      levelName: config.level_name,
      speedMultiplier: parseFloat(config.speed_multiplier),
      minPoints: 0,  // 每个等级都从0开始
      maxPoints: config.max_points,
      description: config.description,
      pointsToNextLevel,
      progressPercentage: parseFloat(progressPercentage)
    };
  }

  /**
   * 根据积分计算等级（已废弃，保留兼容性）
   */
  static calculateLevel(points) {
    // 这个方法已废弃，因为现在等级和积分分开存储
    // 保留用于兼容旧代码
    return this.calculateLevelInfo(1, points);
  }

  /**
   * 获取用户等级信息 (优先从 Redis 缓存获取)
   */
  static async getUserLevel(userId) {
    const connection = await pool.getConnection();
    
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
      const [rows] = await connection.query(
        'SELECT user_level, user_points, mining_speed_multiplier FROM user_information WHERE user_id = ?',
        [userId]
      );

      if (rows.length === 0) {
        throw new Error('用户不存在');
      }

      const userInfo = rows[0];
      const levelInfo = this.calculateLevelInfo(userInfo.user_level, userInfo.user_points);

      const result = {
        level: levelInfo.level,
        points: userInfo.user_points,
        speedMultiplier: levelInfo.speedMultiplier,
        levelName: levelInfo.levelName,
        minPoints: levelInfo.minPoints,
        maxPoints: levelInfo.maxPoints,
        pointsToNextLevel: levelInfo.pointsToNextLevel,
        progressPercentage: levelInfo.progressPercentage
      };

      // 3. 缓存到 Redis（包含完整的等级信息）
      if (redisClient.isReady()) {
        try {
          await redisClient.cacheUserLevel(
            userId,
            result.level,
            result.points,
            result.speedMultiplier,
            false,
            null,
            result.levelName,
            result.maxPoints,
            result.pointsToNextLevel,
            result.progressPercentage
          );
        } catch (cacheError) {
          console.error(`缓存用户 ${userId} 等级失败:`, cacheError.message);
        }
      }

      return result;
    } catch (error) {
      console.error('❌ 获取用户等级信息失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 计算等级进度百分比（已废弃）
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
   * 计算最终挖矿速率
   * 公式：每秒奖励 BTC = 基础奖励 × 国家系数 × 矿工等级速率系数 × 特殊加成系数
   * 注意：特殊加成系数（1.36倍）只在签到合约中使用，其他合约不使用
   */
  static async calculateMiningSpeed(userId, baseSpeed = 0.000000000000139) {
    try {
      // 1. 获取用户等级倍数（矿工等级速率系数）
      const levelInfo = await this.getUserLevel(userId);
      const levelMultiplier = levelInfo.speedMultiplier;

      // 2. 检查是否有每日签到加成 (1.36倍，2小时有效) - 仅用于签到合约
      let dailyBonusMultiplier = 1.0;
      let dailyBonusActive = false;
      if (redisClient.isReady()) {
        const isActive = await redisClient.isDailyBonusActive(userId);
        if (isActive) {
          dailyBonusMultiplier = 1.36;
          dailyBonusActive = true;
          console.log(`✅ 用户 ${userId} 每日签到加成激活（仅用于签到合约）`);
        }
      }

      // 3. 获取用户国家倍数（国家系数）
      let countryMultiplier = 1.0;
      try {
        const CountryMiningService = require('./countryMiningService');
        
        // 从数据库获取用户国家
        const [userInfo] = await db.query(
          'SELECT country_code FROM user_information WHERE user_id = ?',
          [userId]
        );
        
        if (userInfo.length > 0 && userInfo[0].country_code) {
          countryMultiplier = await CountryMiningService.getMiningMultiplier(userInfo[0].country_code);
          console.log(`✅ 用户 ${userId} 国家倍数 (${userInfo[0].country_code}): ${countryMultiplier}`);
        }
      } catch (error) {
        console.warn('获取国家倍数失败，使用默认值 1.0:', error.message);
      }

      // 4. 计算速度（不包含签到加成，签到加成只在签到合约中单独应用）
      // 基础速度 × 等级系数 × 国家系数
      const finalSpeedWithoutBonus = baseSpeed * levelMultiplier * countryMultiplier;
      
      // 5. 计算包含签到加成的速度（仅用于签到合约）
      const finalSpeedWithBonus = finalSpeedWithoutBonus * dailyBonusMultiplier;

      return {
        baseSpeed,
        baseHashrateGhs: 5.5,  // 基础算力 5.5 Gh/s
        levelMultiplier,       // 矿工等级速率系数
        countryMultiplier,     // 国家系数
        dailyBonusMultiplier,  // 特殊加成系数（1.36倍）
        dailyBonusActive,      // 签到加成是否激活
        finalSpeedWithoutBonus, // 标准速度（广告、邀请、绑定推荐人合约使用）
        finalSpeedWithBonus,    // 签到速度（仅签到合约使用）
        // 兼容旧字段
        finalSpeed: finalSpeedWithoutBonus,
        finalSpeedWithCountry: finalSpeedWithoutBonus
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
