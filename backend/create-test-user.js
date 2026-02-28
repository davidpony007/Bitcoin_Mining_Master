const pool = require('./src/config/database_native');

async function createTestUser() {
  const conn = await pool.getConnection();
  
  try {
    const userId = 'U' + Date.now();
    const androidId = 'TEST_ANDROID_' + Date.now();
    
    console.log('创建测试用户:', userId);
    
    await conn.query(`
      INSERT INTO user_information 
      (user_id, android_id, invitation_code, country, user_creation_time, user_level, user_points)
      VALUES (?, ?, ?, 'US', NOW(), 1, 0)
    `, [userId, androidId, userId.substring(0, 8)]);
    
    console.log('✅ 用户创建成功!');
    console.log('用户ID:', userId);
    
    // 测试创建合约
    console.log('\n测试创建Free Ad Reward合约...');
    const [result] = await conn.query(`
      INSERT INTO free_contract_records 
      (user_id, free_contract_type, hashrate, free_contract_creation_time, free_contract_end_time)
      VALUES (?, 'Free Ad Reward', 0.000000000000139, NOW(), DATE_ADD(NOW(), INTERVAL 2 HOUR))
    `, [userId]);
    
    console.log('✅ 合约创建成功, ID:', result.insertId);
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('❌ 错误:', err.message);
    conn.release();
    process.exit(1);
  }
}

createTestUser();
