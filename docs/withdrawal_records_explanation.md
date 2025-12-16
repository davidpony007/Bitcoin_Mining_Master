# withdrawal_records 表结构说明

## 📋 表字段详解

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| **id** | int(11) | 主键,自增ID | 1, 2, 3... |
| **user_id** | varchar(15) | 用户唯一标识符 | "USER001" |
| **email** | varchar(30) | 用户邮箱地址 | "user@example.com" |
| **wallet_address** | varchar(80) | 比特币钱包地址 | "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" |
| **withdrawal_request_amount** | decimal(18,18) | 用户申请提现金额(扣费前) | 0.001 |
| **network_fee** | decimal(18,18) | 网络手续费 | 0.00001 |
| **received_amount** | decimal(18,18) | 实际到账金额(扣费后) | 0.00099 |
| **withdrawal_status** | enum | 提现状态 | "pending" |

---

## 💰 金额计算逻辑

### 三个金额字段的关系:

```javascript
withdrawal_request_amount = 用户申请提现的金额
network_fee = 网络手续费
received_amount = 实际到账金额

// 计算公式:
received_amount = withdrawal_request_amount - network_fee
```

### 示例:
```javascript
// 用户申请提现 0.001 BTC
withdrawal_request_amount: 0.001000000000000000

// 网络手续费 0.00001 BTC
network_fee: 0.000010000000000000

// 实际到账 0.00099 BTC
received_amount: 0.000990000000000000

// 验证: 0.001 - 0.00001 = 0.00099 ✓
```

---

## 📊 提现状态详解

### withdrawal_status 枚举值:

1. **pending** (待处理) - 默认状态
   - 用户刚提交提现申请
   - 等待管理员审核
   - 等待区块链确认

2. **success** (成功)
   - 提现已完成
   - 比特币已转账到用户钱包
   - 区块链确认成功

3. **rejected** (已拒绝)
   - 管理员拒绝提现申请
   - 余额不足
   - 钱包地址无效
   - 其他原因拒绝

---

## 🔄 业务场景代码

### 1. 用户申请提现

```javascript
// 用户申请提现
async function createWithdrawalRequest(userId, email, walletAddress, requestAmount) {
  // 1. 验证用户余额
  const userStatus = await UserStatus.findOne({
    where: { user_id: userId }
  });
  
  if (!userStatus || userStatus.current_bitcoin_balance < requestAmount) {
    throw new Error('余额不足');
  }
  
  // 2. 计算手续费(假设0.1%,最低0.00001 BTC)
  const feeRate = 0.001; // 0.1%
  let networkFee = requestAmount * feeRate;
  networkFee = Math.max(networkFee, 0.00001); // 最低手续费
  
  // 3. 计算实际到账金额
  const receivedAmount = requestAmount - networkFee;
  
  if (receivedAmount <= 0) {
    throw new Error('提现金额过小,无法支付手续费');
  }
  
  const t = await sequelize.transaction();
  
  try {
    // 4. 冻结用户余额(扣除申请金额)
    await userStatus.decrement('current_bitcoin_balance', {
      by: requestAmount,
      transaction: t
    });
    
    // 5. 创建提现记录
    const withdrawal = await WithdrawalRecord.create({
      user_id: userId,
      email: email,
      wallet_address: walletAddress,
      withdrawal_request_amount: requestAmount,
      network_fee: networkFee,
      received_amount: receivedAmount,
      withdrawal_status: 'pending'
    }, { transaction: t });
    
    // 6. 记录交易(待处理状态)
    await BitcoinTransactionRecord.create({
      user_id: userId,
      transaction_type: 'withdrawal',
      transaction_amount: requestAmount,
      transaction_status: 'success'
    }, { transaction: t });
    
    // 7. 更新总提现金额
    await userStatus.increment('total_withdrawal_amount', {
      by: requestAmount,
      transaction: t
    });
    
    await t.commit();
    
    console.log(`提现申请已提交,ID: ${withdrawal.id}`);
    return withdrawal;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

// 使用示例
await createWithdrawalRequest(
  'USER001',
  'user@example.com',
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  0.001  // 申请提现 0.001 BTC
);
```

### 2. 管理员审核通过

```javascript
// 管理员审核通过提现申请
async function approveWithdrawal(withdrawalId, adminId) {
  const withdrawal = await WithdrawalRecord.findByPk(withdrawalId);
  
  if (!withdrawal) {
    throw new Error('提现记录不存在');
  }
  
  if (withdrawal.withdrawal_status !== 'pending') {
    throw new Error('该提现申请已处理');
  }
  
  // 更新状态为成功
  await withdrawal.update({
    withdrawal_status: 'success'
  });
  
  // TODO: 调用区块链API进行实际转账
  // await blockchainService.transfer(
  //   withdrawal.wallet_address,
  //   withdrawal.received_amount
  // );
  
  console.log(`提现申请 ${withdrawalId} 已审核通过`);
  console.log(`已转账 ${withdrawal.received_amount} BTC 到 ${withdrawal.wallet_address}`);
  
  // 发送邮件通知用户
  // await sendEmail(withdrawal.email, '提现成功', ...);
  
  return withdrawal;
}
```

