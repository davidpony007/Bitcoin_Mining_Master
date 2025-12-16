/**
 * ========================================
 * Redis 客户端配置模块
 * ========================================
 * 
 * 【模块功能】
 * 本模块提供了一个完整的 Redis 客户端封装，用于缓存比特币挖矿游戏的高频数据。
 * 采用降级设计模式，当 Redis 不可用时系统仍可正常运行（直接查询数据库）。
 * 
 * 【核心特性】
 * 1. 自动降级：Redis 连接失败时不影响系统运行
 * 2. 智能重试：最多重试 5 次，采用指数退避策略
 * 3. 事件监控：完整的连接状态监听和日志记录
 * 4. 单例模式：全局共享一个 Redis 连接实例
 * 5. 类型安全：所有方法都有完善的错误处理
 * 
 * 【缓存数据类型】
 * - 用户等级信息（Hash，24小时TTL）
 * - 用户签到状态（Hash，48小时TTL）
 * - 每日广告计数（String，当天结束过期）
 * - 推荐广告计数（String，30天TTL）
 * - 邀请进度统计（Hash，长期缓存）
 * - 每日加成用户（Sorted Set，按过期时间排序）
 * 
 * 【使用示例】
 * ```javascript
 * const redisClient = require('./config/redis');
 * 
 * // 初始化连接（在 app 启动时调用）
 * await redisClient.connect();
 * 
 * // 缓存用户等级
 * await redisClient.cacheUserLevel('U001', 5, 1200, 1.5, true, '2025-12-16');
 * 
 * // 获取用户等级（如果缓存不存在返回 null）
 * const level = await redisClient.getUserLevel('U001');
 * 
 * // 关闭连接（在 app 关闭时调用）
 * await redisClient.disconnect();
 * ```
 * 
 * 【性能优化】
 * - 使用 Hash 结构存储用户数据，减少键数量
 * - 合理设置 TTL，避免内存溢出
 * - 禁用离线队列，避免命令堆积导致延迟
 * - 延迟连接策略，先注册事件监听再连接
 * 
 * 【依赖库】
 * - ioredis: 强大的 Redis 客户端，原生支持 Promise、Cluster、Sentinel
 * 
 * @module config/redis
 * @requires ioredis
 * @author Bitcoin Mining Master Team
 * @version 1.0.0
 * @since 2025-12-15
 */

const Redis = require('ioredis');

/**
 * Redis 客户端封装类
 * 
 * 【设计模式】
 * - 单例模式：确保全局只有一个 Redis 连接实例
 * - 降级模式：Redis 不可用时方法返回安全默认值，不抛出异常
 * 
 * 【类成员】
 * @property {Redis|null} client - ioredis 客户端实例
 * @property {boolean} isConnected - 连接状态标志位
 * 
 * 【生命周期】
 * 1. new RedisClient() - 创建实例（不立即连接）
 * 2. await connect() - 建立连接并注册事件监听
 * 3. 使用各种缓存方法...
 * 4. await disconnect() - 优雅关闭连接
 */
class RedisClient {
  /**
   * 构造函数
   * 初始化实例属性，但不建立连接（延迟连接策略）
   */
  constructor() {
    this.client = null;        // ioredis 客户端实例（初始为 null）
    this.isConnected = false;  // 连接状态（初始为 false）
  }

  /**
   * 初始化 Redis 连接
   * 
   * 【功能说明】
   * 创建 Redis 客户端实例并建立连接，注册完整的事件监听器。
   * 如果连接失败，不会抛出异常，系统将以降级模式运行。
   * 
   * 【连接配置】
   * - host: Redis 服务器地址（默认 127.0.0.1）
   * - port: Redis 端口（默认 6379）
   * - password: 密码（可选）
   * - db: 数据库索引（默认 0）
   * - lazyConnect: 延迟连接，先注册事件再连接
   * - retryStrategy: 重试策略（最多 5 次，指数退避）
   * - enableOfflineQueue: 禁用离线队列（避免命令堆积）
   * - connectTimeout: 连接超时 10 秒
   * 
   * 【事件监听】
   * - connect: 连接中
   * - ready: 连接成功，可以执行命令
   * - error: 发生错误
   * - close: 连接关闭
   * - reconnecting: 正在重连
   * - end: 连接终止（不再重连）
   * 
   * 【降级策略】
   * 如果连接失败，所有缓存方法会检查 isReady() 并返回安全默认值：
   * - 读操作返回 null 或 0
   * - 写操作返回 false
   * - 系统直接查询数据库，性能略降但功能正常
   * 
   * @returns {Promise<Redis|null>} Redis 客户端实例或 null（连接失败时）
   * @throws {never} 永不抛出异常（采用降级模式）
   * 
   * @example
   * // 在 app.js 中初始化
   * const redisClient = require('./config/redis');
   * await redisClient.connect();
   */
  async connect() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        lazyConnect: true, // 延迟连接,先注册事件监听再连接（避免错过事件）
        
