# mining_contracts 表结构说明

## 📋 表字段详解

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| **id** | int(30) | 主键,自增ID | 1, 2, 3... |
| **user_id** | varchar(15) | 用户唯一标识符 | "USER001" |
| **contract_type** | enum | 合约类型 | "paid contract" |
| **contract_creation_time** | timestamp | 合约创建时间 | 2025-11-23 10:00:00 |
| **contract_end_time** | datetime | 合约结束时间 | 2025-12-23 10:00:00 |
| **contract_duration** | time | 合约持续时长 | 720:00:00 (30天) |
| **hashrate** | decimal(18,18) | 算力值 | 0.00001 |
| **mining_status** | enum | 挖矿状态 | "mining" |

---

## 📊 合约类型详解

### contract_type 枚举值:

1. **ad free contract** - 广告免费合约
   - 用户观看广告获得的免费挖矿合约
   - 通常持续时间较短(几小时到几天)
   - 算力较低

2. **daily sign-in free contract** - 每日签到免费合约
   - 用户每日签到获得的挖矿合约
   - 固定时长(如24小时)
   - 激励用户每日活跃

3. **invitation free contract** - 邀请免费合约
   - 用户成功邀请新用户注册后获得的奖励合约
   - 时长和算力可能比广告合约更优厚

4. **paid contract** - 付费合约
   - 用户购买的正式挖矿合约
   - 持续时间长(30天、90天、365天等)
   - 算力高,收益稳定

---

## ⚙️ 挖矿状态详解

### mining_status 枚举值:

1. **mining** (挖矿中)
   - 合约正在运行
   - 持续产生比特币收益
   - 当前时间 < contract_end_time

2. **completed** (已完成)
   - 合约已到期
   - 停止产生收益
   - 当前时间 >= contract_end_time

3. **error** (错误)
   - 合约遇到错误(支付失败、系统异常等)
   - 暂停挖矿
   - 需要人工处理

4. **''** (空字符串)
   - 特殊状态,可能表示未激活或其他中间状态

---

## 🔄 业务场景代码

### 1. 用户购买付费合约

```javascript
// 用户购买30天付费合约
async function purchaseMiningContract(userId, contractType, durationDays, hashrate, paymentAmount) {
  const t = await sequelize.transaction();
  
  try {
    // 1. 扣除用户余额
    const userStatus = await UserStatus.findOne({
      where: { user_id: userId },
      transaction: t
    });
    
    if (userStatus.current_bitcoin_balance < paymentAmount) {
      throw new Error('余额不足');
    }
    
    await userStatus.decrement('current_bitcoin_balance', {
      by: paymentAmount,
      transaction: t
    });
    
    // 2. 计算合约时间
    const creationTime = new Date();
    const endTime = new Date(creationTime.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const durationHours = durationDays * 24;
    
    // 3. 创建挖矿合约
    const contract = await MiningContract.create({
      user_id: userId,
      contract_type: contractType,
      contract_creation_time: creationTime,
      contract_end_time: endTime,
      contract_duration: `${durationHours}:00:00`,
      hashrate: hashrate,
      mining_status: 'mining'
    }, { transaction: t });
    
    // 4. 记录交易
    await BitcoinTransactionRecord.create({
      user_id: userId,
      transaction_type: contractType,
      transaction_amount: paymentAmount,
      transaction_status: 'success'
    }, { transaction: t });
    
    await t.commit();
    return contract;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

// 使用示例
await purchaseMiningContract(
  'USER001',
  'paid contract',
  30,  // 30天
  0.00001,  // 算力
  0.001  // 支付0.001 BTC
);
```

### 2. 广告免费合约奖励

```javascript
// 用户看完广告,获得6小时免费挖矿
async function giveAdFreeContract(userId) {
  const durationHours = 6;
  const creationTime = new Date();
  const endTime = new Date(creationTime.getTime() + durationHours * 60 * 60 * 1000);
  
  const contract = await MiningContract.create({
    user_id: userId,
    contract_type: 'ad free contract',
    contract_creation_time: creationTime,
    contract_end_time: endTime,
    contract_duration: '06:00:00',
    hashrate: 0.000001,  // 较低算力
    mining_status: 'mining'
  });
  
  // 记录交易
  await BitcoinTransactionRecord.create({
    user_id: userId,
    transaction_type: 'ad free contract',
    transaction_amount: 0,  // 免费
    transaction_status: 'success'
  });
  
  return contract;
}
```

