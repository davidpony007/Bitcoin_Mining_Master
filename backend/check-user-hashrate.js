/**
 * 查询用户的挖矿速率
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkUserHashrate() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('✅ 数据库连接成功\n');
    
    const userId = 'U2026012816242691017';
    
    // 查询付费合约
    console.log('📊 查询付费合约（Mining Contracts）...\n');
    const [paidContracts] = await connection.query(
      `SELECT hashrate, mining_status, contract_end_time,
              TIMESTAMPDIFF(HOUR, NOW(), contract_end_time) as remaining_hours
       FROM mining_contracts 
       WHERE user_id = ? 
       AND mining_status = 'mining'
       AND contract_end_time > NOW()`,
      [userId]
    );
    
    if (paidContracts.length > 0) {
      console.log(`找到 ${paidContracts.length} 个活跃的付费合约:\n`);
      let totalPaidHashrate = 0;
      paidContracts.forEach((contract, index) => {
        const hashrate = parseFloat(contract.hashrate);
        totalPaidHashrate += hashrate;
        console.log(`  合约 #${index + 1}:`);
        console.log(`  挖矿速率: ${hashrate.toFixed(18)} BTC/秒`);
        console.log(`  状态: ${contract.mining_status}`);
        console.log(`  剩余时间: ${contract.remaining_hours} 小时`);
        console.log(`  结束时间: ${contract.contract_end_time.toLocaleString('zh-CN')}`);
        console.log();
      });
      console.log(`📈 付费合约总挖矿速率: ${totalPaidHashrate.toFixed(18)} BTC/秒\n`);
    } else {
      console.log('⚠️  未找到活跃的付费合约\n');
    }
    
    // 查询免费合约
    console.log('📊 查询免费合约（Free Ad Contracts）...\n');
    const [freeContracts] = await connection.query(
      `SELECT free_contract_type, hashrate, mining_status, free_contract_end_time,
              TIMESTAMPDIFF(HOUR, NOW(), free_contract_end_time) as remaining_hours
       FROM free_contract_records 
       WHERE user_id = ? 
       AND mining_status = 'mining'
       AND free_contract_end_time > NOW()`,
      [userId]
    );
    
    if (freeContracts.length > 0) {
      console.log(`找到 ${freeContracts.length} 个活跃的免费合约:\n`);
      let totalFreeHashrate = 0;
      freeContracts.forEach(contract => {
        const hashrate = parseFloat(contract.hashrate);
        totalFreeHashrate += hashrate;
        console.log(`  合约类型: ${contract.free_contract_type}`);
        console.log(`  挖矿速率: ${hashrate.toFixed(18)} BTC/秒`);
        console.log(`  状态: ${contract.mining_status}`);
        console.log(`  剩余时间: ${contract.remaining_hours} 小时`);
        console.log(`  结束时间: ${contract.free_contract_end_time.toLocaleString('zh-CN')}`);
        console.log();
      });
      console.log(`📈 免费合约总挖矿速率: ${totalFreeHashrate.toFixed(18)} BTC/秒\n`);
    } else {
      console.log('⚠️  未找到活跃的免费合约\n');
    }
    
    // 计算总挖矿速率
    const totalPaidHashrate = paidContracts.reduce((sum, c) => sum + parseFloat(c.hashrate), 0);
    const totalFreeHashrate = freeContracts.reduce((sum, c) => sum + parseFloat(c.hashrate), 0);
    const totalHashrate = totalPaidHashrate + totalFreeHashrate;
    
    console.log('═'.repeat(60));
    console.log('💰 总挖矿速率汇总:');
    console.log('═'.repeat(60));
    console.log(`  付费合约: ${totalPaidHashrate.toFixed(18)} BTC/秒`);
    console.log(`  免费合约: ${totalFreeHashrate.toFixed(18)} BTC/秒`);
    console.log(`  ────────────────────────────────────`);
    console.log(`  总计: ${totalHashrate.toFixed(18)} BTC/秒`);
    console.log('═'.repeat(60));
    
    // 计算每小时、每天、每月收益
    const perHour = totalHashrate * 3600;
    const perDay = totalHashrate * 86400;
    const perMonth = totalHashrate * 2592000; // 30天
    
    console.log('\n📊 预估收益:');
    console.log(`  每小时: ${perHour.toFixed(18)} BTC`);
    console.log(`  每天: ${perDay.toFixed(18)} BTC`);
    console.log(`  每月: ${perMonth.toFixed(18)} BTC`);
    console.log();
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('📌 数据库连接已关闭');
    }
  }
}

checkUserHashrate().catch(err => {
  console.error('执行失败:', err);
  process.exit(1);
});
