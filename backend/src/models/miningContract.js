// mining_contracts 表的 Sequelize 模型
// 用于存储用户的挖矿合约信息
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MiningContract = sequelize.define('mining_contracts', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true,
    comment: '挖矿合约主键ID'
  },
  user_id: { 
    type: DataTypes.STRING(30), 
    allowNull: false,
    references: {
      model: 'user_information',
      key: 'user_id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    comment: '用户唯一标识符'
  },
  contract_type: { 
    type: DataTypes.ENUM(
      'Free Ad Reward',
      'Daily Check-in Reward',
      'Invite Friend Reward',
      'paid contract'
    ),
    allowNull: false,
    comment: '合约类型: 广告免费合约/每日签到免费合约/邀请免费合约/付费合约'
  },
  // 关联 paid_products_list_config.product_id（如 p0499），免费合约为 NULL
  product_id: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '关联产品档位ID，如 p0499；免费合约为 NULL'
  },
  // 支付平台来源
  platform: {
    type: DataTypes.ENUM('ios', 'android', 'system'),
    allowNull: false,
    defaultValue: 'system',
    comment: '合约来源: ios=苹果订阅, android=谷歌订阅, system=系统创建(免费合约)'
  },
  contract_creation_time: { 
    type: DataTypes.DATE, 
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '合约创建时间'
  },
  contract_end_time: { 
    type: DataTypes.DATE, 
    allowNull: false,
    comment: '合约结束时间'
  },
  contract_duration: { 
    type: DataTypes.TIME, 
    allowNull: false,
    comment: '合约持续时长'
  },
  hashrate: { 
    type: DataTypes.DECIMAL(20, 18), 
    allowNull: false,
    comment: '算力(BTC/s)，精度18位'
  },
  base_hashrate: {
    type: DataTypes.DECIMAL(20, 18),
    allowNull: true,
    defaultValue: null,
    comment: '基础算力(BTC/s)，不含任何倍数，与 hashrate 相同（付费合约固定收益，免费合约可能加成）'
  },
  is_cancelled: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 0,
    comment: '是否已取消订阅: 0=正常, 1=用户已取消'
  },
  // iOS originalTransactionId / Android 初始购买token：整个订阅生命周期唯一，用于精准续订定位
  original_transaction_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'iOS originalTransactionId 或 Android 初始 purchase_token，订阅生命周期不变，用于续订时定位合约'
  },
  // 关联首次购买的 user_orders.payment_gateway_id，用于合约←→订单双向追溯
  order_id: {
    type: DataTypes.STRING(80),
    allowNull: true,
    comment: '关联 user_orders.payment_gateway_id（首次购买 transaction_id），双向追溯'
  }
}, {
  timestamps: false,
  freezeTableName: true,
  indexes: [
    { fields: ['user_id'], name: 'idx_user_id' },
    { fields: ['contract_type'], name: 'idx_contract_type' },
    { fields: ['product_id'], name: 'idx_product_id' },
    { fields: ['contract_creation_time'], name: 'idx_contract_creation_time' },
    { fields: ['contract_end_time'], name: 'idx_contract_end_time' },
    { fields: ['contract_end_time', 'user_id'], name: 'idx_active_contracts' },
    { fields: ['original_transaction_id'], name: 'idx_original_tx_id' },
    { fields: ['order_id'], name: 'idx_order_id' }
  ],
  comment: '挖矿合约表'
});

module.exports = MiningContract;
