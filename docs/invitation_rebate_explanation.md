# invitation_rebate 表结构说明

## 📋 表字段详解

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| **id** | int(11) | 主键,自增ID | 1, 2, 3... |
| **user_id** | varchar(15) | **获得返利的用户ID**(上级/邀请人) | "USER001" |
| **invitation_code** | varchar(11) | **上级用户的邀请码** | "CODE_A" |
| **subordinate_user_id** | varchar(15) NULL | **产生返利的下级用户ID** | "USER002" 或 NULL |
| **subordinate_user_invitation_code** | varchar(11) NULL | **下级用户的邀请码** | "CODE_B" 或 NULL |
| **subordinate_rebate_amount** | decimal(18,18) NULL | **返利金额**(比特币数量) | 0.00001 |
| **rebate_creation_time** | timestamp | 返利创建时间 | 2025-11-23 10:30:00 |

---

## 🔄 返利逻辑解析

### 核心概念
这个表记录的是**上级用户获得的返利明细**,每当下级用户产生收益时,上级会获得一定比例的返利。

### 场景示例

#### 场景1: 用户B通过用户A的邀请码注册
```javascript
// 步骤1: B注册成功,给A发放注册奖励
{
  id: 1,
  user_id: "USER001",              // A获得返利(上级)
  invitation_code: "CODE_A",       // A的邀请码
  subordinate_user_id: "USER002",  // B是下级
  subordinate_user_invitation_code: "CODE_B",  // B的邀请码
  subordinate_rebate_amount: 0.00001,  // 注册奖励金额
  rebate_creation_time: "2025-11-23 10:00:00"
}
```

#### 场景2: 用户B挖矿获得收益,上级A获得返利
```javascript
// B挖矿获得 0.001 BTC,A获得10%返利 = 0.0001 BTC
{
  id: 2,
  user_id: "USER001",              // A获得返利
  invitation_code: "CODE_A",
  subordinate_user_id: "USER002",  // 是B的挖矿收益产生的返利
  subordinate_user_invitation_code: "CODE_B",
  subordinate_rebate_amount: 0.0001,  // 返利金额
  rebate_creation_time: "2025-11-23 11:00:00"
}
```

#### 场景3: 多级返利(如果支持)
```javascript
// 用户关系: A -> B -> C
// C挖矿获得 0.001 BTC

// B获得一级返利(10%)
{
  user_id: "USER002",              // B获得返利
  subordinate_user_id: "USER003",  // 来自C
  subordinate_rebate_amount: 0.0001
}

// A获得二级返利(5%)
{
  user_id: "USER001",              // A获得返利
  subordinate_user_id: "USER003",  // 来自C(孙级)
  subordinate_rebate_amount: 0.00005
}
```

---

## 🎯 业务场景代码

### 1. 用户注册时发放邀请奖励

```javascript
// 当用户B通过A的邀请码注册成功后
async function giveRegistrationRebate(referrerId, referrerCode, newUserId, newUserCode) {
  const rebateAmount = 0.00001; // 注册奖励金额
  
  // 1. 创建返利记录
  await InvitationRebate.create({
    user_id: referrerId,
    invitation_code: referrerCode,
    subordinate_user_id: newUserId,
    subordinate_user_invitation_code: newUserCode,
    subordinate_rebate_amount: rebateAmount
  });
  
  // 2. 更新上级用户的总返利金额
  await UserStatus.increment('total_invitation_rebate', {
    by: rebateAmount,
    where: { user_id: referrerId }
  });
  
  // 3. 更新上级用户的比特币余额
  await UserStatus.increment('current_bitcoin_balance', {
    by: rebateAmount,
    where: { user_id: referrerId }
  });
  
  // 4. 记录交易
  await BitcoinTransactionRecord.create({
    user_id: referrerId,
    transaction_type: 'invitation free contract',
    transaction_amount: rebateAmount,
    transaction_status: 'success'
  });
}
```

### 2. 下级挖矿时发放返利

