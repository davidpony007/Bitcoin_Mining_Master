# 🎮 游戏机制实现方案

## 📊 您的需求分析

根据您提供的表格，需要实现以下机制：

### 1. 矿工等级机制 (LV.1 - LV.9)
- 基于积分升级
- 不同等级有不同的挖矿速率加成
- 范围: +10% 到 +200%

### 2. 积分机制
- 观看广告 (+20积分)
- 邀请好友 (+6积分/人，满5次+20积分，满10人+30积分)
- 连续签到 (1天+4分，3天+15分，7天+30分，15天+30分，30天+60分)
- 被邀请的下级用户每看10次广告，邀请人+1积分

### 3. 特殊加成
- 每日签到: 1.36倍系数，限时2小时

---

## 🏗️ 架构设计建议

### 核心原则
```
MySQL (持久化存储) 
    ↓ 
Node.js 后端 (业务逻辑 + 定时任务)
    ↓
Redis (缓存 + 实时计算)
    ↓
Android 客户端 (UI展示)
```

---

## 📦 详细分层方案

### 1️⃣ MySQL 数据库 (数据持久化层)

**用途**: 存储所有关键数据，保证数据不丢失

#### 需要的新表结构:

**A. 用户等级表** (已有 user_information 表，需扩展)
```sql
ALTER TABLE user_information ADD COLUMN user_level INT DEFAULT 1 COMMENT '用户等级 1-9';
ALTER TABLE user_information ADD COLUMN user_points INT DEFAULT 0 COMMENT '用户积分';
ALTER TABLE user_information ADD COLUMN mining_speed_multiplier DECIMAL(10,4) DEFAULT 1.0000 COMMENT '挖矿速率倍数';
```

**B. 签到记录表** (新建)
```sql
CREATE TABLE user_check_in (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL COMMENT '用户ID',
    check_in_date DATE NOT NULL COMMENT '签到日期',
    consecutive_days INT DEFAULT 1 COMMENT '连续签到天数',
    points_earned INT DEFAULT 0 COMMENT '本次签到获得积分',
    daily_bonus_active BOOLEAN DEFAULT FALSE COMMENT '每日签到加成是否激活',
    bonus_expire_time DATETIME NULL COMMENT '加成过期时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_date (user_id, check_in_date),
    INDEX idx_user_id (user_id)
) COMMENT='用户签到记录表';
```

**C. 广告观看记录表** (新建)
```sql
CREATE TABLE ad_watch_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL COMMENT '用户ID',
    ad_type VARCHAR(50) NOT NULL COMMENT '广告类型',
    points_earned INT DEFAULT 20 COMMENT '获得积分',
    watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '观看时间',
    INDEX idx_user_id (user_id),
    INDEX idx_watched_at (watched_at)
) COMMENT='广告观看记录表';
```

**D. 积分变动记录表** (新建)
```sql
CREATE TABLE points_transaction (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL COMMENT '用户ID',
    points_change INT NOT NULL COMMENT '积分变动 (正数增加，负数减少)',
    reason VARCHAR(100) NOT NULL COMMENT '变动原因',
    related_user_id VARCHAR(50) NULL COMMENT '关联用户ID (如邀请人)',
    before_points INT NOT NULL COMMENT '变动前积分',
    after_points INT NOT NULL COMMENT '变动后积分',
    before_level INT NOT NULL COMMENT '变动前等级',
    after_level INT NOT NULL COMMENT '变动后等级',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) COMMENT='积分变动记录表';
```

**E. 邀请奖励进度表** (新建)
```sql
CREATE TABLE invitation_reward_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL COMMENT '邀请人ID',
    milestone_type VARCHAR(50) NOT NULL COMMENT '里程碑类型: INVITE_5, INVITE_10, REFERRAL_AD_10',
    milestone_count INT DEFAULT 0 COMMENT '当前进度',
    milestone_target INT NOT NULL COMMENT '目标数量',
    is_completed BOOLEAN DEFAULT FALSE COMMENT '是否已完成',
    completed_at TIMESTAMP NULL COMMENT '完成时间',
    points_awarded INT DEFAULT 0 COMMENT '已奖励积分',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_milestone (user_id, milestone_type),
    INDEX idx_user_id (user_id)
) COMMENT='邀请奖励进度表';
```

---

### 2️⃣ Redis 缓存层 (实时计算 + 高频读写)

**用途**: 减少数据库压力，提升响应速度

#### Redis 数据结构设计:

**A. 用户等级缓存**
```redis
# Key: user:level:{user_id}
# Type: Hash
# Fields:
HSET user:level:U2025120722050012345 level 3
HSET user:level:U2025120722050012345 points 85
HSET user:level:U2025120722050012345 speed_multiplier 1.20
HSET user:level:U2025120722050012345 daily_bonus_active true
HSET user:level:U2025120722050012345 daily_bonus_expire 1702825200

# TTL: 24小时，过期后从 MySQL 重新加载
```

