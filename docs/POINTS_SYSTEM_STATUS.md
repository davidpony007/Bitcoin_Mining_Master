# 等级积分机制实现状态检查报告

## 📋 需求清单（基于图片）

### 等级积分机制要求：

| 功能 | 奖励 | 说明 |
|------|------|------|
| 每观看一次广告 | 增加1积分 | 此项每日封顶20积分，UTC+00:00重置冷却 |
| 每邀请1个好友 | 增加6积分 | 且好友需完成五次广告观看，可以多次领取 |
| 每邀请10个好友 | 额外增加30积分 | 且好友需完成五次广告观看，可以多次领取 |
| 完成每日签到 | 增加4积分 | 每日都可领取 |
| 连续签到7天 | 额外增加15积分 | 只能领取一次 |
| 连续签到3天 | 额外增加6积分 | 只能领取一次 |
| 连续签到15天 | 额外增加30积分 | 只能领取一次 |
| 连续签到30天 | 额外增加60积分 | 只能领取一次 |
| 被邀请的下级好友每看10次广告 | 本人增加1积分 | - |

---

## ✅ 已实现部分

### 1. 数据库表结构

#### ✅ 已存在的表：
- **level_config** - 等级配置表
  - 字段：level, min_points, max_points, speed_multiplier, level_name, description
  - 状态：已创建并添加中文注释

- **check_in_reward_config** - 签到奖励配置表
  - 字段：consecutive_days, points_reward, bonus_multiplier, bonus_duration_hours, description
  - 状态：已创建并添加中文注释

- **user_information** - 用户信息表
  - 包含：user_level, user_points, mining_speed_multiplier 字段
  - 状态：⚠️ 字段可能需要添加

- **invitation_relationship** - 邀请关系表
  - 用于跟踪推荐关系
  - 状态：已存在

### 2. 后端服务实现

#### ✅ 已实现的服务：
- **levelService.js** - 等级系统服务
  - ✅ 初始化等级配置
  - ✅ 根据积分计算等级
  - ✅ 获取用户等级信息（含Redis缓存）
  - ✅ 计算等级进度百分比
  - ✅ 增加用户积分
  
- **checkInService.js** - 签到系统服务
  - ✅ 用户签到功能
  - ✅ 获取签到状态
  - ✅ 获取签到历史
  
- **adService.js** - 广告系统服务
  - 状态：需要检查是否包含积分奖励逻辑

### 3. API 路由

#### ✅ 已实现的路由：
- **pointsRoutes.js**
  - GET /api/points/history - 获取积分历史
  - POST /api/points/add - 手动增加积分（管理员）

- **checkInRoutes.js**
  - POST /api/checkin - 用户签到
  - GET /api/checkin/status - 获取签到状态
  - GET /api/checkin/history - 获取签到历史

- **levelRoutes.js**
  - GET /api/level/info - 获取用户等级信息
  - GET /api/level/config - 获取等级配置列表
  - GET /api/level/leaderboard - 获取等级排行榜
  - GET /api/level/mining-speed - 计算挖矿速率

### 4. 前端实现

#### ✅ 已实现的功能：
- Dashboard页面包含等级卡片展示
- 等级信息弹窗（显示LV.1-LV.6等级）
- 签到按钮（标注为TODO）
- 广告合约创建和激活接口

---

## ❌ 缺失部分

### 1. 数据库表

需要创建以下表：

#### ❌ user_points 表
```sql
CREATE TABLE user_points (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  user_id VARCHAR(30) NOT NULL UNIQUE COMMENT '用户ID',
  total_points INT DEFAULT 0 COMMENT '总积分',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_user_id (user_id)
) COMMENT='用户积分表';
```

#### ❌ points_transaction 表
```sql
CREATE TABLE points_transaction (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  user_id VARCHAR(30) NOT NULL COMMENT '用户ID',
  points_change INT NOT NULL COMMENT '积分变动（正数增加，负数减少）',
  points_type ENUM(
    'AD_VIEW',
    'REFERRAL_1',
    'REFERRAL_10',
    'DAILY_CHECKIN',
    'CONSECUTIVE_CHECKIN_3',
    'CONSECUTIVE_CHECKIN_7',
    'CONSECUTIVE_CHECKIN_15',
    'CONSECUTIVE_CHECKIN_30',
    'SUBORDINATE_AD_VIEW',
    'MANUAL_ADD',
    'MANUAL_DEDUCT'
  ) NOT NULL COMMENT '积分类型',
  balance_after INT NOT NULL COMMENT '变动后余额',
  description VARCHAR(255) COMMENT '说明',
  related_user_id VARCHAR(30) COMMENT '关联用户ID（如邀请人/被邀请人）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) COMMENT='积分交易记录表';
```

#### ❌ ad_view_record 表
```sql
CREATE TABLE ad_view_record (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  user_id VARCHAR(30) NOT NULL COMMENT '用户ID',
  ad_type VARCHAR(50) DEFAULT 'free_contract' COMMENT '广告类型',
  view_date DATE NOT NULL COMMENT '观看日期（UTC）',
  view_count INT DEFAULT 1 COMMENT '当日观看次数',
  points_earned INT DEFAULT 1 COMMENT '获得积分',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY unique_user_date (user_id, view_date),
  INDEX idx_user_id (user_id),
  INDEX idx_view_date (view_date)
) COMMENT='广告观看记录表';
```

