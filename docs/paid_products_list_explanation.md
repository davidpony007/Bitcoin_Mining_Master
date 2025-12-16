# paid_products_list 表结构说明

## 📋 表字段详解

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| **id** | int(11) | 主键,自增ID | 1, 2, 3... |
| **product_id** | enum | 产品档位标识 | "p0499", "p1999" |
| **product_name** | enum | 合约产品名称 | "contract_4.99" |
| **product_price** | enum | 产品价格(美元) | "4.99", "99.99" |
| **hashrate** | enum | 算力值(Gh/a) | "176.3 Gh/a" |
| **product_contract_duration** | enum | 合约时长 | "720 hours" |

---

## 💎 产品档位配置

### 6个产品套餐的完整配置:

```javascript
const PAID_PRODUCTS = [
  {
    id: 1,
    product_id: 'p0499',
    product_name: 'contract_4.99',
    product_price: '4.99',
    hashrate: '176.3 Gh/a',
    product_contract_duration: '720 hours'
  },
  {
    id: 2,
    product_id: 'p0699',
    product_name: 'contract_6.99',
    product_price: '6.99',
    hashrate: '305.6 Gh/a',
    product_contract_duration: '720 hours'
  },
  {
    id: 3,
    product_id: 'p0999',
    product_name: 'contract_9.99',
    product_price: '9.99',
    hashrate: '611.2 Gh/a',
    product_contract_duration: '720 hours'
  },
  {
    id: 4,
    product_id: 'p1999',
    product_name: 'contract_19.99',
    product_price: '19.99',
    hashrate: '1305.6 Gh/a',
    product_contract_duration: '720 hours'
  },
  {
    id: 5,
    product_id: 'p4999',
    product_name: 'contract_49.99',
    product_price: '49.99',
    hashrate: '3264 Gh/a',
    product_contract_duration: '720 hours'
  },
  {
    id: 6,
    product_id: 'p9999',
    product_name: 'contract_99.99',
    product_price: '99.99',
    hashrate: '6528 Gh/a',
    product_contract_duration: '720 hours'
  }
];
```

### 价格与算力的关系:

| 价格 | 产品ID | 算力 | 性价比 (Gh/a per $) |
|------|--------|------|---------------------|
| $4.99 | p0499 | 176.3 Gh/a | 35.3 |
| $6.99 | p0699 | 305.6 Gh/a | 43.7 |
| $9.99 | p0999 | 611.2 Gh/a | 61.2 |
| $19.99 | p1999 | 1305.6 Gh/a | 65.3 |
| $49.99 | p4999 | 3264 Gh/a | 65.3 |
| $99.99 | p9999 | 6528 Gh/a | 65.3 |

💡 **观察**: 高档位产品($19.99+)的性价比相同,都是 65.3 Gh/a per dollar

---

## 🔄 业务场景代码

### 1. 初始化产品数据

```javascript
// 初始化付费产品列表(仅执行一次)
async function initializePaidProducts() {
  const products = [
    {
      product_id: 'p0499',
      product_name: 'contract_4.99',
      product_price: '4.99',
      hashrate: '176.3 Gh/a',
      product_contract_duration: '720 hours'
    },
    {
      product_id: 'p0699',
      product_name: 'contract_6.99',
      product_price: '6.99',
      hashrate: '305.6 Gh/a',
      product_contract_duration: '720 hours'
    },
    {
      product_id: 'p0999',
      product_name: 'contract_9.99',
      product_price: '9.99',
      hashrate: '611.2 Gh/a',
      product_contract_duration: '720 hours'
    },
    {
      product_id: 'p1999',
      product_name: 'contract_19.99',
      product_price: '19.99',
      hashrate: '1305.6 Gh/a',
      product_contract_duration: '720 hours'
    },
    {
      product_id: 'p4999',
      product_name: 'contract_49.99',
      product_price: '49.99',
      hashrate: '3264 Gh/a',
      product_contract_duration: '720 hours'
    },
    {
      product_id: 'p9999',
      product_name: 'contract_99.99',
      product_price: '99.99',
      hashrate: '6528 Gh/a',
      product_contract_duration: '720 hours'
    }
  ];
  
  try {
    // 清空现有数据
    await PaidProduct.destroy({ where: {} });
    
    // 批量插入
    await PaidProduct.bulkCreate(products);
    
    console.log('✅ 付费产品列表初始化成功!');
    console.log(`已创建 ${products.length} 个产品档位`);
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    throw error;
  }
}

// 执行初始化
// await initializePaidProducts();
```

