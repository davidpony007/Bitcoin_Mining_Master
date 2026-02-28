/**
 * 验证用户数据已重置
 */

require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);

async function verifyReset(userId) {
  try {
    console.log('\n===== 验证用户数据重置 =====');
    console.log(`用户ID: ${userId}\n`);

    // 1. 查询用户基本信息
    const [userInfo] = await sequelize.query(
      `SELECT user_id, user_level, user_points, mining_speed_multiplier 
       FROM user_information WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    console.log('1️⃣  用户基本信息:');
    console.log(`   等级: Lv.${userInfo.user_level}`);
    console.log(`   积分: ${userInfo.user_points}/20`);
    console.log(`   倍率: ${userInfo.mining_speed_multiplier}x\n`);

    // 2. 查询用户余额
    const [userStatus] = await sequelize.query(
      `SELECT bitcoin_accumulated_amount, current_bitcoin_balance 
       FROM user_status WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    console.log('2️⃣  用户余额:');
    console.log(`   BTC余额: ${userStatus.current_bitcoin_balance}`);
    console.log(`   累计挖矿: ${userStatus.bitcoin_accumulated_amount}\n`);

    // 3. 查询积分交易记录
    const pointsTx = await sequelize.query(
      `SELECT COUNT(*) as count FROM points_transaction WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    console.log('3️⃣  积分交易记录:');
    console.log(`   记录数: ${pointsTx[0].count} 条\n`);

    // 4. 查询广告记录
    const adViews = await sequelize.query(
      `SELECT COUNT(*) as count FROM ad_view_record WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    console.log('4️⃣  广告观看记录:');
    console.log(`   记录数: ${adViews[0].count} 条\n`);

    // 5. 查询合约记录
    const freeContracts = await sequelize.query(
      `SELECT COUNT(*) as count FROM free_contract_records WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    const paidContracts = await sequelize.query(
      `SELECT COUNT(*) as count FROM mining_contracts WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    console.log('5️⃣  挖矿合约:');
    console.log(`   免费合约: ${freeContracts[0].count} 个`);
    console.log(`   付费合约: ${paidContracts[0].count} 个\n`);

    // 6. 查询签到记录
    const checkIns = await sequelize.query(
      `SELECT COUNT(*) as count FROM check_in_record WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    console.log('6️⃣  签到记录:');
    console.log(`   记录数: ${checkIns[0].count} 条\n`);

    console.log('===== ✅ 验证完成 =====');
    console.log('所有数据已重置为初始状态，可以开始测试！\n');

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 验证失败:', error);
    await sequelize.close();
    process.exit(1);
  }
}

const userId = process.argv[2] || 'U2026011910532463989';
verifyReset(userId);
