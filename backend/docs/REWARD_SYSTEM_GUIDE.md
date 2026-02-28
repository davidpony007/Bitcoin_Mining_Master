# 奖励系统功能说明与使用指南

## 📋 功能概览

根据您提供的需求，系统实现了以下4个奖励功能：

| 功能 | 奖励积分 | 触发条件 | 限制 | 状态 |
|------|---------|---------|------|------|
| 1. 广告观看奖励 | 每次 1 积分 | 观看一次广告 | 每日上限20积分 | ✅ 已完成 |
| 2. 邀请好友奖励 | 每人 6 积分 | 被邀请人完成5次广告观看 | 无限制 | ✅ 已完成 |
| 3. 邀请10人里程碑 | 每10人 30 积分 | 累计有效邀请达10的倍数 | 可重复 | ✅ 已完成 |
| 4. 下级广告返佣 | 每10次 1 积分 | 下级用户每看10次广告 | 无限制 | ✅ 已完成 |

---

## 💡 使用场景演示

### 场景1：用户A观看广告

**操作流程：**
```
用户A打开广告页面 → 观看30秒广告 → 点击完成
```

**系统处理：**
1. 记录广告观看次数
2. 增加1积分
3. 检查是否达到每日上限（20次）
4. 如果用户A是被邀请人，检查是否达到5次（触发邀请奖励）
5. 如果用户A有邀请人，检查是否达到10的倍数（触发下级返佣）

**API调用：**
```dart
// Flutter前端
final result = await pointsApiService.watchAd();
print('获得积分: ${result['pointsAwarded']}');
print('今日累计: ${result['totalPointsToday']}');
print('剩余次数: ${result['remainingViews']}');
```

**返回示例：**
```json
{
  "success": true,
  "userId": "USER123",
  "viewCount": 5,
  "totalPointsToday": 5,
  "pointsAwarded": 1,
  "dailyLimit": 20,
  "remainingViews": 15,
  "isLimitReached": false,
  "subordinateReward": null,
  "referralReward": {
    "referrerId": "USER_REFERRER",
    "refereeUserId": "USER123",
    "pointsEarned": 6,
    "triggered": true
  }
}
```

---

### 场景2：用户B邀请了用户C

**操作流程：**
```
1. 用户B分享邀请码给用户C
2. 用户C使用邀请码注册
3. 用户C观看1-4次广告：用户B无奖励
4. 用户C观看第5次广告：用户B自动获得6积分 🎉
```

**系统自动处理（无需手动领取）：**
- ✅ 检查邀请关系
- ✅ 统计用户C的广告观看次数
- ✅ 第5次时自动发放6积分给用户B
- ✅ 记录到 referral_milestone 表
- ✅ 记录到 points_transaction 表

**用户B的积分明细：**
```
- 成功邀请好友 USER_C（完成5次广告观看）: +6 积分
```

---

### 场景3：用户D累计邀请了15个好友

**用户D的好友完成情况：**
```
- 12个好友完成了5次广告观看 ✅
- 3个好友还未完成5次 ❌
```

**系统计算：**
```
有效邀请人数 = 12 人
可领取次数 = Math.floor(12 / 10) = 1 次
奖励积分 = 1 × 30 = 30 积分
```

**领取方式1（手动）：**
```dart
// Flutter前端
final result = await pointsApiService.claimInvitationMilestone();
```

**领取方式2（自动）：**
- 系统每2小时自动检查并发放奖励
- 无需用户手动操作

**当用户D累计邀请达到20人时：**
```
有效邀请人数 = 20 人
可领取次数 = Math.floor(20 / 10) = 2 次
已领取次数 = 1 次
新增奖励 = (2 - 1) × 30 = 30 积分
```

---

### 场景4：用户E有3个下级

**下级观看情况：**
```
- 下级1：观看了25次广告
- 下级2：观看了8次广告
- 下级3：观看了12次广告
```

**用户E获得的返佣：**
```
下级1：Math.floor(25 / 10) = 2 积分
下级2：Math.floor(8 / 10) = 0 积分（未满10次）
下级3：Math.floor(12 / 10) = 1 积分
总计：3 积分
```

**自动发放时机：**
- 下级1观看第10次广告时 → 用户E获得1积分
- 下级1观看第20次广告时 → 用户E获得1积分
- 下级2观看第8次广告时 → 无奖励
- 下级3观看第10次广告时 → 用户E获得1积分

---

## 🎯 完整用户旅程示例

### 用户F的完整旅程

