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
  apple_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
    comment: 'Apple用户唯一ID (sub)，首次登录后固定不变'
  },
  apple_account: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
    comment: 'Apple账号邮箱（仅首次授权时可获取，可能为空）'
  },
  nickname: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null,
    comment: '用户昵称'
  },
  android_id: { 
    type: DataTypes.STRING(255),  // 扩展长度支持长指纹
    allowNull: true,  // 允许为空：支持多平台、隐私限制、获取失败等情况
    defaultValue: null,
    comment: 'Android设备ID（支持长指纹）'
  },
  gaid: { 
    type: DataTypes.STRING(36), 
    allowNull: true,
    defaultValue: null,
    comment: 'Google Advertising ID(可选)'
  },
  idfv: {
    type: DataTypes.STRING(36),
    allowNull: true,
    defaultValue: null,
    comment: 'iOS设备厂商标识符(无需权限)'
  },
  idfa: {
    type: DataTypes.STRING(36),
    allowNull: true,
    defaultValue: null,
    comment: 'iOS广告追踪标识符(需ATT授权)'
  },
  att_status: {
    type: DataTypes.TINYINT(1),
    allowNull: true,
    defaultValue: null,
    comment: 'iOS ATT授权状态: 0=未询问 1=受限 2=拒绝 3=已授权'
  },
  att_consent_updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
    comment: 'ATT状态最后更新时间'
  },
  idfv: {
    type: DataTypes.STRING(36),
    allowNull: true,
    defaultValue: null,
    comment: 'iOS设备厂商标识符(无需权限)'
  },
  idfa: {
    type: DataTypes.STRING(36),
    allowNull: true,
    defaultValue: null,
    comment: 'iOS广告追踪标识符(需ATT授权)'
  },
  att_status: {
    type: DataTypes.TINYINT(1),
    allowNull: true,
    defaultValue: null,
    comment: 'iOS ATT授权状态: 0=未询问 1=受限 2=拒绝 3=已授权'
  },
  att_consent_updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
    comment: 'ATT状态最后更新时间'
  },
  register_ip: { 
    type: DataTypes.STRING(45), 
    allowNull: true,
    comment: '注册时的IP地址（支持IPv6）'
  },
  country_code: { 
    type: DataTypes.STRING(32), 
    allowNull: true,
    comment: '用户所在国家代码（如：CN, US等）'
  },
  country_name_cn: { 
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: '',
    comment: '国家中文名称'
  },
  country_multiplier: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true,
    defaultValue: 1.00,
    comment: '国家挖矿速度倍率（对应 country_mining_config.mining_multiplier）,默认1.00'
  },
  miner_level_multiplier: {
    type: DataTypes.DECIMAL(8, 6),
    allowNull: true,
    defaultValue: 1.000000,
    comment: '矿工等级挖矿倍率'
  },
  user_level: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1,
    comment: '用户等级'
  },
  user_points: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: '用户积分'
  },
  mining_speed_multiplier: {
    type: DataTypes.VIRTUAL,
    allowNull: true,
    defaultValue: 1.000000,
    comment: '挖矿速度倍率（虚拟字段，生产库中不存在此列）'
  },
  total_ad_views: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: '累计广告观看次数'
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
      unique: true,  // 唯一约束
      fields: ['invitation_code'],
      name: 'idx_invitation_code_unique'
    },
    {
      unique: true,  // 唯一约束
      fields: ['android_id'],
      name: 'idx_android_id_unique'
    },
    {
      unique: true,  // 唯一约束
      fields: ['apple_id'],
      name: 'idx_apple_id_unique'
    },
    {
      fields: ['email'],
      name: 'idx_email'
    },
    {
      fields: ['gaid'],
      name: 'idx_gaid'
    },
    {
      fields: ['register_ip'],
      name: 'idx_register_ip'
    },
    {
      fields: ['country'],
      name: 'idx_country_code'
    },
    {
      fields: ['user_creation_time'],
      name: 'idx_user_creation_time'
    }
  ],
  comment: '用户基本信息表'
});

module.exports = UserInformation;
