const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTimezone() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
  console.log('=== 时区检查 ===');
  const [result1] = await db.query('SELECT NOW() as time1');
  const [result2] = await db.query('SELECT UTC_TIMESTAMP() as time2');
  console.log('MySQL NOW():', result1[0].time1);
  console.log('MySQL UTC_TIMESTAMP():', result2[0].time2);
  console.log('Node.js时间 (UTC):', new Date().toISOString());
  console.log('Node.js时间 (本地):', new Date().toString());
  
  await db.end();
  process.exit(0);
}

checkTimezone().catch(err => {
  console.error('错误:', err);
  process.exit(1);
});
