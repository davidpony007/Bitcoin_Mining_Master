/**
 * 签到系统服务
 * 负责用户每日签到、累计签到奖励、每日签到加成等功能
 */

const db = require('../config/database');
const redisClient = require('../config/redis');
const LevelService = require('./levelService');

class CheckInService {
  /**
   * 签到奖励配置 (从数据库加载)
   */
  static REWARD_CONFIG = null;
  static DAILY_CHECK_IN_POINTS = 4; // 每日签到固定奖励4积分
  static MILESTONE_REWARDS = {
    7: { points: 15, description: '累计签到7天额外奖励' },
    15: { points: 30, description: '累计签到15天额外奖励' },  
    30: { points: 60, description: '累计签到30天额外奖励' }
  };

  /**
   * 初始化签到奖励配置
   */
  static async initRewardConfig() {
    try {
      const [rows] = await db.query(
        'SELECT cumulative_days, points_reward, description FROM check_in_reward_config WHERE is_active = TRUE ORDER BY cumulative_days ASC'
      );
      this.REWARD_CONFIG = rows;
      console.log(`✅ 签到奖励配置加载成功: ${rows.length} 个奖励档位`);
      return this.REWARD_CONFIG;
    } catch (error) {
      console.error('❌ 加载签到奖励配置失败:', error);
      // 使用默认配置
      this.REWARD_CONFIG = [
        { cumulative_days: 1, points_reward: 4, description: '累计签到1天' },
        { cumulative_days: 3, points_reward: 15, description: '累计签到3天' },
        { cumulative_days: 7, points_reward: 30, description: '累计签到7天' },
        { cumulative_days: 15, points_reward: 30, description: '累计签到15天' },
        { cumulative_days: 30, points_reward: 60, description: '累计签到30天' }
      ];
      return this.REWARD_CONFIG;
    }
  }

  /**
   * 计算签到奖励积分
   * 每日固定4积分 + 里程碑额外奖励（一次性）
   */
  static async calculateReward(userId, consecutiveDays, connection) {
    let totalPoints = this.DAILY_CHECK_IN_POINTS;
    let milestoneRewards = [];

    // 检查是否达到里程碑
    for (const [days, config] of Object.entries(this.MILESTONE_REWARDS)) {
      const targetDays = parseInt(days);
      if (consecutiveDays === targetDays) {
        // 检查是否已经领取过此里程碑奖励
        const [existingMilestone] = await connection.query(
          'SELECT id FROM user_check_in WHERE user_id = ? AND cumulative_days >= ? AND milestone_claimed = TRUE AND milestone_type = ?',
          [userId, targetDays, `CONSECUTIVE_${targetDays}`]
        );

        if (existingMilestone.length === 0) {
          // 首次达到此里程碑，发放额外奖励
          totalPoints += config.points;
          milestoneRewards.push({
            days: targetDays,
            points: config.points,
            description: config.description
          });
        }
      }
    }

    return {
      totalPoints,
      dailyPoints: this.DAILY_CHECK_IN_POINTS,
      milestoneRewards
    };
  }