        /**
         * 重试策略函数
         * 
         * @param {number} times - 当前重试次数（从 1 开始）
         * @returns {number|null} 延迟毫秒数，返回 null 停止重试
         * 
         * 策略：指数退避，最多重试 5 次
         * - 第1次：延迟 1000ms（1秒）
         * - 第2次：延迟 2000ms（2秒）
         * - 第3次：延迟 3000ms（3秒）
         * - 第4次：延迟 4000ms（4秒）
         * - 第5次：延迟 5000ms（5秒）
         * - 第6次：停止重试，系统降级运行
         */
        retryStrategy: (times) => {
          // 重试 5 次后放弃，避免无限重连消耗资源
          if (times > 5) {
            console.log('⚠️  Redis 连接失败,已达最大重试次数,系统将以降级模式运行(无缓存)');
            return null; // 返回 null 停止重试
          }
          // 计算延迟：times * 1000ms，最大 5000ms
          const delay = Math.min(times * 1000, 5000);
          console.log(`[Redis] 第${times}次重试，延迟${delay}ms`);
          return delay;
        },
        maxRetriesPerRequest: null, // 移除单个请求的重试限制（使用全局 retryStrategy）
        enableOfflineQueue: false,  // 禁用离线队列，断线时新命令直接失败而不是排队等待
                                    // 好处：避免命令堆积导致内存溢出和响应延迟
        connectTimeout: 10000,      // 连接超时 10 秒（适用于网络较慢的情况）
        
