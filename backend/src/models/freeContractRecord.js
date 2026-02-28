// free_contract_records 表的 Sequelize 模型
// 用于存储用户的免费合约记录(广告、签到等)
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FreeContractRecord = sequelize.define('free_contract_records', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true,
    comment: '免费合约记录主键ID'
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
  free_contract_type: { 
    type: DataTypes.ENUM(
      'Free Ad Reward',
      'Daily Check-in Reward',
      'Invite Friend Reward',
      'Bind Referrer Reward'
    ),
    allowNull: true,
    comment: '免费合约类型: 广告免费合约/每日签到/邀请奖励/绑定推荐人'
  },
  free_contract_revenue: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: true,
    defaultValue: 0,
    comment: '合约总收益(BTC)'
  },
  free_contract_creation_time: { 
    type: DataTypes.DATE, 
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '合约创建时间'
  },
  free_contract_end_time: { 
    type: DataTypes.DATE, 
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '合约结束时间'
  },
  hashrate: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: true,
    comment: '算力(hashrate)'
  },
  base_hashrate: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: true,
    defaultValue: 0.000000000000139,
    comment: '纯基础算力(不含任何倍数)'
  },
  has_daily_bonus: { 
    type: DataTypes.BOOLEAN, 
    allowNull: true,
    defaultValue: false,
    comment: '是否包含签到加成(1.36倍)'
  },
  mining_status: { 
    type: DataTypes.ENUM('completed', 'mining', 'error'),
    allowNull: true,
    comment: '挖矿状态'
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
      fields: ['free_contract_type'],
      name: 'idx_free_contract_type'
    },
    {
      fields: ['free_contract_creation_time'],
      name: 'idx_free_contract_creation_time'
    },
    {
      fields: ['free_contract_end_time', 'user_id'],
      name: 'idx_active_contracts'
    }
  ],
  comment: '免费合约记录表'
});

module.exports = FreeContractRecord;
