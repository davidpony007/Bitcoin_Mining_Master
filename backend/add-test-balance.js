/**
 * 为测试用户添加比特币余额
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

async function addTestBalance(userId, balance) {
  try {
    console.log('===== 添加测试余额 =====');
    console.log(`用户ID: ${userId}`);
    console.log(`添加余额: ${balance} BTC`);

    // 更新用户余额
    await sequelize.query(
      `UPDATE user_status 
       SET current_bitcoin_balance = :balance,
           bitcoin_accumulated_amount = :balance
       WHERE user_id = :userId`,
      { 
        replacements: { userId, balance }, 
        type: QueryTypes.UPDATE 
      }
    );

    // 验证更新结果
    const [result] = await sequelize.query(
      `SELECT current_bitcoin_balance, bitcoin_accumulated_amount 
       FROM user_status 
       WHERE user_id = :userId`,
      { 
        replacements: { userId }, 
        type: QueryTypes.SELECT 
      }
    );

    if (result) {
      console.log('\n✅ 余额更新成功！');
      console.log(`   当前余额: ${result.current_bitcoin_balance} BTC`);
      console.log(`   累计挖矿: ${result.bitcoin_accumulated_amount} BTC`);
    } else {
      console.log('\n❌ 未找到用户记录');
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

// 从命令行参数获取用户ID和余额，或使用默认值
const userId = process.argv[2] || 'U2026011910532463989';
const balance = process.argv[3] || '0.98234234536';

addTestBalance(userId, balance);
