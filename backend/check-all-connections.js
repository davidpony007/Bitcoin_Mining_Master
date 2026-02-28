/**
 * 完整的系统连接状态检查脚本
 * 检查: Node服务 + MySQL + Redis
 */

const mysql = require('mysql2/promise');
const Redis = require('ioredis');

console.log('\n🔍 ==================== 系统连接状态检查 ==================== 🔍\n');

// 1. Node.js 环境检查
console.log('📦 Node.js 环境信息:');
console.log('   版本:', process.version);
console.log('   平台:', process.platform);
console.log('   架构:', process.arch);
console.log('   工作目录:', process.cwd());
console.log('   ✅ Node.js 运行正常\n');

// 2. MySQL 连接检查
async function checkMySQL() {
  console.log('🗄️  MySQL 数据库连接检查:');
  console.log('   主机: 47.79.232.189');
  console.log('   用户: bitcoin_mining_master');
  console.log('   数据库: bitcoin_mining_master');
  
  const mysqlConfig = {
    host: '47.79.232.189',
    user: 'bitcoin_mining_master',
    password: 'FzFbWmwMptnN3ABE',
    database: 'bitcoin_mining_master'
  };
  
  let connection;
  try {
    console.log('   正在连接...');
    connection = await mysql.createConnection(mysqlConfig);
    
    console.log('   ✅ 连接成功');
    
    // 测试查询
    const [rows] = await connection.execute('SELECT VERSION() as version');
    console.log('   MySQL 版本:', rows[0].version);
    
    // 检查表数量
    const [tables] = await connection.execute(
      'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?',
      ['bitcoin_mining_master']
    );
    console.log('   数据表数量:', tables[0].count);
    
    // 检查关键表是否存在
    const [levelConfig] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'bitcoin_mining_master' AND table_name = 'level_config'"
    );
    const [checkInConfig] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'bitcoin_mining_master' AND table_name = 'check_in_reward_config'"
    );
    const [countryConfig] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'bitcoin_mining_master' AND table_name = 'country_mining_config'"
    );
    
    console.log('   关键配置表状态:');
    console.log('     - level_config:', levelConfig[0].count > 0 ? '✅ 存在' : '❌ 缺失');
    console.log('     - check_in_reward_config:', checkInConfig[0].count > 0 ? '✅ 存在' : '❌ 缺失');
    console.log('     - country_mining_config:', countryConfig[0].count > 0 ? '✅ 存在' : '❌ 缺失');
    
    return {
      status: 'success',
      version: rows[0].version,
      tables: tables[0].count,
      levelConfig: levelConfig[0].count > 0,
      checkInConfig: checkInConfig[0].count > 0,
      countryConfig: countryConfig[0].count > 0
    };
    
  } catch (error) {
    console.log('   ❌ 连接失败:', error.message);
    return { status: 'failed', error: error.message };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 3. Redis 连接检查
async function checkRedis() {
  console.log('\n🔴 Redis 缓存连接检查:');
  console.log('   主机: 47.79.232.189');
  console.log('   端口: 6379');
  console.log('   密码: 已配置 (3hu***)');
  
  const redis = new Redis({
    host: '47.79.232.189',
    port: 6379,
    password: '3hu8fds3y',
    db: 0,
    connectTimeout: 5000,
    retryStrategy: (times) => {
      if (times > 2) return null;
      return Math.min(times * 1000, 3000);
    }
  });
  
  return new Promise((resolve) => {
    let resolved = false;
    
    redis.on('ready', async () => {
      if (resolved) return;
      resolved = true;
      
      try {
        console.log('   ✅ 连接成功');
        
        // 测试 PING
        const pong = await redis.ping();
        console.log('   PING 测试:', pong);
        
        // 获取服务器信息
        const info = await redis.info('server');
        const version = info.match(/redis_version:([^\r\n]+)/);
        if (version) {
          console.log('   Redis 版本:', version[1]);
        }
        
        // 获取内存信息
        const memInfo = await redis.info('memory');
        const usedMemory = memInfo.match(/used_memory_human:([^\r\n]+)/);
        if (usedMemory) {
          console.log('   内存使用:', usedMemory[1]);
        }
        
        // 获取已存储的键数量
        const dbsize = await redis.dbsize();
        console.log('   键数量:', dbsize);
        
        await redis.quit();
        resolve({
          status: 'success',
          version: version ? version[1] : 'unknown',
          keys: dbsize
        });
        
      } catch (error) {
        console.log('   ❌ 操作失败:', error.message);
        await redis.quit();
        resolve({ status: 'failed', error: error.message });
      }
    });
    
    redis.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      console.log('   ❌ 连接失败:', err.message);
      redis.quit();
      resolve({ status: 'failed', error: err.message });
    });
    
    // 超时保护
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.log('   ❌ 连接超时');
      redis.quit();
      resolve({ status: 'timeout' });
    }, 6000);
  });
}

// 4. 执行所有检查
async function runAllChecks() {
  const results = {
    node: true,
    mysql: null,
    redis: null
  };
  
  // 检查 MySQL
  results.mysql = await checkMySQL();
  
  // 检查 Redis
  results.redis = await checkRedis();
  
  // 汇总结果
  console.log('\n📊 ==================== 检查结果汇总 ==================== 📊\n');
  
  console.log('服务状态:');
  console.log('  ✅ Node.js:', process.version, '(运行正常)');
  console.log('  ' + (results.mysql.status === 'success' ? '✅' : '❌') + ' MySQL:', 
    results.mysql.status === 'success' ? 
      `v${results.mysql.version} (${results.mysql.tables}个表)` : 
      '连接失败'
  );
  console.log('  ' + (results.redis.status === 'success' ? '✅' : '❌') + ' Redis:', 
    results.redis.status === 'success' ? 
      `v${results.redis.version} (${results.redis.keys}个键)` : 
      '连接失败'
  );
  
  console.log('\n配置表状态:');
  if (results.mysql.status === 'success') {
    console.log('  ' + (results.mysql.levelConfig ? '✅' : '❌') + ' level_config');
    console.log('  ' + (results.mysql.checkInConfig ? '✅' : '❌') + ' check_in_reward_config');
    console.log('  ' + (results.mysql.countryConfig ? '✅' : '❌') + ' country_mining_config');
  } else {
    console.log('  ⚠️  无法检查 (MySQL未连接)');
  }
  
  console.log('\n整体健康度:');
  const healthy = results.mysql.status === 'success' && results.redis.status === 'success';
  if (healthy) {
    console.log('  ✅ 系统状态: 健康');
    console.log('  ✅ 所有服务正常运行');
  } else {
    console.log('  ⚠️  系统状态: 部分异常');
    if (results.mysql.status !== 'success') {
      console.log('  ❌ MySQL 需要修复');
    }
    if (results.redis.status !== 'success') {
      console.log('  ❌ Redis 需要修复');
    }
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  process.exit(healthy ? 0 : 1);
}

runAllChecks().catch(error => {
  console.error('\n❌ 检查过程出错:', error);
  process.exit(1);
});
