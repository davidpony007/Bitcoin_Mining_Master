# user_orders 表结构说明

## 📋 表字段详解

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| **id** | int(11) | 主键,自增ID | 1, 2, 3... |
| **user_id** | varchar(15) | 用户唯一标识符 | "USER001" |
| **email** | varchar(80) | 用户邮箱地址 | "user@example.com" |
| **product_id** | enum | 产品价格标识 | "4.99", "19.99" |
| **product_name** | enum | 合约产品名称 | "contract_4.99" |
| **product_price** | enum | 产品价格(美元) | "4.99", "99.99" |
| **hashrate** | decimal(18,18) | 合约算力值 | 0.000500000000000000 |
| **order_creation_time** | timestamp | 订单创建时间 | 2024-01-01 10:00:00 |
| **payment_time** | datetime | 支付完成时间 | 2024-01-01 10:05:30 |
| **currency_type** | varchar(30) | 支付货币类型 | "USD", "EUR" |
| **country** | varchar(30) | 用户所在国家 | "United States" |
| **payment_gateway_id** | varchar(80) | 支付网关标识符 | "stripe_ch_xxx" |
| **payment_network_id** | varchar(80) | 支付网络标识符 | "visa_4242" |
| **order_status** | enum | 订单状态 | "active" |

---

## 💳 产品套餐详解

### product_id / product_price 枚举值 (6种套餐):

```javascript
const PRODUCT_PACKAGES = {
  STARTER: {
    id: '4.99',
    name: 'contract_4.99',
    price: '4.99',
    duration: '30 days',
    hashrate: 0.0001  // 示例值
  },
  BASIC: {
    id: '6.99',
    name: 'contract_6.99',
    price: '6.99',
    duration: '30 days',
    hashrate: 0.00015
  },
  STANDARD: {
    id: '9.99',
    name: 'contract_9.99',
    price: '9.99',
    duration: '30 days',
    hashrate: 0.00025
  },
  PREMIUM: {
    id: '19.99',
    name: 'contract_19.99',
    price: '19.99',
    duration: '60 days',
    hashrate: 0.0005
  },
  PRO: {
    id: '49.99',
    name: 'contract_49.99',
    price: '49.99',
    duration: '90 days',
    hashrate: 0.001
  },
  ENTERPRISE: {
    id: '99.99',
    name: 'contract_99.99',
    price: '99.99',
    duration: '180 days',
    hashrate: 0.002
  }
};
```

---

## 📊 订单状态详解

### order_status 枚举值:

1. **active** (激活中)
   - 订单已支付成功
   - 合约正在挖矿中
   - 这是最常见的正常状态

2. **renewing** (续费中)
   - 用户正在续费该合约
   - 等待支付完成
   - 临时状态,很快会变为 active 或 error

3. **complete** (已完成)
   - 合约已到期
   - 挖矿已结束
   - 收益已结算

4. **error** (错误)
   - 支付失败
   - 合约激活失败
   - 需要人工处理

---

## 🔄 业务场景代码

### 1. 用户购买付费合约

