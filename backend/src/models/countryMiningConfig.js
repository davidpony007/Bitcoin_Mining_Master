/**
 * 国家挖矿配置模型
 * 
 * 功能说明:
 * - 管理不同国家的挖矿速率倍率
 * - 支持启用/禁用特定国家的配置
 * - 提供国家级别的挖矿倍率查询
 * 
 * 表结构:
 * - id: 自增主键
 * - country_code: 国家代码 (2位 ISO 3166-1 alpha-2)
 * - country_name: 英文名称
 * - country_name_cn: 中文名称
 * - mining_multiplier: 挖矿速率倍率
 * - is_active: 是否启用
 * - created_at: 创建时间
 * - updated_at: 更新时间
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CountryMiningConfig = sequelize.define('CountryMiningConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '自增主键'
  },
  country_code: {
    type: DataTypes.STRING(2),
    allowNull: false,
    unique: true,
    comment: '国家代码 (ISO 3166-1 alpha-2)',
    validate: {
      len: [2, 2],
      isUppercase: true
    }
  },
  country_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '国家英文名称'
  },
  country_name_cn: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '国家中文名称'
  },
  mining_multiplier: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 1.00,
    comment: '挖矿速率倍率',
    validate: {
      min: 0.01,
      max: 999.99
    }
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
  tableName: 'country_mining_config',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['country_code']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['mining_multiplier']
    }
  ],
  comment: '国家挖矿速率配置表'
});

module.exports = CountryMiningConfig;