### 2. 获取所有产品列表

```javascript
// 获取所有付费产品
async function getAllPaidProducts() {
  const products = await PaidProduct.findAll({
    order: [['product_price', 'ASC']]  // 按价格从低到高排序
  });
  
  console.log(`共有 ${products.length} 个付费产品`);
  return products;
}

// 使用示例
const products = await getAllPaidProducts();
products.forEach(p => {
  console.log(`${p.product_name}: $${p.product_price} - ${p.hashrate}`);
});
```

### 3. 根据产品ID获取产品信息

```javascript
// 根据产品ID获取产品详情
async function getProductById(productId) {
  const product = await PaidProduct.findOne({
    where: { product_id: productId }
  });
  
  if (!product) {
    throw new Error(`产品 ${productId} 不存在`);
  }
  
  return product;
}

// 使用示例
const product = await getProductById('p1999');
console.log(`产品: ${product.product_name}`);
console.log(`价格: $${product.product_price}`);
console.log(`算力: ${product.hashrate}`);
console.log(`时长: ${product.product_contract_duration}`);
```

### 4. 根据价格范围查询产品

```javascript
// 查询指定价格范围内的产品
async function getProductsByPriceRange(minPrice, maxPrice) {
  const { Op } = require('sequelize');
  
  // 将价格数字转换为枚举字符串
  const priceEnums = ['4.99', '6.99', '9.99', '19.99', '49.99', '99.99'];
  const validPrices = priceEnums.filter(price => {
    const p = parseFloat(price);
    return p >= minPrice && p <= maxPrice;
  });
  
  const products = await PaidProduct.findAll({
    where: {
      product_price: {
        [Op.in]: validPrices
      }
    },
    order: [['product_price', 'ASC']]
  });
  
  return products;
}

// 使用示例: 查询 $5 到 $20 之间的产品
const midRangeProducts = await getProductsByPriceRange(5, 20);
console.log(`找到 ${midRangeProducts.length} 个中档产品`);
```

### 5. 购买产品(与 user_orders 关联)

```javascript
// 用户购买付费产品
async function purchaseProduct(userId, email, productId, paymentInfo) {
  // 1. 获取产品信息
  const product = await PaidProduct.findOne({
    where: { product_id: productId }
  });
  
  if (!product) {
    throw new Error('产品不存在');
  }
  
  const t = await sequelize.transaction();
  
  try {
    // 2. 创建订单
    const order = await UserOrder.create({
      user_id: userId,
      email: email,
      product_id: product.product_id,
      product_name: product.product_name,
      product_price: product.product_price,
      hashrate: convertHashrateToDecimal(product.hashrate),  // 转换为 DECIMAL
      order_creation_time: new Date(),
      payment_time: null,
      currency_type: paymentInfo.currency || 'USD',
      country: paymentInfo.country || null,
      payment_gateway_id: paymentInfo.gatewayId,
      payment_network_id: paymentInfo.networkId,
      order_status: 'renewing'
    }, { transaction: t });
    
    // 3. 创建挖矿合约
    const contractEndTime = new Date();
    contractEndTime.setHours(contractEndTime.getHours() + 720);  // 720小时后
    
    await MiningContract.create({
      user_id: userId,
      contract_type: 'paid contract',
      contract_duration: product.product_contract_duration,
      hashrate: convertHashrateToDecimal(product.hashrate),
      contract_creation_time: new Date(),
      contract_end_time: contractEndTime,
      mining_status: 'mining'
    }, { transaction: t });
    
    await t.commit();
    
    console.log(`✅ 购买成功!`);
    console.log(`产品: ${product.product_name}`);
    console.log(`价格: $${product.product_price}`);
    console.log(`算力: ${product.hashrate}`);
    
    return order;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

// 算力转换函数: "176.3 Gh/a" → 0.0001763 (示例)
function convertHashrateToDecimal(hashrateString) {
  // 提取数字部分
  const match = hashrateString.match(/^([\d.]+)\s*Gh\/a$/);
  if (!match) {
    throw new Error(`无效的算力格式: ${hashrateString}`);
  }
  
  const ghValue = parseFloat(match[1]);
  
  // 根据实际业务逻辑转换
  // 这里假设 176.3 Gh/a 对应 0.0001763 BTC/day
  return ghValue / 1000000;  // 示例转换
}

// 使用示例
await purchaseProduct(
  'USER001',
  'user@example.com',
  'p1999',
  {
    currency: 'USD',
    country: 'United States',
    gatewayId: 'stripe_ch_xxx',
    networkId: 'visa_4242'
  }
);
```