```javascript
// 当用户B挖矿获得收益时,给上级A发放返利
async function giveMiningRebate(userId, miningAmount) {
  // 1. 查找用户的上级(推荐人)
  const relationship = await InvitationRelationship.findOne({
    where: { user_id: userId }
  });
  
  if (!relationship || !relationship.referrer_user_id) {
    console.log('该用户没有推荐人,无需发放返利');
    return;
  }
  
  // 2. 计算返利金额(假设10%返利)
  const rebateRate = 0.10;
  const rebateAmount = miningAmount * rebateRate;
  
  // 3. 获取用户邀请码
  const userInfo = await InvitationRelationship.findOne({
    where: { user_id: userId }
  });
  
  const referrerInfo = await InvitationRelationship.findOne({
    where: { user_id: relationship.referrer_user_id }
  });
  
  // 4. 创建返利记录
  await InvitationRebate.create({
    user_id: relationship.referrer_user_id,
    invitation_code: referrerInfo.invitation_code,
    subordinate_user_id: userId,
    subordinate_user_invitation_code: userInfo.invitation_code,
    subordinate_rebate_amount: rebateAmount
  });
  
  // 5. 更新上级余额
  await UserStatus.increment('total_invitation_rebate', {
    by: rebateAmount,
    where: { user_id: relationship.referrer_user_id }
  });
  
  await UserStatus.increment('current_bitcoin_balance', {
    by: rebateAmount,
    where: { user_id: relationship.referrer_user_id }
  });
  
  // 6. 记录交易
  await BitcoinTransactionRecord.create({
    user_id: relationship.referrer_user_id,
    transaction_type: 'subordinate rebate',
    transaction_amount: rebateAmount,
    transaction_status: 'success'
  });
}
```

### 3. 多级返利实现

```javascript
// 递归向上发放多级返利
async function giveMultiLevelRebate(userId, miningAmount, maxLevel = 2) {
  const rebateRates = [0.10, 0.05, 0.02]; // 一级10%,二级5%,三级2%
  
  let currentUser = userId;
  let level = 0;
  
  while (currentUser && level < maxLevel) {
    // 查找上级
    const relationship = await InvitationRelationship.findOne({
      where: { user_id: currentUser }
    });
    
    if (!relationship || !relationship.referrer_user_id) {
      break; // 没有上级了
    }
    
    // 计算返利
    const rebateAmount = miningAmount * rebateRates[level];
    
    // 获取邀请码信息
    const currentUserInfo = await InvitationRelationship.findOne({
      where: { user_id: currentUser }
    });
    
    const referrerInfo = await InvitationRelationship.findOne({
      where: { user_id: relationship.referrer_user_id }
    });
    
    // 创建返利记录
    await InvitationRebate.create({
      user_id: relationship.referrer_user_id,
      invitation_code: referrerInfo.invitation_code,
      subordinate_user_id: userId, // 原始产生收益的用户
      subordinate_user_invitation_code: currentUserInfo.invitation_code,
      subordinate_rebate_amount: rebateAmount
    });
    
    // 更新余额
    await UserStatus.increment('total_invitation_rebate', {
      by: rebateAmount,
      where: { user_id: relationship.referrer_user_id }
    });
    
    await UserStatus.increment('current_bitcoin_balance', {
      by: rebateAmount,
      where: { user_id: relationship.referrer_user_id }
    });
    
    // 向上一层
    currentUser = relationship.referrer_user_id;
    level++;
  }
}
```

---

## 🔍 常用查询

### 1. 查询用户获得的所有返利
```javascript
// 查询用户A获得的所有返利
const rebates = await InvitationRebate.findAll({
  where: { user_id: 'USER001' },
  order: [['rebate_creation_time', 'DESC']]
});

console.log(`用户A共获得 ${rebates.length} 笔返利`);
```

### 2. 统计用户的总返利金额
```javascript
// 使用 Sequelize 聚合查询
const { fn, col } = require('sequelize');

const totalRebate = await InvitationRebate.findOne({
  attributes: [
    [fn('SUM', col('subordinate_rebate_amount')), 'total']
  ],
  where: { user_id: 'USER001' }
});

console.log(`总返利: ${totalRebate.get('total')} BTC`);
```

### 3. 查询某个下级产生的所有返利
```javascript
// 查询用户B给上级带来的所有返利
const rebates = await InvitationRebate.findAll({
  where: { subordinate_user_id: 'USER002' }
});
```

### 4. 查询最近7天的返利记录
```javascript
const { Op } = require('sequelize');

const recentRebates = await InvitationRebate.findAll({
  where: {
    user_id: 'USER001',
    rebate_creation_time: {
      [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }
  }
});
```

