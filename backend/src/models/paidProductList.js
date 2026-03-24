// paid_products_list_config 表的 Sequelize 模型
// 用于存储付费产品档位配置信息（单一数据来源）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaidProduct = sequelize.define('paid_products_list_config', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // 内部产品标识，如 p0499
  product_id: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '产品档位标识，如 p0499'
  },
  // 合约名称，如 contract_4.99
  product_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '合约产品名称，如 contract_4.99'
  },
  // 价格字符串，如 4.99
  product_price: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: '产品价格（美元），如 4.99'
  },
  // 显示算力，如 176.3 Gh/s
  hashrate: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: '显示算力值，如 176.3 Gh/s'
  },
  // 合约时长描述，如 720 hours
  product_contract_duration: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '720 hours',
    comment: '合约时长描述'
  },
  // App Store 商品ID，如 appstore04.99
  ios_product_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'App Store商品ID，如 appstore04.99'
  },
  // Google Play 商品ID，如 p04.99
  android_product_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Google Play商品ID，如 p04.99'
  },
  // 用户界面显示名称，如 Starter Plan
  display_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '用户显示名称，如 Starter Plan'
  },
  // 产品描述文案
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '产品描述'
  },
  // 实际每秒BTC产出（用于计算，不对外展示）
  hashrate_raw: {
    type: DataTypes.DECIMAL(20, 12),
    allowNull: false,
    defaultValue: 0,
    comment: '实际每秒BTC产出，用于挖矿计算'
  },
  // 合约时长（天）
  duration_days: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
    comment: '合约时长（天）'
  },
  // 前端展示排序（升序）
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '显示排序（升序）'
  },
  // 是否上架
  is_active: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '是否上架（1=是，0=否）'
  }
}, {
  timestamps: false,
  freezeTableName: true,
  indexes: [
    { name: 'idx_product_id', fields: ['product_id'] },
    { name: 'idx_ios_product_id', fields: ['ios_product_id'] },
    { name: 'idx_android_product_id', fields: ['android_product_id'] }
  ]
});

module.exports = PaidProduct;
