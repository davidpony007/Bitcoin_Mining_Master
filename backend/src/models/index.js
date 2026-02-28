// models/index.js
// 统一导出所有 Sequelize 模型，便于其他模块统一引用

const UserInformation = require('./userInformation');
const UserStatus = require('./userStatus');
const MiningContract = require('./miningContract');
const BitcoinTransactionRecord = require('./bitcoinTransactionRecord');
const FreeContractRecord = require('./freeContractRecord');
const InvitationRebate = require('./invitationRebate');
const InvitationRelationship = require('./invitationRelationship');
// const PaidProduct = require('./paidProductList'); // 已弃用：付费合约使用代码配置，不依赖此表
const UserLog = require('./userLog');
const UserOrder = require('./userOrder');
const WithdrawalRecord = require('./withdrawalRecord');

// 定义模型关联关系

// 1. 一对一关系：用户信息 <-> 用户状态
UserInformation.hasOne(UserStatus, {
  foreignKey: 'user_id',
  sourceKey: 'user_id',
  as: 'status'
});

UserStatus.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'userInfo'
});

// 2. 一对多关系：用户信息 -> 挖矿合约
UserInformation.hasMany(MiningContract, {
  foreignKey: 'user_id',
  sourceKey: 'user_id',
  as: 'miningContracts'
});

MiningContract.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'userInfo'
});

// 3. 一对多关系：用户信息 -> 比特币交易记录
UserInformation.hasMany(BitcoinTransactionRecord, {
  foreignKey: 'user_id',
  sourceKey: 'user_id',
  as: 'transactions'
});

BitcoinTransactionRecord.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'userInfo'
});

// 4. 一对多关系：用户信息 -> 免费合约记录
UserInformation.hasMany(FreeContractRecord, {
  foreignKey: 'user_id',
  sourceKey: 'user_id',
  as: 'freeContracts'
});

FreeContractRecord.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'userInfo'
});

// 5. 一对多关系：用户信息 -> 邀请返利记录
UserInformation.hasMany(InvitationRebate, {
  foreignKey: 'user_id',
  sourceKey: 'user_id',
  as: 'rebates'
});

InvitationRebate.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'userInfo'
});

// 6. 一对一关系：用户信息 -> 邀请关系 (作为被邀请人)
UserInformation.hasOne(InvitationRelationship, {
  foreignKey: 'user_id',
  sourceKey: 'user_id',
  as: 'invitationRelation'
});

InvitationRelationship.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'invitee'
});

// 7. 一对多关系：用户信息 -> 邀请关系 (作为邀请人)
UserInformation.hasMany(InvitationRelationship, {
  foreignKey: 'referrer_user_id',
  sourceKey: 'user_id',
  as: 'referredUsers'
});

InvitationRelationship.belongsTo(UserInformation, {
  foreignKey: 'referrer_user_id',
  targetKey: 'user_id',
  as: 'referrer'
});

// 8. 一对多关系：用户信息 -> 用户订单
UserInformation.hasMany(UserOrder, {
  foreignKey: 'user_id',
  sourceKey: 'user_id',
  as: 'orders'
});

UserOrder.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'userInfo'
});

// 9. 一对多关系：付费产品 -> 用户订单（已弃用）
// PaidProduct.hasMany(UserOrder, {
//   foreignKey: 'product_id',
//   sourceKey: 'product_id',
//   as: 'orders'
// });

// UserOrder.belongsTo(PaidProduct, {
//   foreignKey: 'product_id',
//   targetKey: 'product_id',
//   as: 'product'
// });

// 10. 一对多关系：用户信息 -> 提现记录
UserInformation.hasMany(WithdrawalRecord, {
  foreignKey: 'user_id',
  sourceKey: 'user_id',
  as: 'withdrawals'
});

WithdrawalRecord.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'userInfo'
});

// 11. 一对多关系：用户信息 -> 用户日志
UserInformation.hasMany(UserLog, {
  foreignKey: 'user_id',
  sourceKey: 'user_id',
  as: 'logs'
});

UserLog.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'userInfo'
});

module.exports = {
  UserInformation,
  UserStatus,
  MiningContract,
  BitcoinTransactionRecord,
  FreeContractRecord,
  InvitationRebate,
  InvitationRelationship,
  // PaidProduct, // 已弃用：付费合约使用代码配置
  UserLog,
  UserOrder,
  WithdrawalRecord
};
