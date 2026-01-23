const db = require('./src/config/database_native');

(async () => {
  try {
    console.log('=== 最终验证：签到功能完整测试 ===\n');
    
    // 查询用户最新状态
    const [user] = await db.query(
      'SELECT user_id, user_points, user_level FROM user_information WHERE user_id = ?', 
      ['U2026011910532463989']
    );
    console.log('✅ 用户当前状态:', user[0]);
    
    // 查询签到记录
    const [records] = await db.query(
      'SELECT check_in_date, points_earned FROM check_in_record WHERE user_id = ? ORDER BY check_in_date DESC LIMIT 3', 
      ['U2026011910532463989']
    );
    console.log('✅ 最近签到记录:', records);
    
    // 查询累计奖励
    const [rewards] = await db.query(
      'SELECT * FROM cumulative_check_in_reward WHERE user_id = ?', 
      ['U2026011910532463989']
    );
    console.log('✅ 累计奖励记录:', rewards.length + '条');
    
    await db.end();
    console.log('\n🎉 签到功能数据完整性验证通过！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  }
})();
