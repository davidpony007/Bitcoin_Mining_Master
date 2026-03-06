# 免费挖矿合约计算公式修复完成

## ✅ 修复完成时间
2026年1月13日

---

## 📋 修复需求

**公式**：
```
每秒奖励 BTC = 基础奖励 × 国家系数 × 矿工等级速率系数 × 特殊加成系数
```

---

## 🔧 修复内容

### 1. ✅ 修改免费合约创建方法

**文件**：[authController.js](../backend/src/controllers/authController.js#L670-L730)

**修改前**：
```javascript
// ❌ 硬编码算力值
const contract = await FreeContractRecord.create({
  hashrate: 0.00000001, // 固定值
  // ...
});
```

**修改后**：
```javascript
// ✅ 调用公式计算实际速度
const LevelService = require('../services/levelService');
const speedInfo = await LevelService.calculateMiningSpeed(user_id.trim());

// 计算2小时预期收益
const durationSeconds = 2 * 60 * 60;
const expectedRevenue = speedInfo.finalSpeedWithCountry * durationSeconds;

// 记录计算过程日志
console.log(`✅ 免费广告合约速度计算:`, {
  user_id: user_id.trim(),
  baseSpeed: speedInfo.baseSpeed,
  levelMultiplier: speedInfo.levelMultiplier,
  dailyBonusMultiplier: speedInfo.dailyBonusMultiplier,
  countryMultiplier: speedInfo.countryMultiplier,
  finalSpeed: speedInfo.finalSpeedWithCountry,
  expectedRevenue2Hours: expectedRevenue
});

// 使用公式计算结果创建合约
const contract = await FreeContractRecord.create({
  hashrate: speedInfo.finalSpeedWithCountry, // ✅ 应用完整公式
  // ...
});
```

**返回数据增强**：
```javascript
res.json({
  success: true,
  message: '免费广告合约创建成功',
  data: {
    contract,
    speedInfo: {
      baseSpeed: speedInfo.baseSpeed,
      baseHashrate: speedInfo.baseHashrateGhs + ' Gh/s',
      levelMultiplier: speedInfo.levelMultiplier,       // 等级系数
      dailyBonusMultiplier: speedInfo.dailyBonusMultiplier, // 签到加成
      countryMultiplier: speedInfo.countryMultiplier,    // 国家系数
      finalSpeed: speedInfo.finalSpeedWithCountry,
      expectedRevenue2Hours: expectedRevenue,
      formula: '每秒奖励 = 基础奖励 × 国家系数 × 矿工等级速率系数 × 特殊加成系数'
    }
  }
});
```

---

### 2. ✅ 修改合约激活方法

**文件**：[authController.js](../backend/src/controllers/authController.js#L738-L780)

**修改前**：
```javascript
// ❌ 激活时不更新hashrate，使用创建时的旧值
await contract.update({
  mining_status: 'mining',
  // hashrate 未更新
});
```

**修改后**：
```javascript
// ✅ 激活时重新计算速度（应用最新的等级/签到/国家系数）
const LevelService = require('../services/levelService');
const speedInfo = await LevelService.calculateMiningSpeed(user_id.trim());

const durationSeconds = 2 * 60 * 60;
const expectedRevenue = speedInfo.finalSpeedWithCountry * durationSeconds;

console.log(`✅ 激活广告合约，重新计算速度:`, {
  user_id: user_id.trim(),
  finalSpeed: speedInfo.finalSpeedWithCountry,
  expectedRevenue2Hours: expectedRevenue
});

await contract.update({
  mining_status: 'mining',
  hashrate: speedInfo.finalSpeedWithCountry // ✅ 更新为当前实际速度
});
```

**好处**：
- 如果用户在创建和激活之间升级，会使用新等级的速度
- 如果用户在激活前签到，会立即获得1.36x加成
- 国家系数变化会实时生效

---

## 🎯 公式验证

### 计算示例

**场景**：LV.3用户 + 已签到 + 中国

#### 输入参数：
- 用户等级：LV.3
- 等级速率系数：1.2
- 签到状态：已签到（2小时内）
- 特殊加成系数：1.36
- 用户国家：中国
- 国家系数：1.5
- 基础奖励：0.000000000000139 BTC/秒

#### 计算过程：
```javascript
基础奖励 = 0.000000000000139 BTC/秒

矿工等级速率系数 = 1.2 (LV.3)
特殊加成系数 = 1.36 (签到加成，2小时有效)
国家系数 = 1.5 (中国)

// 第一步：计算等级和签到加成
finalMultiplier = 等级系数 × 签到加成
                = 1.2 × 1.36
                = 1.632

finalSpeed = 基础奖励 × finalMultiplier
           = 0.000000000000139 × 1.632
           = 0.000000000000227 BTC/秒

// 第二步：应用国家系数
finalSpeedWithCountry = finalSpeed × 国家系数
                      = 0.000000000000227 × 1.5
                      = 0.0000000000003405 BTC/秒

// 第三步：计算2小时收益
2小时收益 = finalSpeedWithCountry × 7200秒
         = 0.0000000000003405 × 7200
         = 0.00000000245 BTC
```

#### 输出结果：
```json
{
  "baseSpeed": 0.000000000000139,
  "levelMultiplier": 1.2,
  "dailyBonusMultiplier": 1.36,
  "countryMultiplier": 1.5,
  "finalSpeed": 0.000000000000227,
  "finalSpeedWithCountry": 0.0000000000003405,
  "expectedRevenue2Hours": 0.00000000245
}
```

---

### API响应示例

#### 创建合约响应：

```json
{
  "success": true,
  "message": "免费广告合约创建成功，请观看广告激活",
  "data": {
    "contract": {
      "id": 123,
      "user_id": "U20260113170000001",
      "free_contract_type": "ad free contract",
      "hashrate": 0.0000000000003405,
      "mining_status": "completed"
    },
    "speedInfo": {
      "baseSpeed": 0.000000000000139,
      "baseHashrate": "5.5 Gh/s",
      "levelMultiplier": 1.2,
      "dailyBonusMultiplier": 1.36,
      "countryMultiplier": 1.5,
      "finalSpeed": 0.0000000000003405,
      "expectedRevenue2Hours": 0.00000000245,
      "formula": "每秒奖励 = 基础奖励 × 国家系数 × 矿工等级速率系数 × 特殊加成系数"
    }
  }
}
```

#### 激活合约响应：

```json
{
  "success": true,
  "message": "广告合约已激活，开始挖矿2小时",
  "data": {
    "contract": {
      "id": 123,
      "hashrate": 0.0000000000003405,
      "mining_status": "mining"
    },
    "speedInfo": {
      "baseSpeed": 0.000000000000139,
      "levelMultiplier": 1.2,
      "dailyBonusMultiplier": 1.36,
      "countryMultiplier": 1.5,
      "finalSpeed": 0.0000000000003405,
      "expectedRevenue2Hours": 0.00000000245
    }
  }
}
```

---

## 📊 系数配置参考

### 1. 基础奖励（固定）
```
0.000000000000139 BTC/秒
```

### 2. 矿工等级速率系数

| 等级 | 积分范围 | 速率系数 |
|------|----------|----------|
| LV.1 | 0-20 | 1.0 |
| LV.2 | 21-50 | 1.1 |
| LV.3 | 51-100 | 1.2 |
| LV.4 | 101-200 | 1.35 |
| LV.5 | 201-400 | 1.5 |
| LV.6 | 401-800 | 1.7 |
| LV.7 | 801-1600 | 2.0 |
| LV.8 | 1601-3000 | 2.4 |
| LV.9 | 3001+ | 3.0 |

### 3. 特殊加成系数

| 类型 | 倍数 | 有效时间 | 触发条件 |
|------|------|----------|----------|
| 签到加成 | 1.36x | 2小时 | 每日首次签到 |
| 无加成 | 1.0x | - | 默认状态 |

### 4. 国家系数

| 国家 | 系数 | 说明 |
|------|------|------|
| 中国 | 1.5x | 示例 |
| 美国 | 1.3x | 示例 |
| 其他 | 1.0x | 默认 |

> **注意**：国家系数在 `country_config` 表中配置

---

## 🔍 日志示例

### 创建合约日志：
```
✅ 免费广告合约速度计算: {
  user_id: 'U20260113170000001',
  baseSpeed: 1.39e-13,
  levelMultiplier: 1.2,
  dailyBonusMultiplier: 1.36,
  countryMultiplier: 1.5,
  finalSpeed: 3.405e-13,
  expectedRevenue2Hours: 2.45e-9
}
```

### 激活合约日志：
```
✅ 激活广告合约，重新计算速度: {
  user_id: 'U20260113170000001',
  finalSpeed: 3.405e-13,
  expectedRevenue2Hours: 2.45e-9
}
```

---

## ✅ 测试验证

### 测试场景1：基础用户（无加成）

**输入**：
- 等级：LV.1 (系数 1.0)
- 签到：无 (系数 1.0)
- 国家：默认 (系数 1.0)

**预期结果**：
```
hashrate = 0.000000000000139 × 1.0 × 1.0 × 1.0
         = 0.000000000000139 BTC/秒

2小时收益 = 0.000000000000139 × 7200
          = 0.0000000010008 BTC
```

---

### 测试场景2：高级用户（全部加成）

**输入**：
- 等级：LV.9 (系数 3.0)
- 签到：已签到 (系数 1.36)
- 国家：中国 (系数 1.5)

**预期结果**：
```
finalMultiplier = 3.0 × 1.36 = 4.08

finalSpeed = 0.000000000000139 × 4.08
           = 0.000000000000567 BTC/秒

finalSpeedWithCountry = 0.000000000000567 × 1.5
                      = 0.0000000000008505 BTC/秒

2小时收益 = 0.0000000000008505 × 7200
          = 0.000000006124 BTC
```

---

### 测试场景3：签到加成过期

**输入**：
- 等级：LV.5 (系数 1.5)
- 签到：2小时前签到，加成已过期 (系数 1.0)
- 国家：美国 (系数 1.3)

**预期结果**：
```
finalMultiplier = 1.5 × 1.0 = 1.5

finalSpeed = 0.000000000000139 × 1.5
           = 0.0000000000002085 BTC/秒

finalSpeedWithCountry = 0.0000000000002085 × 1.3
                      = 0.00000000000027105 BTC/秒

2小时收益 = 0.00000000000027105 × 7200
          = 0.00000000195 BTC
```

---

## 🚀 部署状态

### ✅ 修改完成

1. ✅ 修改 `createAdFreeContract()` - 创建时应用公式
2. ✅ 修改 `activateAdFreeContract()` - 激活时重新计算
3. ✅ 添加详细日志 - 记录计算过程
4. ✅ 增强API响应 - 返回完整系数信息
5. ✅ 重启后端服务 - PM2 restart count: 25

### ✅ 服务状态

```bash
PM2 Status:
┌────┬─────────────────┬──────┬────────┬─────────┐
│ id │ name            │ mode │ ↺      │ status  │
├────┼─────────────────┼──────┼────────┼─────────┤
│ 0  │ bitcoin-backend │ fork │ 25     │ online  │
└────┴─────────────────┴──────┴────────┴─────────┘

启动日志：
✓ Redis 连接成功
✓ 等级配置加载成功
✓ 签到奖励配置加载成功
✓ 国家配置加载成功
✓ 所有定时任务已启动
```

---

## 🎊 修复总结

### ✅ 问题解决

| 问题 | 修复前 | 修复后 |
|------|--------|--------|
| **创建合约** | 硬编码 0.00000001 | ✅ 调用公式计算 |
| **激活合约** | 不更新hashrate | ✅ 重新计算速度 |
| **等级系数** | 未应用 | ✅ 实时应用 |
| **签到加成** | 未应用 | ✅ 2小时内有效 |
| **国家系数** | 未应用 | ✅ 单独计算 |
| **日志记录** | 无 | ✅ 详细记录 |
| **API响应** | 仅返回合约 | ✅ 返回完整计算信息 |

### 🔑 核心改进

1. **公式完整实现**：
   - ✅ 基础奖励：0.000000000000139 BTC/秒
   - ✅ 等级系数：1.0 - 3.0
   - ✅ 签到加成：1.36x（2小时）
   - ✅ 国家系数：可配置

2. **实时计算**：
   - 创建时计算当前速度
   - 激活时重新计算（应用最新状态）
   - 用户升级立即生效
   - 签到加成自动应用

3. **透明度提升**：
   - API返回详细系数信息
   - 日志记录计算过程
   - 显示预期收益
   - 提供公式说明

---

## 📝 API使用说明

### 创建免费广告合约

**请求**：
```bash
POST /api/auth/create-ad-contract
Content-Type: application/json

{
  "user_id": "U20260113170000001"
}
```

**响应**：
```json
{
  "success": true,
  "message": "免费广告合约创建成功，请观看广告激活",
  "data": {
    "contract": { ... },
    "speedInfo": {
      "baseSpeed": 0.000000000000139,
      "levelMultiplier": 1.2,
      "dailyBonusMultiplier": 1.36,
      "countryMultiplier": 1.5,
      "finalSpeed": 0.0000000000003405,
      "expectedRevenue2Hours": 0.00000000245
    }
  }
}
```

### 激活免费广告合约

**请求**：
```bash
POST /api/auth/activate-ad-contract
Content-Type: application/json

{
  "user_id": "U20260113170000001",
  "contract_id": "123"
}
```

**响应**：
```json
{
  "success": true,
  "message": "广告合约已激活，开始挖矿2小时",
  "data": {
    "contract": { ... },
    "speedInfo": { ... }
  }
}
```

---

## 🎯 后续建议

### 可选增强（未来）

1. **余额累积优化**
   - 修改 `miningBalance.js` 使用实时公式
   - 启用挖矿调度器
   - 实时累积BTC到用户余额

2. **合约统计**
   - 记录每个合约的实际产出
   - 对比预期收益和实际收益
   - 生成收益报表

3. **前端展示**
   - 显示当前挖矿速度
   - 显示各系数详情
   - 实时显示收益累积

---

*修复完成时间：2026年1月13日*  
*版本：v1.0*  
*状态：✅ 已部署上线*
