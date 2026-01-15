/**
 * 积分系统服务
 * 负责用户积分的增加、扣除、查询、历史记录等核心功能
 */

const { QueryTypes } = require('sequelize');
const db = require('../config/database');
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
    CONSECUTIVE_CHECKIN_3: 'CONSECUTIVE_CHECKIN_3',   // 连续签到3天
    CONSECUTIVE_CHECKIN_7: 'CONSECUTIVE_CHECKIN_7',   // 连续签到7天
    CONSECUTIVE_CHECKIN_15: 'CONSECUTIVE_CHECKIN_15', // 连续签到15天
    CONSECUTIVE_CHECKIN_30: 'CONSECUTIVE_CHECKIN_30', // 连续签到30天
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

      // 2. 从数据库获取
      const [rows] = await db.query(
        'SELECT total_points, available_points FROM user_points WHERE user_id = ?',
        [userId]
      );

      if (rows.length === 0) {
        // 用户积分记录不存在，创建初始记录
        await db.query(
          'INSERT INTO user_points (user_id, total_points, available_points) VALUES (?, 0, 0)',
          [userId]
        );
        return { userId, totalPoints: 0, availablePoints: 0 };
      }

      const points = {
        userId,
        totalPoints: rows[0].total_points,
        availablePoints: rows[0].available_points
      };

      // 3. 缓存到 Redis
      if (redisClient.isReady()) {
        await redisClient.cacheUserPoints(userId, points.totalPoints, points.availablePoints);
      }

      return points;
    } catch (error) {
      console.error('获取用户积分失败:', error);
      throw error;
    }
  }

  /**
   * 增加用户积分（核心方法）
   */
  static async addPoints(userId, points, pointsType, description = '', relatedUserId = null) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 获取或创建用户积分记录
      let [userPoints] = await connection.query(
        'SELECT total_points, available_points FROM user_points WHERE user_id = ? FOR UPDATE',
        [userId]
      );

      if (userPoints.length === 0) {
        // 创建新记录
        await connection.query(
          'INSERT INTO user_points (user_id, total_points, available_points) VALUES (?, 0, 0)',
          [userId]
        );
        userPoints = [{ total_points: 0, available_points: 0 }];
      }

      const currentTotal = userPoints[0].total_points;
      const currentAvailable = userPoints[0].available_points;
      const newTotal = currentTotal + points;
      const newAvailable = currentAvailable + points;

      // 2. 更新积分
      await connection.query(
        'UPDATE user_points SET total_points = ?, available_points = ?, updated_at = NOW() WHERE user_id = ?',
        [newTotal, newAvailable, userId]
      );

      // 3. 记录积分变动
      await connection.query(
        `INSERT INTO points_transaction (
          user_id, 
          points_change, 
          points_type, 
          balance_after, 
          description, 
          related_user_id
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, points, pointsType, newAvailable, description, relatedUserId]
      );

      await connection.commit();

      // 4. 更新 Redis 缓存
      if (redisClient.isReady()) {
        await redisClient.cacheUserPoints(userId, newTotal, newAvailable);
      }

      console.log(`✅ 用户 ${userId} 增加 ${points} 积分，类型: ${pointsType}`);

      return {
        success: true,
        userId,
        pointsChange: points,
        totalPoints: newTotal,
        availablePoints: newAvailable,
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

      // 1. 获取用户积分记录
      const [userPoints] = await connection.query(
        'SELECT total_points, available_points FROM user_points WHERE user_id = ? FOR UPDATE',
        [userId]
      );

      if (userPoints.length === 0 || userPoints[0].available_points < points) {
        throw new Error('可用积分不足');
      }

      const currentTotal = userPoints[0].total_points;
      const currentAvailable = userPoints[0].available_points;
      const newAvailable = currentAvailable - points;

      // 2. 更新积分
      await connection.query(
        'UPDATE user_points SET available_points = ?, updated_at = NOW() WHERE user_id = ?',
        [newAvailable, userId]
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
        [userId, -points, pointsType, newAvailable, description, relatedUserId]
      );

      await connection.commit();

      // 4. 更新 Redis 缓存
      if (redisClient.isReady()) {
        await redisClient.cacheUserPoints(userId, currentTotal, newAvailable);
      }

      console.log(`✅ 用户 ${userId} 扣除 ${points} 积分，类型: ${pointsType}`);

      return {
        success: true,
        userId,
        pointsChange: -points,
        totalPoints: currentTotal,
        availablePoints: newAvailable,
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
    try {
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE user_id = ?';
      const params = [userId];
      
      if (pointsType) {
        whereClause += ' AND points_type = ?';
        params.push(pointsType);
      }

      // 获取总记录数
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM points_transaction ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      // 获取分页记录
      const [transactions] = await db.query(
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
        success: true,
        data: {
          transactions,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };

    } catch (error) {
      console.error('获取积分记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取积分统计（按类型汇总）
   */
  static async getPointsStatistics(userId) {
    try {
      const [stats] = await db.query(
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
    }
  }

  /**
   * 批量获取多个用户的积分
   */
  static async getBatchUserPoints(userIds) {
    try {
      if (!userIds || userIds.length === 0) {
        return [];
      }

      const placeholders = userIds.map(() => '?').join(',');
      const [rows] = await db.query(
        `SELECT user_id, total_points, available_points 
         FROM user_points 
         WHERE user_id IN (${placeholders})`,
        userIds
      );

      return rows;

    } catch (error) {
      console.error('批量获取用户积分失败:', error);
      throw error;
    }
  }

  /**
   * 积分排行榜
   */
  static async getLeaderboard(limit = 100) {
    try {
      const [rows] = await db.query(
        `SELECT 
          up.user_id,
          up.total_points,
          ui.invitation_code,
          ui.country
        FROM user_points up
        LEFT JOIN user_information ui ON up.user_id = ui.user_id
        ORDER BY up.total_points DESC
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
