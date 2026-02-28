#!/usr/bin/env node

/**
 * 定时任务：更新已过期合约的状态
 * 建议每小时执行一次
 */

const pool = require('./src/config/database_native'); // 使用原生连接池

async function updateExpiredContractsStatus() {
  console.log('\n========== 开始更新过期合约状态 ==========');
  const now = new Date();
  console.log(`执行时间: ${now.toISOString()}`);

  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. 更新免费合约状态
    const [freeResult] = await connection.query(`
      UPDATE free_contract_records 
      SET mining_status = 'completed'
      WHERE mining_status = 'mining' 
        AND free_contract_end_time <= NOW()
    `);
    console.log(`✅ 更新免费合约: ${freeResult.affectedRows} 条记录`);

    // 2. 更新付费合约状态
    const [paidResult] = await connection.query(`
      UPDATE mining_contracts 
      SET mining_status = 'completed'
      WHERE mining_status = 'mining' 
        AND contract_end_time <= NOW()
    `);
    console.log(`✅ 更新付费合约: ${paidResult.affectedRows} 条记录`);

    console.log('========== 状态更新完成 ==========\n');
  } catch (error) {
    console.error('❌ 更新合约状态失败:', error);
  } finally {
    if (connection) connection.release();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updateExpiredContractsStatus()
    .then(() => {
      console.log('脚本执行完成，退出...');
      process.exit(0);
    })
    .catch(err => {
      console.error('脚本执行失败:', err);
      process.exit(1);
    });
}

module.exports = { updateExpiredContractsStatus };
