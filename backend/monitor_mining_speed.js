const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '47.79.232.189',
  user: 'bitcoin_mining_master',
  password: 'FzFbWmwMptnN3ABE',
  database: 'bitcoin_mining_master'
});

const userId = 'U2026012402243718810';

async function monitorBalance() {
  const conn = await pool.getConnection();
  try {
    // 获取用户当前余额
    const [status] = await conn.query(
      'SELECT current_bitcoin_balance FROM user_status WHERE user_id = ?',
      [userId]
    );
    
    if (status.length === 0) {
      console.log('用户不存在');
      return;
    }
    
    const balance1 = parseFloat(status[0].current_bitcoin_balance);
    console.log(`\n时间: ${new Date().toLocaleTimeString()}`);
    console.log(`当前余额: ${balance1.toExponential(5)} BTC`);
    
    // 等待3秒
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 再次获取余额
    const [status2] = await conn.query(
      'SELECT current_bitcoin_balance FROM user_status WHERE user_id = ?',
      [userId]
    );
    
    const balance2 = parseFloat(status2[0].current_bitcoin_balance);
    const diff = balance2 - balance1;
    const speedPerSecond = diff / 3;
    
    console.log(`3秒后余额: ${balance2.toExponential(5)} BTC`);
    console.log(`增量: ${diff.toExponential(5)} BTC`);
    console.log(`实际速率: ${speedPerSecond.toExponential(5)} BTC/秒`);
    console.log(`预期速率: 3.28e-13 BTC/秒`);
    
    // 查询活跃合约
    console.log('\n=== 活跃免费合约 ===');
    const [freeContracts] = await conn.query(`
      SELECT 
        id,
        free_contract_type,
        hashrate,
        TIMESTAMPDIFF(SECOND, NOW(), free_contract_end_time) as remaining
      FROM free_contract_records 
      WHERE user_id = ? 
        AND mining_status = 'mining' 
        AND free_contract_end_time > NOW()
    `, [userId]);
    
    let totalFreeHashrate = 0;
    freeContracts.forEach((c, i) => {
      console.log(`合约 ${i+1}: ${c.free_contract_type}`);
      console.log(`  速率: ${parseFloat(c.hashrate).toExponential(5)} BTC/秒`);
      console.log(`  剩余: ${c.remaining}秒`);
      totalFreeHashrate += parseFloat(c.hashrate);
    });
    
    console.log('\n=== 活跃付费合约 ===');
    const [paidContracts] = await conn.query(`
      SELECT 
        id,
        hashrate,
        TIMESTAMPDIFF(SECOND, NOW(), contract_end_time) as remaining
      FROM mining_contracts 
      WHERE user_id = ? 
        AND mining_status = 'mining' 
        AND contract_end_time > NOW()
    `, [userId]);
    
    let totalPaidHashrate = 0;
    paidContracts.forEach((c, i) => {
      console.log(`合约 ${i+1}:`);
      console.log(`  速率: ${parseFloat(c.hashrate).toExponential(5)} BTC/秒`);
      console.log(`  剩余: ${c.remaining}秒`);
      totalPaidHashrate += parseFloat(c.hashrate);
    });
    
    const totalExpectedSpeed = totalFreeHashrate + totalPaidHashrate;
    console.log(`\n总理论速率: ${totalExpectedSpeed.toExponential(5)} BTC/秒`);
    console.log(`总实际速率: ${speedPerSecond.toExponential(5)} BTC/秒`);
    console.log(`差异: ${((speedPerSecond - totalExpectedSpeed) / totalExpectedSpeed * 100).toFixed(2)}%`);
    
  } finally {
    conn.release();
  }
}

// 运行监控
(async () => {
  await monitorBalance();
  await pool.end();
})();
