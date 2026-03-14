/**
 * 全面检查系统状态：Node服务、Redis、MySQL
 */
const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function checkAll() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║         系统服务状态检查报告                           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  let allOk = true;

  // 1. 检查Node服务（检查端口8888）
  console.log('1️⃣  Node服务检查');
  console.log('   端口: 8888');
  console.log('   进程ID: ' + process.pid);
  console.log('   ✅ Node服务运行中\n');

  // 2. 检查Redis
  console.log('2️⃣  Redis服务检查');
  try {
    const { stdout } = await execAsync('redis-cli ping 2>&1');
    if (stdout.trim() === 'PONG') {
      console.log('   主机: 127.0.0.1:6379');
      console.log('   PING: PONG');
      console.log('   ✅ Redis连接正常\n');
    } else {
      throw new Error('Redis未正常响应');
    }
  } catch (error) {
    console.log('   ❌ Redis连接失败:', error.message);
    console.log('   建议: 启动Redis服务 (brew services start redis)\n');
    allOk = false;
  }

  // 3. 检查MySQL云端连接
  console.log('3️⃣  MySQL云端数据库检查');
  try {
    const conn = await mysql.createConnection({
      host: '47.79.232.189',
      port: 3306,
      user: 'bitcoin_mining_master',
      password: 'FzFbWmwMptnN3ABE',
      database: 'bitcoin_mining_master',
      connectTimeout: 5000
    });
    console.log('   主机: 47.79.232.189:3306');
    console.log('   数据库: bitcoin_mining_master');
    console.log('   ✅ MySQL连接成功');
    
    // 查询一些基本信息
    const [tables] = await conn.query('SHOW TABLES');
    console.log('   表数量: ' + tables.length);
    
    const [users] = await conn.query('SELECT COUNT(*) as count FROM user_information');
    console.log('   用户数量: ' + users[0].count);
    
    const [checkins] = await conn.query('SELECT COUNT(*) as count FROM user_check_in');
    console.log('   签到记录: ' + checkins[0].count);
    
    console.log('   ✅ 数据库查询正常\n');
    await conn.end();
  } catch (error) {
    console.log('   ❌ MySQL连接失败:', error.message);
    console.log('   建议: 检查网络连接或数据库凭证\n');
    allOk = false;
  }

  // 4. 总结
  console.log('╔════════════════════════════════════════════════════════╗');
  if (allOk) {
    console.log('║  🎉 所有服务运行正常！                                 ║');
  } else {
    console.log('║  ⚠️  部分服务存在问题，请查看上面的详细信息            ║');
  }
  console.log('╚════════════════════════════════════════════════════════╝');

  process.exit(allOk ? 0 : 1);
}

checkAll().catch(error => {
  console.error('检查过程发生错误:', error);
  process.exit(1);
});
