# free_contract_records 表结构说明

## 📋 表字段详解

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| **id** | int(11) | 主键,自增ID | 1, 2, 3... |
| **user_id** | varchar(15) | 用户唯一标识符 | "USER001" |
| **free_contract_type** | enum NULL | 免费合约类型 | "ad free contract" |
| **free_contract_revenue** | decimal(18,18) NULL | 合约收益金额 | 0.00001 |
| **free_contract_creation_time** | timestamp | 合约创建时间 | 2025-11-24 10:00:00 |
| **free_contract_end_time** | timestamp | 合约结束时间 | 2025-11-24 16:00:00 |
| **hashrate** | decimal(18,18) NULL | 算力值 | 0.000001 |
| **mining_status** | enum NULL | 挖矿状态 | "mining" |

---

## 🆚 与 mining_contracts 表的区别

### mining_contracts (主合约表)
- 存储**所有类型**的合约(免费+付费)
- 字段完整,包含 contract_duration
- 用于合约管理和状态追踪

### free_contract_records (免费合约记录表)
- **仅存储免费合约**的历史记录
- 更像是免费合约的**日志表/快照表**
- 可能用于统计分析、审计追踪
- 字段相对简化

**关系:** 这两个表可能存在**冗余设计**,免费合约会同时记录在两个表中。

---

## 📊 免费合约类型详解

### free_contract_type 枚举值:

1. **ad free contract** - 广告免费合约
   - 用户观看广告获得
   - 短时长(几小时)
   - 低算力

2. **daily sign-in free contract** - 每日签到免费合约
   - 每日签到奖励
   - 固定24小时
   - 激励每日活跃

3. **invitation free contract** - 邀请免费合约
   - 邀请新用户注册奖励
   - 中等时长(48小时)
   - 较高算力

**注意:** 这个表**不包含 paid contract**(付费合约),只记录免费合约。

---

## 🔄 业务场景代码

### 1. 创建广告免费合约记录

```javascript
// 用户看完广告,同时在两个表创建记录
async function createAdFreeContract(userId) {
  const durationHours = 6;
  const creationTime = new Date();
  const endTime = new Date(creationTime.getTime() + durationHours * 60 * 60 * 1000);
  const hashrate = 0.000001;
  const revenue = hashrate * durationHours * 0.00001; // 预计收益
  
  const t = await sequelize.transaction();
  
  try {
    // 1. 在主合约表创建记录
    await MiningContract.create({
      user_id: userId,
      contract_type: 'ad free contract',
      contract_creation_time: creationTime,
      contract_end_time: endTime,
      contract_duration: '06:00:00',
      hashrate: hashrate,
      mining_status: 'mining'
    }, { transaction: t });
    
    // 2. 在免费合约记录表创建快照
    await FreeContractRecord.create({
      user_id: userId,
      free_contract_type: 'ad free contract',
      free_contract_revenue: revenue,
      free_contract_creation_time: creationTime,
      free_contract_end_time: endTime,
      hashrate: hashrate,
      mining_status: 'mining'
    }, { transaction: t });
    
    // 3. 记录交易
    await BitcoinTransactionRecord.create({
      user_id: userId,
      transaction_type: 'ad free contract',
      transaction_amount: 0,  // 免费获得
      transaction_status: 'success'
    }, { transaction: t });
    
    await t.commit();
    console.log('广告免费合约创建成功');
  } catch (error) {
    await t.rollback();
    throw error;
  }
}
```

### 2. 创建每日签到合约记录

```javascript
// 用户每日签到
async function createDailySignInContract(userId) {
  // 检查今天是否已签到
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const existingRecord = await FreeContractRecord.findOne({
    where: {
      user_id: userId,
      free_contract_type: 'daily sign-in free contract',
      free_contract_creation_time: {
        [Op.gte]: today
      }
    }
  });
  
  if (existingRecord) {
    throw new Error('今日已签到,请明天再来');
  }
  
  const creationTime = new Date();
  const endTime = new Date(creationTime.getTime() + 24 * 60 * 60 * 1000);
  const hashrate = 0.000002;
  const revenue = hashrate * 24 * 0.00001;
  
  // 创建记录
  await FreeContractRecord.create({
    user_id: userId,
    free_contract_type: 'daily sign-in free contract',
    free_contract_revenue: revenue,
    free_contract_creation_time: creationTime,
    free_contract_end_time: endTime,
    hashrate: hashrate,
    mining_status: 'mining'
  });
  
  console.log('签到成功,获得24小时免费挖矿');
}
```

### 3. 创建邀请奖励合约记录

