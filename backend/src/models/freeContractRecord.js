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
      'ad free contract',
      'daily sign-in free contract',
      'invitation free contract'
    ),
    allowNull: true,
    comment: '免费合约类型: 广告免费合约/每日签到/邀请奖励'
  },
  free_contract_revenue: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: true,
    comment: '免费合约收益金额'
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
  mining_status: { 
    type: DataTypes.ENUM('completed', 'mining', 'error'),
    allowNull: true,
    comment: '挖矿状态: completed=已完成, mining=挖矿中, error=错误'
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
      fields: ['mining_status'],
      name: 'idx_mining_status'
    },
    {
      fields: ['free_contract_creation_time'],
      name: 'idx_free_contract_creation_time'
    },
    {
      fields: ['user_id', 'mining_status'],
      name: 'idx_user_status'
    },
    // 复合索引优化实时余额查询（覆盖mining_status='mining' AND end_time > NOW()）
    {
      fields: ['mining_status', 'free_contract_end_time', 'user_id'],
      name: 'idx_active_mining'
    }
  ],
  comment: '免费合约记录表'
});

module.exports = FreeContractRecord;
