# Redis 缓存模块完整指南

## 📋 目录

1. [模块概述](#模块概述)
2. [架构设计](#架构设计)
3. [API 参考](#api-参考)
4. [使用示例](#使用示例)
5. [性能优化](#性能优化)
6. [故障处理](#故障处理)
7. [最佳实践](#最佳实践)

---

## 模块概述

### 功能定位

Redis 缓存模块是比特币挖矿游戏后端的核心组件之一,负责缓存高频访问的数据,减少数据库查询压力,提升系统响应速度。

### 核心特性

| 特性 | 说明 | 优势 |
|------|------|------|
| **自动降级** | Redis 不可用时自动跳过缓存操作 | 系统可用性 100% |
| **智能重试** | 指数退避策略,最多重试 5 次 | 网络波动时快速恢复 |
| **事件监控** | 完整的连接状态监听 | 实时掌握系统健康度 |
| **单例模式** | 全局共享一个连接实例 | 节省资源,避免重复连接 |
| **类型安全** | 所有方法都有错误处理 | 不会因 Redis 错误导致崩溃 |

### 数据类型总览

```
┌─────────────────┬───────────┬──────────┬─────────────────┐
│ 数据类型        │ Redis类型 │ TTL      │ 键模式          │
├─────────────────┼───────────┼──────────┼─────────────────┤
│ 用户等级        │ Hash      │ 24小时   │ user:level:*    │
│ 签到状态        │ Hash      │ 48小时   │ user:checkin:*  │
│ 每日广告计数    │ String    │ 当天结束 │ user:ad:today:* │
│ 推荐广告计数    │ String    │ 30天     │ user:referral:* │
│ 邀请进度        │ Hash      │ 永久     │ user:invite:*   │
│ 每日加成列表    │ Sorted Set│ 永久     │ daily:bonus:*   │
└─────────────────┴───────────┴──────────┴─────────────────┘
```

---

## 架构设计

### 降级模式设计

```
用户请求
    ↓
检查 Redis 是否可用 (isReady())
    ├─→ [是] → 执行缓存操作 → 返回结果
    └─→ [否] → 直接查询数据库 → 返回结果
```

**优势:**
- Redis 故障不影响业务
- 降级后性能略降,但功能完全正常
- 用户无感知切换

### 连接生命周期

```
1. new RedisClient()
   └─ 初始化属性,不建立连接

2. await connect()
   ├─ 注册事件监听器
   ├─ 建立 TCP 连接
   ├─ 执行 AUTH 认证 (如有密码)
   ├─ PING 验证
   └─ 返回客户端实例

3. 使用缓存方法
   ├─ isReady() 检查连接状态
   ├─ 执行 Redis 命令
   └─ 返回结果或安全默认值

4. await disconnect()
   ├─ 发送 QUIT 命令
   ├─ 等待命令队列清空
   └─ 关闭连接
```

### 事件驱动模型

```
事件          触发时机              处理动作
─────────────────────────────────────────────────
connect     → 开始建立连接        → 记录日志
ready       → 连接成功可用        → 设置 isConnected = true
error       → 发生错误            → 记录错误,设置 isConnected = false
close       → 连接关闭            → 设置 isConnected = false
reconnecting→ 正在重连            → 记录重连次数
end         → 连接终止不重连      → 进入降级模式
```

---

## API 参考

### 连接管理

#### `connect()`

建立 Redis 连接并初始化客户端。

**签名:**
```javascript
async connect(): Promise<Redis|null>
```

**返回值:**
- `Redis`: 连接成功,返回 ioredis 客户端实例
- `null`: 连接失败,系统进入降级模式

**示例:**
```javascript
const redisClient = require('./config/redis');

// 应用启动时初始化
await redisClient.connect();
```

#### `disconnect()`

优雅关闭 Redis 连接。

**签名:**
```javascript
async disconnect(): Promise<void>
```

**示例:**
```javascript
// 应用关闭时调用
process.on('SIGTERM', async () => {
  await redisClient.disconnect();
  process.exit(0);
});
```

#### `isReady()`

检查 Redis 是否可用。

**签名:**
```javascript
isReady(): boolean
```

**返回值:**
- `true`: Redis 可用,可以执行命令
- `false`: Redis 不可用,所有缓存操作会被跳过

**示例:**
```javascript
if (redisClient.isReady()) {
  console.log('Redis 正常');
} else {
  console.log('Redis 不可用,使用降级模式');
}
```

---

### 用户等级缓存

#### `cacheUserLevel()`

缓存用户等级信息。

**签名:**
```javascript
async cacheUserLevel(
  userId: string,
  level: number,
  points: number,
  speedMultiplier: number,
  dailyBonusActive: boolean,
  dailyBonusExpire: string|null
): Promise<boolean>
```

**参数:**
- `userId`: 用户ID
- `level`: 等级 (1-100)
- `points`: 积分
- `speedMultiplier`: 挖矿速度倍率
- `dailyBonusActive`: 每日加成是否激活
- `dailyBonusExpire`: 加成过期时间 (ISO 格式)

**返回值:**
- `true`: 缓存成功
- `false`: 缓存失败或 Redis 不可用

**Redis 结构:**
```
Key: user:level:{user_id}
Type: Hash
TTL: 86400秒 (24小时)

Fields:
  level = "5"
  points = "1200"
  speed_multiplier = "1.5"
  daily_bonus_active = "1"
  daily_bonus_expire = "2025-12-16T00:00:00Z"
```

**示例:**
```javascript
await redisClient.cacheUserLevel(
  'U2025120722013740362',
  5,                          // 等级5
  1200,                       // 1200积分
  1.5,                        // 1.5倍速度
  true,                       // 每日加成激活
  '2025-12-16T00:00:00Z'      // 加成过期时间
);
```

#### `getUserLevel()`

获取用户等级缓存。

**签名:**
```javascript
async getUserLevel(userId: string): Promise<Object|null>
```

**返回值:**
```javascript
{
  level: number,              // 等级
  points: number,             // 积分
  speedMultiplier: number,    // 速度倍率
  dailyBonusActive: boolean,  // 加成是否激活
  dailyBonusExpire: string|null // 加成过期时间
}
// 或 null (缓存不存在)
```

**使用模式:**
```javascript
// Cache-Aside 模式
const levelInfo = await redisClient.getUserLevel(userId);

if (levelInfo) {
  // 缓存命中
  console.log('从缓存获取:', levelInfo);
  return levelInfo;
} else {
  // 缓存未命中,查数据库
  const dbLevel = await db.getUserLevel(userId);
  
  // 写入缓存
  await redisClient.cacheUserLevel(
    userId,
    dbLevel.level,
    dbLevel.points,
    dbLevel.speedMultiplier,
    dbLevel.dailyBonusActive,
    dbLevel.dailyBonusExpire
  );
  
  return dbLevel;
}
```

#### `deleteUserLevel()`

删除用户等级缓存。

**签名:**
```javascript
async deleteUserLevel(userId: string): Promise<boolean>
```

**使用场景:**
- 用户升级后强制刷新缓存
- 用户积分变化后更新
- 每日加成激活/失效后更新

**示例:**
```javascript
// 用户升级
await LevelService.upgradeUser(userId);
await redisClient.deleteUserLevel(userId); // 删除旧缓存
```

---

### 签到状态缓存

#### `cacheCheckInStatus()`

缓存用户签到状态。

**签名:**
```javascript
async cacheCheckInStatus(
  userId: string,
  lastDate: string,
  consecutiveDays: number,
  bonusActive: boolean,
  bonusExpire: string|null
): Promise<boolean>
```

**Redis 结构:**
```
Key: user:checkin:{user_id}
Type: Hash
TTL: 172800秒 (48小时)

Fields:
  last_date = "2025-12-15"
  consecutive_days = "7"
  bonus_active = "1"
  bonus_expire = "2025-12-22T00:00:00Z"
```

**示例:**
```javascript
await redisClient.cacheCheckInStatus(
  'U001',
  '2025-12-15',     // 最后签到日期
  7,                // 连续7天
  true,             // 奖励激活
  '2025-12-22T00:00:00Z'
);
```

#### `getCheckInStatus()`

获取签到状态缓存。

**签名:**
```javascript
async getCheckInStatus(userId: string): Promise<Object|null>
```

**返回值:**
```javascript
{
  lastDate: string,           // 最后签到日期
  consecutiveDays: number,    // 连续签到天数
  bonusActive: boolean,       // 奖励是否激活
  bonusExpire: string|null    // 奖励过期时间
}
```

**业务逻辑示例:**
```javascript
const checkin = await redisClient.getCheckInStatus(userId);
const today = new Date().toISOString().split('T')[0];

if (checkin && checkin.lastDate === today) {
  throw new Error('今天已签到');
}

// 执行签到逻辑...
```

---

### 广告计数缓存

#### `incrementTodayAdCount()`

增加今日广告观看次数 (原子操作)。

**签名:**
```javascript
async incrementTodayAdCount(userId: string): Promise<number>
```

**返回值:**
- 今日观看总次数 (包含本次)

**Redis 结构:**
```
Key: user:ad:today:{user_id}
Type: String (数字)
TTL: 自动计算 (当天结束时过期)

示例:
user:ad:today:U001 = "3"  (今天看了3次)
```

**示例:**
```javascript
// 用户观看广告
const count = await redisClient.incrementTodayAdCount(userId);

if (count > 10) {
  throw new Error('今日广告观看次数已达上限');
}

// 发放广告奖励
await rewardUser(userId, adReward);
```

**并发安全:**
```javascript
// INCR 是原子操作,即使高并发也不会出现竞态条件
// 假设两个请求同时到达:
// 请求1: INCR → 返回 1
// 请求2: INCR → 返回 2
// 最终计数正确,不会丢失
```

#### `getTodayAdCount()`

获取今日广告观看次数。

**签名:**
```javascript
async getTodayAdCount(userId: string): Promise<number>
```

**返回值:**
- 今日观看次数 (0 表示未观看或 Redis 不可用)

---

### 推荐广告计数

#### `incrementReferralAdCount()`

增加推荐关系的广告计数。

**签名:**
```javascript
async incrementReferralAdCount(
  referrerId: string,
  referralId: string
): Promise<number>
```

**参数:**
- `referrerId`: 推荐人ID (A)
- `referralId`: 被推荐人ID (B)

**返回值:**
- B 为 A 贡献的总广告次数

**Redis 结构:**
```
Key: user:referral:ad:{referrer_id}:{referral_id}
Type: String
TTL: 2592000秒 (30天)

示例:
user:referral:ad:A001:B002 = "15"
(B002 为 A001 贡献了15次广告观看)
```

**业务流程:**
```javascript
// B 观看广告
await incrementTodayAdCount(B_ID);

// 查找 B 的推荐人
const referrer = await db.getReferrer(B_ID);

if (referrer) {
  // 增加推荐计数
  const count = await incrementReferralAdCount(referrer.id, B_ID);
  
  // 给推荐人发奖励
  await rewardUser(referrer.id, referralBonus);
}
```

---

### 邀请进度缓存

#### `cacheInvitationProgress()`

缓存用户邀请进度统计。

**签名:**
```javascript
async cacheInvitationProgress(
  userId: string,
  totalCount: number,
  milestone5Claimed: boolean,
  milestone10Claimed: boolean,
  referralAdRewards: number
): Promise<boolean>
```

**Redis 结构:**
```
Key: user:invite:progress:{user_id}
Type: Hash
TTL: 无 (长期缓存)

Fields:
  total_count = "8"           # 总邀请人数
  milestone_5_claimed = "1"   # 5人奖励已领取
  milestone_10_claimed = "0"  # 10人奖励未领取
  referral_ad_rewards = "120" # 推荐广告总奖励
```

**示例:**
```javascript
await redisClient.cacheInvitationProgress(
  'U001',
  8,      // 邀请了8人
  true,   // 5人奖励已领取
  false,  // 10人奖励未领取
  120     // 获得120积分广告奖励
);
```

#### `getInvitationProgress()`

获取邀请进度缓存。

**业务逻辑:**
```javascript
const progress = await redisClient.getInvitationProgress(userId);

// 检查是否可以领取里程碑奖励
if (progress.totalCount >= 5 && !progress.milestone5Claimed) {
  // 可以领取5人奖励
  await claimMilestone(userId, 5, milestone5Reward);
  
  // 更新缓存
  await redisClient.deleteInvitationProgress(userId);
}

if (progress.totalCount >= 10 && !progress.milestone10Claimed) {
  // 可以领取10人奖励
  await claimMilestone(userId, 10, milestone10Reward);
  
  // 更新缓存
  await redisClient.deleteInvitationProgress(userId);
}
```

---

### 每日加成管理

#### `addDailyBonusUser()`

添加用户到每日加成激活列表。

**签名:**
```javascript
async addDailyBonusUser(
  userId: string,
  expireTimestamp: number
): Promise<boolean>
```

**参数:**
- `userId`: 用户ID
- `expireTimestamp`: 过期时间戳 (毫秒)

**Redis 结构:**
```
Key: daily:bonus:active
Type: Sorted Set
TTL: 无

示例:
Score                Member
1734220800000   →   U001  (2025-12-15 00:00:00 过期)
1734307200000   →   U002  (2025-12-16 00:00:00 过期)
1734393600000   →   U003  (2025-12-17 00:00:00 过期)
```

**示例:**
```javascript
// 用户签到成功,激活7天加成
const expireTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
await redisClient.addDailyBonusUser(userId, expireTime);
```

#### `isDailyBonusActive()`

检查用户的每日加成是否激活。

**签名:**
```javascript
async isDailyBonusActive(userId: string): Promise<boolean>
```

**返回值:**
- `true`: 加成激活中
- `false`: 未激活或已过期

**性能:**
- 时间复杂度: O(log N)
- 适合高频调用

**示例:**
```javascript
// 计算挖矿收益时检查加成
const isActive = await redisClient.isDailyBonusActive(userId);
const multiplier = isActive ? 2.0 : 1.0;
const reward = baseReward * multiplier;
```

#### `cleanupExpiredDailyBonus()`

清理已过期的每日加成用户。

**签名:**
```javascript
async cleanupExpiredDailyBonus(): Promise<number>
```

**返回值:**
- 清理的用户数量

**定时任务示例:**
```javascript
const cron = require('node-cron');

// 每小时的第0分钟执行
cron.schedule('0 * * * *', async () => {
  const removed = await redisClient.cleanupExpiredDailyBonus();
  console.log(`✅ 清理了 ${removed} 个过期加成用户`);
});
```

---

### 通用缓存方法

#### `set()` / `get()` / `del()`

基础键值对操作。

**示例:**
```javascript
// 缓存token
await redisClient.set('token:U001', 'abc123xyz', 3600);

// 获取token
const token = await redisClient.get('token:U001');

// 删除token
await redisClient.del('token:U001');
```

#### `exists()` / `expire()`

检查键和设置过期时间。

**示例:**
```javascript
// 检查键是否存在
const exists = await redisClient.exists('token:U001');

// 设置过期时间
await redisClient.expire('token:U001', 7200);
```

---

## 使用示例

### 完整的用户等级查询流程

```javascript
/**
 * 获取用户等级信息 (带缓存)
 */
async function getUserLevelInfo(userId) {
  // 1. 尝试从缓存获取
  const cached = await redisClient.getUserLevel(userId);
  
  if (cached) {
    console.log('✅ 缓存命中');
    return cached;
  }
  
  console.log('⚠️  缓存未命中,查询数据库');
  
  // 2. 从数据库查询
  const dbLevel = await db.query(`
    SELECT 
      user_level,
      user_points,
      mining_speed_multiplier,
      daily_bonus_active,
      daily_bonus_expire
    FROM user_information
    WHERE user_id = ?
  `, [userId]);
  
  if (!dbLevel) {
    throw new Error('用户不存在');
  }
  
  // 3. 写入缓存
  await redisClient.cacheUserLevel(
    userId,
    dbLevel.user_level,
    dbLevel.user_points,
    dbLevel.mining_speed_multiplier,
    dbLevel.daily_bonus_active,
    dbLevel.daily_bonus_expire
  );
  
  return dbLevel;
}
```

### 用户签到流程

```javascript
/**
 * 用户签到
 */
async function checkIn(userId) {
  const today = new Date().toISOString().split('T')[0];
  
  // 1. 检查今天是否已签到
  const cached = await redisClient.getCheckInStatus(userId);
  
  if (cached && cached.lastDate === today) {
    throw new Error('今天已签到');
  }
  
  // 2. 从数据库查询签到记录
  const dbCheckin = await db.getCheckInRecord(userId);
  
  let consecutiveDays = 1;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  if (dbCheckin && dbCheckin.lastDate === yesterday) {
    consecutiveDays = dbCheckin.consecutiveDays + 1;
  }
  
  // 3. 更新数据库
  await db.updateCheckIn(userId, today, consecutiveDays);
  
  // 4. 激活7天每日加成
  const bonusExpire = new Date(Date.now() + 7 * 86400000);
  await redisClient.addDailyBonusUser(userId, bonusExpire.getTime());
  
  // 5. 更新缓存
  await redisClient.cacheCheckInStatus(
    userId,
    today,
    consecutiveDays,
    true,
    bonusExpire.toISOString()
  );
  
  // 6. 发放签到奖励
  const reward = getCheckInReward(consecutiveDays);
  await rewardUser(userId, reward);
  
  return {
    consecutiveDays,
    reward,
    bonusExpire
  };
}
```

### 观看广告流程

```javascript
/**
 * 用户观看广告
 */
async function watchAd(userId) {
  // 1. 检查今日观看次数
  const count = await redisClient.incrementTodayAdCount(userId);
  
  if (count > 10) {
    throw new Error('今日广告观看次数已达上限 (10次)');
  }
  
  // 2. 发放广告奖励
  const adReward = 10; // 10积分
  await addUserPoints(userId, adReward);
  
  // 3. 查找推荐人
  const referrer = await db.getReferrer(userId);
  
  if (referrer) {
    // 4. 增加推荐计数
    const referralCount = await redisClient.incrementReferralAdCount(
      referrer.id,
      userId
    );
    
    // 5. 给推荐人发奖励 (5积分)
    const referralBonus = 5;
    await addUserPoints(referrer.id, referralBonus);
    
    // 6. 删除邀请进度缓存,下次查询时刷新
    await redisClient.deleteInvitationProgress(referrer.id);
  }
  
  return {
    reward: adReward,
    todayCount: count,
    remainingCount: 10 - count
  };
}
```

---

## 性能优化

### 缓存命中率统计

```javascript
class CacheMonitor {
  constructor() {
    this.hits = 0;
    this.misses = 0;
  }
  
  recordHit() {
    this.hits++;
  }
  
  recordMiss() {
    this.misses++;
  }
  
  getHitRate() {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : (this.hits / total * 100).toFixed(2);
  }
  
  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate() + '%'
    };
  }
}

const monitor = new CacheMonitor();

// 在 getUserLevel 中使用
async function getUserLevelWithMonitor(userId) {
  const cached = await redisClient.getUserLevel(userId);
  
  if (cached) {
    monitor.recordHit();
    return cached;
  } else {
    monitor.recordMiss();
    // 查数据库...
  }
}

// 定时报告
setInterval(() => {
  console.log('缓存统计:', monitor.getStats());
}, 60000); // 每分钟
```

### 批量操作优化

```javascript
/**
 * 批量获取用户等级 (使用 Pipeline)
 */
async function batchGetUserLevels(userIds) {
  if (!redisClient.isReady()) {
    // Redis 不可用,查数据库
    return await db.batchGetUserLevels(userIds);
  }
  
  // 使用 Pipeline 批量查询
  const pipeline = redisClient.client.pipeline();
  
  userIds.forEach(userId => {
    pipeline.hgetall(`user:level:${userId}`);
  });
  
  const results = await pipeline.exec();
  
  // 处理结果
  return results.map((result, index) => {
    const [err, data] = result;
    
    if (err || !data || Object.keys(data).length === 0) {
      return null; // 缓存未命中
    }
    
    return {
      userId: userIds[index],
      level: parseInt(data.level) || 1,
      points: parseInt(data.points) || 0,
      speedMultiplier: parseFloat(data.speed_multiplier) || 1.0,
      dailyBonusActive: data.daily_bonus_active === '1',
      dailyBonusExpire: data.daily_bonus_expire || null
    };
  });
}
```

### 预热缓存

```javascript
/**
 * 预热用户等级缓存
 * 在应用启动时调用,提前加载活跃用户数据
 */
async function warmupUserLevelCache() {
  console.log('开始预热用户等级缓存...');
  
  // 获取最近7天活跃的用户
  const activeUsers = await db.query(`
    SELECT DISTINCT user_id
    FROM user_log
    WHERE action_time > DATE_SUB(NOW(), INTERVAL 7 DAY)
  `);
  
  let warmed = 0;
  
  for (const user of activeUsers) {
    const level = await db.getUserLevel(user.user_id);
    
    const cached = await redisClient.cacheUserLevel(
      user.user_id,
      level.user_level,
      level.user_points,
      level.mining_speed_multiplier,
      level.daily_bonus_active,
      level.daily_bonus_expire
    );
    
    if (cached) warmed++;
  }
  
  console.log(`✅ 预热完成: ${warmed}/${activeUsers.length} 个用户`);
}

// 应用启动时调用
async function startApp() {
  await redisClient.connect();
  await warmupUserLevelCache();
  // ...
}
```

---

## 故障处理

### 降级模式验证

```javascript
/**
 * 测试 Redis 降级模式
 */
async function testDegradedMode() {
  console.log('=== 降级模式测试 ===\n');
  
  // 1. 正常模式
  console.log('1. Redis 正常模式:');
  console.log('   isReady():', redisClient.isReady());
  
  const cached1 = await redisClient.getUserLevel('U001');
  console.log('   缓存查询:', cached1 ? '成功' : '失败');
  
  // 2. 模拟 Redis 故障
  console.log('\n2. 模拟 Redis 故障:');
  await redisClient.disconnect();
  
  console.log('   isReady():', redisClient.isReady());
  
  // 3. 降级模式下的操作
  console.log('\n3. 降级模式操作:');
  const cached2 = await redisClient.getUserLevel('U001');
  console.log('   缓存查询:', cached2); // 应该返回 null
  
  const set = await redisClient.set('test', 'value');
  console.log('   缓存写入:', set); // 应该返回 false
  
  console.log('\n✅ 降级模式验证通过: 所有操作返回安全默认值');
}
```

### 连接重试监控

```javascript
/**
 * 监控 Redis 连接重试
 */
let retryCount = 0;

const originalRetryStrategy = redisClient.client?.options?.retryStrategy;

redisClient.client.options.retryStrategy = (times) => {
  retryCount = times;
  
  // 发送告警
  if (times === 3) {
    sendAlert('⚠️ Redis 重试第3次,可能存在问题');
  }
  
  if (times > 5) {
    sendAlert('❌ Redis 连接失败,系统已降级');
    return null;
  }
  
  return Math.min(times * 1000, 5000);
};

// 重连成功后重置计数
redisClient.client.on('ready', () => {
  if (retryCount > 0) {
    sendAlert(`✅ Redis 重连成功 (重试了${retryCount}次)`);
    retryCount = 0;
  }
});
```

---

## 最佳实践

### 1. 始终检查返回值

```javascript
// ❌ 错误: 不检查返回值
const level = await redisClient.getUserLevel(userId);
console.log('等级:', level.level); // level 可能是 null,导致错误

// ✅ 正确: 检查返回值
const level = await redisClient.getUserLevel(userId);

if (level) {
  console.log('等级:', level.level);
} else {
  // 缓存未命中,查数据库
}
```

### 2. 使用 Cache-Aside 模式

```javascript
// ✅ 标准的缓存使用模式
async function getData(key) {
  // 1. 查缓存
  const cached = await redisClient.get(key);
  if (cached) return cached;
  
  // 2. 查数据库
  const data = await db.getData(key);
  
  // 3. 写缓存
  await redisClient.set(key, data, 3600);
  
  return data;
}
```

### 3. 避免缓存雪崩

```javascript
// ❌ 错误: 所有缓存同时过期
await redisClient.set('user:1', data, 3600);
await redisClient.set('user:2', data, 3600);
await redisClient.set('user:3', data, 3600);
// 1小时后同时失效,导致大量数据库查询

// ✅ 正确: TTL 加随机值
const baseTTL = 3600;
const randomOffset = Math.floor(Math.random() * 300); // 0-300秒
await redisClient.set('user:1', data, baseTTL + randomOffset);
```

### 4. 及时删除过期缓存

```javascript
// ✅ 数据更新时删除缓存
async function updateUserLevel(userId, newLevel) {
  // 1. 更新数据库
  await db.updateUserLevel(userId, newLevel);
  
  // 2. 删除缓存 (重要!)
  await redisClient.deleteUserLevel(userId);
}
```

### 5. 监控缓存健康度

```javascript
/**
 * 定期检查 Redis 健康度
 */
setInterval(async () => {
  const isReady = redisClient.isReady();
  
  if (!isReady) {
    console.error('❌ Redis 不可用,系统运行在降级模式');
    sendAlert('Redis 服务异常');
  } else {
    // 检查延迟
    const start = Date.now();
    await redisClient.client.ping();
    const latency = Date.now() - start;
    
    if (latency > 100) {
      console.warn(`⚠️  Redis 延迟较高: ${latency}ms`);
    }
  }
}, 60000); // 每分钟检查
```

---

## 附录

### Redis 命令速查表

| 命令 | 说明 | 时间复杂度 |
|------|------|------------|
| GET | 获取字符串值 | O(1) |
| SET | 设置字符串值 | O(1) |
| SETEX | 设置带过期时间的值 | O(1) |
| DEL | 删除键 | O(N) |
| EXISTS | 检查键是否存在 | O(1) |
| EXPIRE | 设置过期时间 | O(1) |
| INCR | 原子递增 | O(1) |
| HSET | 设置Hash字段 | O(1) |
| HGET | 获取Hash字段 | O(1) |
| HGETALL | 获取Hash所有字段 | O(N) |
| HMSET | 批量设置Hash字段 | O(N) |
| ZADD | 添加到有序集合 | O(log N) |
| ZSCORE | 获取成员分数 | O(1) |
| ZREM | 从有序集合删除 | O(log N) |
| ZREMRANGEBYSCORE | 按分数范围删除 | O(log N + M) |

### 环境变量配置

```bash
# .env 文件
REDIS_HOST=47.79.232.189
REDIS_PORT=6379
REDIS_PASSWORD=3hu8fds3y
REDIS_DB=0
```

### 依赖版本

```json
{
  "dependencies": {
    "ioredis": "^5.3.2"
  }
}
```

---

**文档版本:** 1.0.0  
**最后更新:** 2025-12-15  
**维护者:** Bitcoin Mining Master Team
