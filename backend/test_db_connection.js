// 测试MySQL和Redis连接
require('dotenv').config();
const mysql = require('mysql2/promise');
const Redis = require('ioredis');

console.log('=== 开始测试数据库连接 ===\n');

// 测试MySQL
async function testMySQL() {
  console.log('【1】 测试MySQL连接...');
  console.log(`  Host: ${process.env.DB_HOST}`);
  console.log(`  User: ${process.env.DB_USER}`);
  console.log(`  Database: ${process.env.DB_NAME}`);
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS || process.env.DB_PASSWORD, // 兼容两种命名
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });
    
    console.log('  ✅ MySQL连接成功!');
    
    // 测试查询
    const [rows] = await connection.execute('SELECT VERSION() as version, DATABASE() as db, USER() as user');
    console.log(`  版本: ${rows[0].version}`);
    console.log(`  数据库: ${rows[0].db}`);
    console.log(`  用户: ${rows[0].user}`);
    
    // 检查表是否存在
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`  表数量: ${tables.length}`);
    
    await connection.end();
    return true;
  } catch (error) {
    console.error('  ❌ MySQL连接失败:');
    console.error(`  错误: ${error.message}`);
    if (error.code) console.error(`  错误代码: ${error.code}`);
    if (error.errno) console.error(`  错误编号: ${error.errno}`);
    return false;
  }
}

// 测试Redis
async function testRedis() {
  console.log('\n【2】 测试Redis连接...');
  console.log(`  Host: ${process.env.REDIS_HOST}`);
  console.log(`  Port: ${process.env.REDIS_PORT}`);
  
  return new Promise((resolve) => {
    const client = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || '',
      retryStrategy(times) {
        return null; // 不重试,立即返回错误
      }
    });
    
    client.on('connect', () => {
      console.log('  ✅ Redis连接成功!');
    });
    
    client.on('ready', async () => {
      console.log('  ✅ Redis就绪!');
      
      // 测试操作
      try {
        await client.set('test_key', 'test_value');
        const value = await client.get('test_key');
        console.log(`  测试写入/读取: ${value}`);
        await client.del('test_key');
        
        const info = await client.info('server');
        const version = info.match(/redis_version:([^\r\n]+)/);
        if (version) {
          console.log(`  版本: ${version[1]}`);
        }
        
        await client.quit();
        resolve(true);
      } catch (error) {
        console.error(`  ❌ Redis操作失败: ${error.message}`);
        try {
          await client.quit();
        } catch (e) {}
        resolve(false);
      }
    });
    
    client.on('error', (error) => {
      console.error('  ❌ Redis连接失败:');
      console.error(`  错误: ${error.message}`);
      try {
        client.disconnect();
      } catch (e) {}
      resolve(false);
    });
  });
}

// 运行测试
(async () => {
  const mysqlOk = await testMySQL();
  const redisOk = await testRedis();
  
  console.log('\n=== 测试结果汇总 ===');
  console.log(`MySQL: ${mysqlOk ? '✅ 正常' : '❌ 失败'}`);
  console.log(`Redis: ${redisOk ? '✅ 正常' : '❌ 失败'}`);
  
  if (mysqlOk && redisOk) {
    console.log('\n✅ 所有连接测试通过!可以启动服务。');
    process.exit(0);
  } else {
    console.log('\n❌ 存在连接问题,请检查配置和网络。');
    process.exit(1);
  }
})();
