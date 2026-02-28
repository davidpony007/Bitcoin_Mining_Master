/**
 * 测试等级升级逻辑
 */
const PointsService = require('./src/services/pointsService');
const LevelService = require('./src/services/levelService');
const pool = require('./src/config/database_native');

async function test() {
  try {
    console.log('🧪 开始测试等级升级逻辑...\n');
    
    // 1. 初始化等级配置
    await LevelService.initLevelConfig();
    console.log('✅ 等级配置已加载\n');
    
    // 2. 测试用户ID
    const userId = 'U2026011910532463989';
    
    // 3. 查询当前状态
    const [rows] = await pool.query(
      'SELECT user_id, user_level, user_points FROM user_information WHERE user_id = ?',
      [userId]
    );
    
    if (rows.length === 0) {
      console.log('❌ 用户不存在');
      process.exit(1);
    }
    
    const before = rows[0];
    console.log('📊 升级前状态:');
    console.log(`   等级: LV.${before.user_level}`);
    console.log(`   积分: ${before.user_points}\n`);
    
    // 4. 增加1积分（应该从21/20升级到LV.2 2/30）
    console.log('🔄 增加1积分...');
    const result = await PointsService.addPoints(
      userId,
      1,
      'AD_VIEW', // 使用有效的枚举值
      '测试升级逻辑'
    );
    
    console.log('\n📊 增加积分结果:');
    console.log(`   成功: ${result.success}`);
    console.log(`   积分变化: +${result.pointsChange}`);
    console.log(`   新积分: ${result.totalPoints}`);
    console.log(`   当前等级: LV.${result.currentLevel}`);
    console.log(`   是否升级: ${result.levelChanged ? '是' : '否'}\n`);
    
    // 5. 查询最新状态
    const [newRows] = await pool.query(
      'SELECT user_id, user_level, user_points FROM user_information WHERE user_id = ?',
      [userId]
    );
    
    const after = newRows[0];
    console.log('📊 升级后状态:');
    console.log(`   等级: LV.${after.user_level}`);
    console.log(`   积分: ${after.user_points}\n`);
    
    // 6. 验证结果
    if (after.user_level === 2 && after.user_points === 2) {
      console.log('✅ 升级逻辑正确！');
      console.log('   从 LV.1 21分 升级到 LV.2 2分');
    } else {
      console.log('❌ 升级逻辑错误！');
      console.log(`   期望: LV.2 2分`);
      console.log(`   实际: LV.${after.user_level} ${after.user_points}分`);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    process.exit(0);
  }
}

test();