### 6. 产品推荐算法

```javascript
// 根据用户预算推荐最佳产品
async function recommendProduct(budget) {
  const products = await PaidProduct.findAll({
    order: [['product_price', 'ASC']]
  });
  
  // 找到预算内性价比最高的产品
  let bestProduct = null;
  let bestRatio = 0;
  
  for (const product of products) {
    const price = parseFloat(product.product_price);
    
    if (price <= budget) {
      // 提取算力数值
      const hashrateMatch = product.hashrate.match(/^([\d.]+)\s*Gh\/a$/);
      const hashrate = parseFloat(hashrateMatch[1]);
      
      // 计算性价比
      const ratio = hashrate / price;
      
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestProduct = product;
      }
    }
  }
  
  if (bestProduct) {
    console.log(`推荐产品: ${bestProduct.product_name}`);
    console.log(`价格: $${bestProduct.product_price}`);
    console.log(`算力: ${bestProduct.hashrate}`);
    console.log(`性价比: ${bestRatio.toFixed(2)} Gh/a per dollar`);
    return bestProduct;
  } else {
    console.log('预算不足,无法推荐产品');
    return null;
  }
}

// 使用示例
await recommendProduct(15);  // 预算 $15
// 输出: 推荐 contract_9.99 ($9.99, 611.2 Gh/a)
```

---

## 🔍 常用查询

### 1. 获取最便宜的产品

```javascript
const cheapest = await PaidProduct.findOne({
  order: [['product_price', 'ASC']],
  limit: 1
});

console.log(`最便宜: ${cheapest.product_name} - $${cheapest.product_price}`);
```

### 2. 获取最贵的产品

```javascript
const mostExpensive = await PaidProduct.findOne({
  order: [['product_price', 'DESC']],
  limit: 1
});

console.log(`最贵: ${mostExpensive.product_name} - $${mostExpensive.product_price}`);
```

### 3. 获取算力最高的产品

```javascript
const products = await PaidProduct.findAll();

// 手动比较算力(因为 hashrate 是 ENUM 字符串)
let maxHashrate = 0;
let topProduct = null;

products.forEach(p => {
  const match = p.hashrate.match(/^([\d.]+)\s*Gh\/a$/);
  const hashrate = parseFloat(match[1]);
  
  if (hashrate > maxHashrate) {
    maxHashrate = hashrate;
    topProduct = p;
  }
});

console.log(`算力最高: ${topProduct.product_name} - ${topProduct.hashrate}`);
```

### 4. 计算平均价格

```javascript
const { fn, col } = require('sequelize');

// 注意: product_price 是 ENUM,需要特殊处理
const products = await PaidProduct.findAll();

const totalPrice = products.reduce((sum, p) => {
  return sum + parseFloat(p.product_price);
}, 0);

const avgPrice = totalPrice / products.length;
console.log(`平均价格: $${avgPrice.toFixed(2)}`);
```

