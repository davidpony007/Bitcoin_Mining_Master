/**
 * 签到积分服务（增强版）
 * 负责每日签到、连续签到奖励、里程碑奖励等功能
 */

const db = require('../config/database');
const redisClient = require('../config/redis');
const PointsService = require('./pointsService');

class CheckInPointsService {
  /**
   * 30天签到奖励配置系统
   * 包含每日基础奖励 + 里程碑额外奖励
   */
  static BASE_CHECKIN_POINTS = 4; // 每日签到基础奖励4积分

  // 30天签到每日奖励配置（累计奖励）
  static DAILY_REWARDS = {
    1: 4, 2: 4, 3: 6,     // Day 1-3
    4: 4, 5: 4, 6: 4,     // Day 4-6
    7: 10,                 // Week 1 Milestone
    8: 5, 9: 5, 10: 5,    // Day 8-10
    11: 5, 12: 5, 13: 5,  // Day 11-13
    14: 12,                // Week 2 Milestone
    15: 15,                // Half Month Milestone
    16: 6, 17: 6, 18: 6,  // Day 16-18
    19: 6, 20: 6, 21: 18, // Day 19-21, Week 3 Milestone
    22: 7, 23: 7, 24: 7,  // Day 22-24
    25: 8, 26: 8, 27: 8,  // Day 25-27
    28: 20,                // Week 4 Milestone
    29: 10, 30: 30        // Day 29, Full Month Milestone
  };

  // 特殊里程碑额外奖励（可单独领取）
  static MILESTONE_REWARDS = {
    7: { points: 15, label: 'Week 1 Champion', description: 'Continuous 7-day check-in' },
    14: { points: 25, label: 'Week 2 Champion', description: 'Continuous 14-day check-in' },
    21: { points: 35, label: 'Week 3 Champion', description: 'Continuous 21-day check-in' },
    30: { points: 60, label: 'Monthly Master', description: 'Continuous 30-day check-in' }
  };

  /**
   * 执行每日签到
   */
  static async performCheckIn(userId) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // 1. 检查今日是否已签到
      const [existingRows] = await connection.query(
        'SELECT id FROM check_in_record WHERE user_id = ? AND check_in_date = ?',
        [userId, today]
      );

      if (existingRows.length > 0) {
        await connection.rollback();
        return {
          success: false,
          error: 'ALREADY_CHECKED_IN',
          message: '今日已签到'
        };
      }

      // 2. 获取昨天的签到记录，计算连续签到天数
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const [yesterdayRows] = await connection.query(
        'SELECT consecutive_days FROM check_in_record WHERE user_id = ? AND check_in_date = ?',
        [userId, yesterday]
      );

      let consecutiveDays = 1;
      if (yesterdayRows.length > 0) {
        consecutiveDays = yesterdayRows[0].consecutive_days + 1;
      }

      // 3. 计算总奖励积分（基于连续天数的渐进奖励）
      const dayReward = this.DAILY_REWARDS[consecutiveDays] || this.BASE_CHECKIN_POINTS;
      let totalPoints = dayReward;
      let milestoneBonus = 0;
      let milestoneReached = null;
      let isMilestoneDay = false;

      // 检查是否为里程碑日
      if (this.MILESTONE_REWARDS[consecutiveDays]) {
        isMilestoneDay = true;
        milestoneReached = consecutiveDays;
        // 里程碑奖励已包含在DAILY_REWARDS中，这里记录信息用于前端显示
      }

      // 4. 创建签到记录
      await connection.query(
        `INSERT INTO check_in_record (user_id, check_in_date, consecutive_days, points_earned)
         VALUES (?, ?, ?, ?)`,
        [userId, today, consecutiveDays, totalPoints]
      );

      // 5. 增加签到积分
      const description = isMilestoneDay 
        ? `${this.MILESTONE_REWARDS[milestoneReached].label} - Day ${consecutiveDays} Check-in`
        : `Daily Check-in Reward (Day ${consecutiveDays})`;
      
      await PointsService.addPoints(
        userId,
        totalPoints,
        PointsService.POINTS_TYPES.DAILY_CHECKIN,
        description,
        null
      );

      await connection.commit();

      // 7. 更新 Redis 缓存
      if (redisClient.isReady()) {
        await redisClient.setUserCheckInStatus(userId, {
          date: today,
          consecutiveDays,
          totalPoints
        });
      }

      const result = {
        success: true,
        message: isMilestoneDay ? `🎉 ${this.MILESTONE_REWARDS[milestoneReached].label}!` : 'Check-in Success!',
        userId,
        checkInDate: today,
        consecutiveDays,
        pointsAwarded: totalPoints,
        isMilestoneDay,
        milestoneInfo: isMilestoneDay ? this.MILESTONE_REWARDS[milestoneReached] : null,
        nextMilestone: this.getNextMilestone(consecutiveDays),
        totalRewardForToday: dayReward
      };

