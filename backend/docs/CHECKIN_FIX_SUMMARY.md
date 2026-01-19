# 每日签到功能修复与优化文档

## 修复日期
2024年（最新修复）

## 问题描述

根据用户提供的积分机制需求表格，原有签到系统存在以下问题：

### 需求对比

| 功能 | 需求要求 | 原实现 | 问题 |
|------|----------|--------|------|
| 每日签到奖励 | 固定4积分 | 根据天数变化（4-30积分不等） | ❌ 不符合需求 |
| 里程碑奖励 | 累计签到（可不连续）| 连续签到（必须连续） | ❌ 不符合需求 |
| 里程碑天数 | 3/7/15/30天 | 7/14/21/30天 | ❌ 不符合需求 |
| 里程碑积分 | 6/15/30/60积分 | 15/25/35/60积分 | ❌ 不符合需求 |

## 修复内容

### 1. 后端服务修改 (`checkInPointsService.js`)

#### 1.1 奖励配置修改

**修改前：**
```javascript
static DAILY_REWARDS = {
  1: 4, 2: 4, 3: 6,     // Day 1-3
  4: 4, 5: 4, 6: 4,     // Day 4-6
  7: 10,                 // Week 1 Milestone
  // ... 不同天数不同奖励
};

static MILESTONE_REWARDS = {
  7: { points: 15, label: 'Week 1 Champion', description: 'Continuous 7-day check-in' },
  14: { points: 25, label: 'Week 2 Champion', description: 'Continuous 14-day check-in' },
  21: { points: 35, label: 'Week 3 Champion', description: 'Continuous 21-day check-in' },
  30: { points: 60, label: 'Monthly Master', description: 'Continuous 30-day check-in' }
};
```

**修改后：**
```javascript
static BASE_CHECKIN_POINTS = 4; // 每日签到基础奖励4积分（每日都可领取）

// 累计签到里程碑奖励（可以不连续，只能领取一次）
static CUMULATIVE_REWARDS = {
  3: { points: 6, label: '3-Day Milestone', description: 'Complete 3 days of check-in' },
  7: { points: 15, label: 'Week Champion', description: 'Complete 7 days of check-in' },
  15: { points: 30, label: 'Half Month Master', description: 'Complete 15 days of check-in' },
  30: { points: 60, label: 'Monthly Master', description: 'Complete 30 days of check-in' }
};
```

#### 1.2 签到逻辑修改

**关键变化：**
- ✅ 每日签到固定奖励4积分
- ✅ 新增累计签到天数计算（不要求连续）
- ✅ 保留连续签到天数计算（用于前端显示连续状态）
- ✅ 里程碑奖励改为独立领取

**修改的方法：**
1. `performCheckIn()` - 改为累计签到逻辑，每日固定4积分
2. `claimCumulativeMilestone()` - 新增累计签到里程碑领取方法（替代原`claimConsecutiveMilestone`）
3. `getAvailableMilestones()` - 改为基于累计天数计算可领取里程碑
4. `getNextCumulativeMilestone()` - 新增获取下一个累计里程碑方法
5. `getCheckInStatus()` - 增加返回累计签到天数
6. `get30DayCalendar()` - 修改为每日固定4积分显示
7. `getMilestoneConfig()` - 更新配置信息

### 2. 数据库表修改

#### 2.1 新增表

