// user_status 表的 Sequelize 模型
// 用于存储用户的账户状态和余额信息
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserStatus = sequelize.define('user_status', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true,
    comment: '用户状态主键ID'
  },
  user_id: { 
    type: DataTypes.STRING(30), 
    allowNull: false,
    unique: true,
    references: {
      model: 'user_information',
      key: 'user_id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    comment: '用户唯一标识符'
  },
  bitcoin_accumulated_amount: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: true,
    defaultValue: 0,
    comment: '累计挖矿获得的比特币总量'
  },
  current_bitcoin_balance: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: true,
    defaultValue: 0,
    comment: '当前比特币余额'
  },
  total_invitation_rebate: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: true,
    defaultValue: 0,
    comment: '累计邀请返利总额'
  },
  total_withdrawal_amount: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: true,
    defaultValue: 0,
    comment: '累计提现总额'
  },
  last_login_time: { 
    type: DataTypes.DATE, 
    allowNull: true,
    defaultValue: DataTypes.NOW,
    comment: '最后登录时间'
  },
  user_status: { 
    type: DataTypes.ENUM(
      'active within 3 days',
      'no login within 7 days',
      'disabled',
      'deleted',
      'normal'
    ),
    allowNull: true,
    defaultValue: 'normal',
    comment: '用户活跃状态'
  }
}, {
  timestamps: false,
  freezeTableName: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id'],
      name: 'idx_user_id'
    },
    {
      fields: ['user_status'],
      name: 'idx_user_status'
    },
    {
      fields: ['last_login_time'],
      name: 'idx_last_login_time'
    }
  ],
  comment: '用户账户状态表'
});

module.exports = UserStatus;