### 3. 每日签到合约

```javascript
// 用户每日签到获得24小时免费挖矿
async function giveDailySignInContract(userId) {
  // 检查今天是否已签到
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const existingContract = await MiningContract.findOne({
    where: {
      user_id: userId,
      contract_type: 'daily sign-in free contract',
      contract_creation_time: {
        [Op.gte]: today
      }
    }
  });
  
  if (existingContract) {
    throw new Error('今日已签到,请明天再来');
  }
  
  // 创建24小时签到合约
  const creationTime = new Date();
  const endTime = new Date(creationTime.getTime() + 24 * 60 * 60 * 1000);
  
  const contract = await MiningContract.create({
    user_id: userId,
    contract_type: 'daily sign-in free contract',
    contract_creation_time: creationTime,
    contract_end_time: endTime,
    contract_duration: '24:00:00',
    hashrate: 0.000002,
    mining_status: 'mining'
  });
  
  return contract;
}
```

### 4. 邀请奖励合约

```javascript
// 用户成功邀请新用户,获得48小时免费挖矿
async function giveInvitationContract(referrerId) {
  const durationHours = 48;
  const creationTime = new Date();
  const endTime = new Date(creationTime.getTime() + durationHours * 60 * 60 * 1000);
  
  const contract = await MiningContract.create({
    user_id: referrerId,
    contract_type: 'invitation free contract',
    contract_creation_time: creationTime,
    contract_end_time: endTime,
    contract_duration: '48:00:00',
    hashrate: 0.000005,  // 较高算力奖励
    mining_status: 'mining'
  });
  
  return contract;
}
```

---

## ⏰ 定时任务: 更新合约状态

### 自动检查并更新到期合约

```javascript
const cron = require('node-cron');

// 每小时检查一次过期合约
async function updateExpiredContracts() {
  const now = new Date();
  
  // 查找所有已过期但状态仍为 'mining' 的合约
  const expiredContracts = await MiningContract.findAll({
    where: {
      mining_status: 'mining',
      contract_end_time: {
        [Op.lte]: now
      }
    }
  });
  
  console.log(`发现 ${expiredContracts.length} 个过期合约`);
  
  // 批量更新状态为 'completed'
  for (const contract of expiredContracts) {
    await contract.update({ mining_status: 'completed' });
    console.log(`合约 ${contract.id} 已标记为完成`);
  }
  
  return expiredContracts.length;
}

// 启动定时任务 - 每小时执行一次
function startContractStatusScheduler() {
  cron.schedule('0 * * * *', async () => {
    console.log('[定时任务] 开始检查过期合约...');
    try {
      const count = await updateExpiredContracts();
      console.log(`[定时任务] 已更新 ${count} 个过期合约`);
    } catch (error) {
      console.error('[定时任务] 更新合约状态失败:', error);
    }
  });
  
  console.log('[定时任务] 合约状态检查器已启动 - 每小时执行');
}

module.exports = { startContractStatusScheduler, updateExpiredContracts };
```

---

## ⛏️ 挖矿收益计算

### 计算合约每日收益

```javascript
// 根据算力计算每日收益
function calculateDailyReward(hashrate, contractType) {
  // 基础收益率(可配置)
  const baseRewardRate = 0.00001; // 每单位算力每天的基础收益
  
  // 合约类型加成
  const bonusMultiplier = {
    'ad free contract': 1.0,
    'daily sign-in free contract': 1.2,
    'invitation free contract': 1.5,
    'paid contract': 2.0
  };
  
  const multiplier = bonusMultiplier[contractType] || 1.0;
  const dailyReward = hashrate * baseRewardRate * multiplier;
  
  return dailyReward;
}

// 使用示例
const hashrate = 0.00001;
const contractType = 'paid contract';
const dailyReward = calculateDailyReward(hashrate, contractType);
console.log(`每日收益: ${dailyReward} BTC`);
```

### 定时发放挖矿收益

