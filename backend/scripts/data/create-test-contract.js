const sequelize = require('../src/config/database');

async function createTestContract() {
  try {
    // 先查询一个真实的用户ID
    const [users] = await sequelize.query(`
      SELECT ui.user_id 
      FROM user_information ui
      LIMIT 1
    `);
    
    if (users.length === 0) {
      console.error('❌ 未找到可用的用户');
      process.exit(1);
    }
    
    const testUserId = users[0].user_id;
    
    // 先清理该用户的旧测试合约
    await sequelize.query(`
      DELETE FROM free_contract_records 
      WHERE user_id = '${testUserId}' AND free_contract_type = 'ad free contract'
    `);
    
    // 记录初始余额
    const [initialBalance] = await sequelize.query(`
      SELECT current_bitcoin_balance, bitcoin_accumulated_amount 
      FROM user_status 
      WHERE user_id = '${testUserId}'
    `);
    
    if (initialBalance.length === 0) {
      console.error('❌ 用户在user_status表中不存在');
      process.exit(1);
    }
    
    console.log('📊 初始状态:');
    console.log(`  用户ID: ${testUserId}`);
    console.log(`  当前余额: ${initialBalance[0].current_bitcoin_balance}`);
    console.log(`  累计挖矿: ${initialBalance[0].bitcoin_accumulated_amount}`);
    
    // 创建测试合约
    await sequelize.query(`
      INSERT INTO free_contract_records 
      (user_id, free_contract_type, free_contract_creation_time, free_contract_end_time, mining_status, hashrate)
      VALUES 
      ('${testUserId}', 'ad free contract', NOW(), DATE_ADD(NOW(), INTERVAL 2 HOUR), 'mining', 0.00000000000139)
    `);
    
    console.log('\n✓ 测试合约已创建');
    console.log('  合约类型: ad free contract');
    console.log('  有效期: 2小时');
    console.log('  算力: 0.00000000000139 BTC/s');
    console.log('  理论每秒收益: 0.00000000000139 BTC');
    
    // 等待5秒后查询余额变化
    console.log('\n⏳ 等待5秒后开始查询余额变化...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    for (let i = 0; i < 5; i++) {
      const [results] = await sequelize.query(`
        SELECT current_bitcoin_balance, bitcoin_accumulated_amount 
        FROM user_status 
        WHERE user_id = '${testUserId}'
      `);
      
      if (results.length > 0) {
        const balanceChange = results[0].current_bitcoin_balance - initialBalance[0].current_bitcoin_balance;
        console.log(`[${i + 1}] 当前余额: ${results[0].current_bitcoin_balance}`);
        console.log(`    累计挖矿: ${results[0].bitcoin_accumulated_amount}`);
        console.log(`    余额变化: ${balanceChange >= 0 ? '+' : ''}${balanceChange.toFixed(15)}`);
      }
      
      if (i < 4) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n✅ 测试完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

createTestContract();
