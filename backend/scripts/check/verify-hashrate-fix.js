require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
  const [rows] = await conn.query(`
    SELECT hashrate, free_contract_type 
    FROM free_contract_records 
    WHERE user_id = 'TEST_HASHRATE_FIX' 
    ORDER BY free_contract_creation_time DESC 
    LIMIT 1
  `);
  
  if (rows.length > 0) {
    const hashrate = parseFloat(rows[0].hashrate);
    console.log('✅ 合约类型:', rows[0].free_contract_type);
    console.log('挖矿速率:', hashrate.toExponential(3), 'BTC/秒');
    console.log('预期值: 1.390e-13 BTC/秒');
    
    if (Math.abs(hashrate - 0.000000000000139) < 1e-18) {
      console.log('✅ 挖矿速率正确！');
    } else {
      console.log('❌ 挖矿速率错误！实际值:', hashrate);
    }
  }
  
  await conn.end();
})();
