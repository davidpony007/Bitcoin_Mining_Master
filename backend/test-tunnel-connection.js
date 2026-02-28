const mysql = require('mysql2/promise');

async function testTunnelConnection() {
  console.log('🔍 测试SSH隧道MySQL连接...\n');
  
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3307,
      user: 'root',
      password: 'fe2c82a2e5b8e2a3',
      database: 'bitcoin_mining_master',
      connectTimeout: 10000
    });
    
    console.log('✅ 连接成功！');
    
    // 测试查询
    const [rows] = await connection.execute('SELECT DATABASE() as current_db, NOW() as server_time');
    console.log('📊 当前数据库:', rows[0].current_db);
    console.log('⏰ 服务器时间:', rows[0].server_time);
    
    // 检查表
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`\n📋 表数量: ${tables.length}`);
    
    // 检查user_information表
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM user_information');
    console.log(`👥 用户数: ${users[0].count}`);
    
    await connection.end();
    console.log('\n✅ 测试完成！');
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    console.error('详细信息:', error);
    process.exit(1);
  }
}

testTunnelConnection();