**B. 签到状态缓存**
```redis
# Key: user:checkin:{user_id}
# Type: Hash
HSET user:checkin:U2025120722050012345 last_date "2025-12-14"
HSET user:checkin:U2025120722050012345 consecutive_days 5
HSET user:checkin:U2025120722050012345 bonus_active true
HSET user:checkin:U2025120722050012345 bonus_expire 1702832400

# TTL: 48小时
```

**C. 广告观看计数 (滑动窗口)**
```redis
# Key: user:ad:today:{user_id}
# Type: String
# Value: 观看次数
INCR user:ad:today:U2025120722050012345
EXPIRE user:ad:today:U2025120722050012345 86400  # 每天0点重置

# 下级用户广告观看计数
# Key: user:referral:ad:{referrer_id}:{referral_id}
# Type: String
SET user:referral:ad:U123:U456 8
EXPIRE user:referral:ad:U123:U456 2592000  # 30天过期
```

**D. 邀请进度缓存**
```redis
# Key: user:invite:progress:{user_id}
# Type: Hash
HSET user:invite:progress:U123 total_count 8
HSET user:invite:progress:U123 milestone_5_claimed false
HSET user:invite:progress:U123 milestone_10_claimed false

# TTL: 永不过期，手动更新
```

**E. 每日签到加成激活用户集合**
```redis
# Key: daily:bonus:active
# Type: Sorted Set (按过期时间排序)
ZADD daily:bonus:active 1702832400 U2025120722050012345

# 定时任务每分钟清理过期用户
```

---

### 3️⃣ Node.js 后端 API (业务逻辑层)

**用途**: 处理所有业务逻辑，协调 MySQL 和 Redis

#### 需要实现的 API 和服务:

**A. 等级系统服务** (`services/levelService.js`)
```javascript
class LevelService {
  // 等级配置表
  static LEVEL_CONFIG = [
    { level: 1, minPoints: 0, maxPoints: 20, speedMultiplier: 1.00 },
    { level: 2, minPoints: 21, maxPoints: 50, speedMultiplier: 1.10 },
    { level: 3, minPoints: 51, maxPoints: 100, speedMultiplier: 1.20 },
    { level: 4, minPoints: 101, maxPoints: 200, speedMultiplier: 1.35 },
    { level: 5, minPoints: 201, maxPoints: 400, speedMultiplier: 1.50 },
    { level: 6, minPoints: 401, maxPoints: 800, speedMultiplier: 1.70 },
    { level: 7, minPoints: 801, maxPoints: 1600, speedMultiplier: 2.00 },
    { level: 8, minPoints: 1601, maxPoints: 3000, speedMultiplier: 2.40 },
    { level: 9, minPoints: 3001, maxPoints: 999999, speedMultiplier: 3.00 }
  ];

  // 计算用户等级
  static calculateLevel(points) { ... }
  
  // 增加积分并更新等级
  static async addPoints(userId, points, reason) { ... }
  
  // 获取用户当前等级信息
  static async getUserLevel(userId) { ... }
  
  // 计算最终挖矿速率 (等级倍数 × 签到倍数)
  static async calculateMiningSpeed(userId, baseSpeed) { ... }
}
```

**B. 签到服务** (`services/checkInService.js`)
```javascript
class CheckInService {
  // 用户签到
  static async checkIn(userId) {
    // 1. 查询上次签到日期
    // 2. 判断是否连续签到
    // 3. 计算获得积分
    // 4. 激活每日加成 (1.36倍，2小时)
    // 5. 更新 Redis 和 MySQL
    // 6. 返回结果
  }
  
  // 获取签到状态
  static async getCheckInStatus(userId) { ... }
  
  // 检查每日加成是否有效
  static async isDailyBonusActive(userId) { ... }
}
```

**C. 广告服务** (`services/adService.js`)
```javascript
class AdService {
  // 记录广告观看
  static async recordAdWatch(userId, adType) {
    // 1. 记录到 MySQL
    // 2. 增加积分 +20
    // 3. 检查是否有邀请人
    // 4. 如果有，更新邀请人的"下级观看进度"
    // 5. 每满10次，给邀请人 +1 积分
  }
  
  // 获取今日观看次数
  static async getTodayAdCount(userId) { ... }
}
```

