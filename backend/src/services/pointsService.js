/**
 * 积分系统服务
 * 负责用户积分的增加、扣除、查询、历史记录等核心功能
 */

const pool = require('../config/database_native'); // 使用原生MySQL连接池
const redisClient = require('../config/redis');

class PointsService {
  /**
   * 积分类型枚举
   */
  static POINTS_TYPES = {
    AD_VIEW: 'AD_VIEW',                           // 观看广告
    REFERRAL_1: 'REFERRAL_1',                     // 邀请1人
    REFERRAL_10: 'REFERRAL_10',                   // 邀请10人
    DAILY_CHECKIN: 'DAILY_CHECKIN',               // 每日签到
    CUMULATIVE_CHECKIN_3: 'CUMULATIVE_CHECKIN_3',   // 累计签到3天
    CUMULATIVE_CHECKIN_7: 'CUMULATIVE_CHECKIN_7',   // 累计签到7天
    CUMULATIVE_CHECKIN_15: 'CUMULATIVE_CHECKIN_15', // 累计签到15天
    CUMULATIVE_CHECKIN_30: 'CUMULATIVE_CHECKIN_30', // 累计签到30天
    SUBORDINATE_AD_VIEW: 'SUBORDINATE_AD_VIEW',   // 下级观看广告
    MANUAL_ADD: 'MANUAL_ADD',                     // 手动增加
    MANUAL_DEDUCT: 'MANUAL_DEDUCT'                // 手动扣除
  };

  /**
   * 获取用户当前积分
   */
  static async getUserPoints(userId) {
    try {
      // 1. 尝试从 Redis 获取
      if (redisClient.isReady()) {
        const cachedPoints = await redisClient.getUserPoints(userId);
        if (cachedPoints !== null) {
          return {
            userId,
            totalPoints: parseInt(cachedPoints.total || 0),
            availablePoints: parseInt(cachedPoints.available || 0)
          };
        }
      }

      // 2. 从数据库获取（使用user_information表）
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query(
          'SELECT user_points FROM user_information WHERE user_id = ?',
          [userId]
        );

        if (!rows || rows.length === 0) {
          throw new Error('用户不存在');
        }

        const points = {
          userId,
          totalPoints: rows[0].user_points || 0,
          availablePoints: rows[0].user_points || 0 // 简化版：总积分=可用积分
        };

        // 3. 缓存到 Redis
        if (redisClient.isReady()) {
          await redisClient.cacheUserPoints(userId, points.totalPoints, points.availablePoints);
        }

        return points;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('获取用户积分失败:', error);
      throw error;
    }
  }

  /**
   * 增加用户积分（核心方法）
   * 使用user_information表存储积分，points_transaction表记录历史
   */
  static async addPoints(userId, points, pointsType, description = '', relatedUserId = null) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 获取用户当前积分和等级
      const [userRows] = await connection.query(
        'SELECT user_level, user_points FROM user_information WHERE user_id = ? FOR UPDATE',
        [userId]
      );

      if (userRows.length === 0) {
        throw new Error('用户不存在');
      }

      let currentLevel = userRows[0].user_level || 1;
      const currentPoints = userRows[0].user_points || 0;
      let newPoints = currentPoints + points;

      // 2. 检查是否需要升级
      let levelChanged = false;
      const LevelService = require('./levelService');
      
      // 确保等级配置已加载
      if (!LevelService.LEVEL_CONFIG) {
        await LevelService.initLevelConfig();
      }
      
      // 持续检查升级（处理跨多级升级的情况）
      while (currentLevel < 9) {
        const currentLevelConfig = LevelService.LEVEL_CONFIG.find(c => c.level === currentLevel);
        if (!currentLevelConfig) break;
        
        // 如果当前等级积分达到升级要求
        if (newPoints >= currentLevelConfig.max_points) {
          // 计算溢出积分
          const overflowPoints = newPoints - currentLevelConfig.max_points;
          
          // 升级
          currentLevel++;
          newPoints = overflowPoints;
          levelChanged = true;
          
          console.log(`🎉 用户 ${userId} 从 LV.${currentLevel - 1} 升级到 LV.${currentLevel}，溢出积分: ${overflowPoints}`);
        } else {
          break; // 不满足升级条件，退出循环
        }
      }

      // 3. 更新用户积分和等级（user_information表）
      if (levelChanged) {
        await connection.query(
          'UPDATE user_information SET user_points = ?, user_level = ? WHERE user_id = ?',
          [newPoints, currentLevel, userId]
        );
      } else {
        await connection.query(
          'UPDATE user_information SET user_points = ? WHERE user_id = ?',
          [newPoints, userId]
        );
      }

