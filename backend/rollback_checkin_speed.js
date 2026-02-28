const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '47.79.232.189',
  user: 'bitcoin_mining_master',
  password: 'FzFbWmwMptnN3ABE',
  database: 'bitcoin_mining_master'
});

const userId = 'U2026012402243718810';

async function rollbackCheckInSpeed() {
  const conn = await pool.getConnection();
  try {
    const correctHashrate = 0.000000000000189040; // 1.39e-13 * 1.36
    
    await conn.query(`
      UPDATE free_contract_records
      SET hashrate = ?
      WHERE user_id = ?
        AND free_contract_type = 'daily sign-in free contract'
        AND mining_status = 'mining'
        AND free_contract_end_time > NOW()
    `, [correctHashrate, userId]);
    
    console.log(`✅ 已回滚签到合约速率为 ${correctHashrate.toExponential(5)} BTC/秒`);
    
  } finally {
    conn.release();
    await pool.end();
  }
}

rollbackCheckInSpeed();
