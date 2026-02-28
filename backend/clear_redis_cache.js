const Redis = require('ioredis');
require('dotenv').config();

const userId = 'U2026012402243718810';

async function clearRedisCache() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 16379,
    password: process.env.REDIS_PASSWORD,
  });

  try {
    console.log('🔍 清除Redis缓存:', userId);
    
    // 查找所有相关的key
    const patterns = [
      `user:${userId}:*`,
      `balance:${userId}`,
      `level:${userId}`,
      `checkin:${userId}:*`,
      `contract:${userId}:*`,
      `points:${userId}:*`,
    ];
    
    let totalDeleted = 0;
    
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        console.log(`  找到 ${keys.length} 个匹配 "${pattern}" 的key`);
        for (const key of keys) {
          await redis.del(key);
          console.log(`    ✅ 删除: ${key}`);
          totalDeleted++;
        }
      }
    }
    
    console.log(`\n✅ 总共删除了 ${totalDeleted} 个Redis key`);
    
  } catch (err) {
    console.error('❌ 清除Redis缓存失败:', err);
  } finally {
    await redis.quit();
  }
}

clearRedisCache().catch(console.error);
