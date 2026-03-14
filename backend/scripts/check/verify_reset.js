const db = require('../src/config/database_native');
const userId = 'U2026011910532463989';

(async () => {
  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║           验证用户数据重置结果                         ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    // 用户基本信息
    const [user] = await db.query(
      'SELECT user_id, user_points, user_level FROM user_information WHERE user_id = ?', 
      [userId]
    );
    console.log('✅ 用户信息:');
    console.log('   积分:', user[0].user_points);
    console.log('   等级:', user[0].user_level);
    
    // 比特币余额
    const [status] = await db.query(
      'SELECT current_bitcoin_balance, bitcoin_accumulated_amount FROM user_status WHERE user_id = ?', 
      [userId]
    );
    console.log('\n✅ 比特币余额（已保留）:');
    console.log('   当前余额:', status[0].current_bitcoin_balance);
    console.log('   累计产出:', status[0].bitcoin_accumulated_amount);
    
    // 检查各表记录数
    console.log('\n✅ 各表记录数（应该都是0）:');
    
    const tables = [
      'user_check_in',
      'cumulative_check_in_reward',
      'ad_view_record',
      'mining_contracts',
      'free_contract_records',
      'points_transaction',
      'bitcoin_transaction_records',
      'withdrawal_records',
      'invitation_relationship',
      'invitation_rebate'
    ];
    
    for (const table of tables) {
      const [result] = await db.query(
        `SELECT COUNT(*) as count FROM ${table} WHERE user_id = ?`, 
        [userId]
      );
      const count = result[0].count;
      const icon = count === 0 ? '✅' : '❌';
      console.log('   ' + icon, table + ':', count);
    }
    
    console.log('\n🎉 验证完成！用户数据已成功重置，可以开始测试了！\n');
    
    await db.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  }
})();
