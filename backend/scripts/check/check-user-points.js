/**
 * 检查用户积分和交易记录
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

async function checkUserPoints(userId) {
  try {
    console.log('===== 检查用户积分 =====');
    console.log(`用户ID: ${userId}\n`);

    // 1. 查询user_information表的积分
    const [userInfo] = await sequelize.query(
      `SELECT user_id, user_level, user_points 
       FROM user_information WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    console.log('1️⃣  user_information表:');
    console.log(`   user_points: ${userInfo.user_points}`);
    console.log(`   user_level: ${userInfo.user_level}\n`);

    // 2. 查询user_points表（如果存在）
    try {
      const [userPoints] = await sequelize.query(
        `SELECT * FROM user_points WHERE user_id = :userId`,
        { replacements: { userId }, type: QueryTypes.SELECT }
      );
      if (userPoints) {
        console.log('2️⃣  user_points表:');
        console.log(`   total_points: ${userPoints.total_points}`);
        console.log(`   available_points: ${userPoints.available_points}\n`);
      }
    } catch (e) {
      console.log('2️⃣  user_points表不存在\n');
    }

    // 3. 查询积分交易记录
    const transactions = await sequelize.query(
      `SELECT * FROM points_transaction 
       WHERE user_id = :userId 
       ORDER BY created_at DESC LIMIT 10`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    console.log('3️⃣  积分交易记录:');
    if (transactions.length === 0) {
      console.log('   ❌ 没有任何交易记录\n');
    } else {
      transactions.forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.points_type}: ${tx.points_change > 0 ? '+' : ''}${tx.points_change} 积分`);
        console.log(`      余额: ${tx.balance_after}, 时间: ${tx.created_at}`);
      });
      console.log('');
    }

    // 4. 查询广告观看记录
    const adViews = await sequelize.query(
      `SELECT COUNT(*) as count FROM ad_view_record WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    console.log('4️⃣  广告观看记录:');
    console.log(`   总计: ${adViews[0].count} 次\n`);

    // 5. 查询合约记录
    const contracts = await sequelize.query(
      `SELECT * FROM free_contract_records 
       WHERE user_id = :userId 
       ORDER BY free_contract_creation_time DESC LIMIT 5`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    console.log('5️⃣  合约记录:');
    if (contracts.length === 0) {
      console.log('   ❌ 没有合约记录\n');
    } else {
      contracts.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.free_contract_type}`);
        console.log(`      状态: ${c.mining_status}`);
        console.log(`      结束时间: ${c.free_contract_end_time}\n`);
      });
    }

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 查询失败:', error);
    await sequelize.close();
    process.exit(1);
  }
}

const userId = process.argv[2] || 'U2026011910532463989';
checkUserPoints(userId);