---

## 📊 统计分析

### 产品性价比分析

```javascript
// 分析所有产品的性价比
async function analyzeCostEfficiency() {
  const products = await PaidProduct.findAll({
    order: [['product_price', 'ASC']]
  });
  
  console.log('产品性价比分析:');
  console.log('='.repeat(70));
  
  products.forEach(p => {
    const price = parseFloat(p.product_price);
    const hashrateMatch = p.hashrate.match(/^([\d.]+)\s*Gh\/a$/);
    const hashrate = parseFloat(hashrateMatch[1]);
    const ratio = hashrate / price;
    
    console.log(`${p.product_name.padEnd(20)} | $${p.product_price.padEnd(6)} | ${p.hashrate.padEnd(15)} | ${ratio.toFixed(2)} Gh/a/$`);
  });
  
  console.log('='.repeat(70));
}

// 使用示例
await analyzeCostEfficiency();

// 输出:
// 产品性价比分析:
// ======================================================================
// contract_4.99        | $4.99  | 176.3 Gh/a      | 35.33 Gh/a/$
// contract_6.99        | $6.99  | 305.6 Gh/a      | 43.72 Gh/a/$
// contract_9.99        | $9.99  | 611.2 Gh/a      | 61.18 Gh/a/$
// contract_19.99       | $19.99 | 1305.6 Gh/a     | 65.31 Gh/a/$
// contract_49.99       | $49.99 | 3264 Gh/a       | 65.29 Gh/a/$
// contract_99.99       | $99.99 | 6528 Gh/a       | 65.29 Gh/a/$
// ======================================================================
```

---

## ⚠️ 重要注意事项

### 1. hashrate 单位说明

```javascript
// Gh/a = Giga hash per annum (每年千兆哈希)
// 这是一个累计算力单位

// 如果需要转换为日均算力:
// 176.3 Gh/a ÷ 365 天 = 0.483 Gh/day

// 如果需要转换为 BTC 收益:
// 需要根据当前比特币挖矿难度和区块奖励计算
```

### 2. 合约时长固定为 720 小时

```javascript
// 720 hours = 30 days = 1 month
// 所有付费产品的合约时长都是 30 天

// 如果未来要支持不同时长,需要修改 ENUM:
ALTER TABLE paid_products_list 
MODIFY COLUMN product_contract_duration ENUM('720 hours', '1440 hours', '2160 hours');
// 30天, 60天, 90天
```

### 3. 产品档位是固定配置

```javascript
// paid_products_list 表是产品配置表,不是订单表
// 这个表应该只有 6 条记录(6个产品档位)
// 不会频繁增删改

// 如果要修改产品配置:
await PaidProduct.update(
  { hashrate: '200 Gh/a' },
  { where: { product_id: 'p0499' } }
);

// 修改后,新订单会使用新配置
// 但旧订单保持原有配置不变
```

### 4. 与其他表的关系

```javascript
// paid_products_list (产品配置) → user_orders (用户订单)
// product_id 相同

// 查询某产品的所有订单:
const orders = await UserOrder.findAll({
  where: { product_id: 'p1999' }
});

console.log(`产品 p1999 共有 ${orders.length} 个订单`);
```

### 5. 算力与收益的转换

```javascript
// ⚠️ hashrate 是 ENUM 字符串,不能直接用于计算
// 需要先转换为数值

function calculateDailyRevenue(hashrateString) {
  // 提取数值: "176.3 Gh/a" → 176.3
  const match = hashrateString.match(/^([\d.]+)\s*Gh\/a$/);
  const ghPerAnnum = parseFloat(match[1]);
  
  // 转换为日均算力
  const ghPerDay = ghPerAnnum / 365;
  
  // 根据实际挖矿难度和区块奖励计算 BTC 收益
  // 这里仅为示例
  const btcPerGhPerDay = 0.00000001;  // 假设值
  const dailyRevenue = ghPerDay * btcPerGhPerDay;
  
  return dailyRevenue;
}

// 使用示例
const product = await PaidProduct.findOne({ where: { product_id: 'p1999' } });
const revenue = calculateDailyRevenue(product.hashrate);
console.log(`日收益: ${revenue} BTC`);
```

