const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '47.79.232.189',
  user: 'bitcoin_mining_master',
  password: 'FzFbWmwMptnN3ABE',
  database: 'bitcoin_mining_master'
});

const userId = 'U2026012402243718810';

async function fixCheckInContractSpeed() {
  const conn = await pool.getConnection();
  try {
    const [contracts] = await conn.query(`
      SELECT id, hashrate
      FROM free_contract_records
      WHERE user_id = ?
        AND free_contract_type = 'daily sign-in free contract'
        AND mining_status = 'mining'
        AND free_contract_end_time > NOW()
    `, [userId]);
    
    if (contracts.length === 0) {
      console.log('没有找到活跃的签到合约');
      return;
    }
    
    for (const contract of contracts) {
      const currentHashrate = parseFloat(contract.hashrate);
      const correctHashrate = currentHashrate * 1.36;
      
      console.log(`\n合约ID: ${contract.id}`);
      console.log(`当前速率: ${currentHashrate.toExponential(5)} BTC/秒`);
      console.log(`修正后速率: ${correctHashrate.toExponential(5)} BTC/秒`);
      
      await conn.query(`
        UPDATE free_contract_records
        SET hashrate = ?
        WHERE id = ?
      `, [correctHashrate, contract.id]);
      
      console.log(`✅ 已修正签到合约速率`);
    }
    
  } finally {
    conn.release();
    await pool.end();
  }
}

fixCheckInContractSpeed();
