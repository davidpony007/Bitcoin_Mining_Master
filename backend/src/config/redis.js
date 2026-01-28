/**
 * Redis 客户端配置
 * 用于缓存用户等级、签到状态、广告计数等高频数据
 * 
 * 核心特性：
 * - 自动降级：Redis 不可用时系统仍可运行
 * - 智能重试：最多 5 次，指数退避
 * - 单例模式：全局共享连接
 */

const Redis = require('ioredis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 5) {
            console.log('⚠️  Redis 连接失败,已达最大重试次数,系统将以降级模式运行(无缓存)');
            return null;
          }
          const delay = Math.min(times * 1000, 5000);
          console.log(`[Redis] 第${times}次重试，延迟${delay}ms`);
          return delay;
        },
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        connectTimeout: 10000,
        reconnectOnError: (err) => {
          if (err.message.includes('READONLY')) {
            console.log('⚠️  Redis READONLY 错误，尝试重连...');
            return true;
          }
          return false;
        }
      });

      this.client.on('connect', () => console.log('🔌 Redis 正在连接...'));
      this.client.on('ready', () => {
        console.log('✅ Redis 连接成功');
        this.isConnected = true;
      });
      this.client.on('error', (err) => {
        console.error('❌ Redis 错误:', err.message);
        this.isConnected = false;
      });
      this.client.on('close', () => {
        console.log('⚠️  Redis 连接关闭');
        this.isConnected = false;
      });
      this.client.on('reconnecting', (delay) => console.log(`🔄 Redis 正在重连... (延迟: ${delay}ms)`));
      this.client.on('end', () => {
        console.log('🛑 Redis 连接已终止,系统将以降级模式运行(无缓存)');
        this.isConnected = false;
      });

      try {
        await this.client.connect();
        await this.client.ping();
        console.log('✅ Redis PING 成功');
      } catch (connectError) {
        console.warn('⚠️  Redis 服务不可用:', connectError.message);
        console.warn('⚠️  系统将以降级模式运行(所有缓存操作将被跳过)');
        this.isConnected = false;
      }
      
      return this.client;
    } catch (error) {
      console.error('❌ Redis 初始化失败:', error.message);
      console.warn('⚠️  系统将以降级模式运行(无缓存)');
      this.isConnected = false;
      return null;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      console.log('✅ Redis 连接已关闭');
    }
  }

  isReady() {
    return this.isConnected && this.client && this.client.status === 'ready';
  }

  // 用户等级缓存
  async cacheUserLevel(userId, level, points, speedMultiplier, dailyBonusActive, dailyBonusExpire) {
    if (!this.isReady()) {
      console.warn('⚠️  Redis 不可用,跳过缓存操作');
      return false;
    }
    
    try {
      // 参数验证和默认值处理
      if (!userId) {
        console.warn('⚠️  缓存用户等级失败: userId 为空');
        return false;
      }
      
      const key = `user:level:${userId}`;
      const data = {
        level: (level !== undefined && level !== null) ? level.toString() : '1',
        points: (points !== undefined && points !== null) ? points.toString() : '0',
        speed_multiplier: (speedMultiplier !== undefined && speedMultiplier !== null) ? speedMultiplier.toString() : '1.0',
        daily_bonus_active: dailyBonusActive ? '1' : '0',
        daily_bonus_expire: dailyBonusExpire || ''
      };
      
      await this.client.hmset(key, data);
      await this.client.expire(key, 86400);
      return true;
    } catch (error) {
      console.error('缓存用户等级失败:', error.message);
      return false;
    }
  }

  async getUserLevel(userId) {
    if (!this.isReady()) return null;
    
    try {
      const key = `user:level:${userId}`;
      const data = await this.client.hgetall(key);
      
      if (!data || Object.keys(data).length === 0) return null;
      
      return {
        level: parseInt(data.level) || 1,
        points: parseInt(data.points) || 0,
        speedMultiplier: parseFloat(data.speed_multiplier) || 1.0,
        dailyBonusActive: data.daily_bonus_active === '1',
        dailyBonusExpire: data.daily_bonus_expire || null
      };
    } catch (error) {
      console.error('获取用户等级缓存失败:', error.message);
      return null;
    }
  }

  async deleteUserLevel(userId) {
    if (!this.isReady()) return false;
    
    try {
      const key = `user:level:${userId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('删除用户等级缓存失败:', error.message);
      return false;
    }
  }

  // 签到状态缓存
  async cacheCheckInStatus(userId, lastDate, consecutiveDays, bonusActive, bonusExpire) {
    if (!this.isReady()) return false;
    
    try {
      const key = `user:checkin:${userId}`;
      const data = {
        last_date: lastDate,
        consecutive_days: consecutiveDays.toString(),
        bonus_active: bonusActive ? '1' : '0',
        bonus_expire: bonusExpire || ''
      };
      
      await this.client.hmset(key, data);
      await this.client.expire(key, 172800);
      return true;
    } catch (error) {
      console.error('缓存签到状态失败:', error.message);
      return false;
    }
  }

  async getCheckInStatus(userId) {
    if (!this.isReady()) return null;
    
    try {
      const key = `user:checkin:${userId}`;
      const data = await this.client.hgetall(key);
      
      if (!data || Object.keys(data).length === 0) return null;
      
      return {
        lastDate: data.last_date,
        consecutiveDays: parseInt(data.consecutive_days) || 0,
        bonusActive: data.bonus_active === '1',
        bonusExpire: data.bonus_expire || null
      };
    } catch (error) {
      console.error('获取签到状态缓存失败:', error.message);
      return null;
    }
  }

  // 每日广告计数
  async incrementTodayAdCount(userId) {
    if (!this.isReady()) return 0;
    
    try {
      const key = `user:ad:today:${userId}`;
      const count = await this.client.incr(key);
      
      if (count === 1) {
        const now = new Date();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
        const ttl = Math.floor((endOfDay - now) / 1000);
        await this.client.expire(key, ttl);
      }
      
      return count;
    } catch (error) {
      console.error('增加广告计数失败:', error.message);
      return 0;
    }
  }

  async getTodayAdCount(userId) {
    if (!this.isReady()) return 0;
    
    try {
      const key = `user:ad:today:${userId}`;
      const count = await this.client.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('获取广告计数失败:', error.message);
      return 0;
    }
  }

  // 推荐广告计数
  async incrementReferralAdCount(referrerId, referralId) {
    if (!this.isReady()) return 0;
    
    try {
      const key = `user:referral:ad:${referrerId}:${referralId}`;
      const count = await this.client.incr(key);
      await this.client.expire(key, 2592000);
      return count;
    } catch (error) {
      console.error('增加推荐广告计数失败:', error.message);
      return 0;
    }
  }

  async getReferralAdCount(referrerId, referralId) {
    if (!this.isReady()) return 0;
    
    try {
      const key = `user:referral:ad:${referrerId}:${referralId}`;
      const count = await this.client.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('获取推荐广告计数失败:', error.message);
      return 0;
    }
  }

  // 邀请进度缓存
  async cacheInvitationProgress(userId, totalCount, milestone5Claimed, milestone10Claimed, referralAdRewards) {
    if (!this.isReady()) return false;
    
    try {
      const key = `user:invite:progress:${userId}`;
      const data = {
        total_count: totalCount.toString(),
        milestone_5_claimed: milestone5Claimed ? '1' : '0',
        milestone_10_claimed: milestone10Claimed ? '1' : '0',
        referral_ad_rewards: referralAdRewards.toString()
      };
      
      await this.client.hmset(key, data);
      return true;
    } catch (error) {
      console.error('缓存邀请进度失败:', error.message);
      return false;
    }
  }

  async getInvitationProgress(userId) {
    if (!this.isReady()) return null;
    
    try {
      const key = `user:invite:progress:${userId}`;
      const data = await this.client.hgetall(key);
      
      if (!data || Object.keys(data).length === 0) return null;
      
      return {
        totalCount: parseInt(data.total_count) || 0,
        milestone5Claimed: data.milestone_5_claimed === '1',
        milestone10Claimed: data.milestone_10_claimed === '1',
        referralAdRewards: parseInt(data.referral_ad_rewards) || 0
      };
    } catch (error) {
      console.error('获取邀请进度缓存失败:', error.message);
      return null;
    }
  }

  async deleteInvitationProgress(userId) {
    if (!this.isReady()) return false;
    
    try {
      const key = `user:invite:progress:${userId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('删除邀请进度缓存失败:', error.message);
      return false;
    }
  }

  // 每日加成用户管理
  async addDailyBonusUser(userId, expireTimestamp) {
    if (!this.isReady()) return false;
    
    try {
      const key = 'daily:bonus:active';
      await this.client.zadd(key, expireTimestamp, userId);
      return true;
    } catch (error) {
      console.error('添加每日加成用户失败:', error.message);
      return false;
    }
  }

  async removeDailyBonusUser(userId) {
    if (!this.isReady()) return false;
    
    try {
      const key = 'daily:bonus:active';
      await this.client.zrem(key, userId);
      return true;
    } catch (error) {
      console.error('移除每日加成用户失败:', error.message);
      return false;
    }
  }

  async isDailyBonusActive(userId) {
    if (!this.isReady()) return false;
    
    try {
      const key = 'daily:bonus:active';
      const now = Date.now();
      const score = await this.client.zscore(key, userId);
      
      if (!score) return false;
      return parseInt(score) > now;
    } catch (error) {
      console.error('检查每日加成状态失败:', error.message);
      return false;
    }
  }

  async cleanupExpiredDailyBonus() {
    if (!this.isReady()) return 0;
    
    try {
      const key = 'daily:bonus:active';
      const now = Date.now();
      const removed = await this.client.zremrangebyscore(key, '-inf', now);
      return removed;
    } catch (error) {
      console.error('清理过期加成失败:', error.message);
      return 0;
    }
  }

  // 通用缓存方法
  async set(key, value, ttl = null) {
    if (!this.isReady()) return false;
    
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`设置缓存失败 [${key}]:`, error.message);
      return false;
    }
  }

  async get(key) {
    if (!this.isReady()) return null;
    
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`获取缓存失败 [${key}]:`, error.message);
      return null;
    }
  }

  async del(key) {
    if (!this.isReady()) return 0;
    
    try {
      return await this.client.del(key);
    } catch (error) {
      console.error(`删除缓存失败 [${key}]:`, error.message);
      return 0;
    }
  }

  async exists(key) {
    if (!this.isReady()) return 0;
    
    try {
      return await this.client.exists(key);
    } catch (error) {
      console.error(`检查键存在失败 [${key}]:`, error.message);
      return 0;
    }
  }

  async expire(key, seconds) {
    if (!this.isReady()) return 0;
    
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      console.error(`设置过期时间失败 [${key}]:`, error.message);
      return 0;
    }
  }

  /**
   * ==================== 积分系统缓存方法 ====================
   */

  /**
   * 获取今日广告观看次数
   */
  async getTodayAdCount(userId) {
    if (!this.isReady()) return null;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `ad:count:${userId}:${today}`;
      const count = await this.client.get(key);
      return count ? parseInt(count) : null;
    } catch (error) {
      console.error(`获取广告计数失败 [user ${userId}]:`, error.message);
      return null;
    }
  }

  /**
   * 设置今日广告观看次数
   */
  async setTodayAdCount(userId, count) {
    if (!this.isReady()) return false;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `ad:count:${userId}:${today}`;
      await this.client.setex(key, 86400, count); // 24小时过期
      return true;
    } catch (error) {
      console.error(`设置广告计数失败 [user ${userId}]:`, error.message);
      return false;
    }
  }

  /**
   * 获取用户签到状态
   */
  async getUserCheckInStatus(userId) {
    if (!this.isReady()) return null;
    
    try {
      const key = `checkin:status:${userId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`获取签到状态失败 [user ${userId}]:`, error.message);
      return null;
    }
  }

  /**
   * 设置用户签到状态
   */
  async setUserCheckInStatus(userId, status) {
    if (!this.isReady()) return false;
    
    try {
      const key = `checkin:status:${userId}`;
      await this.client.setex(key, 86400, JSON.stringify(status)); // 24小时过期
      return true;
    } catch (error) {
      console.error(`设置签到状态失败 [user ${userId}]:`, error.message);
      return false;
    }
  }

  /**
   * 缓存用户挖矿速率（1分钟）
   */
  async setMiningSpeed(userId, speedPerSecond, ttl = 60) {
    if (!this.isReady()) return false;
    
    try {
      const key = `mining:speed:${userId}`;
      await this.client.setex(key, ttl, speedPerSecond.toString());
      return true;
    } catch (error) {
      console.error(`缓存挖矿速率失败 [user ${userId}]:`, error.message);
      return false;
    }
  }

  /**
   * 获取用户挖矿速率缓存
   */
  async getMiningSpeed(userId) {
    if (!this.isReady()) return null;
    
    try {
      const key = `mining:speed:${userId}`;
      const speed = await this.client.get(key);
      return speed ? parseFloat(speed) : null;
    } catch (error) {
      console.error(`获取挖矿速率失败 [user ${userId}]:`, error.message);
      return null;
    }
  }

  /**
   * 删除用户挖矿速率缓存（合约变更时调用）
   */
  async deleteMiningSpeed(userId) {
    if (!this.isReady()) return false;
    
    try {
      const key = `mining:speed:${userId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`删除挖矿速率缓存失败 [user ${userId}]:`, error.message);
      return false;
    }
  }

  /**
   * 缓存用户积分信息
   */
  async cacheUserPoints(userId, totalPoints, availablePoints) {
    if (!this.isReady()) return false;
    
    try {
      const key = `user:points:${userId}`;
      const data = {
        total: totalPoints.toString(),
        available: availablePoints.toString()
      };
      
      await this.client.hmset(key, data);
      await this.client.expire(key, 300); // 5分钟过期
      return true;
    } catch (error) {
      console.error(`缓存用户积分失败 [user ${userId}]:`, error.message);
      return false;
    }
  }

  /**
   * 获取用户积分缓存
   */
  async getUserPoints(userId) {
    if (!this.isReady()) return null;
    
    try {
      const key = `user:points:${userId}`;
      const data = await this.client.hgetall(key);
      
      if (!data || Object.keys(data).length === 0) return null;
      
      return {
        total: parseInt(data.total) || 0,
        available: parseInt(data.available) || 0
      };
    } catch (error) {
      console.error(`获取用户积分缓存失败 [user ${userId}]:`, error.message);
      return null;
    }
  }

  /**
   * 删除用户积分缓存（积分变更时清除）
   */
  async deleteUserPoints(userId) {
    if (!this.isReady()) return false;
    
    try {
      const key = `user:points:${userId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`删除用户积分缓存失败 [user ${userId}]:`, error.message);
      return false;
    }
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
