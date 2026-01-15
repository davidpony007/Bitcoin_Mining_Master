# 免费挖矿合约计算公式检查报告

## 📋 需求公式

```
每秒奖励 BTC = 基础奖励 × 国家系数 × 矿工等级速率系数 × 特殊加成系数
```

---

## 🔍 检查结果：❌ 未完全实现

经过代码审查，发现当前免费挖矿合约的实现**不完整**，存在以下问题：

---

## 📊 当前实现状态

### 1. 免费合约创建 ⚠️ 硬编码算力值

**文件**：[authController.js](../backend/src/controllers/authController.js#L670-L685)

```javascript
// 创建免费广告合约
const contract = await FreeContractRecord.create({
  user_id: user_id.trim(),
  free_contract_type: 'ad free contract',
  free_contract_revenue: 0,
  free_contract_creation_time: now,
  free_contract_end_time: new Date(now.getTime() + 2 * 60 * 60 * 1000),
  hashrate: 0.00000001, // ❌ 硬编码算力，未使用公式计算
  mining_status: 'completed'
});
```

**问题**：
- ❌ `hashrate: 0.00000001` 是固定值
- ❌ 没有应用公式中的任何系数
- ❌ 未调用 `calculateMiningSpeed()` 计算实际速度

---

### 2. 挖矿余额计算 ⚠️ 使用旧系统

**文件**：[miningBalance.js](../backend/src/utils/miningBalance.js#L21-L38)

```javascript
async function calculateUserBalance(user, contracts) {
  try {
    let balance = Number(await redis.get(BALANCE_KEY(user.id))) || 0;
    const now = Date.now();
    for (const contract of contracts) {
      const lastCalc = Number(await redis.get(LAST_CALC_KEY(user.id))) || contract.startTime;
      const seconds = Math.floor((now - lastCalc) / 1000);
      if (seconds > 0) {
        balance += contract.rate * seconds;  // ❌ 直接使用 contract.rate
      }
    }
    await redis.set(BALANCE_KEY(user.id), balance);
    await redis.set(LAST_CALC_KEY(user.id), now);
    return balance;
  } catch (error) {
    console.error(`计算用户 ${user.id} 余额失败:`, error.message);
    return 0;
  }
}
```

**问题**：
- ❌ `contract.rate` 来自合约表的固定值
- ❌ 没有实时应用公式中的系数
- ❌ 这是旧的挖矿系统，目前已禁用（index.js 第179行注释掉）

---

### 3. 等级速率系数 ✅ 已实现

**文件**：[levelService.js](../backend/src/services/levelService.js#L192-L245)

```javascript
static async calculateMiningSpeed(userId, baseSpeed = 0.000000000000139) {
  try {
    // 1. 获取用户等级倍数 ✅
    const levelInfo = await this.getUserLevel(userId);
    let finalMultiplier = levelInfo.speedMultiplier; // 1.0 - 3.0

    // 2. 检查是否有每日签到加成 ✅ (特殊加成系数)
    let dailyBonusMultiplier = 1.0;
    if (redisClient.isReady()) {
      const isActive = await redisClient.isDailyBonusActive(userId);
      if (isActive) {
        dailyBonusMultiplier = 1.36;
        finalMultiplier *= dailyBonusMultiplier;
      }
    }

    // 3. 获取用户国家倍数 ✅ (国家系数)
    let countryMultiplier = 1.0;
    try {
      const CountryConfigService = require('./countryConfigService');
      const [userInfo] = await db.query(
        'SELECT country FROM user_information WHERE user_id = ?',
        [userId]
      );
      if (userInfo.length > 0 && userInfo[0].country) {
        countryMultiplier = await CountryConfigService.getMiningSpeedMultiplier(userInfo[0].country);
      }
    } catch (error) {
      console.warn('获取国家倍数失败，使用默认值 1.0:', error.message);
    }

    // 4. 计算最终速率
    const finalSpeed = baseSpeed * finalMultiplier;
    const finalSpeedWithCountry = finalSpeed * countryMultiplier;

    return {
      baseSpeed,                         // ✅ 基础奖励 0.000000000000139
      baseHashrateGhs: 5.5,
      levelMultiplier: levelInfo.speedMultiplier,  // ✅ 矿工等级速率系数
      dailyBonusMultiplier,              // ✅ 特殊加成系数（签到加成）
      countryMultiplier,                 // ✅ 国家系数
      finalMultiplier,
      finalSpeed,
      finalSpeedWithCountry,             // ✅ 完整公式结果
      dailyBonusActive: dailyBonusMultiplier > 1.0
    };
  }
}
```

**优点**：
- ✅ 包含所有公式所需的系数
- ✅ 计算逻辑完整

**问题**：
- ❌ **未被免费合约系统调用**
- ❌ 免费合约创建时没有使用这个函数

---

## 🎯 公式对照表

| 公式要素 | 代码实现 | 状态 | 位置 |
|----------|----------|------|------|
| **基础奖励** | `baseSpeed = 0.000000000000139` | ✅ 已定义 | levelService.js#L192 |
| **国家系数** | `countryMultiplier` | ✅ 已实现 | levelService.js#L215-L227 |
| **矿工等级速率系数** | `levelInfo.speedMultiplier` | ✅ 已实现 | levelService.js#L195-L197 |
| **特殊加成系数** | `dailyBonusMultiplier = 1.36` | ✅ 已实现 | levelService.js#L199-L209 |
| **公式整合** | `finalSpeedWithCountry` | ✅ 计算正确 | levelService.js#L236 |
| **免费合约应用** | ❌ 未调用 | ❌ **缺失** | authController.js#L680 |

---

## ❌ 关键问题

### 问题1：免费合约创建时未使用公式

**当前代码**：
```javascript
// authController.js createAdFreeContract()
const contract = await FreeContractRecord.create({
  hashrate: 0.00000001, // ❌ 硬编码
  // ...
});
```

**应该改为**：
```javascript
// 1. 调用公式计算实际速度
const speedInfo = await LevelService.calculateMiningSpeed(user_id.trim());

// 2. 使用计算结果创建合约
const contract = await FreeContractRecord.create({
  user_id: user_id.trim(),
  free_contract_type: 'ad free contract',
  free_contract_revenue: 0,
  free_contract_creation_time: now,
  free_contract_end_time: new Date(now.getTime() + 2 * 60 * 60 * 1000),
  hashrate: speedInfo.finalSpeedWithCountry, // ✅ 使用公式计算的速度
  mining_status: 'completed'
});
```

---

### 问题2：余额累积未使用公式

**当前代码**：
```javascript
// miningBalance.js calculateUserBalance()
balance += contract.rate * seconds; // ❌ 使用固定的 contract.rate
```

**应该改为**：
```javascript
// 实时计算挖矿速度
const speedInfo = await LevelService.calculateMiningSpeed(user.user_id);
balance += speedInfo.finalSpeedWithCountry * seconds; // ✅ 使用实时计算的速度
```

**好处**：
- 实时反映用户等级变化
- 自动应用签到加成（2小时有效）
- 国家倍数自动生效

---

### 问题3：挖矿调度器已禁用

**文件**：[index.js](../backend/src/index.js#L179)

```javascript
// 旧调度器（暂时禁用）
// startMiningBalanceScheduler(); // ❌ 已注释
```

**影响**：
- 即使修复了公式，余额也不会自动累积
- 需要重新启用或重写调度器

---

## 🔧 修复方案

### 方案1：快速修复（推荐）⭐

**修改 createAdFreeContract() 方法**：

```javascript
// backend/src/controllers/authController.js
exports.createAdFreeContract = async (req, res) => {
  try {
    const { user_id } = req.body;

    // ... 验证代码 ...

    // ✅ 调用公式计算实际挖矿速度
    const LevelService = require('../services/levelService');
    const speedInfo = await LevelService.calculateMiningSpeed(user_id.trim());

    // 计算2小时的预期收益
    const durationSeconds = 2 * 60 * 60; // 2小时
    const expectedRevenue = speedInfo.finalSpeedWithCountry * durationSeconds;

    const now = new Date();
    const contract = await FreeContractRecord.create({
      user_id: user_id.trim(),
      free_contract_type: 'ad free contract',
      free_contract_revenue: 0,
      free_contract_creation_time: now,
      free_contract_end_time: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      hashrate: speedInfo.finalSpeedWithCountry, // ✅ 使用公式计算
      mining_status: 'completed'
    });

    res.json({
      success: true,
      message: '免费广告合约创建成功',
      data: {
        contract,
        speedInfo: {
          baseSpeed: speedInfo.baseSpeed,
          levelMultiplier: speedInfo.levelMultiplier,
          dailyBonusMultiplier: speedInfo.dailyBonusMultiplier,
          countryMultiplier: speedInfo.countryMultiplier,
          finalSpeed: speedInfo.finalSpeedWithCountry,
          expectedRevenue2Hours: expectedRevenue
        }
      }
    });

  } catch (err) {
    console.error('创建免费广告合约失败:', err);
    res.status(500).json({
      success: false,
      error: '创建失败',
      details: err.message
    });
  }
};
```

---

### 方案2：完整修复（需要更多时间）

#### 步骤1：修改免费合约创建

同方案1

#### 步骤2：修改余额累积逻辑

```javascript
// backend/src/utils/miningBalance.js
async function calculateUserBalance(user, contracts) {
  try {
    let balance = Number(await redis.get(BALANCE_KEY(user.user_id))) || 0;
    const now = Date.now();
    
    for (const contract of contracts) {
      const lastCalc = Number(await redis.get(LAST_CALC_KEY(user.user_id))) || contract.startTime;
      const seconds = Math.floor((now - lastCalc) / 1000);
      
      if (seconds > 0) {
        // ✅ 实时计算挖矿速度（应用所有系数）
        const LevelService = require('../services/levelService');
        const speedInfo = await LevelService.calculateMiningSpeed(user.user_id);
        
        // 使用公式计算的速度累积余额
        balance += speedInfo.finalSpeedWithCountry * seconds;
      }
    }
    
    await redis.set(BALANCE_KEY(user.user_id), balance);
    await redis.set(LAST_CALC_KEY(user.user_id), now);
    return balance;
  } catch (error) {
    console.error(`计算用户 ${user.user_id} 余额失败:`, error.message);
    return 0;
  }
}
```

#### 步骤3：重新启用挖矿调度器

```javascript
// backend/src/index.js
// 在数据库连接成功后启用
startMiningBalanceScheduler(); // ✅ 取消注释
```

---

## 📝 公式验证示例

### 场景：等级3用户 + 签到加成 + 中国

**输入**：
- 用户ID：`USER12345`
- 等级：LV.3（速率系数 1.2）
- 签到状态：今日已签到（加成 1.36，2小时有效）
- 国家：中国（国家系数 1.5）

**计算过程**：
```javascript
基础奖励 = 0.000000000000139 BTC/秒
矿工等级速率系数 = 1.2
特殊加成系数 = 1.36 (签到加成)
国家系数 = 1.5

finalMultiplier = 1.2 × 1.36 = 1.632

finalSpeed = 0.000000000000139 × 1.632 = 0.000000000000227

finalSpeedWithCountry = 0.000000000000227 × 1.5 = 0.0000000000003405 BTC/秒
```

**2小时收益**：
```
2小时 = 7200秒
收益 = 0.0000000000003405 × 7200 = 0.00000000245 BTC
```

---

## ✅ 实现建议

### 立即执行（推荐）：

1. **修改免费合约创建** ⭐ 高优先级
   - 修改 `createAdFreeContract()` 方法
   - 调用 `calculateMiningSpeed()` 获取实际速度
   - 使用计算结果创建合约

2. **修改余额累积** ⭐ 高优先级
   - 修改 `calculateUserBalance()` 方法
   - 实时计算挖矿速度
   - 应用所有公式系数

3. **启用挖矿调度器** ⭐ 高优先级
   - 取消 `startMiningBalanceScheduler()` 注释
   - 验证调度器正常运行

4. **添加日志** 🟡 中优先级
   - 记录每次计算的系数值
   - 便于验证公式正确性

5. **单元测试** 🟡 中优先级
   - 测试公式计算
   - 验证各种场景（不同等级、国家、加成组合）

---

## 📊 系数配置参考

### 矿工等级速率系数

| 等级 | 积分范围 | 速率系数 | 名称 |
|------|----------|----------|------|
| LV.1 | 0-20 | 1.0 | 新手矿工 |
| LV.2 | 21-50 | 1.1 | 初级矿工 |
| LV.3 | 51-100 | 1.2 | 中级矿工 |
| LV.4 | 101-200 | 1.35 | 高级矿工 |
| LV.5 | 201-400 | 1.5 | 专家矿工 |
| LV.6 | 401-800 | 1.7 | 大师矿工 |
| LV.7 | 801-1600 | 2.0 | 传奇矿工 |
| LV.8 | 1601-3000 | 2.4 | 史诗矿工 |
| LV.9 | 3001+ | 3.0 | 神话矿工 |

### 特殊加成系数

| 类型 | 倍数 | 持续时间 | 触发条件 |
|------|------|----------|----------|
| 签到加成 | 1.36x | 2小时 | 每日首次签到 |
| 无加成 | 1.0x | - | 默认状态 |

### 国家系数

| 国家 | 系数 | 配置位置 |
|------|------|----------|
| 中国 | 1.5x | country_config 表 |
| 美国 | 1.3x | country_config 表 |
| 其他 | 1.0x | 默认值 |

---

## 🎊 总结

### ❌ 当前状态：公式未应用

**主要问题**：
1. 免费合约创建时使用硬编码值（0.00000001）
2. 余额累积未调用公式计算
3. 挖矿调度器已禁用

**公式本身**：✅ 完整实现（levelService.js）

**整合状态**：❌ 未连接到免费合约系统

### ✅ 修复后状态

**预期效果**：
- ✅ 免费合约根据用户等级、签到状态、国家自动计算速度
- ✅ 余额实时累积，反映所有加成效果
- ✅ 用户升级或签到后立即生效

**公式验证**：
```
每秒奖励 BTC = 0.000000000000139 × 等级系数 × 签到加成 × 国家系数 ✅
```

---

*检查时间：2026年1月13日*  
*状态：❌ 需要修复*  
*优先级：⭐⭐⭐ 高优先级*