**D. 邀请奖励服务** (`services/invitationRewardService.js`)
```javascript
class InvitationRewardService {
  // 处理新用户注册 (邀请人获得奖励)
  static async handleNewReferral(referrerId, referralId) {
    // 1. 邀请人 +6 积分
    // 2. 更新邀请进度
    // 3. 检查里程碑 (5人+20分，10人+30分)
    // 4. 发放里程碑奖励
  }
  
  // 处理下级用户观看广告
  static async handleReferralAdWatch(referrerId, referralId) {
    // 1. 增加计数
    // 2. 每满10次，邀请人 +1 积分
  }
  
  // 获取邀请进度
  static async getInvitationProgress(userId) { ... }
}
```

**E. 定时任务** (`queue/scheduledTasks.js`)
```javascript
// 使用 node-cron 或 Bull Queue
const cron = require('node-cron');

// 每天 00:00 重置签到加成
cron.schedule('0 0 * * *', async () => {
  // 清理过期的签到加成
  await redis.del('daily:bonus:active');
});

// 每分钟检查并清理过期加成
cron.schedule('* * * * *', async () => {
  const now = Date.now() / 1000;
  await redis.zremrangebyscore('daily:bonus:active', '-inf', now);
});

// 每小时同步 Redis 数据到 MySQL
cron.schedule('0 * * * *', async () => {
  await syncRedisToMySQL();
});
```

---

### 4️⃣ API 接口设计

#### 新增的 API 端点:

```javascript
// ============ 等级系统 ============
GET  /api/level/info?user_id={user_id}
// 响应: { level, points, speedMultiplier, nextLevelPoints }

GET  /api/level/config
// 响应: LEVEL_CONFIG 数组

// ============ 签到系统 ============
POST /api/checkin
// 请求: { user_id }
// 响应: { success, pointsEarned, consecutiveDays, bonusActive, bonusExpire }

GET  /api/checkin/status?user_id={user_id}
// 响应: { lastCheckIn, consecutiveDays, bonusActive, bonusExpire }

// ============ 广告系统 ============
POST /api/ad/watch
// 请求: { user_id, ad_type }
// 响应: { success, pointsEarned, totalPoints, todayAdCount }

GET  /api/ad/count?user_id={user_id}
// 响应: { todayCount, totalCount }

// ============ 邀请奖励 ============
GET  /api/invitation/progress?user_id={user_id}
// 响应: { 
//   totalInvited, 
//   milestone5: { target: 5, current: 3, claimed: false },
//   milestone10: { target: 10, current: 3, claimed: false },
//   referralAdRewards: 12  // 已获得的下级广告奖励次数
// }

// ============ 积分历史 ============
GET  /api/points/history?user_id={user_id}&page=1&limit=20
// 响应: { transactions: [...], total }
```

---

## 🎯 实现优先级和建议

### 阶段 1: 基础架构 (2-3天)
1. ✅ 创建 MySQL 新表 (5个表)
2. ✅ 实现 LevelService (等级计算逻辑)
3. ✅ 创建基础 API 端点
4. ✅ Redis 缓存集成

### 阶段 2: 核心功能 (3-5天)
1. ✅ 签到系统 (CheckInService + API)
2. ✅ 广告观看 (AdService + API)
3. ✅ 邀请奖励 (InvitationRewardService)
4. ✅ 积分事务记录

### 阶段 3: 优化和测试 (2-3天)
1. ✅ 定时任务 (清理过期数据)
2. ✅ Redis 同步到 MySQL
3. ✅ 单元测试
4. ✅ 压力测试

### 阶段 4: Android 客户端集成 (2-3天)
1. ✅ UI 页面 (等级、签到、广告)
2. ✅ API 调用
3. ✅ 数据展示

---

## 📌 关键决策点

### Q1: 积分计算放在哪里？
**答**: **Node.js 后端**
- ✅ 保证数据一致性
- ✅ 防止客户端作弊
- ✅ 便于审计和日志记录

### Q2: 实时数据放在哪里？
**答**: **Redis**
- ✅ 高频读写 (如广告计数)
- ✅ 临时状态 (如签到加成)
- ✅ 排行榜 (可扩展)

### Q3: 历史记录放在哪里？
**答**: **MySQL**
- ✅ 持久化存储
- ✅ 复杂查询 (如积分历史)
- ✅ 数据分析

### Q4: 定时任务放在哪里？
**答**: **Node.js 后端 (使用 Bull Queue 或 node-cron)**
- ✅ 每日重置
- ✅ 数据同步
- ✅ 清理过期数据

---

## 🚀 快速开始

我可以帮您立即实现以下内容：

1. **创建 MySQL 表结构** (DDL SQL 脚本)
2. **实现 LevelService** (等级计算逻辑)
3. **实现 CheckInService** (签到逻辑)
4. **创建 API 路由** (Express 路由)
5. **Redis 集成代码**

请告诉我：
- 想从哪个功能开始？(建议从**等级系统**开始)
- 需要我生成完整代码吗？

我可以一步步帮您实现! 😊