### 3. 管理员拒绝提现

```javascript
// 管理员拒绝提现申请
async function rejectWithdrawal(withdrawalId, reason) {
  const withdrawal = await WithdrawalRecord.findByPk(withdrawalId);
  
  if (!withdrawal) {
    throw new Error('提现记录不存在');
  }
  
  if (withdrawal.withdrawal_status !== 'pending') {
    throw new Error('该提现申请已处理');
  }
  
  const t = await sequelize.transaction();
  
  try {
    // 1. 更新状态为拒绝
    await withdrawal.update({
      withdrawal_status: 'rejected'
    }, { transaction: t });
    
    // 2. 退还余额
    await UserStatus.increment('current_bitcoin_balance', {
      by: withdrawal.withdrawal_request_amount,
      where: { user_id: withdrawal.user_id }
    }, { transaction: t });
    
    // 3. 回退总提现金额
    await UserStatus.decrement('total_withdrawal_amount', {
      by: withdrawal.withdrawal_request_amount,
      where: { user_id: withdrawal.user_id }
    }, { transaction: t });
    
    // 4. 记录退款交易
    await BitcoinTransactionRecord.create({
      user_id: withdrawal.user_id,
      transaction_type: 'refund for withdrawal failure',
      transaction_amount: withdrawal.withdrawal_request_amount,
      transaction_status: 'success'
    }, { transaction: t });
    
    await t.commit();
    
    console.log(`提现申请 ${withdrawalId} 已拒绝,原因: ${reason}`);
    console.log(`已退还 ${withdrawal.withdrawal_request_amount} BTC`);
    
    // 发送邮件通知用户
    // await sendEmail(withdrawal.email, '提现被拒绝', reason);
    
    return withdrawal;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}
```

### 4. 批量处理待审核提现

```javascript
// 批量处理待审核的提现申请
async function processPendingWithdrawals() {
  const pendingWithdrawals = await WithdrawalRecord.findAll({
    where: { withdrawal_status: 'pending' },
    order: [['id', 'ASC']],
    limit: 100
  });
  
  console.log(`发现 ${pendingWithdrawals.length} 个待处理的提现申请`);
  
  for (const withdrawal of pendingWithdrawals) {
    try {
      // 自动审核逻辑(可根据业务规则调整)
      
      // 检查1: 金额是否合理(不超过某个阈值)
      if (withdrawal.withdrawal_request_amount > 1) {
        console.log(`提现金额过大,需要人工审核: ${withdrawal.id}`);
        continue;
      }
      
      // 检查2: 钱包地址是否有效
      if (!isValidBitcoinAddress(withdrawal.wallet_address)) {
        await rejectWithdrawal(withdrawal.id, '钱包地址无效');
        continue;
      }
      
      // 检查3: 用户是否有风险标记
      // if (await isUserFlagged(withdrawal.user_id)) {
      //   continue;
      // }
      
      // 自动通过
      await approveWithdrawal(withdrawal.id, 'AUTO_SYSTEM');
      
    } catch (error) {
      console.error(`处理提现申请 ${withdrawal.id} 失败:`, error);
    }
  }
}

// 钱包地址验证(简化版)
function isValidBitcoinAddress(address) {
  // Bitcoin 地址通常以 1, 3 或 bc1 开头
  if (!address || address.length < 26 || address.length > 90) {
    return false;
  }
  
  const validPrefixes = ['1', '3', 'bc1'];
  return validPrefixes.some(prefix => address.startsWith(prefix));
}
```

---

## 🔍 常用查询

### 1. 查询用户的提现记录
```javascript
const withdrawals = await WithdrawalRecord.findAll({
  where: { user_id: 'USER001' },
  order: [['id', 'DESC']]
});

console.log(`用户共有 ${withdrawals.length} 条提现记录`);
```

### 2. 查询待处理的提现申请
```javascript
const pending = await WithdrawalRecord.findAll({
  where: { withdrawal_status: 'pending' },
  order: [['id', 'ASC']]
});

console.log(`有 ${pending.length} 个待处理的提现申请`);
```

