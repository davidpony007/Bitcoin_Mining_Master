# Bind Referrer Reward显示问题修复说明

## 问题描述

用户A邀请用户B，绑定关系建立成功后，B的Contracts页面没有显示**Bind Referrer Reward**合约卡片。

## 问题分析

### 1. 后端检查 ✅

**数据库**：
- 合约记录存在且正确
- `hashrate = 0.000000000000139`（实际BTC/s算力）
- `mining_status = 'mining'`
- 剩余时间正常

**API响应**：
```json
{
  "bindReferrerReward": {
    "exists": true,
    "isActive": true,
    "hashrate": "5.5Gh/s",
    "remainingSeconds": 6595,
    "endTime": "2026-02-01T12:27:16.000Z",
    "contractId": 70
  }
}
```

### 2. 前端问题 ❌

**问题根因**：前端代码尝试将`hashrate`字段（现在是字符串"5.5Gh/s"）转换为`double`类型，导致解析异常：

```dart
// 错误代码：
_inviteFriendHashrate = (data['inviteFriendReward']['hashrate'] ?? 0).toDouble();
_bindReferrerHashrate = (data['bindReferrerReward']['hashrate'] ?? 0).toDouble();
```

因为`hashrate`现在是字符串`"5.5Gh/s"`，调用`.toDouble()`会抛出异常，导致状态更新失败，卡片不显示。

## 修复方案

### 修改文件

**android_clent/bitcoin_mining_master/lib/screens/contracts_screen.dart**

#### 1. 移除hashrate解析代码

```dart
// 修复前：
_inviteFriendHashrate = (data['inviteFriendReward']['hashrate'] ?? 0).toDouble();
_bindReferrerHashrate = (data['bindReferrerReward']['hashrate'] ?? 0).toDouble();

// 修复后：
// hashrate现在是字符串（如"5.5Gh/s"），不需要解析
// _inviteFriendHashrate和_bindReferrerHashrate变量已弃用
```

#### 2. 添加调试日志

```dart
print('📊 合约存在性: InviteFriendExists=$_inviteFriendExists, BindReferrerExists=$_bindReferrerExists');
print('⏱️ 剩余时间: InviteFriend=$_inviteFriendRemainingSeconds秒, BindReferrer=$_bindReferrerRemainingSeconds秒');
```

## 验证步骤

### 1. 后端验证（已通过）

```bash
# 检查数据库
SELECT id, user_id, free_contract_type, hashrate, mining_status
FROM free_contract_records 
WHERE user_id = 'USER_ID'
AND free_contract_type = 'bind referrer free contract';

# 检查API
curl "http://47.79.232.189/api/contract-status/my-contracts/USER_ID"
```

### 2. 前端验证

1. 重新构建APK：
   ```bash
   cd android_clent/bitcoin_mining_master
   flutter build apk --release
   ```

2. 安装到设备：
   ```bash
   adb install -r build/app/outputs/flutter-apk/app-release.apk
   ```

3. 打开APP，登录被邀请人账号

4. 进入Contracts页面，在**All**标签下应该看到：
   - Daily Check-in Reward: Not Active
   - Free Ad Reward: Not Active
   - Invite Friend Reward: Not Active
   - **Bind Referrer Reward: 5.5Gh/s (倒计时显示)** ✅

## 预期结果

### All标签
- 显示所有合约类型
- **Bind Referrer Reward**显示为Active，带倒计时

### Expired标签
- 合约过期后，**Bind Referrer Reward**移动到此标签
- 显示为Not Active

## 技术说明

### API返回的hashrate字段

- **API返回**：字符串格式，如`"5.5Gh/s"`、`"7.5Gh/s"`
- **前端显示**：直接使用固定值，无需解析
- **后端计算**：使用数据库中的实际BTC/s值（0.000000000000139）

### 显示逻辑

```dart
Widget _buildAllTab() {
  return Column(
    children: [
      _buildDailyCheckinCard(),      // Daily Check-in
      _buildAdMiningCard(),           // Ad Reward
      _buildInviteFriendCard(),       // Invite Friend Reward
      
      // Bind Referrer Reward - 只在活跃时显示
      if (_bindReferrerExists && _isBindReferrerActive) ...[
        _buildBindReferrerCard(),
      ],
    ],
  );
}
```

## 相关文件

- `backend/src/routes/contractStatusRoutes.js` - API路由（已修复hashrate返回）
- `backend/src/services/refereeMiningContractService.js` - 合约创建服务（已修复存储）
- `android_clent/bitcoin_mining_master/lib/screens/contracts_screen.dart` - 前端显示（本次修复）

## 修复日期

- **2026-02-01**：修复hashrate精度问题（后端）
- **2026-02-01**：修复前端解析问题（本次）

---

**修复状态**：✅ 已完成
**测试状态**：⏳ 待用户验证
