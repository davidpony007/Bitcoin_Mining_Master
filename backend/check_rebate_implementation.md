# Total Rebate Earnings 功能设计检查报告

## 📋 用户需求
1. 下级用户的 **Free Ad Reward** 收益统计完成（每2小时）
2. 计算下级收益 × 20% 作为返利
3. 返利给对应的上级推荐者
4. 更新间隔：每2小时
5. 持久化存储

## ✅ 已实现的部分

### 1. 返利计算逻辑 (referralRebateTask.js)
- ✅ 定时任务：每2小时5分执行 (`5 */2 * * *`)
- ✅ 计算周期：统计过去2小时
- ✅ 返利比例：20% (0.20)
- ✅ 合约类型：**仅统计普通广告合约** ('ad free contract')
- ✅ 计算方式：合约hashrate × 挖矿秒数 × 20%
- ✅ 余额更新：更新 `current_bitcoin_balance` 和 `bitcoin_accumulated_amount`
- ✅ 交易记录：插入 `bitcoin_transaction_records` 表

### 2. 数据库表结构
- ✅ `invitation_rebate` 表已定义（模型文件存在）
- ✅ `user_status.total_invitation_rebate` 字段已定义

## ❌ 存在的问题

### 1. **返利任务未启用**
```javascript
// backend/src/index.js:249
// ReferralRebateTask.start();  // ❌ 被注释掉了！
```
**影响**：返利功能完全未运行，用户不会收到任何返利

### 2. **持久化不完整**
返利任务中**缺失**以下操作：

#### a) 未更新 `total_invitation_rebate` 字段
```javascript
// ❌ 缺少这个更新
UPDATE user_status 
SET total_invitation_rebate = total_invitation_rebate + ?
WHERE user_id = ?
```

#### b) 未插入 `invitation_rebate` 表记录
```javascript
// ❌ 缺少这个插入
INSERT INTO invitation_rebate (
  user_id,
  invitation_code,
  subordinate_user_id,
  subordinate_user_invitation_code,
  subordinate_rebate_amount,
  rebate_creation_time
) VALUES (?, ?, ?, ?, ?, NOW())
```

**影响**：
- 前端显示的 `Total Rebate Earnings` 始终为 0
- 无法追溯每个下级贡献的返利明细
- 无法统计历史返利数据

### 3. **前端数据来源错误**
```dart
// referral_screen.dart:85
_totalRebate = (data['total_invitation_rebate'] ?? 0).toString();
```
前端从 `total_invitation_rebate` 字段读取，但该字段从未被更新！

## 🔧 需要修复的内容

### 1. 启用返利任务
```javascript
// backend/src/index.js
ReferralRebateTask.start(); // 取消注释
```

### 2. 完善持久化逻辑
在 `referralRebateTask.js` 的第165行附近添加：

```javascript
// 5. 发放返利给推荐人（更新余额）
await connection.query(`
  UPDATE user_status 
  SET 
    current_bitcoin_balance = current_bitcoin_balance + ?,
    bitcoin_accumulated_amount = bitcoin_accumulated_amount + ?,
    total_invitation_rebate = total_invitation_rebate + ?  // ✅ 新增
  WHERE user_id = ?
`, [rebateAmount, rebateAmount, rebateAmount, referrerId]);

// 6. 记录到 invitation_rebate 表（✅ 新增）
for (const sub of subordinateDetails) {
  await connection.query(`
    INSERT INTO invitation_rebate (
      user_id,
      subordinate_user_id,
      subordinate_rebate_amount,
      rebate_creation_time
    ) VALUES (?, ?, ?, NOW())
  `, [referrerId, sub.userId, sub.revenue * 0.20]);
}

// 7. 记录返利发放日志到 bitcoin_transaction_records
// (现有代码保持不变)
```

### 3. 获取推荐人邀请码
需要在计算返利时查询邀请码：

```javascript
// 获取推荐人邀请码
const [referrerInfo] = await connection.query(
  'SELECT invitation_code FROM user_information WHERE user_id = ?',
  [referrerId]
);
const invitationCode = referrerInfo[0]?.invitation_code || '';

// 查询每个下级的邀请码
const [subInfo] = await connection.query(
  'SELECT invitation_code FROM user_information WHERE user_id = ?',
  [sub.userId]
);
```

## 📊 设计符合度评估

| 需求项 | 当前实现 | 符合度 |
|--------|---------|--------|
| 统计Free Ad Reward | ✅ 仅统计ad free contract | ✅ 100% |
| 计算周期2小时 | ✅ 每2小时5分执行 | ✅ 100% |
| 返利比例20% | ✅ × 0.20 | ✅ 100% |
| 返利给上级 | ✅ 更新余额 | ✅ 100% |
| 更新间隔2小时 | ✅ cron: 5 */2 * * * | ✅ 100% |
| 持久化-余额 | ✅ current_bitcoin_balance | ✅ 100% |
| 持久化-累计 | ❌ total_invitation_rebate未更新 | ❌ 0% |
| 持久化-明细 | ❌ invitation_rebate表未写入 | ❌ 0% |
| **任务启用** | ❌ 被注释掉 | ❌ 0% |

## 🎯 总结

### ✅ 设计正确
核心逻辑（计算方式、时间间隔、返利比例）完全符合需求

### ❌ 实现不完整
1. **致命问题**：返利任务被禁用，功能完全不工作
2. **数据问题**：total_invitation_rebate 字段从未更新，前端显示始终为0
3. **追溯问题**：invitation_rebate 表无数据，无法查询返利明细

### 🔨 修复优先级
1. **P0 - 立即修复**：启用返利任务
2. **P0 - 立即修复**：更新 total_invitation_rebate 字段
3. **P1 - 重要**：插入 invitation_rebate 表记录
4. **P2 - 优化**：添加返利明细查询API