### 3. 统计用户的总提现金额
```javascript
const { fn, col } = require('sequelize');

const totalWithdrawn = await WithdrawalRecord.findOne({
  attributes: [
    [fn('SUM', col('withdrawal_request_amount')), 'total']
  ],
  where: {
    user_id: 'USER001',
    withdrawal_status: 'success'
  }
});

console.log(`用户总提现: ${totalWithdrawn.get('total')} BTC`);
```

### 4. 统计各状态的提现数量
```javascript
const stats = await WithdrawalRecord.findAll({
  attributes: [
    'withdrawal_status',
    [fn('COUNT', col('id')), 'count'],
    [fn('SUM', col('withdrawal_request_amount')), 'total_amount']
  ],
  group: ['withdrawal_status']
});

console.log('提现状态统计:');
stats.forEach(s => {
  console.log(`${s.withdrawal_status}: ${s.get('count')}笔, 总额: ${s.get('total_amount')} BTC`);
});
```

### 5. 查询大额提现(需人工审核)
```javascript
const largeWithdrawals = await WithdrawalRecord.findAll({
  where: {
    withdrawal_status: 'pending',
    withdrawal_request_amount: {
      [Op.gte]: 1  // ≥ 1 BTC
    }
  }
});

console.log(`有 ${largeWithdrawals.length} 个大额提现需要人工审核`);
```

---

## 📊 统计分析

### 提现成功率分析

```javascript
// 计算用户的提现成功率
async function getWithdrawalSuccessRate(userId) {
  const allWithdrawals = await WithdrawalRecord.count({
    where: { user_id: userId }
  });
  
  const successfulWithdrawals = await WithdrawalRecord.count({
    where: {
      user_id: userId,
      withdrawal_status: 'success'
    }
  });
  
  const successRate = allWithdrawals > 0 
    ? (successfulWithdrawals / allWithdrawals) * 100 
    : 0;
  
  return {
    total: allWithdrawals,
    successful: successfulWithdrawals,
    successRate: successRate.toFixed(2) + '%'
  };
}

// 使用示例
const rate = await getWithdrawalSuccessRate('USER001');
console.log(`提现成功率: ${rate.successRate}`);
```

### 手续费统计

```javascript
// 统计系统收取的总手续费
async function getTotalNetworkFees(startDate, endDate) {
  const totalFees = await WithdrawalRecord.findOne({
    attributes: [
      [fn('SUM', col('network_fee')), 'total_fees'],
      [fn('COUNT', col('id')), 'withdrawal_count']
    ],
    where: {
      withdrawal_status: 'success',
      // 注意: 表中没有时间字段,这里假设有 created_at
      // created_at: {
      //   [Op.between]: [startDate, endDate]
      // }
    }
  });
  
  return {
    totalFees: totalFees.get('total_fees') || 0,
    withdrawalCount: totalFees.get('withdrawal_count') || 0,
    avgFeePerWithdrawal: totalFees.get('total_fees') / totalFees.get('withdrawal_count') || 0
  };
}
```

---

## ⚠️ 重要注意事项

### 1. 表中没有时间字段!

```javascript
// ⚠️ 数据库表缺少 created_at/updated_at 字段
// 无法按时间查询和排序
// 建议添加时间字段:

ALTER TABLE withdrawal_records 
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER withdrawal_status;

ALTER TABLE withdrawal_records 
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
```

### 2. 金额字段精度问题

```javascript
// 当前: DECIMAL(18,18) - 只能存储 0-1 BTC
// 如果提现金额可能 ≥ 1 BTC,建议修改:

ALTER TABLE withdrawal_records 
MODIFY COLUMN withdrawal_request_amount DECIMAL(20, 8);

ALTER TABLE withdrawal_records 
MODIFY COLUMN network_fee DECIMAL(20, 8);

ALTER TABLE withdrawal_records 
MODIFY COLUMN received_amount DECIMAL(20, 8);
```

### 3. 余额冻结机制

```javascript
// 提现申请时,立即扣除余额(防止重复提现)
// 如果拒绝,需要退还余额
// 务必使用事务确保数据一致性

const t = await sequelize.transaction();
try {
  // 扣除余额
  await UserStatus.decrement('current_bitcoin_balance', {...}, { transaction: t });
  
  // 创建提现记录
  await WithdrawalRecord.create({...}, { transaction: t });
  
  await t.commit();
} catch (error) {
  await t.rollback();
}
```

### 4. 钱包地址验证

```javascript
// 务必验证钱包地址的有效性
// 错误的地址会导致资金丢失!

function isValidBitcoinAddress(address) {
  // 主网地址
  if (address.startsWith('1')) {
    // P2PKH 地址,25-34 字符
    return address.length >= 26 && address.length <= 35;
  }
  if (address.startsWith('3')) {
    // P2SH 地址,25-34 字符
    return address.length >= 26 && address.length <= 35;
  }
  if (address.startsWith('bc1')) {
    // Bech32 地址,42-90 字符
    return address.length >= 42 && address.length <= 90;
  }
  return false;
}
```

