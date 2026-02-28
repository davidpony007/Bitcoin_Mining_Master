// user_log 表的 Sequelize 模型
// 用于存储用户操作日志
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserLog = sequelize.define('user_log', {
  // 主键，自增ID
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true,
    comment: '用户日志主键ID'
  },
  // 用户ID
  user_id: { 
    type: DataTypes.STRING(15), 
    allowNull: false,
    comment: '用户唯一标识符'
  },
  // 操作内容
  action: { 
    type: DataTypes.STRING(100), 
    allowNull: false,
    comment: '用户操作行为描述'
  },
  // 日志时间
  log_time: { 
    type: DataTypes.DATE, 
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '日志记录时间'
  }
}, {
  timestamps: false,
  freezeTableName: true,
  indexes: [
    {
      fields: ['user_id'],
      name: 'idx_user_id',
      comment: '用户ID索引 - 查询特定用户的所有日志'
    },
    {
      fields: ['log_time'],
      name: 'idx_log_time',
      comment: '日志时间索引 - 按时间排序查询'
    },
    {
      fields: ['user_id', 'log_time'],
      name: 'idx_user_log_time',
      comment: '复合索引 - 查询特定用户在特定时间段的日志'
    },
    {
      fields: ['action'],
      name: 'idx_action',
      comment: '操作类型索引 - 查询特定类型的操作日志'
    }
  ],
  comment: '用户操作日志表'
});

module.exports = UserLog;
