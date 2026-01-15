# 付费产品页面 (Paid Contracts Screen)

## 功能概述

已成功创建付费矿机合约商店页面，包含四个付费档位。

## 四个付费档位

### 1. Starter Plan - $4.99
- **算力**: 176.3 Gh/s
- **时长**: 30天
- **每日产出**: 0.00039398 BTC
- **总产出**: 0.01181952 BTC
- **描述**: Perfect for beginners
- **颜色**: 蓝色 (#4A90E2)

### 2. Standard Plan - $6.99 ⭐ 最受欢迎
- **算力**: 305.6 Gh/s
- **时长**: 30天
- **每日产出**: 0.00066661 BTC
- **总产出**: 0.01999872 BTC
- **描述**: Most popular choice
- **颜色**: 绿色 (#50C878)
- **标签**: 🔥 POPULAR

### 3. Advanced Plan - $9.99
- **算力**: 611.2 Gh/s
- **时长**: 30天
- **每日产出**: 0.00133056 BTC
- **总产出**: 0.03991680 BTC
- **描述**: For serious miners
- **颜色**: 橙色 (#FF6B35)

### 4. Premium Plan - $19.99
- **算力**: 1326.4 Gh/s
- **时长**: 30天
- **每日产出**: 0.00289440 BTC
- **总产出**: 0.08683200 BTC
- **描述**: Maximum hashrate power
- **颜色**: 金色 (#FFD700)

## 页面功能

### 1. 顶部说明区域
- 🚀 Boost Your Mining 标题
- 简洁的功能说明

### 2. 合约卡片
每个合约卡片包含：
- 档位名称和描述
- 价格显示（醒目的颜色）
- 三个关键信息行：
  - ⚡ Hashrate（算力）
  - 📅 Daily Output（每日产出）
  - 💰 Total Output (30d)（30天总产出）
- Purchase Contract 按钮

### 3. 特殊标识
- "Standard Plan"标记为"🔥 POPULAR"
- 热门卡片有发光边框效果

### 4. 底部说明
📋 How it works 部分包含：
- Contract activates immediately after purchase（立即激活）
- Mining runs automatically for 30 days（自动运行30天）
- Daily earnings are added to your balance（每日收益自动入账）
- Withdraw anytime once balance reaches minimum（余额达标即可提现）
- No additional fees or hidden costs（无隐藏费用）

## 交互流程

### 1. 进入页面
- 从Dashboard点击"Buy Contract"按钮
- 或从底部导航栏进入

### 2. 查看合约
- 上下滚动查看四个档位
- 对比不同档位的算力和产出

### 3. 购买流程
1. 点击"Purchase Contract"按钮
2. 弹出确认对话框，显示：
   - 合约名称
   - 价格
   - 算力
   - 时长
3. 确认购买后进入支付流程（待集成）

## 已集成的入口

### Dashboard页面
- Quick Actions区域的"Buy Contract"按钮
- 点击后跳转到付费产品页面

## 待实现功能

### 支付集成
需要添加以下支付方式：
1. **Google Play Billing** - Android应用内购买
2. **Stripe** - 信用卡支付
3. **Cryptocurrency** - 加密货币支付

### 支付流程
```dart
void _processPurchase(Map<String, dynamic> tier) {
  // TODO: 实现支付逻辑
  // 1. 调用支付网关（Google Play, Stripe等）
  // 2. 支付成功后调用后端API创建合约
  // 3. 显示购买成功提示
}
```

## 后端API对接

### 创建合约API
```javascript
// POST /api/contracts/paid
{
  "userId": "user_id",
  "productId": "p0699",  // p0499, p0699, p0999, p1999
  "orderId": "order_id"
}
```

### 后端服务
使用 `paidContractService.js` 中的方法：
```javascript
PaidContractService.createPaidContract(userId, productId, orderId)
```

## 设计特点

### 视觉设计
- 深色主题 (#1A1A2E 背景)
- 每个档位独特的颜色标识
- 渐变色顶部标题区域
- 卡片式布局，阴影效果
- 热门标签突出显示

### 用户体验
- 清晰的信息层级
- 直观的价格对比
- 详细的收益展示
- 友好的购买确认流程
- 完善的功能说明

## 文件位置

- **页面文件**: `lib/screens/paid_contracts_screen.dart`
- **集成位置**: `lib/screens/dashboard_screen.dart`
- **后端服务**: `backend/src/services/paidContractService.js`

## 下一步开发建议

1. **支付集成**
   - 集成Google Play Billing SDK
   - 配置产品ID和价格
   - 实现支付验证

2. **API对接**
   - 连接后端创建合约接口
   - 处理支付成功回调
   - 更新用户合约列表

3. **用户体验优化**
   - 添加购买历史记录
   - 显示当前激活的合约
   - 添加合约倒计时显示

4. **A/B测试**
   - 测试不同的价格展示方式
   - 优化热门标签位置
   - 测试按钮文案效果
