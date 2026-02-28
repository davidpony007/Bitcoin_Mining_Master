/**
 * 重置测试用户数据脚本
 * 清空指定用户的所有数据
 */
require('dotenv').config();
const db = require('./src/config/database_native');

const userId = 'U2026012523102894533';

async function resetUserData() {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║           测试用户数据重置工具                         ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    console.log(`目标用户: ${userId}\n`);
    
    // 1. 获取当前用户信息
    console.log('📊 步骤1: 获取当前数据...');
    const [userInfo] = await connection.query(
      'SELECT user_id, user_points, user_level, country FROM user_information WHERE user_id = ?',
      [userId]
    );
    
    if (userInfo.length === 0) {
      console.log('❌ 用户不存在！');
      await connection.rollback();
      return;
    }
    
    console.log('   当前积分:', userInfo[0].user_points || 0);
    console.log('   当前等级:', userInfo[0].user_level || 1);
    
    // 获取比特币余额
    const [userStatus] = await connection.query(
      'SELECT current_bitcoin_balance, bitcoin_accumulated_amount FROM user_status WHERE user_id = ?',
      [userId]
    );
    
    if (userStatus.length > 0) {
      console.log('   当前比特币余额:', userStatus[0].current_bitcoin_balance);
      console.log('   累计挖矿产出:', userStatus[0].bitcoin_accumulated_amount);
    }
    
    // 2. 删除所有相关记录
    console.log('\n🗑️  步骤2: 删除所有数据...');
    
    // 删除挖矿合约
    const [contractResult] = await connection.query('DELETE FROM mining_contracts WHERE user_id = ?', [userId]);
    console.log(`   ✅ 删除挖矿合约: ${contractResult.affectedRows} 条`);
    
    // 删除积分交易记录
    const [pointsResult] = await connection.query('DELETE FROM points_transaction WHERE user_id = ?', [userId]);
    console.log(`   ✅ 删除积分交易: ${pointsResult.affectedRows} 条`);
    
    // 删除比特币交易记录
    const [btcResult] = await connection.query('DELETE FROM bitcoin_transaction_records WHERE user_id = ?', [userId]);
    console.log(`   ✅ 删除比特币交易: ${btcResult.affectedRows} 条`);
    
    // 删除提现记录
    const [withdrawResult] = await connection.query('DELETE FROM withdrawal_records WHERE user_id = ?', [userId]);
    console.log(`   ✅ 删除提现记录: ${withdrawResult.affectedRows} 条`);
    
    // 尝试删除签到记录（如果表存在）
    try {
      const [checkinResult] = await connection.query('DELETE FROM daily_check_in WHERE user_id = ?', [userId]);
      console.log(`   ✅ 删除签到记录: ${checkinResult.affectedRows} 条`);
    } catch (e) {
      console.log('   ℹ️  签到记录表不存在或已删除');
    }
    
    // 尝试删除广告记录
    try {
      const [adResult] = await connection.query('DELETE FROM ad_view_record WHERE user_id = ?', [userId]);
      console.log(`   ✅ 删除广告记录: ${adResult.affectedRows} 条`);
    } catch (e) {
      console.log('   ℹ️  广告记录表不存在或已删除');
    }
    
    // 3. 重置用户信息
    console.log('\n🔄 步骤3: 重置用户信息...');
    
    // 重置user_information表
    await connection.query(
      `UPDATE user_information SET
        user_points = 0,
        user_level = 1,
        mining_speed_multiplier = 1.000000
      WHERE user_id = ?`,
      [userId]
    );
    console.log('   ✅ user_information表已重置');
    
    // 重置user_status表
    await connection.query(
      `UPDATE user_status SET
        current_bitcoin_balance = 0,
        bitcoin_accumulated_amount = 0,
        total_invitation_rebate = 0,
        total_withdrawal_amount = 0,
        last_balance_update_time = CURRENT_TIMESTAMP
      WHERE user_id = ?`,
      [userId]
    );
    console.log('   ✅ user_status表已重置');
    
    // 4. 提交事务
    await connection.commit();
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║           重置完成！                                   ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('\n✅ 用户数据已完全重置:');
    console.log('  • 比特币余额: 0');
    console.log('  • 积分: 0');
    console.log('  • 等级: 1');
    console.log('  • 所有交易记录: 已清空');
    console.log('  • 所有合约: 已清空');
    console.log('\n🎯 现在可以重新开始测试了！\n');
    
  } catch (error) {
    await connection.rollback();
    console.error('\n❌ 重置失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    connection.release();
    await db.end();
  }
}

// 执行重置
console.log('\n⚠️  警告：此操作将清空用户的所有数据！\n');
console.log('用户ID:', userId);
console.log('\n按 Ctrl+C 取消，或等待3秒后自动执行...\n');

setTimeout(() => {
  resetUserData();
}, 3000);
