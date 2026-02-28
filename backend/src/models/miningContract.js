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
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: false,
    comment: '算力(hashrate)'
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
      fields: ['contract_type'],
      name: 'idx_contract_type'
    },
    {
      fields: ['contract_creation_time'],
      name: 'idx_contract_creation_time'
    },
    {
      fields: ['contract_end_time'],
      name: 'idx_contract_end_time'
    },
    {
      fields: ['contract_end_time', 'user_id'],
      name: 'idx_active_contracts'
    }
  ],
  comment: '挖矿合约表'
});

module.exports = MiningContract;