### 5. 统计每个下级的贡献
```javascript
// 统计每个下级给用户A带来的返利总额
const contributions = await InvitationRebate.findAll({
  attributes: [
    'subordinate_user_id',
    [fn('SUM', col('subordinate_rebate_amount')), 'total_contribution'],
    [fn('COUNT', col('id')), 'rebate_count']
  ],
  where: { user_id: 'USER001' },
  group: ['subordinate_user_id'],
  order: [[fn('SUM', col('subordinate_rebate_amount')), 'DESC']]
});

console.log('下级贡献排行:');
contributions.forEach(c => {
  console.log(`${c.subordinate_user_id}: ${c.get('total_contribution')} BTC (${c.get('rebate_count')}笔)`);
});
```

---

## 📊 统计分析

### 1. 返利趋势分析
```javascript
// 按月统计返利金额
const monthlyRebates = await sequelize.query(`
  SELECT 
    DATE_FORMAT(rebate_creation_time, '%Y-%m') as month,
    COUNT(*) as rebate_count,
    SUM(subordinate_rebate_amount) as total_amount
  FROM invitation_rebate
  WHERE user_id = :userId
  GROUP BY month
  ORDER BY month DESC
`, {
  replacements: { userId: 'USER001' },
  type: QueryTypes.SELECT
});
```

### 2. 返利来源分析
```javascript
// 分析返利来自直属下级还是间接下级
async function analyzeRebateSource(userId) {
  // 获取直属下级列表
  const directSubordinates = await InvitationRelationship.findAll({
    where: { referrer_user_id: userId },
    attributes: ['user_id']
  });
  
  const directIds = directSubordinates.map(s => s.user_id);
  
  // 统计直属返利
  const directRebates = await InvitationRebate.findAll({
    attributes: [[fn('SUM', col('subordinate_rebate_amount')), 'total']],
    where: {
      user_id: userId,
      subordinate_user_id: { [Op.in]: directIds }
    }
  });
  
  // 统计间接返利
  const indirectRebates = await InvitationRebate.findAll({
    attributes: [[fn('SUM', col('subordinate_rebate_amount')), 'total']],
    where: {
      user_id: userId,
      subordinate_user_id: { [Op.notIn]: directIds }
    }
  });
  
  return {
    direct: directRebates[0].get('total') || 0,
    indirect: indirectRebates[0].get('total') || 0
  };
}
```

---

## 🔗 关联关系

### 在 models/index.js 中添加关联

```javascript
// 返利记录与用户信息关联
InvitationRebate.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'user'  // 获得返利的用户
});

InvitationRebate.belongsTo(UserInformation, {
  foreignKey: 'subordinate_user_id',
  targetKey: 'user_id',
  as: 'subordinate'  // 产生返利的下级用户
});

// 使用示例: 查询返利记录并包含用户信息
const rebate = await InvitationRebate.findOne({
  where: { id: 1 },
  include: [
    { model: UserInformation, as: 'user' },        // 上级信息
    { model: UserInformation, as: 'subordinate' }  // 下级信息
  ]
});

console.log(`${rebate.user.user_id} 从 ${rebate.subordinate.user_id} 获得返利`);
```

---

## ⚠️ 重要注意事项

### 1. subordinate_rebate_amount 字段精度问题
```javascript
// 当前: DECIMAL(18,18) - 只能存储 0-1 之间的值
// 如果返利金额可能 ≥ 1 BTC,建议修改为:
ALTER TABLE invitation_rebate 
MODIFY COLUMN subordinate_rebate_amount DECIMAL(20, 8);
```

### 2. 防止重复发放返利
```javascript
// 在发放返利前检查是否已存在
async function checkDuplicateRebate(userId, subordinateUserId, timestamp) {
  const existing = await InvitationRebate.findOne({
    where: {
      user_id: userId,
      subordinate_user_id: subordinateUserId,
      rebate_creation_time: timestamp
    }
  });
  
  if (existing) {
    throw new Error('该返利已发放,禁止重复发放');
  }
}
```

### 3. 返利发放失败回滚
```javascript
// 使用事务确保数据一致性
async function giveRebateWithTransaction(userId, subordinateUserId, amount) {
  const t = await sequelize.transaction();
  
  try {
    // 1. 创建返利记录
    await InvitationRebate.create({
      user_id: userId,
      subordinate_user_id: subordinateUserId,
      subordinate_rebate_amount: amount
    }, { transaction: t });
    
    // 2. 更新余额
    await UserStatus.increment('total_invitation_rebate', {
      by: amount,
      where: { user_id: userId }
    }, { transaction: t });
    
    // 3. 记录交易
    await BitcoinTransactionRecord.create({
      user_id: userId,
      transaction_type: 'subordinate rebate',
      transaction_amount: amount,
      transaction_status: 'success'
    }, { transaction: t });
    
    // 提交事务
    await t.commit();
  } catch (error) {
    // 回滚事务
    await t.rollback();
    throw error;
  }
}
```

