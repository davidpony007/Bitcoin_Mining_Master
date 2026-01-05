// paid_products_list 表的 Sequelize 模型
// 用于存储付费产品档位配置信息
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaidProduct = sequelize.define('paid_products_list', {
  // 主键，自增ID
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  
  // 产品ID (档位标识)
  product_id: { 
    type: DataTypes.ENUM('p0499', 'p0699', 'p0999', 'p1999', 'p4999', 'p9999'),
    allowNull: false,
    comment: '产品档位标识'
  },
  
  // 产品名称 (合约名称)
  product_name: { 
    type: DataTypes.ENUM(
      'contract_4.99', 
      'contract_6.99', 
      'contract_9.99', 
      'contract_19.99', 
      'contract_49.99', 
      'contract_99.99'
    ),
    allowNull: false,
    comment: '合约产品名称'
  },
  
  // 产品价格 (美元)
  product_price: { 
    type: DataTypes.ENUM('4.99', '6.99', '9.99', '19.99', '49.99', '99.99'),
    allowNull: false,
    comment: '产品价格(美元)'
  },
  
  // 算力值
  hashrate: { 
    type: DataTypes.ENUM(
      '176.3 Gh/s', 
      '305.6 Gh/s', 
      '611.2 Gh/s', 
      '1326.4 Gh/s', 
      '2915.6 Gh/s', 
      '6122.7 Gh/s'
    ),
    allowNull: false,
    comment: '算力值'
  },
  
  // 合约时长
  product_contract_duration: { 
    type: DataTypes.ENUM('720 hours'),
    allowNull: false,
    comment: '合约时长(720小时=30天)'
  }
}, {
  timestamps: false,
  freezeTableName: true,
  indexes: [
    // 产品ID索引 - 通过产品ID快速查询
    {
      name: 'idx_product_id',
      fields: ['product_id']
    },
    // 产品价格索引 - 按价格查询产品
    {
      name: 'idx_product_price',
      fields: ['product_price']
    }
  ]
});

module.exports = PaidProduct;