        /**
         * 错误重连策略
         * 
         * @param {Error} err - 错误对象
         * @returns {boolean|1|2} true=重连, false=不重连, 1=重连, 2=重连并重新选择
         * 
         * 策略：只在特定错误时重连
         * - READONLY：Redis 主从切换时的只读错误
         * - 其他错误：不重连，由 retryStrategy 处理
         */
        reconnectOnError: (err) => {
          // READONLY 错误：Redis 主从架构中，从节点只读时触发
          // 此时应该重连以切换到主节点
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            console.log('⚠️  Redis READONLY 错误，尝试重连...');
            return true; // 返回 true 触发重连
          }
          return false; // 其他错误不在这里处理，交给 retryStrategy
        }
      });

      // ==================== 事件监听器注册 ====================
      // 注意：必须在 connect() 之前注册，否则可能错过事件
      
      /**
       * connect 事件：开始建立 TCP 连接
       * 触发时机：调用 connect() 方法后立即触发
       */
      this.client.on('connect', () => {
        console.log('🔌 Redis 正在连接...');
      });

      /**
       * ready 事件：连接成功且通过认证，可以执行命令
       * 触发时机：TCP 连接建立 + AUTH 认证通过（如有密码）
       * 此时 client.status === 'ready'
       */
      this.client.on('ready', () => {
        console.log('✅ Redis 连接成功');
        this.isConnected = true; // 设置连接标志位
      });

      /**
       * error 事件：发生错误（不一定导致连接中断）
       * 触发时机：网络错误、认证失败、命令执行错误等
       * 注意：error 事件不会导致进程退出，只是记录日志
       */
      this.client.on('error', (err) => {
        console.error('❌ Redis 错误:', err.message);
        this.isConnected = false; // 标记为未连接状态
      });

      /**
       * close 事件：连接关闭（可能会自动重连）
       * 触发时机：网络断开、服务器关闭、主动调用 quit()
       * 与 end 的区别：close 后可能重连，end 不会重连
       */
      this.client.on('close', () => {
        console.log('⚠️  Redis 连接关闭');
        this.isConnected = false;
      });

      /**
       * reconnecting 事件：正在尝试重新连接
       * 触发时机：retryStrategy 返回延迟值时
       * @param {number} delay - 本次重连的延迟时间（毫秒）
       */
      this.client.on('reconnecting', (delay) => {
        console.log(`🔄 Redis 正在重连... (延迟: ${delay}ms)`);
      });

      /**
       * end 事件：连接彻底终止，不再重连
       * 触发时机：retryStrategy 返回 null 或调用 disconnect()
       * 此时系统将以降级模式运行，所有缓存操作被跳过
       */
      this.client.on('end', () => {
        console.log('🛑 Redis 连接已终止,系统将以降级模式运行(无缓存)');
        this.isConnected = false;
      });

      // ==================== 建立连接 ====================
      // 使用 try-catch 确保连接失败不影响系统启动
      try {
        // 步骤1：建立 TCP 连接
        await this.client.connect();
        
        // 步骤2：验证连接（PING 命令）
        await this.client.ping();
        console.log('✅ Redis PING 成功');
      } catch (connectError) {
        // 连接失败时的降级处理
        console.warn('⚠️  Redis 服务不可用:', connectError.message);
        console.warn('⚠️  系统将以降级模式运行(所有缓存操作将被跳过)');
        this.isConnected = false;
        // 关键：不抛出错误，让系统继续运行
        // 所有缓存方法会检查 isReady() 并返回安全默认值
      }
      
      return this.client; // 返回客户端实例（可能未连接）
    } catch (error) {
      // 外层 catch：处理 ioredis 构造函数或其他初始化错误
      console.error('❌ Redis 初始化失败:', error.message);
      console.warn('⚠️  系统将以降级模式运行(无缓存)');
      this.isConnected = false;
      // 不抛出错误，保证系统可以启动
      return null;
    }
  }

  /**
   * 关闭 Redis 连接
   * 
   * 【功能说明】
   * 优雅地关闭 Redis 连接，发送 QUIT 命令通知服务器。
   * 应在应用关闭时调用，确保所有命令执行完毕。
   * 
   * 【quit vs disconnect】
   * - quit(): 发送 QUIT 命令，等待所有命令完成后关闭（推荐）
   * - disconnect(): 立即强制关闭连接，可能丢失正在执行的命令
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * // 在应用关闭时调用
   * process.on('SIGTERM', async () => {
   *   await redisClient.disconnect();
   *   process.exit(0);
   * });
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit(); // 优雅关闭：先发送 QUIT 命令
      console.log('✅ Redis 连接已关闭');
    }
  }

  /**
   * 检查 Redis 是否就绪
   * 
   * 【功能说明】
   * 判断 Redis 客户端是否处于可用状态，可以执行命令。
   * 所有缓存方法在执行前都会调用此方法检查。
   * 
   * 【检查条件】
   * 1. isConnected === true（连接标志位）
   * 2. client !== null（客户端实例存在）
   * 3. client.status === 'ready'（ioredis 内部状态）
   * 
   * 【状态说明】
   * - 'wait': 等待连接
   * - 'connecting': 正在连接
   * - 'connect': 已连接但未认证
   * - 'ready': 已连接且已认证，可以执行命令 ✅
   * - 'close': 连接关闭
   * - 'reconnecting': 正在重连
   * - 'end': 连接终止
   * 
   * @returns {boolean} true=可用, false=不可用
   * 
   * @example
   * if (redisClient.isReady()) {
   *   await redisClient.set('key', 'value');
   * } else {
   *   console.log('Redis 不可用，跳过缓存');
   * }
   */
  isReady() {
    return this.isConnected && this.client && this.client.status === 'ready';
  }

  // ==================== 用户等级缓存 ====================
  // 使用 Hash 结构存储用户等级的多个字段，减少键数量

  /**
   * 缓存用户等级信息
   * 
   * 【数据结构】
   * Key: user:level:{user_id}
   * Type: Hash
   * Fields: level, points, speed_multiplier, daily_bonus_active, daily_bonus_expire
   * TTL: 24小时（86400秒）
   * 
   * 【为什么使用 Hash】
   * - 单个键存储多个字段，节省内存
   * - 可以单独更新某个字段（HSET）
   * - 可以批量获取所有字段（HGETALL）
   * 
   * 【使用场景】
   * 用户等级信息变化不频繁，但查询频繁：
   * - 每次计算挖矿收益都需要查等级倍率
   * - 每次显示用户信息都需要查等级
   * - 缓存可以大幅减少数据库查询压力
   * 
   * @param {string} userId - 用户ID（唯一标识）
   * @param {number} level - 用户等级（1-100）
   * @param {number} points - 用户积分
   * @param {number} speedMultiplier - 挖矿速度倍率（如 1.5 表示 1.5 倍速度）
   * @param {boolean} dailyBonusActive - 每日加成是否激活
   * @param {string|null} dailyBonusExpire - 每日加成过期时间（ISO 格式字符串）
   * @returns {Promise<boolean>} true=缓存成功, false=缓存失败或 Redis 不可用
   * 
   * @example
   * await redisClient.cacheUserLevel(
   *   'U2025120722013740362', 
   *   5,                    // 等级 5
   *   1200,                 // 1200 积分
   *   1.5,                  // 1.5 倍速度
   *   true,                 // 每日加成激活
   *   '2025-12-16T00:00:00Z' // 加成过期时间
   * );
   */
  async cacheUserLevel(userId, level, points, speedMultiplier, dailyBonusActive, dailyBonusExpire) {
    // 降级检查：Redis 不可用时跳过缓存
    if (!this.isReady()) {
      console.warn('⚠️  Redis 不可用,跳过缓存操作');
      return false; // 返回 false，调用方应直接查询数据库
    }
    
    try {
      const key = `user:level:${userId}`;
      
      // 准备 Hash 数据（所有值必须是字符串）
      const data = {
        level: level.toString(),                             // 数字转字符串
        points: points.toString(),                           // 数字转字符串
        speed_multiplier: speedMultiplier.toString(),        // 浮点数转字符串
        daily_bonus_active: dailyBonusActive ? '1' : '0',    // 布尔值转 '1' 或 '0'
        daily_bonus_expire: dailyBonusExpire || ''           // null 转空字符串
      };
      
      // HMSET：批量设置 Hash 字段（一次网络往返）
      await this.client.hmset(key, data);
      
      // EXPIRE：设置 24 小时过期时间（86400 秒）
      await this.client.expire(key, 86400);
      
      return true; // 缓存成功
    } catch (error) {
      // 捕获 Redis 命令执行错误（网络错误、OOM 等）
      console.error('缓存用户等级失败:', error.message);
      return false; // 返回 false，不影响业务逻辑
    }
  }

  /**
   * 获取用户等级缓存
   * 
   * 【功能说明】
   * 从 Redis 获取用户等级信息，如果缓存不存在返回 null。
   * 调用方应检查返回值，null 时从数据库查询并重新缓存。
   * 
   * 【返回值类型转换】
   * Redis Hash 存储的都是字符串，需要转换回原类型：
   * - level: string → number (parseInt)
   * - points: string → number (parseInt)
   * - speed_multiplier: string → number (parseFloat)
   * - daily_bonus_active: '1'/'0' → boolean
   * - daily_bonus_expire: string → string|null
   * 
   * @param {string} userId - 用户ID
   * @returns {Promise<Object|null>} 等级信息对象或 null（缓存不存在/Redis 不可用）
   * 
   * @example
   * const levelInfo = await redisClient.getUserLevel('U001');
   * if (levelInfo) {
   *   console.log('等级:', levelInfo.level);
   *   console.log('速度倍率:', levelInfo.speedMultiplier);
   * } else {
   *   // 缓存未命中，查询数据库
   *   const dbLevel = await db.getUserLevel('U001');
   *   await redisClient.cacheUserLevel(...dbLevel);
   * }
   */
  async getUserLevel(userId) {
    // 降级检查
    if (!this.isReady()) {
      return null; // Redis 不可用，返回 null，调用方查数据库
    }
    
    try {
      const key = `user:level:${userId}`;
      
      // HGETALL：获取 Hash 的所有字段和值
      const data = await this.client.hgetall(key);
      
      // 缓存未命中检查
      if (!data || Object.keys(data).length === 0) {
        return null; // 缓存不存在（键不存在或已过期）
      }
      
      // 类型转换并返回结构化数据
      return {
        level: parseInt(data.level) || 1,                    // 字符串转数字，默认 1
        points: parseInt(data.points) || 0,                  // 字符串转数字，默认 0
        speedMultiplier: parseFloat(data.speed_multiplier) || 1.0, // 字符串转浮点数，默认 1.0
        dailyBonusActive: data.daily_bonus_active === '1',   // '1' 转 true，其他转 false
        dailyBonusExpire: data.daily_bonus_expire || null    // 空字符串转 null
      };
    } catch (error) {
      console.error('获取用户等级缓存失败:', error.message);
      return null; // 发生错误，返回 null，不影响业务
    }
  }

  /**
   * 删除用户等级缓存
   * 
   * 【使用场景】
   * - 用户等级升级：删除缓存，下次查询时从数据库获取最新数据
   * - 用户积分变化：删除缓存，强制刷新
   * - 每日加成激活/失效：删除缓存，更新状态
   * 
   * 【策略】
   * 采用 Cache Invalidation（缓存失效）模式，而非 Cache Update（缓存更新）：
   * - 优点：逻辑简单，不会出现数据不一致
   * - 缺点：下次查询需要重新缓存（可接受，因为查询频率高）
   * 
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} true=删除成功, false=删除失败或 Redis 不可用
   * 
   * @example
   * // 用户升级后删除缓存
   * await LevelService.upgradeUser(userId);
   * await redisClient.deleteUserLevel(userId);
   */
  async deleteUserLevel(userId) {
    if (!this.isReady()) {
      return false;
    }
    
    try {
      const key = `user:level:${userId}`;
      await this.client.del(key); // DEL：删除键
      return true;
    } catch (error) {
      console.error('删除用户等级缓存失败:', error.message);
      return false;
    }
  }

  // ==================== 签到状态缓存 ====================
  // 使用 Hash 结构存储签到相关的多个字段

  /**
   * 缓存用户签到状态
   * 
   * 【数据结构】
   * Key: user:checkin:{user_id}
   * Type: Hash
   * Fields: last_date, consecutive_days, bonus_active, bonus_expire
   * TTL: 48小时（172800秒）
   * 
   * 【为什么48小时TTL】
   * - 签到数据相对稳定，每天只变化一次
   * - 48小时可以覆盖跨时区的场景
   * - 即使缓存失效，从数据库查询也不影响性能
   * 
   * 【使用场景】
   * - 判断用户今天是否已签到
   * - 显示连续签到天数
   * - 检查签到奖励是否激活
   * 
   * @param {string} userId - 用户ID
   * @param {string} lastDate - 最后签到日期（YYYY-MM-DD 格式）
   * @param {number} consecutiveDays - 连续签到天数
   * @param {boolean} bonusActive - 签到奖励是否激活
   * @param {string|null} bonusExpire - 奖励过期时间（ISO 格式）
   * @returns {Promise<boolean>} true=缓存成功, false=失败
   * 
   * @example
   * await redisClient.cacheCheckInStatus(
   *   'U001',
   *   '2025-12-15',
   *   7,              // 连续7天
   *   true,           // 奖励激活
   *   '2025-12-22T00:00:00Z'
   * );
   */
  async cacheCheckInStatus(userId, lastDate, consecutiveDays, bonusActive, bonusExpire) {
    if (!this.isReady()) {
      return false;
    }
    
    try {
      const key = `user:checkin:${userId}`;
      const data = {
        last_date: lastDate,                            // 最后签到日期字符串
        consecutive_days: consecutiveDays.toString(),   // 数字转字符串
        bonus_active: bonusActive ? '1' : '0',          // 布尔转 '1'/'0'
        bonus_expire: bonusExpire || ''                 // null 转空字符串
      };
      
      await this.client.hmset(key, data);
      await this.client.expire(key, 172800); // 48小时 = 172800秒
      return true;
    } catch (error) {
      console.error('缓存签到状态失败:', error.message);
      return false;
    }
  }

  /**
   * 获取用户签到状态缓存
   * 
   * @param {string} userId - 用户ID
   * @returns {Promise<Object|null>} 签到状态对象或 null
   * 
   * @example
   * const checkin = await redisClient.getCheckInStatus('U001');
   * if (checkin && checkin.lastDate === today) {
   *   console.log('今天已签到');
   * }
   */
  async getCheckInStatus(userId) {
    if (!this.isReady()) {
      return null;
    }
    
    try {
      const key = `user:checkin:${userId}`;
      const data = await this.client.hgetall(key);
      
      if (!data || Object.keys(data).length === 0) {
        return null;
      }
      
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

  // ==================== 每日广告计数缓存 ====================
  // 使用 String 类型存储计数，配合 INCR 命令实现原子递增

  /**
   * 增加今日广告观看次数
   * 
   * 【数据结构】
   * Key: user:ad:today:{user_id}
   * Type: String (存储数字)
   * TTL: 当天结束时自动过期
   * 
   * 【原子操作】
   * 使用 INCR 命令，保证在高并发下计数准确：
   * - INCR 是原子操作，不会出现竞态条件
   * - 如果键不存在，INCR 会先设为 0 再加 1
   * 
   * 【自动过期策略】
   * 计算当天剩余时间作为 TTL：
   * - 第一次 INCR 时设置 EXPIRE
   * - 每天 00:00 自动删除，次日重新计数
   * 
   * 【使用场景】
   * - 限制用户每天最多看 10 次广告
   * - 统计用户广告观看习惯
   * 
   * @param {string} userId - 用户ID
   * @returns {Promise<number>} 今日观看次数（包含本次）
   * 
   * @example
   * const count = await redisClient.incrementTodayAdCount('U001');
   * if (count > 10) {
   *   throw new Error('今日广告观看次数已达上限');
   * }
   */
  async incrementTodayAdCount(userId) {
    if (!this.isReady()) {
      return 0;
    }
    
    try {
      const key = `user:ad:today:${userId}`;
      
      // INCR：原子递增，返回递增后的值
      const count = await this.client.incr(key);
      
      // 计算当天剩余时间（秒）
      const now = new Date();
      const endOfDay = new Date(
        now.getFullYear(), 
        now.getMonth(), 
        now.getDate() + 1,  // 明天
        0, 0, 0             // 00:00:00
      );
      const ttl = Math.floor((endOfDay - now) / 1000); // 毫秒转秒
      
      // 只在第一次递增时设置过期时间（count === 1）
      if (count === 1) {
        await this.client.expire(key, ttl);
      }
      
      return count; // 返回今日总次数
    } catch (error) {
      console.error('增加广告计数失败:', error.message);
      return 0; // 发生错误返回 0，调用方应查数据库
    }
  }

  /**
   * 获取今日广告观看次数
   * 
   * @param {string} userId - 用户ID
   * @returns {Promise<number>} 今日观看次数（0 表示未观看或 Redis 不可用）
   * 
   * @example
   * const count = await redisClient.getTodayAdCount('U001');
   * console.log(`今天已看 ${count} 次广告，还可以看 ${10 - count} 次`);
   */
  async getTodayAdCount(userId) {
    if (!this.isReady()) {
      return 0;
    }
    
    try {
      const key = `user:ad:today:${userId}`;
      const count = await this.client.get(key); // GET：获取字符串值
      return count ? parseInt(count) : 0;       // 字符串转数字，null 返回 0
    } catch (error) {
      console.error('获取广告计数失败:', error.message);
      return 0;
    }
  }

  // ==================== 推荐人广告计数缓存 ====================
  // 记录推荐关系中被推荐者的广告观看次数

  /**
   * 增加推荐人的被推荐者广告观看次数
   * 
   * 【数据结构】
   * Key: user:referral:ad:{referrer_id}:{referral_id}
   * Type: String (数字)
   * TTL: 30天（2592000秒）
   * 
   * 【业务逻辑】
   * 推荐系统规则：
   * - A 推荐了 B
   * - B 每看 1 次广告，A 获得一定奖励
   * - 记录 B 为 A 贡献的广告次数
   * 
   * 【为什么30天TTL】
   * - 推荐奖励通常有时效性（如30天内有效）
   * - 过期数据自动清理，节省内存
   * - 永久数据存储在数据库，Redis 只做计数缓存
   * 
   * @param {string} referrerId - 推荐人ID（A）
   * @param {string} referralId - 被推荐人ID（B）
   * @returns {Promise<number>} B 为 A 贡献的总广告次数
   * 
   * @example
   * // B 看了一次广告
   * const count = await redisClient.incrementReferralAdCount('A_ID', 'B_ID');
   * // 给 A 发放奖励
   * await rewardService.grantReferralBonus('A_ID', adRewardAmount);
   */
  async incrementReferralAdCount(referrerId, referralId) {
    if (!this.isReady()) {
      return 0;
    }
    
    try {
      const key = `user:referral:ad:${referrerId}:${referralId}`;
      const count = await this.client.incr(key);          // 原子递增
      await this.client.expire(key, 2592000);             // 30天 = 2592000秒
      return count;
    } catch (error) {
      console.error('增加推荐广告计数失败:', error.message);
      return 0;
    }
  }

  /**
   * 获取推荐关系的广告观看次数
   * 
   * @param {string} referrerId - 推荐人ID
   * @param {string} referralId - 被推荐人ID
   * @returns {Promise<number>} 广告观看次数
   * 
   * @example
   * const count = await redisClient.getReferralAdCount('A_ID', 'B_ID');
   * console.log(`B 为 A 贡献了 ${count} 次广告观看`);
   */
  async getReferralAdCount(referrerId, referralId) {
    if (!this.isReady()) {
      return 0;
    }
    
    try {
      const key = `user:referral:ad:${referrerId}:${referralId}`;
      const count = await this.client.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('获取推荐广告计数失败:', error.message);
      return 0;
    }
  }

  // ==================== 邀请进度缓存 ====================
  // 使用 Hash 存储用户的邀请统计信息

  /**
   * 缓存用户邀请进度
   * 
   * 【数据结构】
   * Key: user:invite:progress:{user_id}
   * Type: Hash
   * Fields: total_count, milestone_5_claimed, milestone_10_claimed, referral_ad_rewards
   * TTL: 无（长期缓存）
   * 
   * 【为什么不设置TTL】
   * - 邀请数据很重要，不能随意过期
   * - 数据变化不频繁（只在新增邀请时更新）
   * - 数据量小（每个用户一个 Hash）
   * 
   * 【里程碑奖励】
   * - 邀请 5 人：奖励A（milestone_5_claimed 标记是否已领取）
   * - 邀请 10 人：奖励B（milestone_10_claimed 标记是否已领取）
   * 
   * @param {string} userId - 用户ID
   * @param {number} totalCount - 总邀请人数
   * @param {boolean} milestone5Claimed - 5人里程碑是否已领取
   * @param {boolean} milestone10Claimed - 10人里程碑是否已领取
   * @param {number} referralAdRewards - 推荐广告奖励总额
   * @returns {Promise<boolean>} true=成功, false=失败
   * 
   * @example
   * await redisClient.cacheInvitationProgress(
   *   'U001',
   *   8,      // 邀请了8人
   *   true,   // 5人奖励已领取
   *   false,  // 10人奖励未领取
   *   120     // 获得120积分广告奖励
   * );
   */
  async cacheInvitationProgress(userId, totalCount, milestone5Claimed, milestone10Claimed, referralAdRewards) {
    if (!this.isReady()) {
      return false;
    }
    
    try {
      const key = `user:invite:progress:${userId}`;
      const data = {
        total_count: totalCount.toString(),                   // 数字转字符串
        milestone_5_claimed: milestone5Claimed ? '1' : '0',   // 布尔转 '1'/'0'
        milestone_10_claimed: milestone10Claimed ? '1' : '0', // 布尔转 '1'/'0'
        referral_ad_rewards: referralAdRewards.toString()     // 数字转字符串
      };
      
      await this.client.hmset(key, data);
      // 注意：不设置 EXPIRE，长期缓存
      return true;
    } catch (error) {
      console.error('缓存邀请进度失败:', error.message);
      return false;
    }
  }

  /**
   * 获取用户邀请进度缓存
   * 
   * @param {string} userId - 用户ID
   * @returns {Promise<Object|null>} 邀请进度对象或 null
   * 
   * @example
   * const progress = await redisClient.getInvitationProgress('U001');
   * if (progress && progress.totalCount >= 5 && !progress.milestone5Claimed) {
   *   // 可以领取5人里程碑奖励
   *   await claimMilestone(userId, 5);
   * }
   */
  async getInvitationProgress(userId) {
    if (!this.isReady()) {
      return null;
    }
    
    try {
      const key = `user:invite:progress:${userId}`;
      const data = await this.client.hgetall(key);
      
      if (!data || Object.keys(data).length === 0) {
        return null;
      }
      
      return {
        totalCount: parseInt(data.total_count) || 0,           // 字符串转数字
        milestone5Claimed: data.milestone_5_claimed === '1',   // '1' 转 true
        milestone10Claimed: data.milestone_10_claimed === '1', // '1' 转 true
        referralAdRewards: parseInt(data.referral_ad_rewards) || 0 // 字符串转数字
      };
    } catch (error) {
      console.error('获取邀请进度缓存失败:', error.message);
      return null;
    }
  }

  /**
   * 删除用户邀请进度缓存
   * 
   * 【使用场景】
   * - 用户邀请数据发生变化：删除缓存，下次从数据库刷新
   * - 里程碑奖励领取后：删除缓存，更新状态
   * 
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} true=删除成功, false=失败
   */
  async deleteInvitationProgress(userId) {
    if (!this.isReady()) {
      return false;
    }
    
    try {
      const key = `user:invite:progress:${userId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('删除邀请进度缓存失败:', error.message);
      return false;
    }
  }

  // ==================== 每日加成用户管理 ====================
  // 使用 Sorted Set 管理激活每日加成的用户列表

  /**
   * 添加用户到每日加成激活列表
   * 
   * 【数据结构】
   * Key: daily:bonus:active
   * Type: Sorted Set (有序集合)
   * Score: 过期时间戳（毫秒）
   * Member: user_id
   * TTL: 无（手动清理过期成员）
   * 
   * 【为什么使用 Sorted Set】
   * - 需要按过期时间排序
   * - 需要快速查找某用户是否激活（ZSCORE O(log N)）
   * - 需要批量清理过期用户（ZREMRANGEBYSCORE O(log N + M)）
   * 
   * 【数据示例】
   * ```
   * daily:bonus:active
   * 1734220800000 → U001  (2025-12-15 00:00:00 过期)
   * 1734307200000 → U002  (2025-12-16 00:00:00 过期)
   * 1734393600000 → U003  (2025-12-17 00:00:00 过期)
   * ```
   * 
   * 【业务逻辑】
   * - 用户签到成功 → 激活7天每日加成
   * - 加成过期 → 自动失效
   * - 每小时清理一次过期用户（定时任务）
   * 
   * @param {string} userId - 用户ID
   * @param {number} expireTimestamp - 过期时间戳（毫秒）
   * @returns {Promise<boolean>} true=添加成功, false=失败
   * 
   * @example
   * // 用户签到，激活7天加成
   * const expireTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
   * await redisClient.addDailyBonusUser('U001', expireTime);
   */
  async addDailyBonusUser(userId, expireTimestamp) {
    if (!this.isReady()) {
      return false;
    }
    
    try {
      const key = 'daily:bonus:active';
      // ZADD：添加成员到有序集合
      // score = 过期时间戳, member = 用户ID
      await this.client.zadd(key, expireTimestamp, userId);
      return true;
    } catch (error) {
      console.error('添加每日加成用户失败:', error.message);
      return false;
    }
  }

  /**
   * 从每日加成列表中移除用户
   * 
   * 【使用场景】
   * - 用户手动取消加成
   * - 测试时需要重置用户状态
   * 
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} true=移除成功, false=失败
   * 
   * @example
   * await redisClient.removeDailyBonusUser('U001');
   */
  async removeDailyBonusUser(userId) {
    if (!this.isReady()) {
      return false;
    }
    
    try {
      const key = 'daily:bonus:active';
      await this.client.zrem(key, userId); // ZREM：从有序集合移除成员
      return true;
    } catch (error) {
      console.error('移除每日加成用户失败:', error.message);
      return false;
    }
  }

  /**
   * 检查用户的每日加成是否激活
   * 
   * 【实现逻辑】
   * 1. ZSCORE：获取用户的分数（过期时间戳）
   * 2. 比较：score > now ? 激活 : 未激活
   * 
   * 【性能】
   * - 时间复杂度：O(log N)，N 为集合大小
   * - 适合高频调用（每次计算挖矿收益都要检查）
   * 
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} true=激活中, false=未激活或已过期
   * 
   * @example
   * const isActive = await redisClient.isDailyBonusActive('U001');
   * const multiplier = isActive ? 2.0 : 1.0;
   * const reward = baseReward * multiplier;
   */
  async isDailyBonusActive(userId) {
    if (!this.isReady()) {
      return false;
    }
    
    try {
      const key = 'daily:bonus:active';
      const now = Date.now(); // 当前时间戳（毫秒）
      
      // ZSCORE：获取用户的分数（过期时间戳）
      const score = await this.client.zscore(key, userId);
      
      if (!score) {
        return false; // 用户不在集合中，未激活
      }
      
      // 比较：过期时间 > 当前时间 ? 激活 : 已过期
      return parseInt(score) > now;
    } catch (error) {
      console.error('检查每日加成状态失败:', error.message);
      return false; // 发生错误，返回未激活
    }
  }

  /**
   * 清理已过期的每日加成用户
   * 
   * 【功能说明】
   * 批量删除有序集合中已过期的成员（score <= now）
   * 应定时调用（如每小时一次），避免集合无限增长
   * 
   * 【命令说明】
   * ZREMRANGEBYSCORE key min max
   * - min: '-inf'（负无穷）
   * - max: now（当前时间戳）
   * - 删除所有 score 在 [-inf, now] 范围的成员
   * 
   * 【定时任务示例】
   * ```javascript
   * const cron = require('node-cron');
   * 
   * // 每小时的第0分钟执行
   * cron.schedule('0 * * * *', async () => {
   *   const removed = await redisClient.cleanupExpiredDailyBonus();
   *   console.log(`清理了 ${removed} 个过期加成用户`);
   * });
   * ```
   * 
   * @returns {Promise<number>} 清理的用户数量
   * 
   * @example
   * const removed = await redisClient.cleanupExpiredDailyBonus();
   * console.log(`清理了 ${removed} 个过期用户`);
   */
  async cleanupExpiredDailyBonus() {
    if (!this.isReady()) {
      return 0;
    }
    
    try {
      const key = 'daily:bonus:active';
      const now = Date.now();
      
      // ZREMRANGEBYSCORE：删除分数在指定范围内的成员
      // '-inf' 到 now：所有已过期的成员
      const removed = await this.client.zremrangebyscore(key, '-inf', now);
      
      return removed; // 返回删除的成员数量
    } catch (error) {
      console.error('清理过期加成失败:', error.message);
      return 0;
    }
  }

  // ==================== 通用缓存方法 ====================
  // 提供基础的 Redis 操作封装，适用于简单场景

  /**
   * 设置缓存
   * 
   * 【功能说明】
   * 通用的键值对缓存方法，支持可选的过期时间。
   * 适用于简单的字符串缓存场景。
   * 
   * 【命令选择】
   * - 有 TTL: SETEX key seconds value (原子操作，推荐)
   * - 无 TTL: SET key value
   * 
   * @param {string} key - 缓存键
   * @param {string} value - 缓存值（必须是字符串，复杂对象需先 JSON.stringify）
   * @param {number|null} ttl - 过期时间（秒），null 表示永不过期
   * @returns {Promise<boolean>} true=设置成功, false=失败
   * 
   * @example
   * // 缓存用户token，1小时过期
   * await redisClient.set('token:U001', 'abc123xyz', 3600);
   * 
   * // 缓存配置，永不过期
   * await redisClient.set('config:version', '1.0.0', null);
   * 
   * // 缓存对象（需要序列化）
   * await redisClient.set('user:U001', JSON.stringify({name: 'Alice'}), 600);
   */
  async set(key, value, ttl = null) {
    if (!this.isReady()) {
      return false;
    }
    
    try {
      if (ttl) {
        // SETEX：设置键值对并指定过期时间（原子操作）
        await this.client.setex(key, ttl, value);
      } else {
        // SET：设置键值对，永不过期
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`设置缓存失败 [${key}]:`, error.message);
      return false;
    }
  }

  /**
   * 获取缓存
   * 
   * @param {string} key - 缓存键
   * @returns {Promise<string|null>} 缓存值或 null（键不存在/已过期/Redis 不可用）
   * 
   * @example
   * const token = await redisClient.get('token:U001');
   * if (token) {
   *   console.log('Token有效:', token);
   * } else {
   *   console.log('Token已过期或不存在');
   * }
   * 
   * // 获取对象（需要反序列化）
   * const userJson = await redisClient.get('user:U001');
   * const user = userJson ? JSON.parse(userJson) : null;
   */
  async get(key) {
    if (!this.isReady()) {
      return null;
    }
    
    try {
      return await this.client.get(key); // GET：获取字符串值，不存在返回 null
    } catch (error) {
      console.error(`获取缓存失败 [${key}]:`, error.message);
      return null;
    }
  }

  /**
   * 删除缓存
   * 
   * @param {string} key - 缓存键
   * @returns {Promise<number>} 删除的键数量（1=删除成功, 0=键不存在）
   * 
   * @example
   * const deleted = await redisClient.del('token:U001');
   * if (deleted) {
   *   console.log('Token已删除');
   * }
   */
  async del(key) {
    if (!this.isReady()) {
      return 0;
    }
    
    try {
      return await this.client.del(key); // DEL：删除键，返回删除数量
    } catch (error) {
      console.error(`删除缓存失败 [${key}]:`, error.message);
      return 0;
    }
  }

  /**
   * 检查键是否存在
   * 
   * @param {string} key - 缓存键
   * @returns {Promise<number>} 1=存在, 0=不存在
   * 
   * @example
   * const exists = await redisClient.exists('token:U001');
   * if (exists) {
   *   console.log('Token存在');
   * }
   */
  async exists(key) {
    if (!this.isReady()) {
      return 0;
    }
    
    try {
      return await this.client.exists(key); // EXISTS：检查键是否存在
    } catch (error) {
      console.error(`检查键存在失败 [${key}]:`, error.message);
      return 0;
    }
  }

  /**
   * 设置过期时间
   * 
   * 【功能说明】
   * 为已存在的键设置过期时间（秒）。
   * 如果键不存在或已有过期时间，会覆盖。
   * 
   * @param {string} key - 缓存键
   * @param {number} seconds - 过期时间（秒）
   * @returns {Promise<number>} 1=设置成功, 0=键不存在
   * 
   * @example
   * // 先设置值
   * await redisClient.set('session:U001', 'active');
   * // 后设置过期时间
   * await redisClient.expire('session:U001', 3600); // 1小时后过期
   * 
   * // 延长过期时间
   * await redisClient.expire('session:U001', 7200); // 改为2小时后过期
   */
  async expire(key, seconds) {
    if (!this.isReady()) {
      return 0;
    }
    
    try {
      return await this.client.expire(key, seconds); // EXPIRE：设置过期时间
    } catch (error) {
      console.error(`设置过期时间失败 [${key}]:`, error.message);
      return 0;
    }
  }
}

// ==================== 单例导出 ====================

/**
 * 创建并导出 RedisClient 单例
 * 
 * 【单例模式】
 * - 全局只有一个 Redis 连接实例
 * - 所有模块共享同一个连接池
 * - 避免重复连接浪费资源
 * 
 * 【使用方式】
 * ```javascript
 * // 在任何模块中导入
 * const redisClient = require('./config/redis');
 * 
 * // 直接使用，无需 new
 * await redisClient.cacheUserLevel(...);
 * ```
 */
const redisClient = new RedisClient();

module.exports = redisClient;
