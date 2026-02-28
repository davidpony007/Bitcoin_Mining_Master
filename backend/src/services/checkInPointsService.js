/**
 * 签到积分服务（增强版）
 * 负责每日签到、累计签到奖励、里程碑奖励等功能
 */

const db = require('../config/database_native'); // 使用原生MySQL连接池
const redisClient = require('../config/redis');
const PointsService = require('./pointsService');

class CheckInPointsService {
  /**
   * 30天签到奖励配置系统
   * 包含每日基础奖励 + 累计里程碑额外奖励
   */
  static BASE_CHECKIN_POINTS = 4; // 每日签到基础奖励4积分（每日都可领取）

  // 累计签到里程碑奖励（可以不连续，只能领取一次）
  // 根据用户需求配置：3天/7天/15天/30天累计签到可获得额外奖励
  static CUMULATIVE_REWARDS = {
    3: { points: 6, label: '3-Day Milestone', description: 'Complete 3 days of check-in' },
    7: { points: 15, label: 'Week Champion', description: 'Complete 7 days of check-in' },
    15: { points: 30, label: 'Half Month Master', description: 'Complete 15 days of check-in' },
    30: { points: 60, label: 'Monthly Master', description: 'Complete 30 days of check-in' }
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
        'SELECT id FROM user_check_in WHERE user_id = ? AND check_in_date = ?',
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

      // 2. 计算累计签到天数（不要求连续）
      const [totalCheckInsRows] = await connection.query(
        'SELECT COUNT(*) as total FROM user_check_in WHERE user_id = ?',
        [userId]
      );
      const cumulativeDays = (totalCheckInsRows[0].total || 0) + 1; // 加上今天

      // 3. 每日签到奖励固定为4积分
      const dailyPoints = this.BASE_CHECKIN_POINTS;

      // 4. 创建签到记录（只记录累计天数）
      await connection.query(
        `INSERT INTO user_check_in (user_id, check_in_date, points_earned, cumulative_days)
         VALUES (?, ?, ?, ?)`,
        [userId, today, dailyPoints, cumulativeDays]
      );

      // 5. 增加每日签到积分
      await PointsService.addPoints(
        userId,
        dailyPoints,
        PointsService.POINTS_TYPES.DAILY_CHECKIN,
        `Daily Check-in Reward (Day ${cumulativeDays})`,
        null
      );

      await connection.commit();

      // 7. 更新 Redis 缓存
      if (redisClient.isReady()) {
        await redisClient.setUserCheckInStatus(userId, {
          date: today,
          cumulativeDays,
          totalPoints: dailyPoints
        });
      }

      const result = {
        success: true,
        message: 'Check-in Success!',
        userId,
        checkInDate: today,
        cumulativeDays,
        pointsAwarded: dailyPoints,
        nextMilestone: this.getNextCumulativeMilestone(cumulativeDays),
        totalRewardForToday: dailyPoints
      };

      console.log(`✅ 用户 ${userId} 签到成功，累计${cumulativeDays}天，获得${dailyPoints}积分`);

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

      // 获取累计签到天数
      const [totalRows] = await db.query(
        'SELECT COUNT(*) as total FROM user_check_in WHERE user_id = ?',
        [userId]
      );
      const cumulativeDays = totalRows[0].total || 0;

      // 优先从 Redis 获取
      if (redisClient.isReady()) {
        const cached = await redisClient.getUserCheckInStatus(userId);
        if (cached && cached.date === today) {
          return {
            success: true,
            hasCheckedInToday: true,
            cumulativeDays,
            ...cached
          };
        }
      }

      // 1. 检查今日是否已签到
      const [todayRows] = await db.query(
        'SELECT points_earned, created_at FROM user_check_in WHERE user_id = ? AND check_in_date = ?',
        [userId, today]
      );

      if (todayRows.length > 0) {
        const status = {
          success: true,
          hasCheckedInToday: true,
          checkInDate: today,
          cumulativeDays,
          pointsEarned: todayRows[0].points_earned,
          checkInTime: todayRows[0].created_at,
          nextMilestone: this.getNextCumulativeMilestone(cumulativeDays)
        };

        // 缓存到 Redis
        if (redisClient.isReady()) {
          await redisClient.setUserCheckInStatus(userId, {
            date: today,
            cumulativeDays,
            totalPoints: status.pointsEarned
          });
        }

        return status;
      }

      // 2. 今日未签到，返回当前累计状态
      return {
        success: true,
        hasCheckedInToday: false,
        cumulativeDays,
        nextMilestone: this.getNextCumulativeMilestone(cumulativeDays + 1),
        potentialPoints: this.calculatePotentialPoints(cumulativeDays + 1)
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
          points_earned,
          created_at
        FROM user_check_in
        WHERE user_id = ?
        AND check_in_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ORDER BY check_in_date DESC`,
        [userId, days]
      );

      // 计算统计
      const totalCheckIns = rows.length;
      const totalPoints = rows.reduce((sum, row) => sum + row.points_earned, 0);

      return {
        success: true,
        data: {
          history: rows,
          statistics: {
            days,
            totalCheckIns,
            totalPoints,
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
   * 领取累计签到里程碑奖励（独立领取，可以不连续）
   */
  static async claimCumulativeMilestone(userId, cumulativeDays) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 验证里程碑是否有效
      if (!this.CUMULATIVE_REWARDS[cumulativeDays]) {
        await connection.rollback();
        return {
          success: false,
          error: 'INVALID_MILESTONE',
          message: '无效的里程碑天数'
        };
      }

      // 2. 检查是否已在user_check_in表中标记领取
      const [claimedRows] = await connection.query(
        'SELECT id FROM user_check_in WHERE user_id = ? AND cumulative_days = ? AND milestone_claimed = TRUE',
        [userId, cumulativeDays]
      );

      if (claimedRows.length > 0) {
        await connection.rollback();
        return {
          success: false,
          error: 'ALREADY_CLAIMED',
          message: '该里程碑奖励已领取'
        };
      }

      // 3. 验证用户是否达到累计签到天数（不要求连续）
      const [checkInRows] = await connection.query(
        `SELECT COUNT(*) as total_check_ins 
         FROM user_check_in 
         WHERE user_id = ?`,
        [userId]
      );

      if (checkInRows.length === 0 || checkInRows[0].total_check_ins < cumulativeDays) {
        await connection.rollback();
        return {
          success: false,
          error: 'REQUIREMENT_NOT_MET',
          message: `未达到累计签到${cumulativeDays}天的要求（当前累计：${checkInRows[0].total_check_ins}天）`
        };
      }

      // 4. 发放奖励（在user_check_in的对应记录中标记milestone_claimed）
      const rewardPoints = this.CUMULATIVE_REWARDS[cumulativeDays].points;
      const milestoneType = `CUMULATIVE_CHECKIN_${cumulativeDays}`;

      // 找到累计天数对应的签到记录并标记为已领取
      await connection.query(
        `UPDATE user_check_in 
         SET milestone_claimed = TRUE, milestone_type = ? 
         WHERE user_id = ? AND cumulative_days = ? 
         LIMIT 1`,
        [milestoneType, userId, cumulativeDays]
      );

      await PointsService.addPoints(
        userId,
        rewardPoints,
        PointsService.POINTS_TYPES[milestoneType] || PointsService.POINTS_TYPES.DAILY_CHECKIN,
        `领取累计签到${cumulativeDays}天里程碑奖励 - ${this.CUMULATIVE_REWARDS[cumulativeDays].label}`,
        null
      );

      await connection.commit();

      console.log(`✅ 用户 ${userId} 领取累计签到${cumulativeDays}天奖励 ${rewardPoints} 积分`);

      return {
        success: true,
        userId,
        cumulativeDays,
        pointsEarned: rewardPoints,
        label: this.CUMULATIVE_REWARDS[cumulativeDays].label
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
   * 获取可领取的累计签到里程碑奖励
   */
  static async getAvailableMilestones(userId) {
    try {
      // 1. 获取用户累计签到天数（不要求连续）
      const [totalRows] = await db.query(
        'SELECT COUNT(*) as total_check_ins FROM user_check_in WHERE user_id = ?',
        [userId]
      );

      const cumulativeDays = totalRows[0].total_check_ins || 0;

      // 2. 获取已领取的里程碑（从user_check_in表查询）
      const [claimedRows] = await db.query(
        'SELECT cumulative_days FROM user_check_in WHERE user_id = ? AND milestone_claimed = TRUE',
        [userId]
      );

      const claimedMilestones = claimedRows.map(row => row.cumulative_days);

      // 3. 计算可领取的里程碑
      const availableMilestones = [];
      for (const [days, config] of Object.entries(this.CUMULATIVE_REWARDS)) {
        const daysNum = parseInt(days);
        const isClaimed = claimedMilestones.includes(daysNum);
        const canClaim = daysNum <= cumulativeDays && !isClaimed;
        
        availableMilestones.push({
          cumulativeDays: daysNum,
          points: config.points,
          label: config.label,
          description: config.description,
          canClaim,
          claimed: isClaimed,
          progress: cumulativeDays,
          required: daysNum
        });
      }

      return {
        success: true,
        cumulativeDays,
        availableMilestones,
        claimedMilestones
      };

    } catch (error) {
      console.error('获取可领取里程碑失败:', error);
      throw error;
    }
  }

  /**
   * 获取下一个累计签到里程碑
   */
  static getNextCumulativeMilestone(currentCumulativeDays) {
    const milestones = Object.keys(this.CUMULATIVE_REWARDS).map(Number).sort((a, b) => a - b);
    
    for (const milestone of milestones) {
      if (currentCumulativeDays < milestone) {
        return {
          days: milestone,
          label: this.CUMULATIVE_REWARDS[milestone].label,
          points: this.CUMULATIVE_REWARDS[milestone].points,
          daysRemaining: milestone - currentCumulativeDays
        };
      }
    }

    return null; // 已达到最高里程碑
  }

  /**
   * 获取下一个里程碑（废弃，保留兼容性）
   */
  static getNextMilestone(currentDays) {
    return this.getNextCumulativeMilestone(currentDays);
  }

  /**
   * 获取30天完整签到日历数据
   */
  static async get30DayCalendar(userId) {
    try {
      // 获取用户最近30天的签到记录
      const [records] = await db.query(
        `SELECT check_in_date, points_earned
         FROM user_check_in
         WHERE user_id = ?
         AND check_in_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         ORDER BY check_in_date DESC`,
        [userId]
      );

      const checkedDates = new Map(records.map(r => [r.check_in_date, {
        points: r.points_earned
      }]));

      // 获取用户累计签到天数
      const [totalRows] = await db.query(
        'SELECT COUNT(*) as total FROM user_check_in WHERE user_id = ?',
        [userId]
      );
      const cumulativeDays = totalRows[0].total || 0;

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
          pointsEarned: checkedInfo?.points || 0,
          potentialPoints: this.BASE_CHECKIN_POINTS, // 每日固定4积分
          isMilestone: !!this.CUMULATIVE_REWARDS[day],
          milestoneInfo: this.CUMULATIVE_REWARDS[day] || null,
          isPast: date < today,
          isToday: dateStr === today.toISOString().split('T')[0],
          isFuture: date > today
        });
      }

      return {
        success: true,
        calendar,
        cumulativeDays,
        summary: {
          totalChecked: records.length,
          totalPoints: records.reduce((sum, r) => sum + r.points_earned, 0),
          cumulativeDays
        }
      };

    } catch (error) {
      console.error('获取30天日历失败:', error);
      throw error;
    }
  }

  /**
   * 检查用户今日是否已签到
   */
  static async hasCheckedInToday(userId) {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      const [rows] = await db.query(
        'SELECT id FROM user_check_in WHERE user_id = ? AND check_in_date = ?',
        [userId, today]
      );

      return rows.length > 0;
    } catch (error) {
      console.error('检查今日签到状态失败:', error);
      throw error;
    }
  }

  /**
   * 计算签到可获得的积分（统一为每日4积分）
   */
  static calculatePotentialPoints(cumulativeDays) {
    return this.BASE_CHECKIN_POINTS;
  }

  /**
   * 获取所有里程碑配置（用于前端显示）
   */
  static getMilestoneConfig() {
    return {
      success: true,
      basePoints: this.BASE_CHECKIN_POINTS,
      milestones: Object.entries(this.CUMULATIVE_REWARDS).map(([day, config]) => ({
        day: parseInt(day),
        ...config
      }))
    };
  }
}

module.exports = CheckInPointsService;