**创建 `cumulative_check_in_reward` 表：**
```sql
CREATE TABLE IF NOT EXISTS `cumulative_check_in_reward` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
  `cumulative_days` INT UNSIGNED NOT NULL COMMENT '累计签到天数（3/7/15/30）',
  `points_earned` INT UNSIGNED NOT NULL COMMENT '获得的积分',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_cumulative` (`user_id`, `cumulative_days`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='累计签到里程碑奖励记录表';
```

**说明：**
- 用于记录用户已领取的累计签到里程碑奖励
- 与连续签到奖励表分离，支持不连续签到的里程碑
- 每个用户每个里程碑只能领取一次（通过UNIQUE KEY保证）

#### 2.2 保留原有表

**`check_in_record` 表：** 保持不变，用于记录每日签到
- `consecutive_days` 字段：保留，用于显示连续签到状态
- 新增逻辑：计算累计天数通过 `COUNT(*)` 查询

**`consecutive_check_in_reward` 表：** 可保留用于数据迁移或兼容性

### 3. API路由修改 (`checkInRoutes.js`)

#### 3.1 领取里程碑奖励接口

**修改前：**
```javascript
router.post('/claim-milestone', authenticate, async (req, res) => {
  const { user_id, consecutive_days } = req.body;
  const result = await CheckInPointsService.claimConsecutiveMilestone(
    user_id,
    parseInt(consecutive_days)
  );
});
```

**修改后：**
```javascript
router.post('/claim-milestone', authenticate, async (req, res) => {
  const { user_id, cumulative_days, consecutive_days } = req.body;
  // 兼容旧的consecutive_days参数
  const days = cumulative_days || consecutive_days;
  
  const result = await CheckInPointsService.claimCumulativeMilestone(
    user_id,
    parseInt(days)
  );
});
```

**说明：**
- 参数名从 `consecutive_days` 改为 `cumulative_days`
- 保留对旧参数的兼容性
- 调用新的 `claimCumulativeMilestone` 方法

### 4. 前端需要的修改（待实现）

#### 4.1 签到状态显示

需要更新显示逻辑以显示：
- **累计签到天数**（主要指标）
- 连续签到天数（次要指标，可选）
- 每日固定4积分提示

#### 4.2 里程碑显示

需要更新里程碑卡片：
- 显示天数：3/7/15/30天
- 显示奖励：6/15/30/60积分
- 标签更新为累计签到（非连续）
- 进度条基于累计天数

#### 4.3 API调用修改

```dart
// 领取里程碑奖励时
await _apiService.claimMilestone({
  'user_id': userId,
  'cumulative_days': days,  // 使用新参数名
});
```

## 数据迁移建议

### 步骤1：创建新表
```bash
mysql -u root -p bitcoin_mining < backend/migrations/add-cumulative-checkin-reward-table.sql
```

### 步骤2：迁移已有里程碑奖励（可选）
```sql
-- 如果需要将已有的连续签到奖励迁移到累计签到
INSERT INTO cumulative_check_in_reward (user_id, cumulative_days, points_earned, created_at)
SELECT user_id, consecutive_days, points_earned, created_at
FROM consecutive_check_in_reward
WHERE consecutive_days IN (3, 7, 15, 30)
ON DUPLICATE KEY UPDATE created_at = created_at;
```

## 验证清单

### 后端验证
- [x] 每日签到固定获得4积分 ✅
- [x] 累计签到天数正确计算 ✅
- [x] 里程碑奖励为3/7/15/30天 ✅
- [x] 里程碑积分为6/15/30/60 ✅
- [x] 里程碑可独立领取 ✅
- [x] 同一里程碑只能领取一次 ✅
- [x] 支持不连续签到的累计 ✅

### 前端待验证
- [ ] 显示累计签到天数
- [ ] 显示正确的里程碑信息
- [ ] 领取里程碑功能正常
- [ ] UI更新为"累计签到"而非"连续签到"

## 与需求对齐验证

根据用户需求表格：

| 需求项 | 需求描述 | 实现状态 |
|--------|----------|----------|
| 完成每日签到 | 增加4积分，每日都可领取 | ✅ 已实现 |
| 完成每日签到3天 | 额外增加6积分，只能领取一次，可以不连续 | ✅ 已实现 |
| 完成每日签到7天 | 额外增加15积分，只能领取一次，可以不连续 | ✅ 已实现 |
| 完成每日签到15天 | 额外增加30积分，只能领取一次，可以不连续 | ✅ 已实现 |
| 完成每日签到30天 | 额外增加60积分，只能领取一次，可以不连续 | ✅ 已实现 |

## 示例响应

### 签到成功响应
```json
{
  "success": true,
  "message": "Check-in Success!",
  "userId": 1,
  "checkInDate": "2024-01-15",
  "consecutiveDays": 5,
  "cumulativeDays": 12,
  "pointsAwarded": 4,
  "nextMilestone": {
    "days": 15,
    "label": "Half Month Master",
    "points": 30,
    "daysRemaining": 3
  }
}
```

### 获取里程碑响应
```json
{
  "success": true,
  "cumulativeDays": 12,
  "availableMilestones": [
    {
      "cumulativeDays": 3,
      "points": 6,
      "label": "3-Day Milestone",
      "description": "Complete 3 days of check-in",
      "canClaim": false,
      "claimed": true,
      "progress": 12,
      "required": 3
    },
    {
      "cumulativeDays": 7,
      "points": 15,
      "label": "Week Champion",
      "description": "Complete 7 days of check-in",
      "canClaim": false,
      "claimed": true,
      "progress": 12,
      "required": 7
    },
    {
      "cumulativeDays": 15,
      "points": 30,
      "label": "Half Month Master",
      "description": "Complete 15 days of check-in",
      "canClaim": false,
      "claimed": false,
      "progress": 12,
      "required": 15
    },
    {
      "cumulativeDays": 30,
      "points": 60,
      "label": "Monthly Master",
      "description": "Complete 30 days of check-in",
      "canClaim": false,
      "claimed": false,
      "progress": 12,
      "required": 30
    }
  ]
}
```

## 注意事项

1. **数据库迁移必须执行**：必须创建 `cumulative_check_in_reward` 表才能正常使用新功能
2. **API兼容性**：保留了对旧参数名的兼容，前端可以逐步迁移
3. **测试建议**：建议在测试环境先验证完整流程后再部署到生产环境
4. **前端需要更新**：前端显示逻辑需要相应调整以正确显示累计天数和里程碑