### 4. subordinate 字段可为 NULL 的情况
```javascript
// 某些返利可能没有明确的下级用户(如系统奖励)
{
  user_id: "USER001",
  invitation_code: "CODE_A",
  subordinate_user_id: null,  // 系统奖励,没有特定下级
  subordinate_user_invitation_code: null,
  subordinate_rebate_amount: 0.00001,
  rebate_creation_time: "2025-11-23 10:00:00"
}
```

---

## 📈 业务指标

### 返利效率分析
```javascript
// 计算用户的"返利效率"(每个下级平均贡献)
async function getRebateEfficiency(userId) {
  // 1. 统计下级数量
  const subordinateCount = await InvitationRelationship.count({
    where: { referrer_user_id: userId }
  });
  
  // 2. 统计总返利
  const totalRebate = await InvitationRebate.sum('subordinate_rebate_amount', {
    where: { user_id: userId }
  });
  
  // 3. 计算平均值
  const efficiency = subordinateCount > 0 ? totalRebate / subordinateCount : 0;
  
  return {
    subordinate_count: subordinateCount,
    total_rebate: totalRebate,
    avg_rebate_per_subordinate: efficiency
  };
}
```

### 活跃下级识别
```javascript
// 找出最活跃的下级(产生返利最多的)
async function getTopSubordinates(userId, limit = 10) {
  return await InvitationRebate.findAll({
    attributes: [
      'subordinate_user_id',
      [fn('SUM', col('subordinate_rebate_amount')), 'total_rebate'],
      [fn('COUNT', col('id')), 'rebate_count'],
      [fn('MAX', col('rebate_creation_time')), 'last_rebate_time']
    ],
    where: { 
      user_id: userId,
      subordinate_user_id: { [Op.ne]: null }
    },
    group: ['subordinate_user_id'],
    order: [[fn('SUM', col('subordinate_rebate_amount')), 'DESC']],
    limit: limit
  });
}
```

---

## 💡 数据库优化建议

### 当前索引配置 ✅
```sql
-- 已添加的索引
CREATE INDEX idx_user_id ON invitation_rebate(user_id);
CREATE INDEX idx_invitation_code ON invitation_rebate(invitation_code);
CREATE INDEX idx_subordinate_user_id ON invitation_rebate(subordinate_user_id);
CREATE INDEX idx_rebate_creation_time ON invitation_rebate(rebate_creation_time);
CREATE INDEX idx_user_time ON invitation_rebate(user_id, rebate_creation_time);
```

### 建议添加的索引
```sql
-- 用于统计分析的复合索引
CREATE INDEX idx_user_subordinate ON invitation_rebate(user_id, subordinate_user_id);

-- 用于金额统计的索引
CREATE INDEX idx_user_amount ON invitation_rebate(user_id, subordinate_rebate_amount);
```

### 外键约束(可选)
```sql
-- 确保 user_id 引用真实用户
ALTER TABLE invitation_rebate
ADD CONSTRAINT fk_rebate_user
FOREIGN KEY (user_id) REFERENCES user_information(user_id)
ON DELETE CASCADE;

-- 确保 subordinate_user_id 引用真实用户
ALTER TABLE invitation_rebate
ADD CONSTRAINT fk_rebate_subordinate
FOREIGN KEY (subordinate_user_id) REFERENCES user_information(user_id)
ON DELETE SET NULL;
```

---

## 🎯 总结

**核心概念:**
- **user_id**: 获得返利的人(上级/邀请人)
- **subordinate_user_id**: 产生返利的人(下级/被邀请人)
- **subordinate_rebate_amount**: 返利金额
- 一个上级可以从多个下级获得返利
- 一个下级的行为可以给上级产生多次返利

**业务价值:**
- 激励用户推广(邀请返利机制)
- 追踪返利明细(审计和结算)
- 分析推广效果(哪些下级最活跃)
- 多级返利支持(构建分销网络)

**注意事项:**
- ⚠️ 返利金额字段使用 DECIMAL(18,18),只能存储 0-1 之间的值
- ✅ 使用事务确保返利发放的原子性
- ✅ 防止重复发放返利
- ✅ subordinate 字段可为 NULL(系统奖励等场景)
