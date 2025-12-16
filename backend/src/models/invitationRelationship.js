// invitation_relationship 表的 Sequelize 模型
// 用于存储用户的邀请关系记录
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvitationRelationship = sequelize.define('invitation_relationship', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true,
    comment: '邀请关系主键ID'
  },
  user_id: { 
    type: DataTypes.STRING(30), 
    allowNull: false,
    comment: '被邀请用户ID(新注册用户)'
  },
  invitation_code: { 
    type: DataTypes.STRING(30), 
    allowNull: false,
    comment: '被邀请用户自己的邀请码'
  },
  referrer_user_id: { 
    type: DataTypes.STRING(30), 
    allowNull: true,
    comment: '推荐人用户ID(邀请者ID,可为空表示无推荐人)'
  },
  referrer_invitation_code: { 
    type: DataTypes.STRING(30), 
    allowNull: true,
    comment: '推荐人的邀请码(可为空)'
  },
  invitation_creation_time: { 
    type: DataTypes.DATE, 
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '邀请关系创建时间'
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
      unique: true,
      fields: ['invitation_code'],
      name: 'idx_invitation_code'
    },
    {
      fields: ['referrer_user_id'],
      name: 'idx_referrer_user_id'
    },
    {
      fields: ['referrer_invitation_code'],
      name: 'idx_referrer_invitation_code'
    },
    {
      fields: ['invitation_creation_time'],
      name: 'idx_invitation_creation_time'
    }
  ],
  comment: '用户邀请关系表'
});

module.exports = InvitationRelationship;