```javascript
// 用户购买付费合约
async function createUserOrder(userId, email, productId, paymentInfo) {
  // 1. 根据产品ID获取产品信息
  const productConfig = {
    '4.99': { name: 'contract_4.99', hashrate: 0.0001, duration: 30 },
    '6.99': { name: 'contract_6.99', hashrate: 0.00015, duration: 30 },
    '9.99': { name: 'contract_9.99', hashrate: 0.00025, duration: 30 },
    '19.99': { name: 'contract_19.99', hashrate: 0.0005, duration: 60 },
    '49.99': { name: 'contract_49.99', hashrate: 0.001, duration: 90 },
    '99.99': { name: 'contract_99.99', hashrate: 0.002, duration: 180 }
  };
  
  const product = productConfig[productId];
  if (!product) {
    throw new Error('无效的产品ID');
  }
  
  const t = await sequelize.transaction();
  
  try {
    // 2. 创建订单
    const order = await UserOrder.create({
      user_id: userId,
      email: email,
      product_id: productId,
      product_name: product.name,
      product_price: productId,  // 价格等于产品ID
      hashrate: product.hashrate,
      order_creation_time: new Date(),
      payment_time: null,  // 还未支付
      currency_type: paymentInfo.currency || 'USD',
      country: paymentInfo.country || null,
      payment_gateway_id: paymentInfo.gatewayId,
      payment_network_id: paymentInfo.networkId,
      order_status: 'active'  // 直接激活(假设已验证支付)
    }, { transaction: t });
    
    // 3. 在 mining_contracts 表中创建对应的挖矿合约
    const contractEndTime = new Date();
    contractEndTime.setDate(contractEndTime.getDate() + product.duration);
    
    await MiningContract.create({
      user_id: userId,
      contract_type: 'paid contract',
      contract_duration: `${product.duration * 24}:00:00`,  // 转换为小时
      hashrate: product.hashrate,
      contract_creation_time: new Date(),
      contract_end_time: contractEndTime,
      mining_status: 'mining'
    }, { transaction: t });
    
    // 4. 记录交易
    await BitcoinTransactionRecord.create({
      user_id: userId,
      transaction_type: 'paid contract',
      transaction_amount: product.hashrate,  // 或者记录购买金额
      transaction_status: 'success',
      transaction_creation_time: new Date()
    }, { transaction: t });
    
    await t.commit();
    
    console.log(`订单创建成功! 订单ID: ${order.id}`);
    console.log(`合约类型: ${product.name}`);
    console.log(`算力: ${product.hashrate} BTC/day`);
    console.log(`时长: ${product.duration} 天`);
    
    return order;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

// 使用示例
await createUserOrder(
  'USER001',
  'user@example.com',
  '19.99',
  {
    currency: 'USD',
    country: 'United States',
    gatewayId: 'stripe_ch_1234567890',
    networkId: 'visa_4242'
  }
);
```

### 2. 处理支付回调

```javascript
// 处理支付网关的回调通知
async function handlePaymentCallback(paymentGatewayId, paymentStatus) {
  const order = await UserOrder.findOne({
    where: { payment_gateway_id: paymentGatewayId }
  });
  
  if (!order) {
    throw new Error('订单不存在');
  }
  
  if (paymentStatus === 'success') {
    // 支付成功,更新订单
    await order.update({
      payment_time: new Date(),
      order_status: 'active'
    });
    
    console.log(`订单 ${order.id} 支付成功,合约已激活`);
    
    // 发送邮件通知
    // await sendEmail(order.email, '支付成功', ...);
    
  } else if (paymentStatus === 'failed') {
    // 支付失败
    await order.update({
      order_status: 'error'
    });
    
    console.log(`订单 ${order.id} 支付失败`);
    
    // 发送邮件通知
    // await sendEmail(order.email, '支付失败', ...);
  }
  
  return order;
}
```

### 3. 合约续费

```javascript
// 用户续费现有合约
async function renewContract(orderId, paymentInfo) {
  const order = await UserOrder.findByPk(orderId);
  
  if (!order) {
    throw new Error('订单不存在');
  }
  
  if (order.order_status !== 'complete') {
    throw new Error('只能续费已完成的合约');
  }
  
  const t = await sequelize.transaction();
  
  try {
    // 1. 创建新订单(续费订单)
    const newOrder = await UserOrder.create({
      user_id: order.user_id,
      email: order.email,
      product_id: order.product_id,
      product_name: order.product_name,
      product_price: order.product_price,
      hashrate: order.hashrate,
      order_creation_time: new Date(),
      payment_time: null,
      currency_type: paymentInfo.currency,
      country: order.country,
      payment_gateway_id: paymentInfo.gatewayId,
      payment_network_id: paymentInfo.networkId,
      order_status: 'renewing'
    }, { transaction: t });
    
    // 2. 等待支付完成后,在 handlePaymentCallback 中激活新合约
    
    await t.commit();
    
    console.log(`续费订单已创建: ${newOrder.id}`);
    console.log(`等待支付...`);
    
    return newOrder;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}
```

