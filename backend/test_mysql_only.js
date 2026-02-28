// 快速测试MySQL连接
require('dotenv').config();
const mysql = require('mysql2/promise');

async function testMySQL() {
  console.log('测试MySQL连接...');
  console.log(`Host: ${process.env.DB_HOST}`);
  console.log(`User: ${process.env.DB_USER}`);
  console.log(`Database: ${process.env.DB_NAME}\n`);
  
  const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD, // 兼容两种命名
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    connectTimeout: 10000 // 10秒超时
  };
  
  try {
    console.log('正在连接...');
    const connection = await mysql.createConnection(config);
    console.log('✅ 连接成功!\n');
    
    // 测试查询
    const [rows] = await connection.execute('SELECT VERSION() as version, DATABASE() as db, NOW() as time');
    console.log(`MySQL版本: ${rows[0].version}`);
    console.log(`当前数据库: ${rows[0].db}`);
    console.log(`服务器时间: ${rows[0].time}\n`);
    
    // 检查user_information表
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME, TABLE_ROWS 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      LIMIT 5
    `, [process.env.DB_NAME]);
    
    console.log('数据库表(前5个):');
    tables.forEach(t => {
      console.log(`  - ${t.TABLE_NAME} (约${t.TABLE_ROWS}行)`);
    });
    
    await connection.end();
    console.log('\n✅ 所有测试通过!数据库连接正常。');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ MySQL连接失败!');
    console.error(`错误: ${error.message}`);
    if (error.code) console.error(`错误代码: ${error.code}`);
    if (error.errno) console.error(`错误编号: ${error.errno}`);
    if (error.sqlState) console.error(`SQL状态: ${error.sqlState}`);
    
    console.error('\n可能的原因:');
    console.error('1. 云服务器MySQL未启动');
    console.error('2. 防火墙/安全组阻止了3306端口');
    console.error('3. 用户名或密码错误');
    console.error('4. 数据库不存在');
    console.error('5. 网络连接问题');
    
    process.exit(1);
  }
}

testMySQL();