**第1天：**
```
1. 观看20次广告 → 获得20积分（达到每日上限）
2. 邀请了2个好友（USER_G, USER_H）
```

**第2天：**
```
3. USER_G 观看5次广告 → 用户F自动获得6积分（邀请奖励）
4. USER_H 观看5次广告 → 用户F自动获得6积分（邀请奖励）
5. 用户F继续观看20次广告 → 获得20积分
```

**第3-7天：**
```
6. 用户F继续邀请好友，累计达到10个有效邀请
7. 系统自动或手动领取 → 获得30积分（10人里程碑）
8. USER_G 累计观看20次广告 → 用户F获得2积分（下级返佣）
```

**用户F的总积分：**
```
- 广告观看奖励：20 × 7天 = 140积分
- 邀请好友奖励：6 × 10人 = 60积分
- 10人里程碑奖励：30 × 1次 = 30积分
- 下级广告返佣：2积分（USER_G的20次）
总计：232积分 🎉
```

---

## 🔍 如何查看奖励记录

### 1. 查看今日广告观看情况
```http
GET /api/ad/today?user_id=USER_ID
```

**返回：**
```json
{
  "success": true,
  "viewCount": 5,
  "pointsEarned": 5,
  "remainingViews": 15
}
```

### 2. 查看邀请进度
```http
GET /api/invitation/progress?user_id=USER_ID
```

**返回：**
```json
{
  "success": true,
  "totalReferrals": 12,
  "validReferrals": 10,
  "milestone10Count": 1,
  "availableMilestones": 0
}
```

### 3. 查看下级观看统计
```http
GET /api/ad/subordinate?user_id=USER_ID
```

**返回：**
```json
{
  "success": true,
  "data": [
    {
      "subordinate_id": "USER_C",
      "total_views": 25,
      "milestone_count": 2
    }
  ]
}
```

### 4. 查看积分明细
```http
GET /api/points/history?limit=50
```

**返回：**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "points": 6,
        "points_type": "REFERRAL_1",
        "description": "成功邀请好友 USER_C（完成5次广告观看）",
        "created_at": "2026-01-18T10:00:00Z"
      },
      {
        "points": 1,
        "points_type": "AD_VIEW",
        "description": "观看广告奖励（第5次）",
        "created_at": "2026-01-18T09:50:00Z"
      }
    ]
  }
}
```

---

## ⚙️ 系统配置

所有奖励参数都在后端代码中配置，可根据需要调整：

**文件：** `backend/src/services/adPointsService.js`
```javascript
static AD_REWARD_POINTS = 1;      // 每次广告奖励
static DAILY_AD_LIMIT = 20;       // 每日上限
static SUBORDINATE_MILESTONE = 10; // 下级返佣里程碑
static REFERRAL_REQUIRED_ADS = 5;  // 邀请要求广告次数
```

**文件：** `backend/src/services/invitationPointsService.js`
```javascript
static FIRST_FRIEND_REWARD = 6;   // 单个好友奖励
static TEN_FRIENDS_REWARD = 30;   // 10人里程碑奖励
```

---

## 🚀 系统优势

1. **自动化奖励** - 大部分奖励自动发放，无需手动领取
2. **防重复机制** - 每个奖励只能领取一次，防止重复发放
3. **实时统计** - 实时计算观看次数和邀请人数
4. **透明记录** - 所有奖励都有详细的交易记录
5. **灵活配置** - 奖励参数可随时调整
6. **数据一致性** - 使用事务保证数据完整性

---

## 📝 注意事项

1. **广告观看上限**：每日20积分封顶，超过后不再获得积分（但会继续记录观看次数）
2. **邀请有效性**：只有被邀请人完成5次广告观看，邀请才算有效
3. **时区设置**：使用UTC+00:00时区，每日重置时间为UTC 00:00
4. **返佣计算**：下级每满10次广告触发1积分，累计计算不重置
5. **里程碑奖励**：可以手动领取，也会每2小时自动发放

---

## ✅ 功能验证清单

- [x] 广告观看每次1积分
- [x] 每日20积分封顶
- [x] UTC+00:00重置
- [x] 被邀请人5次广告后自动触发邀请奖励
- [x] 邀请人获得6积分
- [x] 10人里程碑奖励30积分
- [x] 下级每10次广告返佣1积分
- [x] 所有奖励记录到数据库
- [x] API接口完整
- [x] 前端API调用已实现
- [x] 防重复机制
- [x] 错误处理

**所有功能已完成并可以投入使用！** 🎉
