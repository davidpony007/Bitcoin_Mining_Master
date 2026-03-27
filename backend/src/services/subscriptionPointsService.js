/**
 * 订阅积分奖励服务
 * 业务规则：用户首次订阅某个付费档位，奖励 20 积分
 * - 每个不同档位最多奖励一次（续订不重复奖励）
 * - 最多 4 个档位 × 20 = 80 积分
 */

const pool = require('../config/database_native');
const PointsService = require('./pointsService');

class SubscriptionPointsService {
  static POINTS_PER_TIER = 20;

  // 各档位对应的积分类型
  static PRODUCT_POINTS_TYPE = {
    'p0499': PointsService.POINTS_TYPES.SUBSCRIBE_STARTER_PLAN,
    'p0699': PointsService.POINTS_TYPES.SUBSCRIBE_STANDARD_PLAN,
    'p0999': PointsService.POINTS_TYPES.SUBSCRIBE_ADVANCED_PLAN,
    'p1999': PointsService.POINTS_TYPES.SUBSCRIBE_PREMIUM_PLAN,
  };

  // 各档位对应的积分描述
  static PRODUCT_DESCRIPTION = {
    'p0499': 'Subscribe Starter Plan 首次订阅积分奖励',
    'p0699': 'Subscribe Standard Plan 首次订阅积分奖励',
    'p0999': 'Subscribe Advanced Plan 首次订阅积分奖励',
    'p1999': 'Subscribe Premium Plan 首次订阅积分奖励',
  };

  /**
   * 对用户首次订阅某档位发放积分奖励（幂等）
   * @param {string} userId       用户ID
   * @param {string} productId    后端产品ID，如 p0499 / p0699 / p0999 / p1999
   * @returns {{ awarded: boolean, pointsAwarded: number, reason?: string }}
   */
  static async awardSubscriptionPoints(userId, productId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. 检查该用户对该档位是否已发放过积分（使用 INSERT IGNORE 保证原子性）
      const [insertResult] = await connection.query(
        `INSERT IGNORE INTO subscription_point_awards (user_id, product_id)
         VALUES (?, ?)`,
        [userId, productId]
      );

      // affectedRows = 0 表示记录已存在（UNIQUE 键冲突被忽略）
      if (insertResult.affectedRows === 0) {
        await connection.commit();
        console.log(`ℹ️ [subscriptionPoints] 已发放过积分: user=${userId} product=${productId}`);
        return { awarded: false, pointsAwarded: 0, reason: 'already_awarded' };
      }

      await connection.commit();

      // 2. 确定该档位对应的积分类型和描述
      const pointsType = SubscriptionPointsService.PRODUCT_POINTS_TYPE[productId]
        || PointsService.POINTS_TYPES.SUBSCRIBE_STARTER_PLAN;
      const description = SubscriptionPointsService.PRODUCT_DESCRIPTION[productId]
        || `Subscribe ${productId} 首次订阅积分奖励`;

      // 3. 在事务外调用 PointsService.addPoints（其内部自带事务）
      await PointsService.addPoints(
        userId,
        this.POINTS_PER_TIER,
        pointsType,
        description,
        null
      );

      console.log(`🎉 [subscriptionPoints] 发放积分成功: user=${userId} product=${productId} points=${this.POINTS_PER_TIER}`);
      return { awarded: true, pointsAwarded: this.POINTS_PER_TIER };

    } catch (err) {
      await connection.rollback().catch(() => {});
      console.error(`❌ [subscriptionPoints] 发放积分失败: user=${userId} product=${productId}`, err);
      // 积分奖励失败不阻断主流程，直接返回失败标识
      return { awarded: false, pointsAwarded: 0, reason: 'error', error: err.message };
    } finally {
      connection.release();
    }
  }
}

module.exports = SubscriptionPointsService;
