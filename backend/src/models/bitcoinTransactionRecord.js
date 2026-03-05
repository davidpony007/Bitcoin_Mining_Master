// bitcoin_transaction_records 表的 Sequelize 模型
// 用于存储用户的比特币交易记录
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BitcoinTransactionRecord = sequelize.define('bitcoin_transaction_records', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true,
    comment: '交易记录主键ID'
  },
  user_id: { 
    type: DataTypes.STRING(15), 
    allowNull: false,
    comment: '用户唯一标识符'
  },
  transaction_type: { 
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '交易类型: Free Ad Reward / Daily Check-in Reward / Invite Friend Reward / Bind Referrer Reward / contract_4.99 / contract_6.99 / contract_9.99 / contract_19.99 / withdrawal / subordinate rebate / refund for withdrawal failure / mining_reward'
  },
  transaction_amount: { 
    type: DataTypes.DECIMAL(20, 18), 
    allowNull: false,
    comment: '交易金额(比特币数量，正数)'
  },
  balance_after: {
    type: DataTypes.DECIMAL(20, 18),
    allowNull: true,
    defaultValue: null,
    comment: '交易后余额 (BTC)'
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null,
    comment: '交易描述 (人类可读)'
  },
  transaction_creation_time: { 
    type: DataTypes.DATE, 
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '交易创建时间'
  },
  transaction_status: { 
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'success',
    comment: '交易状态: success / error / pending'
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
      fields: ['transaction_type'],
      name: 'idx_transaction_type'
    },
    {
      fields: ['transaction_status'],
      name: 'idx_transaction_status'
    },
    {
      fields: ['transaction_creation_time'],
      name: 'idx_transaction_creation_time'
    }
  ],
  comment: '比特币交易记录表'
});

module.exports = BitcoinTransactionRecord;