```javascript
const cron = require('node-cron');

// 每天凌晨2点发放所有活跃合约的收益
async function distributeAllMiningRewards() {
  // 查找所有挖矿中的合约
  const activeContracts = await MiningContract.findAll({
    where: { mining_status: 'mining' }
  });
  
  console.log(`开始发放 ${activeContracts.length} 个活跃合约的收益`);
  
  for (const contract of activeContracts) {
    try {
      // 计算收益
      const dailyReward = calculateDailyReward(
        contract.hashrate,
        contract.contract_type
      );
      
      // 更新用户余额
      await UserStatus.increment('bitcoin_accumulated_amount', {
        by: dailyReward,
        where: { user_id: contract.user_id }
      });
      
      await UserStatus.increment('current_bitcoin_balance', {
        by: dailyReward,
        where: { user_id: contract.user_id }
      });
      
      // 记录交易
      await BitcoinTransactionRecord.create({
        user_id: contract.user_id,
        transaction_type: contract.contract_type,
        transaction_amount: dailyReward,
        transaction_status: 'success'
      });
      
      console.log(`用户 ${contract.user_id} 获得收益: ${dailyReward} BTC`);
    } catch (error) {
      console.error(`发放收益失败 - 合约 ${contract.id}:`, error);
    }
  }
}

// 启动挖矿收益发放定时任务
function startMiningRewardScheduler() {
  // 每天凌晨2点执行
  cron.schedule('0 2 * * *', async () => {
    console.log('[定时任务] 开始发放挖矿收益...');
    try {
      await distributeAllMiningRewards();
      console.log('[定时任务] 挖矿收益发放完成');
    } catch (error) {
      console.error('[定时任务] 发放挖矿收益失败:', error);
    }
  });
  
  console.log('[定时任务] 挖矿收益发放器已启动 - 每天凌晨2点执行');
}

module.exports = { startMiningRewardScheduler, distributeAllMiningRewards };
```

---

## 🔍 常用查询

### 1. 查询用户的所有合约
```javascript
const contracts = await MiningContract.findAll({
  where: { user_id: 'USER001' },
  order: [['contract_creation_time', 'DESC']]
});
```

### 2. 查询用户当前活跃的合约
```javascript
const activeContracts = await MiningContract.findAll({
  where: {
    user_id: 'USER001',
    mining_status: 'mining'
  }
});

console.log(`用户有 ${activeContracts.length} 个活跃合约`);
```

### 3. 统计用户的总算力
```javascript
const { fn, col } = require('sequelize');

const totalHashrate = await MiningContract.findOne({
  attributes: [
    [fn('SUM', col('hashrate')), 'total_hashrate']
  ],
  where: {
    user_id: 'USER001',
    mining_status: 'mining'
  }
});

console.log(`总算力: ${totalHashrate.get('total_hashrate')}`);
```

### 4. 查询即将到期的合约
```javascript
const { Op } = require('sequelize');

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

const expiringSoon = await MiningContract.findAll({
  where: {
    mining_status: 'mining',
    contract_end_time: {
      [Op.lte]: tomorrow
    }
  }
});

console.log(`${expiringSoon.length} 个合约即将到期`);
```

### 5. 统计各类型合约数量
```javascript
const contractStats = await MiningContract.findAll({
  attributes: [
    'contract_type',
    [fn('COUNT', col('id')), 'count'],
    [fn('SUM', col('hashrate')), 'total_hashrate']
  ],
  where: { mining_status: 'mining' },
  group: ['contract_type']
});

console.log('合约类型统计:');
contractStats.forEach(stat => {
  console.log(`${stat.contract_type}: ${stat.get('count')}个, 总算力: ${stat.get('total_hashrate')}`);
});
```

---

## ⚠️ 重要注意事项

### 1. hashrate 字段精度问题
```javascript
// 当前: DECIMAL(18,18) - 只能存储 0-1 之间的值
// 如果算力值可能 ≥ 1,建议修改为:
ALTER TABLE mining_contracts 
MODIFY COLUMN hashrate DECIMAL(20, 8);
```

### 2. contract_duration 字段的使用
```javascript
// TIME 类型存储时长(小时:分钟:秒)
// 示例:
'06:00:00'  // 6小时
'24:00:00'  // 24小时
'720:00:00' // 30天(720小时)

// 注意: MySQL TIME 类型最大值是 838:59:59
// 如果合约时长超过838小时(约35天),需要特殊处理
```

