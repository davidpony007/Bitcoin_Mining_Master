// user_orders 表的 Sequelize 模型
// 用于存储用户的付费合约订单信息
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserOrder = sequelize.define('user_orders', {
  // 主键，自增ID
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  
  // 用户ID
  user_id: { 
    type: DataTypes.STRING(15), 
    allowNull: false,
    comment: '用户唯一标识符'
  },
  
  // 用户邮箱
  email: { 
    type: DataTypes.STRING(80), 
    allowNull: false,
    comment: '用户邮箱地址'
  },
  
  // Google账号
  google_account: { 
    type: DataTypes.STRING(100), 
    allowNull: true,
    comment: '用户Google账号'
  },
  
  // 产品ID (价格枚举)
  product_id: { 
    type: DataTypes.ENUM('p0499', 'p0699', 'p0999', 'p1999'),
    allowNull: false,
    comment: '产品档位标识'
  },
  
  // 产品名称 (合约名称)
  product_name: { 
    type: DataTypes.ENUM(
      'contract_4.99', 
      'contract_6.99', 
      'contract_9.99', 
      'contract_19.99'
    ),
    allowNull: false,
    comment: '合约产品名称'
  },
  
  // 产品价格
  product_price: { 
    type: DataTypes.ENUM('4.99', '6.99', '9.99', '19.99'),
    allowNull: false,
    comment: '产品价格(美元)'
  },
  
  // 算力值
  hashrate: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: false,
    defaultValue: 0,
    comment: '合约算力值'
  },
  
  // 订单创建时间
  order_creation_time: { 
    type: DataTypes.DATE, 
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '订单创建时间'
  },
  
  // 支付完成时间
  payment_time: { 
    type: DataTypes.DATE, 
    allowNull: true,
    comment: '支付完成时间'
  },
  
  // 货币类型
  currency_type: { 
    type: DataTypes.STRING(30), 
    allowNull: false,
    comment: '支付货币类型(USD, EUR, etc.)'
  },
  
  // 国家代码
  country_code: { 
    type: DataTypes.STRING(30), 
    allowNull: true,
    comment: '国家代码'
  },
  
  // 支付网关ID
  payment_gateway_id: { 
    type: DataTypes.STRING(80), 
    allowNull: false,
    comment: '支付网关标识符'
  },
  
  // 支付网络ID
  payment_network_id: { 
    type: DataTypes.STRING(80), 
    allowNull: false,
    comment: '支付网络标识符'
  },
  
  // 订单状态
  order_status: { 
    type: DataTypes.ENUM('active', 'renewing', 'complete', 'error', 'refund request in progress', 'refund successful', 'refund rejected'),
    allowNull: true,
    defaultValue: 'active',
    comment: '订单状态: active-激活中, renewing-续费中, complete-已完成, error-错误, refund request in progress-退款请求中, refund successful-退款成功, refund rejected-退款拒绝'
  }
}, {
  timestamps: false,
  freezeTableName: true,
  indexes: [
    // 用户ID索引 - 查询用户的所有订单
    {
      name: 'idx_user_id',
      fields: ['user_id']
    },
    // 邮箱索引 - 通过邮箱查询订单
    {
      name: 'idx_email',
      fields: ['email']
    },
    // 订单状态索引 - 查询特定状态的订单
    {
      name: 'idx_order_status',
      fields: ['order_status']
    },
    // 订单创建时间索引 - 按时间排序
    {
      name: 'idx_order_creation_time',
      fields: ['order_creation_time']
    },
    // 支付网关ID索引 - 查询特定支付网关的订单
    {
      name: 'idx_payment_gateway_id',
      fields: ['payment_gateway_id']
    },
    // 用户+状态复合索引 - 查询用户特定状态的订单
    {
      name: 'idx_user_status',
      fields: ['user_id', 'order_status']
    }
  ]
});

module.exports = UserOrder;
