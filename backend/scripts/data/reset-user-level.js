/**
 * 重置用户等级为LV.1 21分，用于测试升级
 */
const pool = require('../src/config/database_native');

async function reset() {
  try {
    const userId = 'U2026011910532463989';
    
    console.log('🔄 重置用户等级为 LV.1 21分...');
    
    await pool.query(
      'UPDATE user_information SET user_level = 1, user_points = 21 WHERE user_id = ?',
      [userId]
    );
    
    console.log('✅ 重置完成！');
    console.log('   等级: LV.1');
    console.log('   积分: 21/20 (超过升级要求)');
    console.log('\n📝 下次增加积分时会自动升级到 LV.2，积分变为 2/30');
    
  } catch (error) {
    console.error('❌ 重置失败:', error);
  } finally {
    process.exit(0);
  }
}

reset();
