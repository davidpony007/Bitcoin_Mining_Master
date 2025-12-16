// country_config 表的 Sequelize 模型
// 用于存储不同国家的挖矿速率配置
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CountryConfig = sequelize.define('country_config', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '主键ID'
  },
  country_code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
    comment: '国家代码（ISO 3166-1 alpha-2）'
  },
  country_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '国家名称'
  },
  mining_speed_multiplier: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 1.00,
    comment: '挖矿速度倍数'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否启用'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '更新时间'
  }
}, {
  tableName: 'country_config',
  timestamps: false,
  underscored: true,
  comment: '国家配置表 - 不同国家的挖矿速率配置'
});

module.exports = CountryConfig;