      console.log(`✅ 用户 ${userId} 签到成功，连续${consecutiveDays}天，获得${totalPoints}积分`);

      return result;

    } catch (error) {
      await connection.rollback();
      console.error('签到失败:', error);
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
      const today = new Date().toISOString().split('T')[0];

      // 优先从 Redis 获取
      if (redisClient.isReady()) {
        const cached = await redisClient.getUserCheckInStatus(userId);
        if (cached && cached.date === today) {
          return {
            success: true,
            hasCheckedInToday: true,
            ...cached
          };
        }
      }

      // 1. 检查今日是否已签到
      const [todayRows] = await db.query(
        'SELECT consecutive_days, points_earned, created_at FROM check_in_record WHERE user_id = ? AND check_in_date = ?',
        [userId, today]
      );

      if (todayRows.length > 0) {
        const status = {
          success: true,
          hasCheckedInToday: true,
          checkInDate: today,
          consecutiveDays: todayRows[0].consecutive_days,
          pointsEarned: todayRows[0].points_earned,
          checkInTime: todayRows[0].created_at,
          nextMilestone: this.getNextMilestone(todayRows[0].consecutive_days)
        };

        // 缓存到 Redis
        if (redisClient.isReady()) {
          await redisClient.setUserCheckInStatus(userId, {
            date: today,
            consecutiveDays: status.consecutiveDays,
            totalPoints: status.pointsEarned
          });
        }

        return status;
      }

      // 2. 获取最近一次签到记录
      const [lastRows] = await db.query(
        `SELECT check_in_date, consecutive_days 
         FROM check_in_record 
         WHERE user_id = ? 
         ORDER BY check_in_date DESC 
         LIMIT 1`,
        [userId]
      );

      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      let currentStreak = 0;

      if (lastRows.length > 0) {
        if (lastRows[0].check_in_date === yesterday) {
          // 昨天签到了，今天可以继续
          currentStreak = lastRows[0].consecutive_days;
        }
        // 如果不是昨天，连续签到中断，从0开始
      }

      return {
        success: true,
        hasCheckedInToday: false,
        currentStreak,
        nextCheckInDay: currentStreak + 1,
        nextMilestone: this.getNextMilestone(currentStreak + 1),
        potentialPoints: this.calculatePotentialPoints(currentStreak + 1)
      };

    } catch (error) {
      console.error('获取签到状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取签到历史（最近N天）
   */
  static async getCheckInHistory(userId, days = 30) {
    try {
      const [rows] = await db.query(
        `SELECT 
          check_in_date,
          consecutive_days,
          points_earned,
          created_at
        FROM check_in_record
        WHERE user_id = ?
        AND check_in_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ORDER BY check_in_date DESC`,
        [userId, days]
      );

      // 计算统计
      const totalCheckIns = rows.length;
      const totalPoints = rows.reduce((sum, row) => sum + row.points_earned, 0);
      const maxStreak = rows.length > 0 ? Math.max(...rows.map(r => r.consecutive_days)) : 0;

      return {
        success: true,
        data: {
          history: rows,
          statistics: {
            days,
            totalCheckIns,
            totalPoints,
            maxStreak,
            checkInRate: ((totalCheckIns / days) * 100).toFixed(2) + '%'
          }
        }
      };

    } catch (error) {
      console.error('获取签到历史失败:', error);
      throw error;
    }
  }

  /**
   * 领取连续签到里程碑奖励（独立领取）
   */
  static async claimConsecutiveMilestone(userId, consecutiveDays) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 验证里程碑是否有效
      if (!this.CONSECUTIVE_REWARDS[consecutiveDays]) {
        await connection.rollback();
        return {
          success: false,
          error: 'INVALID_MILESTONE',
          message: '无效的里程碑天数'
        };
      }

      // 2. 检查是否已领取
      const [claimedRows] = await connection.query(
        'SELECT id FROM consecutive_check_in_reward WHERE user_id = ? AND consecutive_days = ?',
        [userId, consecutiveDays]
      );

      if (claimedRows.length > 0) {
        await connection.rollback();
        return {
          success: false,
          error: 'ALREADY_CLAIMED',
          message: '该里程碑奖励已领取'
        };
      }

      // 3. 验证用户是否达到连续签到天数
      const [checkInRows] = await connection.query(
        `SELECT MAX(consecutive_days) as max_consecutive 
         FROM check_in_record 
         WHERE user_id = ?`,
        [userId]
      );

      if (checkInRows.length === 0 || checkInRows[0].max_consecutive < consecutiveDays) {
        await connection.rollback();
        return {
          success: false,
          error: 'REQUIREMENT_NOT_MET',
          message: `未达到连续签到${consecutiveDays}天的要求`
        };
      }

      // 4. 发放奖励
      const rewardPoints = this.CONSECUTIVE_REWARDS[consecutiveDays];
      const milestoneType = `CONSECUTIVE_CHECKIN_${consecutiveDays}`;

      await connection.query(
        `INSERT INTO consecutive_check_in_reward (user_id, consecutive_days, points_earned)
         VALUES (?, ?, ?)`,
        [userId, consecutiveDays, rewardPoints]
      );

      await PointsService.addPoints(
        userId,
        rewardPoints,
        PointsService.POINTS_TYPES[milestoneType],
        `领取连续签到${consecutiveDays}天里程碑奖励`,
        null
      );

      await connection.commit();

      console.log(`✅ 用户 ${userId} 领取连续签到${consecutiveDays}天奖励 ${rewardPoints} 积分`);

      return {
        success: true,
        userId,
        consecutiveDays,
        pointsEarned: rewardPoints
      };

    } catch (error) {
      await connection.rollback();
      console.error('领取里程碑奖励失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取可领取的里程碑奖励
   */
  static async getAvailableMilestones(userId) {
    try {
      // 1. 获取用户最大连续签到天数
      const [maxRows] = await db.query(
        'SELECT MAX(consecutive_days) as max_consecutive FROM check_in_record WHERE user_id = ?',
        [userId]
      );

      const maxConsecutive = maxRows[0].max_consecutive || 0;

      // 2. 获取已领取的里程碑
      const [claimedRows] = await db.query(
        'SELECT consecutive_days FROM consecutive_check_in_reward WHERE user_id = ?',
        [userId]
      );

      const claimedMilestones = claimedRows.map(row => row.consecutive_days);

      // 3. 计算可领取的里程碑
      const availableMilestones = [];
      for (const [days, points] of Object.entries(this.CONSECUTIVE_REWARDS)) {
        const daysNum = parseInt(days);
        if (daysNum <= maxConsecutive && !claimedMilestones.includes(daysNum)) {
          availableMilestones.push({
            consecutiveDays: daysNum,
            points,
            canClaim: true
          });
        }
      }

      return {
        success: true,
        maxConsecutive,
        availableMilestones,
        claimedMilestones
      };

    } catch (error) {
      console.error('获取可领取里程碑失败:', error);
      throw error;
    }
  }

  /**
   * 获取下一个里程碑
   */
  static getNextMilestone(currentDays) {
    const milestones = Object.keys(this.MILESTONE_REWARDS).map(Number).sort((a, b) => a - b);
    
    for (const milestone of milestones) {
      if (currentDays < milestone) {
        return {
          days: milestone,
          label: this.MILESTONE_REWARDS[milestone].label,
          points: this.MILESTONE_REWARDS[milestone].points,
          daysRemaining: milestone - currentDays
        };
      }
    }

    return null; // 已达到最高里程碑
  }

  /**
   * 获取30天完整签到日历数据
   */
  static async get30DayCalendar(userId) {
    try {
      // 获取用户最近30天的签到记录
      const [records] = await db.query(
        `SELECT check_in_date, consecutive_days, points_earned
         FROM check_in_record
         WHERE user_id = ?
         AND check_in_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         ORDER BY check_in_date DESC`,
        [userId]
      );

      const checkedDates = new Map(records.map(r => [r.check_in_date, {
        consecutiveDays: r.consecutive_days,
        points: r.points_earned
      }]));

      // 生成30天日历数据
      const calendar = [];
      const today = new Date();
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const checkedInfo = checkedDates.get(dateStr);
        const day = 30 - i; // Day 1 to 30
        
        calendar.push({
          date: dateStr,
          day,
          isChecked: !!checkedInfo,
          consecutiveDays: checkedInfo?.consecutiveDays || 0,
          pointsEarned: checkedInfo?.points || 0,
          potentialPoints: this.DAILY_REWARDS[day] || this.BASE_CHECKIN_POINTS,
          isMilestone: !!this.MILESTONE_REWARDS[day],
          milestoneInfo: this.MILESTONE_REWARDS[day] || null,
          isPast: date < today,
          isToday: dateStr === today.toISOString().split('T')[0],
          isFuture: date > today
        });
      }

      return {
        success: true,
        calendar,
        summary: {
          totalChecked: records.length,
          totalPoints: records.reduce((sum, r) => sum + r.points_earned, 0),
          maxStreak: records.length > 0 ? Math.max(...records.map(r => r.consecutive_days)) : 0
        }
      };

    } catch (error) {
      console.error('获取30天日历失败:', error);
      throw error;
    }
  }

  /**
   * 计算签到可获得的积分
   */
  static calculatePotentialPoints(consecutiveDays) {
    return this.DAILY_REWARDS[consecutiveDays] || this.BASE_CHECKIN_POINTS;
  }

  /**
   * 获取所有里程碑配置（用于前端显示）
   */
  static getMilestoneConfig() {
    return {
      success: true,
      milestones: Object.entries(this.MILESTONE_REWARDS).map(([day, config]) => ({
        day: parseInt(day),
        ...config
      })),
      dailyRewards: this.DAILY_REWARDS
    };
  }
}

module.exports = CheckInPointsService;
