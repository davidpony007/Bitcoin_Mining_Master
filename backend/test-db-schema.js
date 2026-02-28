const pool = require('./src/config/database_native');

async function test() {
  const conn = await pool.getConnection();
  
  const [result] = await conn.query('SELECT DATABASE()');
  console.log('当前数据库:', result[0]['DATABASE()']);
  
  const [columns] = await conn.query('DESCRIBE free_contract_records');
  console.log('\nfree_contract_records 表结构:');
  columns.forEach(c => {
    console.log(`  - ${c.Field} (${c.Type})`);
  });
  
  const hasRevenue = columns.find(c => c.Field === 'free_contract_revenue');
  console.log('\n✅ free_contract_revenue 字段存在:', !!hasRevenue);
  
  // 测试 INSERT
  console.log('\n测试 INSERT 语句...');
  try {
    await conn.query(`
      INSERT INTO free_contract_records 
      (user_id, free_contract_type, hashrate, free_contract_creation_time, free_contract_end_time)
      VALUES ('TEST_123', 'Free Ad Reward', 0.000000000000139, NOW(), DATE_ADD(NOW(), INTERVAL 2 HOUR))
    `);
    console.log('✅ INSERT 成功！');
    
    // 清理测试数据
    await conn.query('DELETE FROM free_contract_records WHERE user_id = "TEST_123"');
  } catch (err) {
    console.error('❌ INSERT 失败:', err.message);
  }
  
  conn.release();
  process.exit(0);
}

test().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