### 5. 防止重复提现

```javascript
// 检查是否有待处理的提现
async function checkPendingWithdrawal(userId) {
  const pending = await WithdrawalRecord.findOne({
    where: {
      user_id: userId,
      withdrawal_status: 'pending'
    }
  });
  
  if (pending) {
    throw new Error('您有一笔提现正在处理中,请等待审核完成');
  }
}

// 在创建新提现前调用
await checkPendingWithdrawal(userId);
await createWithdrawalRequest(...);
```

---

## 🔗 关联关系

### 在 models/index.js 中添加关联

```javascript
// 提现记录与用户信息关联
WithdrawalRecord.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'userInfo'
});

// 使用示例: 查询提现记录并包含用户信息
const withdrawal = await WithdrawalRecord.findOne({
  where: { id: 1 },
  include: [{
    model: UserInformation,
    as: 'userInfo'
  }]
});

console.log(`用户: ${withdrawal.userInfo.email}`);
console.log(`钱包: ${withdrawal.wallet_address}`);
console.log(`金额: ${withdrawal.withdrawal_request_amount} BTC`);
```

---

## 💡 数据库优化建议

### 1. 添加时间字段(强烈建议)

```sql
-- 添加创建时间和更新时间
ALTER TABLE withdrawal_records 
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';

ALTER TABLE withdrawal_records 
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- 添加索引
CREATE INDEX idx_created_at ON withdrawal_records(created_at);
```

### 2. 当前索引配置 ✅

```sql
CREATE INDEX idx_user_id ON withdrawal_records(user_id);
CREATE INDEX idx_email ON withdrawal_records(email);
CREATE INDEX idx_wallet_address ON withdrawal_records(wallet_address);
CREATE INDEX idx_withdrawal_status ON withdrawal_records(withdrawal_status);
CREATE INDEX idx_user_status ON withdrawal_records(user_id, withdrawal_status);
```

### 3. 外键约束(可选)

```sql
ALTER TABLE withdrawal_records
ADD CONSTRAINT fk_withdrawal_user
FOREIGN KEY (user_id) REFERENCES user_information(user_id)
ON DELETE CASCADE;
```

### 4. 添加拒绝原因字段(建议)

```sql
-- 记录拒绝原因
ALTER TABLE withdrawal_records 
ADD COLUMN rejection_reason VARCHAR(200) NULL COMMENT '拒绝原因' AFTER withdrawal_status;
```

---

## 📧 邮件通知模板

### 提现申请成功邮件

```javascript
async function sendWithdrawalRequestEmail(email, withdrawalId, amount) {
  const subject = '提现申请已提交';
  const body = `
    您好,
    
    您的提现申请已成功提交,详情如下:
    
    提现单号: ${withdrawalId}
    申请金额: ${amount} BTC
    状态: 待审核
    
    我们会尽快处理您的申请,请耐心等待。
    
    此致
    Bitcoin Mining Master 团队
  `;
  
  // await emailService.send(email, subject, body);
}
```

### 提现成功邮件

```javascript
async function sendWithdrawalSuccessEmail(email, withdrawal) {
  const subject = '提现成功';
  const body = `
    您好,
    
    您的提现已成功处理,详情如下:
    
    提现单号: ${withdrawal.id}
    申请金额: ${withdrawal.withdrawal_request_amount} BTC
    网络手续费: ${withdrawal.network_fee} BTC
    实际到账: ${withdrawal.received_amount} BTC
    钱包地址: ${withdrawal.wallet_address}
    
    感谢您的使用!
    
    此致
    Bitcoin Mining Master 团队
  `;
  
  // await emailService.send(email, subject, body);
}
```

---

## 🎯 总结

**核心功能:**
- 记录用户的比特币提现申请
- 三个金额字段清晰展示手续费扣除逻辑
- 三种状态管理提现流程(pending → success/rejected)
- 包含用户邮箱和钱包地址信息

**业务流程:**
1. 用户申请提现 → 状态: pending
2. 管理员审核
   - 通过 → 状态: success,转账到钱包
   - 拒绝 → 状态: rejected,退还余额

**技术要点:**
- ⚠️ 表中**没有时间字段**,强烈建议添加
- ⚠️ 金额字段都是 DECIMAL(18,18),可能需要调整
- ✅ 钱包地址验证非常重要
- ✅ 使用事务确保余额操作安全
- ✅ 防止重复提现
- ✅ 邮件通知用户提现状态

**关键公式:**
```
received_amount = withdrawal_request_amount - network_fee
```

现在代码已经完全匹配数据库结构! 🚀
