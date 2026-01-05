// user_information 表的 Sequelize 模型
// 用于存储用户的基本信息
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserInformation = sequelize.define('user_information', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true,
    comment: '用户信息主键ID'
  },
  user_id: { 
    type: DataTypes.STRING(30), 
    allowNull: false,
    comment: '用户唯一标识符（格式：U+年月日时分秒+5位随机数）'
  },
  invitation_code: { 
    type: DataTypes.STRING(30), 
    allowNull: false,
    defaultValue: '',  // 添加默认值为空字符串（由controller自动生成）
    comment: '用户的邀请码（格式：INV+年月日时分秒+4位随机数）'
  },
  email: { 
    type: DataTypes.STRING(100), 
    allowNull: true,
    comment: '用户邮箱地址'
  },
  google_account: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
    comment: '绑定的Google账号邮箱'
  },
  android_id: { 
    type: DataTypes.STRING(32), 
    allowNull: true,  // 允许为空：支持多平台、隐私限制、获取失败等情况
    defaultValue: null,
    comment: 'Android设备ID(可选)'
  },
  gaid: { 
    type: DataTypes.STRING(36), 
    allowNull: true,
    defaultValue: null,
    comment: 'Google Advertising ID(可选)'
  },
  register_ip: { 
    type: DataTypes.STRING(45), 
    allowNull: true,
    comment: '注册时的IP地址（支持IPv6）'
  },
  country: { 
    type: DataTypes.STRING(32), 
    allowNull: true,
    comment: '用户所在国家'
  },
  country_multiplier: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true,
    defaultValue: 1.00,
    comment: '国家挖矿速度倍率,默认1.00'
  },
  user_creation_time: { 
    type: DataTypes.DATE, 
    allowNull: false, 
    defaultValue: DataTypes.NOW,
    comment: '用户创建时间'
  }
}, {
  timestamps: true,                // 启用时间戳
  createdAt: 'user_creation_time', // 使用现有字段作为 createdAt
  updatedAt: false,                // 不使用 updatedAt（因为表中没有这个字段）
  freezeTableName: true,           // 保持表名与模型名一致
  indexes: [
    {
      unique: true,
      fields: ['user_id'],
      name: 'idx_user_id'
    },
    {
      fields: ['invitation_code'],
      name: 'idx_invitation_code'
    },
    {
      fields: ['email'],
      name: 'idx_email'
    }
  ],
  comment: '用户基本信息表'
});

module.exports = UserInformation;
