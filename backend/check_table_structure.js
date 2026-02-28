/**
 * 检查签到相关表的结构
 */
const mysql = require('mysql2/promise');

async function checkTables() {
  const connection = await mysql.createConnection({
    host: '47.79.232.189',
    port: 3306,
    user: 'bitcoin_mining_master',
    password: 'FzFbWmwMptnN3ABE',
    database: 'bitcoin_mining_master'
  });

  try {
    console.log('=== check_in_record 表结构 ===');
    const [fields1] = await connection.query('DESCRIBE check_in_record');
    console.table(fields1);

    console.log('\n=== check_in_reward_config 表结构 ===');
    const [fields2] = await connection.query('DESCRIBE check_in_reward_config');
    console.table(fields2);

    console.log('\n=== cumulative_check_in_reward 表结构 ===');
    const [fields3] = await connection.query('DESCRIBE cumulative_check_in_reward');
    console.table(fields3);

    console.log('\n=== ad_view_record 表结构 ===');
    const [fields4] = await connection.query('DESCRIBE ad_view_record');
    console.table(fields4);

    console.log('\n=== 检查用户 U2026011910532463989 在各表中的数据 ===');
    const userId = 'U2026011910532463989';
    
    const [checkIn] = await connection.query('SELECT * FROM check_in_record WHERE user_id = ?', [userId]);
    console.log(`\ncheck_in_record: ${checkIn.length} 条记录`);
    
    const [adView] = await connection.query('SELECT * FROM ad_view_record WHERE user_id = ?', [userId]);
    console.log(`ad_view_record: ${adView.length} 条记录`);
    
    const [cumulative] = await connection.query('SELECT * FROM cumulative_check_in_reward WHERE user_id = ?', [userId]);
    console.log(`cumulative_check_in_reward: ${cumulative.length} 条记录`);
    
    const [userInfo] = await connection.query('SELECT * FROM user_information WHERE user_id = ?', [userId]);
    console.log(`user_information: ${userInfo.length} 条记录`);
    if (userInfo.length > 0) {
      console.log('用户信息:', userInfo[0]);
    }

  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await connection.end();
  }
}

checkTables();
