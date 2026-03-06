/**
 * 测试等级显示修复
 */
const LevelService = require('../src/services/levelService');
const pool = require('../src/config/database_native');
const redisClient = require('../src/config/redis');

async function test() {
  try {
    console.log('🧪 开始测试等级显示修复...\n');
    
    // 1. 初始化等级配置
    await LevelService.initLevelConfig();
    await redisClient.connect();
    console.log('✅ 等级配置和Redis已加载\n');
    
    // 2. 查询一个用户
    const [users] = await pool.query(
      'SELECT user_id, user_level, user_points FROM user_information WHERE user_level >= 2 LIMIT 1'
    );
    
    if (users.length === 0) {
      console.log('⚠️  没有找到等级>=2的用户，创建测试数据...');
      // 使用一个测试用户
      const testUserId = 'TEST_USER_001';
      await pool.query(
        'INSERT INTO user_information (user_id, user_level, user_points) VALUES (?, 2, 5) ON DUPLICATE KEY UPDATE user_level=2, user_points=5',
        [testUserId]
      );
      users.push({ user_id: testUserId, user_level: 2, user_points: 5 });
    }
    
    const testUser = users[0];
    console.log(`📊 测试用户: ${testUser.user_id}`);
    console.log(`   数据库等级: LV.${testUser.user_level}`);
    console.log(`   数据库积分: ${testUser.user_points}\n`);
    
    // 3. 清除Redis缓存
    console.log('🗑️  清除Redis缓存...');
    await redisClient.deleteUserLevel(testUser.user_id);
    
    // 4. 调用getUserLevel API
    console.log('📡 调用getUserLevel API...');
    const levelInfo = await LevelService.getUserLevel(testUser.user_id);
    
    console.log('\n📊 API返回的数据:');
    console.log(JSON.stringify(levelInfo, null, 2));
    
    // 5. 验证数据
    console.log('\n✅ 数据验证:');
    console.log(`   等级匹配: ${levelInfo.level === testUser.user_level ? '✓' : '✗'}`);
    console.log(`   积分匹配: ${levelInfo.points === testUser.user_points ? '✓' : '✗'}`);
    console.log(`   等级名称: ${levelInfo.levelName}`);
    console.log(`   当前等级最大积分: ${levelInfo.maxPoints}`);
    console.log(`   距离下一级所需积分: ${levelInfo.pointsToNextLevel}`);
    console.log(`   进度百分比: ${levelInfo.progressPercentage}%`);
    
    // 6. 验证Redis缓存
    console.log('\n🔍 验证Redis缓存...');
    const cachedData = await redisClient.getUserLevel(testUser.user_id);
    console.log('缓存数据:');
    console.log(JSON.stringify(cachedData, null, 2));
    
    if (cachedData) {
      console.log('\n✅ Redis缓存验证:');
      console.log(`   等级匹配: ${cachedData.level === levelInfo.level ? '✓' : '✗'}`);
      console.log(`   levelName存在: ${cachedData.levelName ? '✓' : '✗'}`);
      console.log(`   maxPoints存在: ${cachedData.maxPoints ? '✓' : '✗'}`);
      console.log(`   pointsToNextLevel存在: ${cachedData.pointsToNextLevel ? '✓' : '✗'}`);
    }
    
    // 7. 测试前端会看到的数据
    console.log('\n📱 前端将显示:');
    console.log(`   Current Level Points: ${levelInfo.points} PTS`);
    console.log(`   Level: ${levelInfo.levelName}`);
    console.log(`   Next Level: ${levelInfo.maxPoints} PTS`);
    console.log(`   进度: ${levelInfo.progressPercentage}%`);
    
    if (testUser.user_level === 2) {
      const expectedMaxPoints = 30; // LV.2的maxPoints应该是30
      if (levelInfo.maxPoints === expectedMaxPoints) {
        console.log('\n✅ 修复成功！LV.2用户显示下一级需要30积分');
      } else {
        console.log(`\n❌ 修复失败！期望maxPoints=30，实际=${levelInfo.maxPoints}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await pool.end();
    await redisClient.disconnect();
    process.exit(0);
  }
}

test();
