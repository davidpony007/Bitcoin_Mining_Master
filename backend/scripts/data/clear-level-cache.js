/**
 * 清除所有用户的等级缓存
 * 用于强制刷新等级显示
 */
const redisClient = require('../src/config/redis');
const pool = require('../src/config/database_native');

async function clearAllUserLevelCache() {
  try {
    console.log('🔄 开始清除所有用户的等级缓存...\n');
    
    await redisClient.connect();
    console.log('✅ Redis连接成功\n');
    
    // 获取所有用户
    const [users] = await pool.query(
      'SELECT user_id FROM user_information LIMIT 1000'
    );
    
    console.log(`📊 找到 ${users.length} 个用户\n`);
    
    let clearedCount = 0;
    for (const user of users) {
      try {
        await redisClient.deleteUserLevel(user.user_id);
        clearedCount++;
        if (clearedCount % 100 === 0) {
          console.log(`   已清除 ${clearedCount}/${users.length} 个用户缓存...`);
        }
      } catch (err) {
        console.error(`清除用户 ${user.user_id} 缓存失败:`, err.message);
      }
    }
    
    console.log(`\n✅ 清除完成！共清除 ${clearedCount} 个用户的等级缓存`);
    console.log('🔄 用户下次打开应用时将从数据库重新加载正确的等级信息');
    
  } catch (error) {
    console.error('❌ 清除缓存失败:', error);
  } finally {
    await pool.end();
    await redisClient.disconnect();
    process.exit(0);
  }
}

clearAllUserLevelCache();
