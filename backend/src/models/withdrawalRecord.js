// withdrawal_records 表的 Sequelize 模型
// 用于存储用户提现记录
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WithdrawalRecord = sequelize.define('withdrawal_records', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true,
    comment: '提现记录主键ID'
  },
  user_id: { 
    type: DataTypes.STRING(30), 
    allowNull: false,
    comment: '用户唯一标识符'
  },
  email: { 
    type: DataTypes.STRING(60), 
    allowNull: false,
    comment: '用户邮箱地址'
  },
  wallet_address: { 
    type: DataTypes.STRING(80), 
    allowNull: false,
    comment: '提现钱包地址'
  },
  withdrawal_request_amount: { 
    type: DataTypes.DECIMAL(20, 8), 
    allowNull: false,
    comment: '用户申请提现金额(扣除手续费前)'
  },
  network_fee: { 
    type: DataTypes.DECIMAL(20, 8), 
    allowNull: false,
    comment: '网络手续费'
  },
  received_amount: { 
    type: DataTypes.DECIMAL(20, 8), 
    allowNull: false,
    comment: '实际到账金额(扣除手续费后)'
  },
  withdrawal_status: { 
    type: DataTypes.ENUM('success', 'pending', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
    comment: '提现状态: success=成功, pending=待处理, rejected=已拒绝'
  },
  google_account: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
    comment: 'Google账号邮箱，用于用户去重标识'
  },
  apple_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
    comment: 'Apple用户唯一ID(sub)，用于用户去重标识'
  }
}, {
  timestamps: false,
  freezeTableName: true,
  indexes: [
    {
      fields: ['user_id'],
      name: 'idx_user_id'
    },
    {
      fields: ['email'],
      name: 'idx_email'
    },
    {
      fields: ['wallet_address'],
      name: 'idx_wallet_address'
    },
    {
      fields: ['withdrawal_status'],
      name: 'idx_withdrawal_status'
    },
    {
      fields: ['user_id', 'withdrawal_status'],
      name: 'idx_user_status'
    }
  ],
  comment: '用户提现记录表'
});

module.exports = WithdrawalRecord;
