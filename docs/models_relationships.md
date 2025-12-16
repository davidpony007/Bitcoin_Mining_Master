# 数据库模型关联关系说明

## 📊 表关系概览

```
UserInformation (用户信息表)
    ├── 1:1 → UserStatus (用户状态)
    ├── 1:N → MiningContract (挖矿合约)
    ├── 1:N → BitcoinTransactionRecord (比特币交易记录)
    ├── 1:N → FreeContractRecord (免费合约记录)
    ├── 1:N → InvitationRebate (邀请返利)
    ├── 1:1 → InvitationRelationship (作为被邀请人)
    ├── 1:N → InvitationRelationship (作为邀请人)
    ├── 1:N → UserOrder (用户订单)
    ├── 1:N → WithdrawalRecord (提现记录)
    └── 1:N → UserLog (用户日志)

PaidProduct (付费产品配置)
    └── 1:N → UserOrder (用户订单)
```

---

## 🔗 详细关联关系

### 1. UserInformation ↔ UserStatus (一对一)

**关系说明:**
- 一个用户只有一条状态记录
- 用户信息表存储基础信息，用户状态表存储动态数据

**使用示例:**
```javascript
// 查询用户及其状态
const user = await UserInformation.findOne({
  where: { user_id: 'USER001' },
  include: [{
    model: UserStatus,
    as: 'status'
  }]
});

console.log(`用户: ${user.email}`);
console.log(`余额: ${user.status.current_bitcoin_balance} BTC`);
console.log(`累计收益: ${user.status.bitcoin_accumulated_amount} BTC`);
```

---

### 2. UserInformation → MiningContract (一对多)

**关系说明:**
- 一个用户可以拥有多个挖矿合约（付费合约、免费合约）
- 每个合约属于一个用户

**使用示例:**
```javascript
// 查询用户的所有挖矿合约
const user = await UserInformation.findOne({
  where: { user_id: 'USER001' },
  include: [{
    model: MiningContract,
    as: 'miningContracts',
    where: { mining_status: 'mining' }  // 只查询挖矿中的合约
  }]
});

console.log(`用户有 ${user.miningContracts.length} 个活跃合约`);
user.miningContracts.forEach(contract => {
  console.log(`- ${contract.contract_type}: ${contract.hashrate} 算力`);
});
```

---

### 3. UserInformation → BitcoinTransactionRecord (一对多)

**关系说明:**
- 一个用户有多条交易记录
- 记录所有类型的比特币交易（收入、支出、返利等）

**使用示例:**
```javascript
// 查询用户的交易历史
const user = await UserInformation.findOne({
  where: { user_id: 'USER001' },
  include: [{
    model: BitcoinTransactionRecord,
    as: 'transactions',
    order: [['transaction_creation_time', 'DESC']],
    limit: 10
  }]
});

console.log('最近10笔交易:');
user.transactions.forEach(tx => {
  console.log(`${tx.transaction_type}: ${tx.transaction_amount} BTC - ${tx.transaction_status}`);
});
```

---

### 4. UserInformation → FreeContractRecord (一对多)

**关系说明:**
- 一个用户可以获得多个免费合约（广告、签到、邀请）
- 记录免费合约的历史数据

**使用示例:**
```javascript
// 查询用户的免费合约记录
const user = await UserInformation.findOne({
  where: { user_id: 'USER001' },
  include: [{
    model: FreeContractRecord,
    as: 'freeContracts',
    where: { mining_status: 'completed' }
  }]
});

const totalRevenue = user.freeContracts.reduce((sum, contract) => {
  return sum + parseFloat(contract.free_contract_revenue);
}, 0);

console.log(`免费合约累计收益: ${totalRevenue} BTC`);
```

---

### 5. UserInformation → InvitationRebate (一对多)

**关系说明:**
- 一个用户可以收到多笔邀请返利
- 记录下级用户产生的返利

**使用示例:**
```javascript
// 查询用户收到的所有返利
const user = await UserInformation.findOne({
  where: { user_id: 'USER001' },
  include: [{
    model: InvitationRebate,
    as: 'rebates'
  }]
});

const totalRebate = user.rebates.reduce((sum, rebate) => {
  return sum + parseFloat(rebate.subordinate_rebate_amount);
}, 0);

console.log(`累计获得返利: ${totalRebate} BTC`);
console.log(`返利笔数: ${user.rebates.length}`);
```

---

### 6. UserInformation ↔ InvitationRelationship (一对一 + 一对多)

**关系说明:**
- **作为被邀请人**: 一个用户只能被一个人邀请（一对一）
- **作为邀请人**: 一个用户可以邀请多个人（一对多）

**使用示例 - 查询用户的邀请人:**
```javascript
// 查询用户是被谁邀请的
const user = await UserInformation.findOne({
  where: { user_id: 'USER001' },
  include: [{
    model: InvitationRelationship,
    as: 'invitationRelation',
    include: [{
      model: UserInformation,
      as: 'referrer'  // 邀请人信息
    }]
  }]
});

if (user.invitationRelation && user.invitationRelation.referrer) {
  console.log(`邀请人: ${user.invitationRelation.referrer.email}`);
} else {
  console.log('直接注册，无邀请人');
}
```