### 4. 订单完成(合约到期)

```javascript
// 定时任务: 检查并完成已到期的订单
async function completeExpiredOrders() {
  const { Op } = require('sequelize');
  
  // 查找所有 active 状态的订单
  const activeOrders = await UserOrder.findAll({
    where: { order_status: 'active' }
  });
  
  for (const order of activeOrders) {
    // 查找对应的挖矿合约
    const contract = await MiningContract.findOne({
      where: {
        user_id: order.user_id,
        contract_type: 'paid contract',
        mining_status: 'mining'
      },
      order: [['contract_creation_time', 'DESC']]
    });
    
    if (!contract) continue;
    
    // 检查合约是否已到期
    if (new Date() > new Date(contract.contract_end_time)) {
      // 合约已到期
      await contract.update({ mining_status: 'completed' });
      await order.update({ order_status: 'complete' });
      
      console.log(`订单 ${order.id} 已完成,合约已到期`);
      
      // 发送邮件通知用户续费
      // await sendEmail(order.email, '合约已到期,请续费', ...);
    }
  }
}

// 每天执行一次
// cron.schedule('0 0 * * *', completeExpiredOrders);
```

---

## 🔍 常用查询

### 1. 查询用户的所有订单

```javascript
const orders = await UserOrder.findAll({
  where: { user_id: 'USER001' },
  order: [['order_creation_time', 'DESC']]
});

console.log(`用户共有 ${orders.length} 个订单`);
```

### 2. 查询用户的激活中订单

```javascript
const activeOrders = await UserOrder.findAll({
  where: {
    user_id: 'USER001',
    order_status: 'active'
  }
});

console.log(`用户有 ${activeOrders.length} 个激活中的合约`);
```

### 3. 查询特定产品的订单

```javascript
const premiumOrders = await UserOrder.findAll({
  where: {
    product_id: '19.99',
    order_status: 'active'
  }
});

console.log(`${premiumOrders.length} 个用户购买了 Premium 套餐`);
```

### 4. 统计各套餐的销量

```javascript
const { fn, col } = require('sequelize');

const salesStats = await UserOrder.findAll({
  attributes: [
    'product_id',
    'product_name',
    [fn('COUNT', col('id')), 'sales_count'],
    [fn('SUM', col('product_price')), 'total_revenue']
  ],
  group: ['product_id', 'product_name']
});

console.log('套餐销量统计:');
salesStats.forEach(stat => {
  console.log(`${stat.product_name}: ${stat.get('sales_count')}笔, 总收入: $${stat.get('total_revenue')}`);
});
```

### 5. 查询待处理的错误订单

```javascript
const errorOrders = await UserOrder.findAll({
  where: { order_status: 'error' }
});

console.log(`有 ${errorOrders.length} 个错误订单需要处理`);
```

### 6. 查询即将到期的订单

```javascript
// 查询最近7天内到期的订单
const { Op } = require('sequelize');

const expiringOrders = await UserOrder.findAll({
  where: { order_status: 'active' },
  include: [{
    model: MiningContract,
    where: {
      contract_end_time: {
        [Op.between]: [new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
      }
    }
  }]
});

console.log(`${expiringOrders.length} 个合约将在7天内到期`);
```

---

## 📊 统计分析

### 1. 计算总收入

```javascript
// 计算所有已支付订单的总收入
async function getTotalRevenue() {
  const { fn, col, Op } = require('sequelize');
  
  const result = await UserOrder.findOne({
    attributes: [
      [fn('SUM', fn('CAST', col('product_price'), 'DECIMAL(10,2)')), 'total_revenue'],
      [fn('COUNT', col('id')), 'total_orders']
    ],
    where: {
      order_status: {
        [Op.in]: ['active', 'complete']
      }
    }
  });
  
  return {
    totalRevenue: parseFloat(result.get('total_revenue') || 0),
    totalOrders: parseInt(result.get('total_orders') || 0)
  };
}

// 使用示例
const revenue = await getTotalRevenue();
console.log(`总收入: $${revenue.totalRevenue}`);
console.log(`总订单数: ${revenue.totalOrders}`);
```