```javascript
// 成功邀请新用户
async function createInvitationContract(referrerId) {
  const creationTime = new Date();
  const endTime = new Date(creationTime.getTime() + 48 * 60 * 60 * 1000);
  const hashrate = 0.000005;
  const revenue = hashrate * 48 * 0.00001;
  
  await FreeContractRecord.create({
    user_id: referrerId,
    free_contract_type: 'invitation free contract',
    free_contract_revenue: revenue,
    free_contract_creation_time: creationTime,
    free_contract_end_time: endTime,
    hashrate: hashrate,
    mining_status: 'mining'
  });
  
  console.log('邀请奖励合约创建成功');
}
```

---

## 🔍 常用查询

### 1. 查询用户的所有免费合约记录
```javascript
const freeContracts = await FreeContractRecord.findAll({
  where: { user_id: 'USER001' },
  order: [['free_contract_creation_time', 'DESC']]
});

console.log(`用户共有 ${freeContracts.length} 条免费合约记录`);
```

### 2. 统计用户获得的免费合约总收益
```javascript
const { fn, col } = require('sequelize');

const totalRevenue = await FreeContractRecord.findOne({
  attributes: [
    [fn('SUM', col('free_contract_revenue')), 'total']
  ],
  where: { user_id: 'USER001' }
});

console.log(`免费合约总收益: ${totalRevenue.get('total')} BTC`);
```

### 3. 统计各类型免费合约数量
```javascript
const stats = await FreeContractRecord.findAll({
  attributes: [
    'free_contract_type',
    [fn('COUNT', col('id')), 'count'],
    [fn('SUM', col('free_contract_revenue')), 'total_revenue']
  ],
  where: { user_id: 'USER001' },
  group: ['free_contract_type']
});

console.log('免费合约统计:');
stats.forEach(s => {
  console.log(`${s.free_contract_type}: ${s.get('count')}次, 收益: ${s.get('total_revenue')} BTC`);
});
```

### 4. 查询今天的签到记录
```javascript
const { Op } = require('sequelize');

const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const todaySignIn = await FreeContractRecord.findOne({
  where: {
    user_id: 'USER001',
    free_contract_type: 'daily sign-in free contract',
    free_contract_creation_time: {
      [Op.gte]: today,
      [Op.lt]: tomorrow
    }
  }
});

if (todaySignIn) {
  console.log('今日已签到');
} else {
  console.log('今日未签到');
}
```

### 5. 查询活跃的免费合约
```javascript
const activeContracts = await FreeContractRecord.findAll({
  where: {
    user_id: 'USER001',
    mining_status: 'mining'
  }
});

console.log(`有 ${activeContracts.length} 个活跃的免费合约`);
```

---

## 📊 统计分析

### 用户免费合约活跃度分析

```javascript
// 分析用户的免费合约使用情况
async function analyzeFreeContractActivity(userId) {
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // 最近30天的免费合约记录
  const recentContracts = await FreeContractRecord.findAll({
    where: {
      user_id: userId,
      free_contract_creation_time: {
        [Op.gte]: last30Days
      }
    }
  });
  
  // 按类型分组统计
  const adCount = recentContracts.filter(c => c.free_contract_type === 'ad free contract').length;
  const signInCount = recentContracts.filter(c => c.free_contract_type === 'daily sign-in free contract').length;
  const invitationCount = recentContracts.filter(c => c.free_contract_type === 'invitation free contract').length;
  
  // 计算总收益
  const totalRevenue = recentContracts.reduce((sum, c) => sum + parseFloat(c.free_contract_revenue || 0), 0);
  
  return {
    totalContracts: recentContracts.length,
    adFreeContracts: adCount,
    dailySignIns: signInCount,
    invitationContracts: invitationCount,
    totalRevenue: totalRevenue,
    avgRevenuePerContract: totalRevenue / recentContracts.length || 0
  };
}

// 使用示例
const activity = await analyzeFreeContractActivity('USER001');
console.log('最近30天免费合约活跃度:', activity);
```

### 签到连续天数统计

```javascript
// 计算用户的连续签到天数
async function getSignInStreak(userId) {
  const signInRecords = await FreeContractRecord.findAll({
    where: {
      user_id: userId,
      free_contract_type: 'daily sign-in free contract'
    },
    order: [['free_contract_creation_time', 'DESC']],
    limit: 100  // 最多查询100天
  });
  
  if (signInRecords.length === 0) {
    return { streak: 0, lastSignIn: null };
  }
  
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < signInRecords.length; i++) {
    const recordDate = new Date(signInRecords[i].free_contract_creation_time);
    recordDate.setHours(0, 0, 0, 0);
    
    const expectedDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    
    if (recordDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }
  
  return {
    streak: streak,
    lastSignIn: signInRecords[0].free_contract_creation_time
  };
}

// 使用示例
const streakInfo = await getSignInStreak('USER001');
console.log(`连续签到 ${streakInfo.streak} 天`);
```