**使用示例 - 查询用户邀请的所有人:**
```javascript
// 查询用户邀请了多少人
const user = await UserInformation.findOne({
  where: { user_id: 'USER001' },
  include: [{
    model: InvitationRelationship,
    as: 'referredUsers',  // 被邀请的用户列表
    include: [{
      model: UserInformation,
      as: 'invitee'
    }]
  }]
});

console.log(`邀请了 ${user.referredUsers.length} 个用户`);
user.referredUsers.forEach(relation => {
  console.log(`- ${relation.invitee.email}`);
});
```

---

### 7. UserInformation → UserOrder (一对多)

**关系说明:**
- 一个用户可以购买多个付费合约
- 记录所有订单信息

**使用示例:**
```javascript
// 查询用户的所有订单
const user = await UserInformation.findOne({
  where: { user_id: 'USER001' },
  include: [{
    model: UserOrder,
    as: 'orders',
    include: [{
      model: PaidProduct,
      as: 'product'  // 包含产品详情
    }]
  }]
});

console.log(`用户共有 ${user.orders.length} 个订单`);
user.orders.forEach(order => {
  console.log(`订单 ${order.id}: ${order.product.product_name} - $${order.product_price} - ${order.order_status}`);
});
```

---

### 8. PaidProduct → UserOrder (一对多)

**关系说明:**
- 一个产品档位可以被购买多次
- 每个订单对应一个产品档位

**使用示例:**
```javascript
// 查询某个产品的所有订单
const product = await PaidProduct.findOne({
  where: { product_id: 'p1999' },
  include: [{
    model: UserOrder,
    as: 'orders',
    where: { order_status: 'active' }
  }]
});

console.log(`产品 ${product.product_name}`);
console.log(`激活订单数: ${product.orders.length}`);
console.log(`总销售额: $${product.orders.length * parseFloat(product.product_price)}`);
```

---

### 9. UserInformation → WithdrawalRecord (一对多)

**关系说明:**
- 一个用户可以发起多次提现
- 记录所有提现申请和处理结果

**使用示例:**
```javascript
// 查询用户的提现记录
const user = await UserInformation.findOne({
  where: { user_id: 'USER001' },
  include: [{
    model: WithdrawalRecord,
    as: 'withdrawals',
    order: [['id', 'DESC']]
  }]
});

const successfulWithdrawals = user.withdrawals.filter(w => w.withdrawal_status === 'success');
const totalWithdrawn = successfulWithdrawals.reduce((sum, w) => {
  return sum + parseFloat(w.withdrawal_request_amount);
}, 0);

console.log(`成功提现 ${successfulWithdrawals.length} 次`);
console.log(`总提现金额: ${totalWithdrawn} BTC`);
```

---

### 10. UserInformation → UserLog (一对多)

**关系说明:**
- 一个用户产生多条操作日志
- 记录用户的所有重要操作

**使用示例:**
```javascript
// 查询用户的最近操作日志
const user = await UserInformation.findOne({
  where: { user_id: 'USER001' },
  include: [{
    model: UserLog,
    as: 'logs',
    order: [['created_at', 'DESC']],
    limit: 20
  }]
});

console.log('最近20条操作:');
user.logs.forEach(log => {
  console.log(`[${log.created_at}] ${log.action}: ${log.details}`);
});
```

---

## 💡 复杂查询示例

### 1. 查询用户的完整画像

```javascript
// 获取用户的所有相关数据
async function getUserCompleteProfile(userId) {
  const user = await UserInformation.findOne({
    where: { user_id: userId },
    include: [
      {
        model: UserStatus,
        as: 'status'
      },
      {
        model: MiningContract,
        as: 'miningContracts',
        where: { mining_status: 'mining' },
        required: false
      },
      {
        model: UserOrder,
        as: 'orders',
        include: [{
          model: PaidProduct,
          as: 'product'
        }]
      },
      {
        model: InvitationRelationship,
        as: 'invitationRelation',
        include: [{
          model: UserInformation,
          as: 'referrer'
        }]
      },
      {
        model: InvitationRelationship,
        as: 'referredUsers'
      },
      {
        model: InvitationRebate,
        as: 'rebates'
      }
    ]
  });
  
  return {
    基础信息: {
      用户ID: user.user_id,
      邮箱: user.email,
      邀请码: user.invitation_code
    },
    账户状态: {
      当前余额: user.status.current_bitcoin_balance,
      累计收益: user.status.bitcoin_accumulated_amount,
      累计提现: user.status.total_withdrawal_amount
    },
    挖矿合约: {
      活跃合约数: user.miningContracts.length,
      总算力: user.miningContracts.reduce((sum, c) => sum + parseFloat(c.hashrate), 0)
    },
    订单信息: {
      总订单数: user.orders.length,
      总消费: user.orders.reduce((sum, o) => sum + parseFloat(o.product_price), 0)
    },
    邀请信息: {
      邀请人: user.invitationRelation?.referrer?.email || '无',
      已邀请人数: user.referredUsers.length,
      获得返利: user.rebates.reduce((sum, r) => sum + parseFloat(r.subordinate_rebate_amount), 0)
    }
  };
}

// 使用
const profile = await getUserCompleteProfile('USER001');
console.log(JSON.stringify(profile, null, 2));
```