### 2. 计算用户的订单统计

```javascript
// 获取用户的订单统计信息
async function getUserOrderStats(userId) {
  const { fn, col } = require('sequelize');
  
  const stats = await UserOrder.findOne({
    attributes: [
      [fn('COUNT', col('id')), 'total_orders'],
      [fn('SUM', fn('CAST', col('product_price'), 'DECIMAL(10,2)')), 'total_spent'],
      [fn('COUNT', col('id')), 'active_orders'],
    ],
    where: { 
      user_id: userId,
      order_status: 'active'
    }
  });
  
  const allOrders = await UserOrder.count({
    where: { user_id: userId }
  });
  
  return {
    totalOrders: allOrders,
    activeOrders: parseInt(stats.get('active_orders') || 0),
    totalSpent: parseFloat(stats.get('total_spent') || 0)
  };
}

// 使用示例
const userStats = await getUserOrderStats('USER001');
console.log(`用户订单统计:`);
console.log(`- 总订单数: ${userStats.totalOrders}`);
console.log(`- 激活中订单: ${userStats.activeOrders}`);
console.log(`- 总消费: $${userStats.totalSpent}`);
```

### 3. 最受欢迎的套餐

```javascript
// 查找最受欢迎的产品套餐
async function getMostPopularProduct() {
  const { fn, col } = require('sequelize');
  
  const result = await UserOrder.findAll({
    attributes: [
      'product_id',
      'product_name',
      [fn('COUNT', col('id')), 'purchase_count']
    ],
    group: ['product_id', 'product_name'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    limit: 1
  });
  
  if (result.length > 0) {
    const top = result[0];
    console.log(`最受欢迎的套餐: ${top.product_name}`);
    console.log(`销量: ${top.get('purchase_count')}笔`);
    return top;
  }
}
```

---

## 💳 支付网关集成

### Stripe 支付示例

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// 创建支付意图
async function createPaymentIntent(userId, email, productId) {
  const productPrices = {
    '4.99': 499,    // 转换为分
    '6.99': 699,
    '9.99': 999,
    '19.99': 1999,
    '49.99': 4999,
    '99.99': 9999
  };
  
  const amount = productPrices[productId];
  
  // 创建 Stripe 支付意图
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    metadata: {
      user_id: userId,
      product_id: productId
    }
  });
  
  // 预创建订单(状态为 renewing)
  const order = await UserOrder.create({
    user_id: userId,
    email: email,
    product_id: productId,
    product_name: `contract_${productId}`,
    product_price: productId,
    hashrate: 0.0001,  // 根据套餐设置
    order_creation_time: new Date(),
    payment_time: null,
    currency_type: 'USD',
    country: null,
    payment_gateway_id: paymentIntent.id,
    payment_network_id: 'stripe',
    order_status: 'renewing'
  });
  
  return {
    clientSecret: paymentIntent.client_secret,
    orderId: order.id
  };
}

// Stripe Webhook 处理
async function handleStripeWebhook(event) {
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      await handlePaymentCallback(paymentIntent.id, 'success');
      break;
      
    case 'payment_intent.payment_failed':
      const failedIntent = event.data.object;
      await handlePaymentCallback(failedIntent.id, 'failed');
      break;
  }
}
```

---

## ⚠️ 重要注意事项

### 1. 产品枚举值不一致问题

```javascript
// ⚠️ product_id, product_name, product_price 的枚举值需要保持一致
// 当前存在不一致:
// - product_id: '4.99', '6.99', '9.99', '19.99', '49.99', '99.99' (6个)
// - product_price: '4.99', '6.99', '19.99', '49.99', '99.99' (5个,缺少 9.99)

// 建议统一为 6 个套餐:
ALTER TABLE user_orders 
MODIFY COLUMN product_price ENUM('4.99', '6.99', '9.99', '19.99', '49.99', '99.99');
```

### 2. hashrate 字段精度问题

```javascript
// 当前: DECIMAL(18,18) - 只能存储 0-1 的值
// 如果算力值可能 ≥ 1,建议修改:

ALTER TABLE user_orders 
MODIFY COLUMN hashrate DECIMAL(20, 8);
```

### 3. 订单与合约的关联

```javascript
// user_orders 记录购买订单
// mining_contracts 记录实际的挖矿合约

// 一个订单 → 一个挖矿合约
// 需要确保两个表的数据同步

// 建议在 user_orders 中添加字段:
ALTER TABLE user_orders 
ADD COLUMN mining_contract_id INT(11) NULL COMMENT '关联的挖矿合约ID';

// 添加外键
ALTER TABLE user_orders
ADD CONSTRAINT fk_order_contract
FOREIGN KEY (mining_contract_id) REFERENCES mining_contracts(id);
```

### 4. 订单状态转换规则

```javascript
// 订单状态只能按以下方向转换:
// renewing → active (支付成功)
// renewing → error (支付失败)
// active → complete (合约到期)
// error → active (重试支付成功)

// 实现状态转换验证
async function validateStatusTransition(currentStatus, newStatus) {
  const validTransitions = {
    'renewing': ['active', 'error'],
    'active': ['complete'],
    'error': ['active'],
    'complete': []  // 完成状态不能再转换
  };
  
  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`无效的状态转换: ${currentStatus} → ${newStatus}`);
  }
}
```

### 5. 防止重复购买

```javascript
// 检查用户是否已有激活中的同类型订单
async function checkDuplicateOrder(userId, productId) {
  const existingOrder = await UserOrder.findOne({
    where: {
      user_id: userId,
      product_id: productId,
      order_status: 'active'
    }
  });
  
  if (existingOrder) {
    throw new Error('您已有该套餐的激活订单,无需重复购买');
  }
}

// 在创建订单前调用
await checkDuplicateOrder(userId, productId);
```

---

## 🔗 关联关系

### 在 models/index.js 中添加关联

```javascript
// 订单与用户信息关联
UserOrder.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'userInfo'
});

// 订单与挖矿合约关联 (需要先添加 mining_contract_id 字段)
UserOrder.belongsTo(MiningContract, {
  foreignKey: 'mining_contract_id',
  targetKey: 'id',
  as: 'miningContract'
});

// 使用示例: 查询订单并包含用户信息和合约信息
const order = await UserOrder.findOne({
  where: { id: 1 },
  include: [
    {
      model: UserInformation,
      as: 'userInfo'
    },
    {
      model: MiningContract,
      as: 'miningContract'
    }
  ]
});

console.log(`订单ID: ${order.id}`);
console.log(`用户: ${order.userInfo.email}`);
console.log(`套餐: ${order.product_name}`);
console.log(`价格: $${order.product_price}`);
console.log(`算力: ${order.hashrate} BTC/day`);
console.log(`合约状态: ${order.miningContract.mining_status}`);
```

---

## 💡 数据库优化建议

### 1. 添加 mining_contract_id 字段(强烈建议)

```sql
-- 添加挖矿合约ID字段
ALTER TABLE user_orders 
ADD COLUMN mining_contract_id INT(11) NULL COMMENT '关联的挖矿合约ID' AFTER hashrate;

-- 添加外键约束
ALTER TABLE user_orders
ADD CONSTRAINT fk_order_contract
FOREIGN KEY (mining_contract_id) REFERENCES mining_contracts(id)
ON DELETE SET NULL;

