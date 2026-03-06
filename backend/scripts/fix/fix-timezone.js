const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixTimezone() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
  const userId = 'U2026012402243718810';
  
  console.log('修复用户余额更新时间为UTC时间...');
  // 使用UTC_TIMESTAMP()而不是NOW()
  await db.query(
    'UPDATE user_status SET last_balance_update_time = UTC_TIMESTAMP(), current_bitcoin_balance = 0 WHERE user_id = ?',
    [userId]
  );
  
  console.log('\n✅ 时区修复完成!\n');
  
  // 验证结果
  const [status] = await db.query(
    'SELECT current_bitcoin_balance, last_balance_update_time FROM user_status WHERE user_id = ?',
    [userId]
  );
  console.log('余额信息:');
  console.log('  当前余额:', status[0].current_bitcoin_balance);
  console.log('  更新时间(UTC):', status[0].last_balance_update_time);
  
  await db.end();
  process.exit(0);
}

fixTimezone().catch(err => {
  console.error('错误:', err);
  process.exit(1);
});