---

### 2. 查询产品销售统计

```javascript
// 统计所有产品的销售情况
async function getProductSalesStatistics() {
  const products = await PaidProduct.findAll({
    include: [{
      model: UserOrder,
      as: 'orders',
      where: {
        order_status: ['active', 'complete']
      },
      required: false
    }]
  });
  
  return products.map(p => ({
    产品: p.product_name,
    价格: `$${p.product_price}`,
    算力: p.hashrate,
    销量: p.orders.length,
    总收入: `$${p.orders.length * parseFloat(p.product_price)}`
  }));
}

// 使用
const stats = await getProductSalesStatistics();
console.table(stats);
```

---

### 3. 查询邀请团队结构

```javascript
// 递归查询用户的邀请团队（多级）
async function getInvitationTeam(userId, level = 1, maxLevel = 3) {
  if (level > maxLevel) return [];
  
  const directInvitees = await InvitationRelationship.findAll({
    where: { referrer_user_id: userId },
    include: [{
      model: UserInformation,
      as: 'invitee',
      include: [{
        model: UserStatus,
        as: 'status'
      }]
    }]
  });
  
  const team = [];
  
  for (const relation of directInvitees) {
    const member = {
      level: level,
      user_id: relation.invitee.user_id,
      email: relation.invitee.email,
      balance: relation.invitee.status.current_bitcoin_balance,
      下级成员: await getInvitationTeam(relation.invitee.user_id, level + 1, maxLevel)
    };
    
    team.push(member);
  }
  
  return team;
}

// 使用
const team = await getInvitationTeam('USER001', 1, 3);
console.log('团队结构:');
console.log(JSON.stringify(team, null, 2));
```

---

## ⚠️ 注意事项

### 1. 循环引用问题

```javascript
// ❌ 避免无限递归
const user = await UserInformation.findOne({
  include: [{
    model: InvitationRelationship,
    as: 'referredUsers',
    include: [{
      model: UserInformation,  // 这里会再次加载 UserInformation
      as: 'invitee',
      include: [...] // 可能导致无限递归
    }]
  }]
});

// ✅ 使用 separate: true 或限制深度
const user = await UserInformation.findOne({
  include: [{
    model: InvitationRelationship,
    as: 'referredUsers',
    separate: true  // 分开查询，避免循环
  }]
});
```

### 2. N+1 查询问题

```javascript
// ❌ N+1 查询
const users = await UserInformation.findAll();
for (const user of users) {
  const status = await UserStatus.findOne({ where: { user_id: user.user_id } });
  // 每个用户都要查询一次，效率低
}

// ✅ 使用 include 预加载
const users = await UserInformation.findAll({
  include: [{
    model: UserStatus,
    as: 'status'
  }]
});
// 一次查询搞定
```

### 3. 大数据量查询优化

```javascript
// ❌ 一次性加载所有数据
const user = await UserInformation.findOne({
  where: { user_id: 'USER001' },
  include: [{
    model: BitcoinTransactionRecord,
    as: 'transactions'  // 可能有几千条记录
  }]
});

// ✅ 分页查询
const user = await UserInformation.findOne({
  where: { user_id: 'USER001' }
});

const transactions = await BitcoinTransactionRecord.findAll({
  where: { user_id: 'USER001' },
  limit: 20,
  offset: 0,
  order: [['transaction_creation_time', 'DESC']]
});
```

---

## 🎯 总结

**已定义的关联关系:**
- ✅ UserInformation ↔ UserStatus (一对一)
- ✅ UserInformation → MiningContract (一对多)
- ✅ UserInformation → BitcoinTransactionRecord (一对多)
- ✅ UserInformation → FreeContractRecord (一对多)
- ✅ UserInformation → InvitationRebate (一对多)
- ✅ UserInformation ↔ InvitationRelationship (一对一 + 一对多)
- ✅ UserInformation → UserOrder (一对多)
- ✅ PaidProduct → UserOrder (一对多)
- ✅ UserInformation → WithdrawalRecord (一对多)
- ✅ UserInformation → UserLog (一对多)

**关联的好处:**
1. 简化查询代码，使用 `include` 自动关联
2. 数据一致性，通过外键约束保证
3. 代码可读性强，关系清晰明了
4. 支持级联操作（删除、更新）

现在所有模型之间的关系都已正确配置！🎉