-- 添加索引
CREATE INDEX idx_mining_contract_id ON user_orders(mining_contract_id);
```

### 2. 统一产品枚举值

```sql
-- 统一 product_price 枚举值
ALTER TABLE user_orders 
MODIFY COLUMN product_price ENUM('4.99', '6.99', '9.99', '19.99', '49.99', '99.99');
```

### 3. 当前索引配置 ✅

```sql
CREATE INDEX idx_user_id ON user_orders(user_id);
CREATE INDEX idx_email ON user_orders(email);
CREATE INDEX idx_order_status ON user_orders(order_status);
CREATE INDEX idx_order_creation_time ON user_orders(order_creation_time);
CREATE INDEX idx_payment_gateway_id ON user_orders(payment_gateway_id);
CREATE INDEX idx_user_status ON user_orders(user_id, order_status);
```

### 4. 添加支付失败原因字段(建议)

```sql
-- 记录支付失败原因
ALTER TABLE user_orders 
ADD COLUMN payment_error_message VARCHAR(200) NULL COMMENT '支付失败原因' AFTER order_status;
```

### 5. 添加退款字段(建议)

```sql
-- 记录退款信息
ALTER TABLE user_orders 
ADD COLUMN refund_status ENUM('none', 'pending', 'completed') DEFAULT 'none' COMMENT '退款状态' AFTER order_status;

ALTER TABLE user_orders 
ADD COLUMN refund_time DATETIME NULL COMMENT '退款时间' AFTER refund_status;

ALTER TABLE user_orders 
ADD COLUMN refund_amount DECIMAL(10,2) NULL COMMENT '退款金额' AFTER refund_time;
```

---

## 📧 邮件通知模板

### 订单创建成功邮件

```javascript
async function sendOrderCreatedEmail(order) {
  const subject = '订单创建成功';
  const body = `
    您好,
    
    您的订单已成功创建,详情如下:
    
    订单号: ${order.id}
    套餐: ${order.product_name}
    价格: $${order.product_price}
    算力: ${order.hashrate} BTC/day
    状态: 等待支付
    
    请尽快完成支付以激活合约。
    
    此致
    Bitcoin Mining Master 团队
  `;
  
  // await emailService.send(order.email, subject, body);
}
```

### 支付成功邮件

```javascript
async function sendPaymentSuccessEmail(order) {
  const subject = '支付成功,合约已激活';
  const body = `
    您好,
    
    您的支付已成功,合约已激活!
    
    订单号: ${order.id}
    套餐: ${order.product_name}
    价格: $${order.product_price}
    算力: ${order.hashrate} BTC/day
    支付时间: ${order.payment_time}
    
    您的挖矿合约已开始运行,每日收益将自动发放。
    
    此致
    Bitcoin Mining Master 团队
  `;
  
  // await emailService.send(order.email, subject, body);
}
```

### 合约到期提醒邮件

```javascript
async function sendContractExpiringEmail(order, daysLeft) {
  const subject = `合约即将到期 - 还剩 ${daysLeft} 天`;
  const body = `
    您好,
    
    您的挖矿合约即将到期:
    
    订单号: ${order.id}
    套餐: ${order.product_name}
    剩余时间: ${daysLeft} 天
    
    为了不影响您的收益,请及时续费。
    点击下方链接进行续费:
    [续费链接]
    
    此致
    Bitcoin Mining Master 团队
  `;
  
  // await emailService.send(order.email, subject, body);
}
```

---

## 🎯 总结

**核心功能:**
- 记录用户购买付费挖矿合约的订单
- 6 个产品套餐($4.99 - $99.99)
- 包含支付信息(网关、网络、时间)
- 4 种订单状态管理订单生命周期

**业务流程:**
1. 用户选择套餐 → 创建订单(status: renewing)
2. 调用支付网关 → 用户支付
3. 接收支付回调 → 更新状态(status: active)
4. 创建挖矿合约 → 开始挖矿
5. 合约到期 → 更新状态(status: complete)
6. 用户续费 → 重复流程

**技术要点:**
- ⚠️ product_price 枚举值缺少 '9.99',需要修复
- ⚠️ hashrate 使用 DECIMAL(18,18),可能需要调整
- ✅ 建议添加 mining_contract_id 字段关联合约
- ✅ 需要实现订单状态转换验证
- ✅ 集成支付网关(Stripe, PayPal, etc.)
- ✅ 定时任务处理到期订单
- ✅ 邮件通知用户订单状态

**关键关系:**
```
user_orders (订单) ⟷ mining_contracts (合约)
一个订单对应一个挖矿合约
```

现在代码已经完全匹配数据库结构! 🚀
