const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '47.79.232.189',
  user: 'bitcoin_mining_master',
  password: 'FzFbWmwMptnN3ABE',
  database: 'bitcoin_mining_master'
});

(async () => {
  const conn = await pool.getConnection();
  try {
    // 查询活跃合约
    const [contracts] = await conn.query(`
      SELECT 
        id,
        contract_type,
        hashrate,
        contract_creation_time,
        contract_end_time,
        contract_duration,
        mining_status,
        TIMESTAMPDIFF(SECOND, NOW(), contract_end_time) as remaining_seconds
      FROM mining_contracts 
      WHERE user_id = 'U2026012402243718810' 
        AND mining_status = 'mining'
        AND contract_creation_time <= NOW()
        AND contract_end_time > NOW()
      ORDER BY id
    `);
    
    console.log('\n=== 活跃挖矿合约 ===');
    console.log('合约数量:', contracts.length);
    
    let totalHashrate = 0;
    contracts.forEach((c, i) => {
      console.log(`\n合约 ${i+1} (ID: ${c.id}):`);
      console.log(`  类型: ${c.contract_type}`);
      console.log(`  算力: ${c.hashrate}`);
      console.log(`  持续时间: ${c.contract_duration}`);
      console.log(`  剩余: ${c.remaining_seconds}秒`);
      totalHashrate += parseFloat(c.hashrate);
    });
    
    console.log(`\n总合约算力: ${totalHashrate}`);
    
    // 查询用户信息
    const [users] = await conn.query('SELECT user_id, current_btc, hashrate FROM user_info WHERE user_id = ?', ['U2026012402243718810']);
    if (users.length > 0) {
      console.log(`\n用户基础算力: ${users[0].hashrate}`);
      console.log(`用户当前BTC: ${users[0].current_btc}`);
      
      const totalSpeed = parseFloat(users[0].hashrate) + totalHashrate;
      console.log(`\n总算力 (基础+合约): ${totalSpeed}`);
      console.log(`预期速率: 0.000000000000328 BTC/秒`);
      console.log(`当前速率: ${totalSpeed.toFixed(18)} BTC/秒`);
    }
    
  } finally {
    conn.release();
    await pool.end();
  }
})();
