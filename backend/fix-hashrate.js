const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixHashrate() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
  const userId = 'U2026012402243718810';
  
  console.log('1. 修复用户余额时间为当前时间...');
  await db.query(
    'UPDATE user_status SET current_bitcoin_balance = 0, last_balance_update_time = NOW() WHERE user_id = ?',
    [userId]
  );
  
  console.log('2. 修正合约hashrate (5.5 GH/s = 1.39e-13 BTC/秒)...');
  // 每1 GH/s = 0.00000000000002527272727... BTC/秒
  // 5.5 GH/s = 0.000000000000139 BTC/秒
  const correctHashrate = 0.000000000000139;
  await db.query(
    'UPDATE free_contract_records SET hashrate = ? WHERE user_id = ?',
    [correctHashrate, userId]
  );
  
  // 清除Redis缓存
  console.log('3. 清除Redis hashrate缓存...');
  const redisClient = require('./src/config/redis');
  await redisClient.deleteMiningSpeed(userId);
  
  console.log('\n✅ 修复完成!\n');
  
  // 验证结果
  const [contracts] = await db.query(
    'SELECT id, hashrate, mining_status, free_contract_end_time FROM free_contract_records WHERE user_id = ?',
    [userId]
  );
  console.log('合约信息:');
  console.log('  ID:', contracts[0].id);
  console.log('  Hashrate (BTC/秒):', contracts[0].hashrate);
  console.log('  状态:', contracts[0].mining_status);
  console.log('  结束时间:', contracts[0].free_contract_end_time);
  
  const [status] = await db.query(
    'SELECT current_bitcoin_balance, last_balance_update_time FROM user_status WHERE user_id = ?',
    [userId]
  );
  console.log('\n余额信息:');
  console.log('  当前余额:', status[0].current_bitcoin_balance);
  console.log('  更新时间:', status[0].last_balance_update_time);
  
  await db.end();
  process.exit(0);
}

fixHashrate().catch(err => {
  console.error('错误:', err);
  process.exit(1);
});