  /**
   * 用户签到（简化版本，用于挖矿合约系统）
   * 仅验证今日是否已签到，不处理积分奖励
   */
  static async checkIn(userId) {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // 使用Sequelize原生查询
      const [existingCheckIn] = await db.query(
        'SELECT id FROM user_check_in WHERE user_id = ? AND check_in_date = ?',
        {
          replacements: [userId, today],
          type: db.QueryTypes.SELECT
        }
      );

      if (existingCheckIn) {
        return {
          success: false,
          message: '今日已签到',
          alreadyCheckedIn: true
        };
      }

      // 插入签到记录（简化版）
      await db.query(
        `INSERT INTO user_check_in (
          user_id, 
          check_in_date, 
          cumulative_days, 
          points_earned
        ) VALUES (?, ?, 1, 0)`,
        {
          replacements: [userId, today],
          type: db.QueryTypes.INSERT
        }
      );

      return {
        success: true,
        message: '签到成功',
        checkInDate: today
      };
    } catch (error) {
      console.error('❌ 签到失败:', error);
      throw error;
    }
  }

  /**
   * 用户签到（完整版本，已废弃）
   */
  static async checkInOld(userId) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // 1. 检查今天是否已签到
      const [existingCheckIn] = await connection.query(
        'SELECT id FROM user_check_in WHERE user_id = ? AND check_in_date = ?',
        [userId, today]
      );

      if (existingCheckIn.length > 0) {
        await connection.rollback();
        return {
          success: false,
          message: '今天已经签到过了',
          alreadyCheckedIn: true
        };
      }

      // 2. 查询最近的签到记录
      const [lastCheckIn] = await connection.query(
        'SELECT check_in_date, cumulative_days FROM user_check_in WHERE user_id = ? ORDER BY check_in_date DESC LIMIT 1',
        [userId]
      );

      let consecutiveDays = 1;
      if (lastCheckIn.length > 0) {
        const lastDate = new Date(lastCheckIn[0].check_in_date);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          // 累计签到（注意：虽然代码逻辑检查连续性，但实际奖励基于累计天数）
          consecutiveDays = lastCheckIn[0].cumulative_days + 1;
        } else if (diffDays > 1) {
          // 中断签到，重新开始
          consecutiveDays = 1;
        }
      }

      // 3. 计算奖励积分
      const reward = await this.calculateReward(userId, consecutiveDays, connection);
      const pointsEarned = reward.totalPoints;

      // 4. 确定里程碑类型
      let milestoneType = null;
      let milestoneClaimed = false;
      if (reward.milestoneRewards.length > 0) {
        milestoneType = `CONSECUTIVE_${reward.milestoneRewards[0].days}`;
        milestoneClaimed = true;
      }

      // 5. 插入签到记录
      await connection.query(
        `INSERT INTO user_check_in (
          user_id, 
          check_in_date, 
          cumulative_days, 
          points_earned,
          milestone_type,
          milestone_claimed
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, today, consecutiveDays, pointsEarned, milestoneType, milestoneClaimed]
      );

      // 6. 增加用户积分 - 每日签到积分
      await connection.query(
        'CALL sp_add_user_points(?, ?, ?, ?, NULL, NULL)',
        [userId, reward.dailyPoints, `每日签到 (连续${consecutiveDays}天)`, 'CHECK_IN']
      );

      // 7. 增加里程碑奖励积分
      for (const milestone of reward.milestoneRewards) {
        await connection.query(
          'CALL sp_add_user_points(?, ?, ?, ?, NULL, NULL)',
          [userId, milestone.points, milestone.description, 'CHECK_IN_MILESTONE']
        );
      }

      // 8. 更新用户最后登录时间
      await connection.query(
        'UPDATE user_information SET last_login_time = NOW() WHERE user_id = ?',
        [userId]
      );

      await connection.commit();

      // 9. 更新 Redis 缓存
      if (redisClient.isReady()) {
        // 缓存签到状态
        await redisClient.cacheCheckInStatus(userId, today, consecutiveDays, true, new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString());

        // 添加到每日签到加成激活用户集合 (2小时后过期)
        const expireTimestamp = Date.now() + 2 * 60 * 60 * 1000;
        await redisClient.addDailyBonusUser(userId, expireTimestamp);

        // 清除用户等级缓存 (积分已变化)
        await redisClient.deleteUserLevel(userId);
      }

      // 10. 获取最新用户等级信息
      const levelInfo = await LevelService.getUserLevel(userId);

      return {
        success: true,
        message: '签到成功',
        pointsEarned,
        dailyPoints: reward.dailyPoints,
        milestoneRewards: reward.milestoneRewards,
        consecutiveDays,
        dailyBonusActive: true,
        dailyBonusMultiplier: 1.36,
        dailyBonusDuration: '2小时',
        userLevel: levelInfo.level,
        userPoints: levelInfo.points
      };

    } catch (error) {
      await connection.rollback();
      console.error('❌ 签到失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取用户签到状态
   */
  static async getCheckInStatus(userId) {
    try {
      // 1. 尝试从 Redis 获取
      if (redisClient.isReady()) {
        const cachedStatus = await redisClient.getCheckInStatus(userId);
        if (cachedStatus) {
          // 检查今天是否已签到
          const today = new Date().toISOString().split('T')[0];
          const hasCheckedInToday = cachedStatus.lastDate === today;

          // 检查加成是否还有效
          let bonusActive = false;
          let bonusTimeRemaining = 0;
          if (cachedStatus.bonusExpire) {
            const expireTime = new Date(cachedStatus.bonusExpire);
            const now = new Date();
            bonusActive = expireTime > now;
            bonusTimeRemaining = bonusActive ? Math.floor((expireTime - now) / 1000) : 0;
          }

          return {
            hasCheckedInToday,
            lastCheckInDate: cachedStatus.lastDate,
            consecutiveDays: cachedStatus.consecutiveDays,
            dailyBonusActive: bonusActive,
            dailyBonusExpire: cachedStatus.bonusExpire,
            dailyBonusTimeRemaining: bonusTimeRemaining,
            nextReward: this.calculateReward(cachedStatus.consecutiveDays + 1)
          };
        }
      }

      // 2. 从数据库获取
      const today = new Date().toISOString().split('T')[0];

      const [checkInRecords] = await db.query(
        `SELECT 
          check_in_date,
          cumulative_days,
          points_earned
        FROM user_check_in
        WHERE user_id = ?
        ORDER BY check_in_date DESC
        LIMIT 1`,
        [userId]
      );

      if (checkInRecords.length === 0) {
        return {
          hasCheckedInToday: false,
          lastCheckInDate: null,
          consecutiveDays: 0,
          dailyBonusActive: false,
          dailyBonusExpire: null,
          dailyBonusTimeRemaining: 0,
          nextReward: this.calculateReward(1)
        };
      }

      const lastCheckIn = checkInRecords[0];
      const hasCheckedInToday = lastCheckIn.check_in_date === today;

      // 从 Redis 检查加成是否还有效
      let bonusActive = false;
      let bonusTimeRemaining = 0;
      if (redisClient.isReady()) {
        bonusActive = await redisClient.isDailyBonusActive(userId);
        // 简化处理，不返回具体剩余时间
      }

      const result = {
        hasCheckedInToday,
        lastCheckInDate: lastCheckIn.check_in_date,
        consecutiveDays: lastCheckIn.cumulative_days,
        dailyBonusActive: bonusActive,
        dailyBonusTimeRemaining: bonusTimeRemaining,
        nextReward: this.calculateReward(hasCheckedInToday ? lastCheckIn.cumulative_days + 1 : 1)
      };

      // 3. 缓存到 Redis
      if (redisClient.isReady()) {
        await redisClient.cacheCheckInStatus(userId, {
          lastDate: lastCheckIn.check_in_date,
          consecutiveDays: lastCheckIn.cumulative_days,
          bonusActive: bonusActive,
          bonusExpire: lastCheckIn.bonus_expire_time
        });
      }

      return result;

    } catch (error) {
      console.error('❌ 获取签到状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户签到历史 (最近30天)
   */
  static async getCheckInHistory(userId, days = 30) {
    try {
      const [records] = await db.query(
        `SELECT 
          check_in_date,
          cumulative_days,
          points_earned,
          created_at
        FROM user_check_in
        WHERE user_id = ?
        AND check_in_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ORDER BY check_in_date DESC`,
        [userId, days]
      );

      return {
        history: records,
        totalCheckIns: records.length,
        maxConsecutiveDays: records.length > 0 ? Math.max(...records.map(r => r.cumulative_days)) : 0
      };

    } catch (error) {
      console.error('❌ 获取签到历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取签到统计信息
   */
  static async getCheckInStatistics(userId) {
    try {
      const [stats] = await db.query(
        `SELECT 
          COUNT(*) as total_check_ins,
          SUM(points_earned) as total_points_from_checkin,
          MAX(cumulative_days) as max_cumulative_days
        FROM user_check_in
        WHERE user_id = ?`,
        [userId]
      );

      return stats[0] || {
        total_check_ins: 0,
        total_points_from_checkin: 0,
        max_cumulative_days: 0
      };

    } catch (error) {
      console.error('❌ 获取签到统计失败:', error);
      throw error;
    }
  }

  /**
   * 检查每日签到加成是否有效
   */
  static async isDailyBonusActive(userId) {
    try {
      // 优先从 Redis 检查
      if (redisClient.isReady()) {
        const isActive = await redisClient.isDailyBonusActive(userId);
        return isActive;
      }

      // 从数据库检查
      const today = new Date().toISOString().split('T')[0];
      const [records] = await db.query(
        `SELECT bonus_expire_time 
        FROM user_check_in 
        WHERE user_id = ? 
        AND check_in_date = ?
        AND daily_bonus_active = TRUE
        AND bonus_expire_time > NOW()`,
        [userId, today]
      );

      return records.length > 0;

    } catch (error) {
      console.error('❌ 检查每日签到加成失败:', error);
      return false;
    }
  }
}

module.exports = CheckInService;