      // 4. 记录积分变动历史（points_transaction表）
      await connection.query(
        `INSERT INTO points_transaction (
          user_id, 
          points_change, 
          points_type, 
          balance_after, 
          description, 
          related_user_id
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, points, pointsType, newPoints, description, relatedUserId]
      );

      // 5. 同步积分到user_points表（如果存在）
      await connection.query(
        `INSERT INTO user_points (user_id, total_points, available_points) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
         total_points = total_points + ?,
         available_points = available_points + ?,
         updated_at = NOW()`,
        [userId, newPoints, newPoints, points, points]
      );

      await connection.commit();

      // 6. 更新 Redis 缓存
      if (redisClient.isReady()) {
        await redisClient.cacheUserPoints(userId, newPoints, newPoints);
        // 清除等级缓存，强制重新计算
        await redisClient.deleteUserLevel(userId);
      }

      console.log(`✅ 用户 ${userId} 增加 ${points} 积分，类型: ${pointsType}，当前等级: LV.${currentLevel}，当前积分: ${newPoints}${levelChanged ? ' (已升级)' : ''}`);

      return {
        success: true,
        userId,
        pointsChange: points,
        totalPoints: newPoints,
        availablePoints: newPoints,
        currentLevel,
        levelChanged,
        pointsType,
        description
      };

    } catch (error) {
      await connection.rollback();
      console.error('增加积分失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 扣除用户积分
   */
  static async deductPoints(userId, points, pointsType, description = '', relatedUserId = null) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 获取用户当前积分
      const [userRows] = await connection.query(
        'SELECT user_points FROM user_information WHERE user_id = ? FOR UPDATE',
        [userId]
      );

      if (userRows.length === 0) {
        throw new Error('用户不存在');
      }

      const currentPoints = userRows[0].user_points || 0;

      if (currentPoints < points) {
        throw new Error('可用积分不足');
      }

      const newPoints = currentPoints - points;

      // 2. 更新用户积分
      await connection.query(
        'UPDATE user_information SET user_points = ? WHERE user_id = ?',
        [newPoints, userId]
      );

      // 3. 记录积分变动（负数）
      await connection.query(
        `INSERT INTO points_transaction (
          user_id, 
          points_change, 
          points_type, 
          balance_after, 
          description, 
          related_user_id
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, -points, pointsType, newPoints, description, relatedUserId]
      );

      // 4. 同步到user_points表
      await connection.query(
        `UPDATE user_points 
         SET available_points = available_points - ?,
             updated_at = NOW()
         WHERE user_id = ?`,
        [points, userId]
      );

      await connection.commit();

      // 5. 更新 Redis 缓存
      if (redisClient.isReady()) {
        await redisClient.deleteUserPoints(userId);
      }

      console.log(`✅ 用户 ${userId} 扣除 ${points} 积分，类型: ${pointsType}`);

      return {
        success: true,
        userId,
        pointsChange: -points,
        totalPoints: newPoints,
        availablePoints: newPoints,
        pointsType,
        description
      };

    } catch (error) {
      await connection.rollback();
      console.error('扣除积分失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取积分交易记录
   */
  static async getPointsTransactions(userId, page = 1, limit = 20, pointsType = null) {
    const connection = await pool.getConnection();
    
    try {
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE user_id = ?';
      const params = [userId];
      
      if (pointsType) {
        whereClause += ' AND points_type = ?';
        params.push(pointsType);
      }

      // 获取总记录数
      const [countResult] = await connection.query(
        `SELECT COUNT(*) as total FROM points_transaction ${whereClause}`,
        params
      );
      const total = countResult[0]?.total || 0;

      // 获取分页记录
      const [transactions] = await connection.query(
        `SELECT 
          id,
          user_id,
          points_change,
          points_type,
          balance_after,
          description,
          related_user_id,
          created_at
        FROM points_transaction
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset]
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
      console.error('获取积分记录失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取积分统计（按类型汇总）
   */
  static async getPointsStatistics(userId) {
    const connection = await pool.getConnection();
    
    try {
      const [stats] = await connection.query(
        `SELECT 
          points_type,
          SUM(CASE WHEN points_change > 0 THEN points_change ELSE 0 END) as total_earned,
          SUM(CASE WHEN points_change < 0 THEN ABS(points_change) ELSE 0 END) as total_spent,
          COUNT(*) as transaction_count
        FROM points_transaction
        WHERE user_id = ?
        GROUP BY points_type
        ORDER BY total_earned DESC`,
        [userId]
      );

      // 获取总积分
      const userPoints = await this.getUserPoints(userId);

      return {
        success: true,
        data: {
          currentPoints: userPoints,
          statistics: stats
        }
      };

    } catch (error) {
      console.error('获取积分统计失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 批量获取多个用户的积分
   */
  static async getBatchUserPoints(userIds) {
    const connection = await pool.getConnection();
    
    try {
      if (!userIds || userIds.length === 0) {
        return [];
      }

      const placeholders = userIds.map(() => '?').join(',');
      const [rows] = await connection.query(
        `SELECT user_id, user_points as total_points, user_points as available_points 
         FROM user_information 
         WHERE user_id IN (${placeholders})`,
        userIds
      );

      return rows;

    } catch (error) {
      console.error('批量获取用户积分失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 积分排行榜
   */
  static async getLeaderboard(limit = 100) {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.query(
        `SELECT 
          user_id,
          user_points as total_points,
          invitation_code,
          country
        FROM user_information
        ORDER BY user_points DESC
        LIMIT ?`,
        [limit]
      );

      return {
        success: true,
        data: rows
      };

    } catch (error) {
      console.error('获取积分排行榜失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 清理过期的积分缓存
   */
  static async clearExpiredCache() {
    try {
      if (!redisClient.isReady()) {
        return;
      }

      // 清理30天前的缓存
      const keys = await redisClient.client.keys('user:points:*');
      let clearedCount = 0;

      for (const key of keys) {
        const ttl = await redisClient.client.ttl(key);
        if (ttl < 0) {
          await redisClient.client.del(key);
          clearedCount++;
        }
      }

      console.log(`✅ 清理了 ${clearedCount} 个过期的积分缓存`);
      return clearedCount;

    } catch (error) {
      console.error('清理积分缓存失败:', error);
      throw error;
    }
  }
}

module.exports = PointsService;