### 3. 防止重复发放收益
```javascript
// 在 bitcoin_transaction_records 中记录每次收益
// 可以通过日期去重,避免同一天多次发放
async function checkDailyRewardDistributed(userId, contractId, date) {
  const existing = await BitcoinTransactionRecord.findOne({
    where: {
      user_id: userId,
      transaction_type: 'mining reward',
      transaction_creation_time: {
        [Op.gte]: date,
        [Op.lt]: new Date(date.getTime() + 24 * 60 * 60 * 1000)
      }
    }
  });
  
  return existing !== null;
}
```

### 4. 合约叠加效果
```javascript
// 用户可以同时拥有多个活跃合约
// 总算力 = 所有活跃合约的 hashrate 之和
async function getTotalHashrate(userId) {
  const result = await MiningContract.sum('hashrate', {
    where: {
      user_id: userId,
      mining_status: 'mining'
    }
  });
  
  return result || 0;
}
```

---

## 📈 数据分析

### 合约续费率分析
```javascript
// 统计用户的合约续费情况
async function getContractRenewalRate(userId) {
  const allContracts = await MiningContract.findAll({
    where: {
      user_id: userId,
      contract_type: 'paid contract'
    },
    order: [['contract_creation_time', 'ASC']]
  });
  
  if (allContracts.length < 2) {
    return { renewalRate: 0, totalContracts: allContracts.length };
  }
  
  let renewalCount = 0;
  
  for (let i = 1; i < allContracts.length; i++) {
    const prevEndTime = allContracts[i - 1].contract_end_time;
    const currentStartTime = allContracts[i].contract_creation_time;
    
    // 如果在结束后7天内续费,算作续费
    const daysDiff = (currentStartTime - prevEndTime) / (1000 * 60 * 60 * 24);
    
    if (daysDiff <= 7) {
      renewalCount++;
    }
  }
  
  return {
    renewalRate: renewalCount / (allContracts.length - 1),
    totalContracts: allContracts.length,
    renewals: renewalCount
  };
}
```

### 合约收益预估
```javascript
// 预估合约总收益
async function estimateContractTotalReward(contractId) {
  const contract = await MiningContract.findByPk(contractId);
  
  if (!contract) {
    throw new Error('合约不存在');
  }
  
  // 计算合约总天数
  const startTime = contract.contract_creation_time;
  const endTime = contract.contract_end_time;
  const totalDays = (endTime - startTime) / (1000 * 60 * 60 * 24);
  
  // 计算每日收益
  const dailyReward = calculateDailyReward(contract.hashrate, contract.contract_type);
  
  // 总收益
  const totalReward = dailyReward * totalDays;
  
  return {
    totalDays: totalDays,
    dailyReward: dailyReward,
    totalReward: totalReward,
    status: contract.mining_status
  };
}
```

---

## 💡 数据库优化建议

### 当前索引配置 ✅
```sql
CREATE INDEX idx_user_id ON mining_contracts(user_id);
CREATE INDEX idx_contract_type ON mining_contracts(contract_type);
CREATE INDEX idx_mining_status ON mining_contracts(mining_status);
CREATE INDEX idx_contract_creation_time ON mining_contracts(contract_creation_time);
CREATE INDEX idx_contract_end_time ON mining_contracts(contract_end_time);
CREATE INDEX idx_user_status ON mining_contracts(user_id, mining_status);
```

### 外键约束(可选)
```sql
ALTER TABLE mining_contracts
ADD CONSTRAINT fk_contract_user
FOREIGN KEY (user_id) REFERENCES user_information(user_id)
ON DELETE CASCADE;
```

---

## 🎯 总结

**核心功能:**
- 管理用户的挖矿合约(免费/付费)
- 记录合约类型、时长、算力
- 追踪合约状态(挖矿中/已完成/错误)
- 支持多种合约类型(广告/签到/邀请/付费)

**业务价值:**
- 激励用户活跃(广告、签到合约)
- 推广拉新(邀请合约)
- 核心变现(付费合约)
- 收益计算基础(算力 × 时长)

**技术要点:**
- ⚠️ hashrate 使用 DECIMAL(18,18),可能需要调整
- ✅ 定时任务自动更新过期合约状态
- ✅ 定时任务每日发放挖矿收益
- ✅ 支持合约叠加(多个合约同时运行)
- ✅ 防止重复发放收益
