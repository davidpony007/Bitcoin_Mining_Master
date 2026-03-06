const Redis = require('ioredis');

async function testRedis() {
  console.log('==================== Redis 连接测试 ====================\n');
  
  const config = {
    host: '47.79.232.189',
    port: 6379,
    password: '3hu8fds3y',
    db: 0
  };
  
  console.log('配置信息:');
  console.log('  主机:', config.host);
  console.log('  端口:', config.port);
  console.log('  密码:', config.password ? '已设置 (' + config.password.substring(0, 3) + '***)' : '未设置');
  console.log('  数据库:', config.db);
  console.log('\n正在连接...\n');
  
  const redis = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    connectTimeout: 5000,
    retryStrategy: (times) => {
      if (times > 3) {
        console.log('❌ 重试次数过多,停止重试');
        return null;
      }
      console.log(`⏳ 第${times}次重试...`);
      return Math.min(times * 1000, 3000);
    }
  });
  
  redis.on('connect', () => {
    console.log('🔌 TCP 连接已建立');
  });
  
  redis.on('ready', () => {
    console.log('✅ Redis 连接就绪');
  });
  
  redis.on('error', (err) => {
    console.error('❌ Redis 错误:', err.message);
  });
  
  try {
    // 测试 PING
    const pong = await redis.ping();
    console.log('✅ PING 测试成功:', pong);
    
    // 测试写入
    await redis.set('test:connection', 'success');
    console.log('✅ SET 测试成功');
    
    // 测试读取
    const value = await redis.get('test:connection');
    console.log('✅ GET 测试成功:', value);
    
    // 测试删除
    await redis.del('test:connection');
    console.log('✅ DEL 测试成功');
    
    // 获取服务器信息
    const info = await redis.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/);
    if (version) {
      console.log('✅ Redis 版本:', version[1]);
    }
    
    console.log('\n==================== 测试结果: 成功 ✅ ====================');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.log('\n==================== 测试结果: 失败 ❌ ====================');
  } finally {
    await redis.quit();
    console.log('\n连接已关闭');
    process.exit(0);
  }
}

testRedis();