---

## ⚠️ 重要注意事项

### 1. 与 mining_contracts 表的数据同步

```javascript
// 确保两个表数据一致
// 定期检查数据同步情况
async function checkDataConsistency() {
  // 查找 mining_contracts 中的免费合约
  const miningContracts = await MiningContract.count({
    where: {
      contract_type: {
        [Op.in]: ['ad free contract', 'daily sign-in free contract', 'invitation free contract']
      }
    }
  });
  
  // 查找 free_contract_records 中的记录
  const freeRecords = await FreeContractRecord.count();
  
  console.log(`mining_contracts 中的免费合约: ${miningContracts}`);
  console.log(`free_contract_records 中的记录: ${freeRecords}`);
  
  if (miningContracts !== freeRecords) {
    console.warn('⚠️ 警告: 两个表的数据不一致!');
  }
}
```

### 2. revenue 字段精度问题

```javascript
// free_contract_revenue: DECIMAL(18,18)
// 只能存储 0-1 之间的值
// 如果需要存储更大的收益,建议修改为:
ALTER TABLE free_contract_records 
MODIFY COLUMN free_contract_revenue DECIMAL(20, 8);
```

### 3. 字段可为 NULL

```javascript
// 很多字段允许 NULL,查询时需要处理
const contract = await FreeContractRecord.findByPk(1);

if (contract.free_contract_revenue === null) {
  console.log('该合约还没有计算收益');
}

if (contract.mining_status === null) {
  console.log('该合约状态未设置');
}
```

### 4. 时间字段都是 TIMESTAMP

```javascript
// MySQL TIMESTAMP 有时区问题
// Sequelize 会自动处理时区转换
// 确保服务器和数据库时区设置一致
```

---

## 🔗 表关系设计建议

### 当前设计的问题

**数据冗余:**
- 免费合约同时存在于 `mining_contracts` 和 `free_contract_records`
- 两个表需要保持同步
- 增加维护成本

### 优化建议

**方案1: 合并表**
```javascript
// 只使用 mining_contracts 一个表
// 删除 free_contract_records 表
// 优点: 数据一致性好,维护简单
// 缺点: 失去专门的免费合约记录
```

**方案2: 明确职责**
```javascript
// mining_contracts: 活跃合约(mining 状态)
// free_contract_records: 历史记录(completed 状态)

// 当合约完成时,从 mining_contracts 移动到 free_contract_records
async function archiveCompletedFreeContracts() {
  const completed = await MiningContract.findAll({
    where: {
      mining_status: 'completed',
      contract_type: {
        [Op.in]: ['ad free contract', 'daily sign-in free contract', 'invitation free contract']
      }
    }
  });
  
  for (const contract of completed) {
    // 归档到 free_contract_records
    await FreeContractRecord.create({
      user_id: contract.user_id,
      free_contract_type: contract.contract_type,
      free_contract_revenue: contract.hashrate * 24 * 0.00001, // 计算实际收益
      free_contract_creation_time: contract.contract_creation_time,
      free_contract_end_time: contract.contract_end_time,
      hashrate: contract.hashrate,
      mining_status: 'completed'
    });
    
    // 从 mining_contracts 删除
    await contract.destroy();
  }
}
```

---

## 💡 数据库优化建议

### 当前索引配置 ✅
```sql
CREATE INDEX idx_user_id ON free_contract_records(user_id);
CREATE INDEX idx_free_contract_type ON free_contract_records(free_contract_type);
CREATE INDEX idx_mining_status ON free_contract_records(mining_status);
CREATE INDEX idx_free_contract_creation_time ON free_contract_records(free_contract_creation_time);
CREATE INDEX idx_user_status ON free_contract_records(user_id, mining_status);
```

### 外键约束(可选)
```sql
ALTER TABLE free_contract_records
ADD CONSTRAINT fk_free_contract_user
FOREIGN KEY (user_id) REFERENCES user_information(user_id)
ON DELETE CASCADE;
```

---

## 🎯 总结

**表的作用:**
- 专门记录免费合约的历史数据
- 用于统计分析用户的免费合约使用情况
- 可能用于审计和数据分析

**与 mining_contracts 的关系:**
- 存在数据冗余
- 需要保持同步
- 建议明确两个表的职责划分

**技术要点:**
- ⚠️ revenue 和 hashrate 都是 DECIMAL(18,18)
- ✅ 字段多为 NULL,需要处理空值
- ✅ 仅包含免费合约类型(不含 paid contract)
- ✅ 时间字段为 TIMESTAMP 类型

**业务价值:**
- 追踪用户的免费合约使用历史
- 统计签到连续性
- 分析免费合约的转化效果
- 计算免费合约的总收益贡献