#### ❌ check_in_record 表
```sql
CREATE TABLE check_in_record (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  user_id VARCHAR(30) NOT NULL COMMENT '用户ID',
  check_in_date DATE NOT NULL COMMENT '签到日期',
  consecutive_days INT DEFAULT 1 COMMENT '连续签到天数',
  points_earned INT DEFAULT 4 COMMENT '获得积分',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY unique_user_date (user_id, check_in_date),
  INDEX idx_user_id (user_id),
  INDEX idx_check_in_date (check_in_date)
) COMMENT='每日签到记录表';
```

#### ❌ consecutive_check_in_reward 表
```sql
CREATE TABLE consecutive_check_in_reward (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  user_id VARCHAR(30) NOT NULL COMMENT '用户ID',
  consecutive_days INT NOT NULL COMMENT '连续天数（3/7/15/30）',
  points_earned INT NOT NULL COMMENT '获得积分',
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
  UNIQUE KEY unique_user_days (user_id, consecutive_days),
  INDEX idx_user_id (user_id)
) COMMENT='连续签到奖励记录表（防止重复领取）';
```

#### ❌ referral_milestone 表
```sql
CREATE TABLE referral_milestone (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  user_id VARCHAR(30) NOT NULL COMMENT '推荐人用户ID',
  milestone_count INT NOT NULL COMMENT '里程碑数量（1人/10人）',
  times_claimed INT DEFAULT 1 COMMENT '领取次数',
  points_earned INT NOT NULL COMMENT '累计获得积分',
  last_claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后领取时间',
  UNIQUE KEY unique_user_milestone (user_id, milestone_count),
  INDEX idx_user_id (user_id)
) COMMENT='邀请里程碑记录表（追踪1人/10人奖励）';
```

### 2. 服务层功能

需要实现的服务方法：

#### ❌ adService.js 扩展
- `recordAdView(userId)` - 记录广告观看
- `checkDailyAdLimit(userId)` - 检查每日观看限制
- `awardAdViewPoints(userId)` - 奖励广告积分

#### ❌ checkInService.js 扩展
- `checkConsecutiveDays(userId)` - 检查连续签到天数
- `awardConsecutiveReward(userId, days)` - 奖励连续签到积分
- `canClaimConsecutiveReward(userId, days)` - 检查是否可领取连续奖励

#### ❌ invitationRewardService.js 扩展
- `checkReferralMilestone(userId)` - 检查邀请里程碑
- `awardReferralPoints(userId, count)` - 奖励邀请积分
- `trackRefereeAdViews(refereeId)` - 追踪被邀请人广告观看
- `awardSubordinateAdPoints(inviterId)` - 奖励上级用户积分

#### ❌ pointsService.js 新建
- `getUserPoints(userId)` - 获取用户积分
- `addPoints(userId, points, type, description)` - 增加积分
- `deductPoints(userId, points, type, description)` - 扣除积分
- `getPointsTransactions(userId, page, limit)` - 查询积分记录

### 3. API 路由

需要添加的接口：

#### ❌ /api/ad/view
- POST - 记录广告观看并奖励积分

#### ❌ /api/points/balance
- GET - 查询用户当前积分余额

#### ❌ /api/checkin/consecutive-reward
- POST - 领取连续签到奖励

#### ❌ /api/referral/milestone
- GET - 查询邀请里程碑状态
- POST - 领取邀请里程碑奖励

### 4. 前端实现

需要实现的页面/组件：

#### ❌ 积分页面
- 显示当前积分
- 显示积分获取方式
- 积分历史记录

#### ❌ 签到页面/弹窗
- 每日签到按钮
- 连续签到天数显示
- 连续签到奖励展示
- 签到日历

#### ❌ 广告观看
- 集成广告SDK
- 观看完成回调
- 每日观看次数显示

#### ❌ 邀请系统扩展
- 显示邀请人数
- 显示里程碑进度（1人/10人）
- 领取奖励按钮

---

## 🎯 实现优先级

### P0 - 核心功能（必须实现）
1. ✅ 创建 user_points 表
2. ✅ 创建 points_transaction 表
3. ✅ 实现 pointsService 基础功能
4. ✅ 实现广告观看积分奖励
5. ✅ 实现每日签到积分奖励

### P1 - 重要功能
1. ✅ 创建 ad_view_record 表
2. ✅ 创建 check_in_record 表
3. ✅ 实现连续签到奖励
4. ✅ 实现邀请1人/10人奖励
5. ✅ 前端积分展示页面

### P2 - 增强功能
1. ✅ 创建连续签到奖励记录表
2. ✅ 实现下级广告观看积分
3. ✅ 积分排行榜
4. ✅ 签到日历UI

---

## 📝 总结

### 实现率统计：
- 数据库表：2/7 (29%) ✅ level_config, check_in_reward_config
- 服务层：2/6 (33%) ✅ levelService, checkInService (部分)
- API路由：3/7 (43%) ✅ level, points(部分), checkin
- 前端：1/4 (25%) ✅ 等级显示

### 整体评估：
**约30%已实现**，核心框架已建立，但具体的积分获取和消耗逻辑需要补充实现。

### 下一步行动：
1. 创建缺失的数据库表
2. 完善 adService 和 checkInService
3. 新建 pointsService
4. 实现对应的API接口
5. 完善前端展示和交互