---

## 🔗 关联关系

### 在 models/index.js 中添加关联

```javascript
// paid_products_list 与 user_orders 的关系
// 产品配置表 → 订单表 (一对多)

PaidProduct.hasMany(UserOrder, {
  foreignKey: 'product_id',
  sourceKey: 'product_id',
  as: 'orders'
});

UserOrder.belongsTo(PaidProduct, {
  foreignKey: 'product_id',
  targetKey: 'product_id',
  as: 'product'
});

// 使用示例: 查询产品及其所有订单
const product = await PaidProduct.findOne({
  where: { product_id: 'p1999' },
  include: [{
    model: UserOrder,
    as: 'orders'
  }]
});

console.log(`产品: ${product.product_name}`);
console.log(`订单数: ${product.orders.length}`);

// 使用示例: 查询订单及其产品信息
const order = await UserOrder.findOne({
  where: { id: 1 },
  include: [{
    model: PaidProduct,
    as: 'product'
  }]
});

console.log(`订单 ${order.id}`);
console.log(`产品: ${order.product.product_name}`);
console.log(`算力: ${order.product.hashrate}`);
```

---

## 💡 数据库优化建议

### 1. 当前索引配置 ✅

```sql
CREATE INDEX idx_product_id ON paid_products_list(product_id);
CREATE INDEX idx_product_price ON paid_products_list(product_price);
```

### 2. 添加唯一约束(建议)

```sql
-- 确保每个产品ID只有一条记录
ALTER TABLE paid_products_list
ADD UNIQUE INDEX unique_product_id (product_id);
```

### 3. 外键约束(可选)

```sql
-- 如果要强制 user_orders 的 product_id 必须存在于 paid_products_list
ALTER TABLE user_orders
ADD CONSTRAINT fk_order_product
FOREIGN KEY (product_id) REFERENCES paid_products_list(product_id);
```

---

## 📧 产品展示前端示例

### 产品列表展示

```javascript
// API: GET /api/products/paid
async function getPaidProductsList(req, res) {
  try {
    const products = await PaidProduct.findAll({
      order: [['product_price', 'ASC']]
    });
    
    // 转换为前端友好的格式
    const formattedProducts = products.map(p => ({
      id: p.product_id,
      name: p.product_name,
      price: parseFloat(p.product_price),
      hashrate: p.hashrate,
      duration: '30 days',  // 720 hours = 30 days
      recommended: p.product_id === 'p1999'  // 标记推荐产品
    }));
    
    res.json({
      success: true,
      data: formattedProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
```

---

## 🎯 总结

**核心功能:**
- 存储 6 个付费产品档位的配置信息
- 每个产品包含: ID、名称、价格、算力、合约时长
- 作为产品目录,供用户购买时查询

**产品特点:**
- 价格范围: $4.99 - $99.99 (6个档位)
- 算力范围: 176.3 Gh/a - 6528 Gh/a
- 合约时长: 统一 720 小时 (30天)
- 高档位产品性价比更高 (65.3 Gh/a per dollar)

**使用场景:**
1. 用户浏览产品列表 → 从此表查询
2. 用户选择产品 → 根据 product_id 获取详情
3. 用户购买产品 → 创建 user_order 记录
4. 系统激活合约 → 创建 mining_contract 记录

**关键关系:**
```
paid_products_list (产品配置) 
    ↓ (product_id)
user_orders (用户订单)
    ↓ (关联)
mining_contracts (挖矿合约)
```

现在代码已经完全匹配数据库结构! 🚀
