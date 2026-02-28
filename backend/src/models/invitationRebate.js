// invitation_rebate 表的 Sequelize 模型
// 用于存储邀请返利记录(上级用户获得的返利)
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvitationRebate = sequelize.define('invitation_rebate', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true,
    comment: '返利记录主键ID'
  },
  user_id: { 
    type: DataTypes.STRING(15), 
    allowNull: false,
    comment: '获得返利的用户ID(上级/邀请人)'
  },
  invitation_code: { 
    type: DataTypes.STRING(11), 
    allowNull: false,
    comment: '上级用户的邀请码'
  },
  subordinate_user_id: { 
    type: DataTypes.STRING(15), 
    allowNull: true,
    comment: '下级用户ID(产生返利的用户,可为空)'
  },
  subordinate_user_invitation_code: { 
    type: DataTypes.STRING(11), 
    allowNull: true,
    comment: '下级用户的邀请码(可为空)'
  },
  subordinate_rebate_amount: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: true,
    comment: '返利金额(比特币数量)'
  },
  rebate_creation_time: { 
    type: DataTypes.DATE, 
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '返利创建时间'
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
      fields: ['invitation_code'],
      name: 'idx_invitation_code'
    },
    {
      fields: ['subordinate_user_id'],
      name: 'idx_subordinate_user_id'
    },
    {
      fields: ['rebate_creation_time'],
      name: 'idx_rebate_creation_time'
    },
    {
      fields: ['user_id', 'rebate_creation_time'],
      name: 'idx_user_time'
    }
  ],
  comment: '邀请返利记录表'
});

module.exports = InvitationRebate;
