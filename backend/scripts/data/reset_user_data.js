/**
 * 重置用户数据脚本
 * 清空指定用户的所有数据，但保留比特币余额
 */
require('dotenv').config();
const db = require('../src/config/database_native');

const userId = 'U2026012523102894533';

async function resetUserData() {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║           用户数据重置工具                             ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    console.log(`目标用户: ${userId}\n`);
    
    // 1. 获取当前比特币余额和用户信息
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
    
    const currentUser = userInfo[0];
    
    // 获取比特币余额（在user_status表中）
    const [userStatus] = await connection.query(
      'SELECT current_bitcoin_balance, bitcoin_accumulated_amount FROM user_status WHERE user_id = ?',
      [userId]
    );
    
    const btcBalance = userStatus.length > 0 ? userStatus[0].current_bitcoin_balance : 0;
    const btcAccumulated = userStatus.length > 0 ? userStatus[0].bitcoin_accumulated_amount : 0;
    
    console.log('   当前比特币余额:', btcBalance);
    console.log('   累计挖矿产出:', btcAccumulated);
    console.log('   当前积分:', currentUser.user_points || 0);
    console.log('   当前等级:', currentUser.user_level || 1);
    console.log('   国家:', currentUser.country || 'null');
    
    // 2. 统计要删除的数据
    console.log('\n📊 步骤2: 统计要删除的数据...');
    
    const [checkInCount] = await connection.query(
      'SELECT COUNT(*) as count FROM user_check_in WHERE user_id = ?',
      [userId]
    );
    console.log(`   签到记录: ${checkInCount[0].count} 条`);
    
    const [cumulativeRewardCount] = await connection.query(
      'SELECT COUNT(*) as count FROM cumulative_check_in_reward WHERE user_id = ?',
      [userId]
    );
    console.log(`   累计签到奖励: ${cumulativeRewardCount[0].count} 条`);
    
    const [adCount] = await connection.query(
      'SELECT COUNT(*) as count FROM ad_view_record WHERE user_id = ?',
      [userId]
    );
    console.log(`   广告观看记录: ${adCount[0].count} 条`);
    
    const [contractCount] = await connection.query(
      'SELECT COUNT(*) as count FROM mining_contracts WHERE user_id = ?',
      [userId]
    );
    console.log(`   挖矿合约: ${contractCount[0].count} 条`);
    
    const [freeContractCount] = await connection.query(
      'SELECT COUNT(*) as count FROM free_contract_records WHERE user_id = ?',
      [userId]
    );
    console.log(`   免费合约: ${freeContractCount[0].count} 条`);
    
    const [pointsTransCount] = await connection.query(
      'SELECT COUNT(*) as count FROM points_transaction WHERE user_id = ?',
      [userId]
    );
    console.log(`   积分交易: ${pointsTransCount[0].count} 条`);
    
    const [btcTransCount] = await connection.query(
      'SELECT COUNT(*) as count FROM bitcoin_transaction_records WHERE user_id = ?',
      [userId]
    );
    console.log(`   比特币交易: ${btcTransCount[0].count} 条`);
    
    const [withdrawalCount] = await connection.query(
      'SELECT COUNT(*) as count FROM withdrawal_records WHERE user_id = ?',
      [userId]
    );
    console.log(`   提现记录: ${withdrawalCount[0].count} 条`);
    
    // 3. 确认删除
    console.log('\n⚠️  步骤3: 准备清空数据...');
    console.log('   保留: 比特币余额 (' + btcBalance + ')');
    console.log('   清空: 积分、等级、所有交易记录、合约、签到记录等\n');
    
    // 4. 删除所有相关记录
    console.log('🗑️  步骤4: 删除数据...');
    
    // 删除签到记录
    await connection.query('DELETE FROM user_check_in WHERE user_id = ?', [userId]);
    console.log('   ✅ 签到记录已清空');
    
    // 删除累计签到奖励
    await connection.query('DELETE FROM cumulative_check_in_reward WHERE user_id = ?', [userId]);
    console.log('   ✅ 累计签到奖励已清空');
    
    // 删除广告观看记录
    await connection.query('DELETE FROM ad_view_record WHERE user_id = ?', [userId]);
    console.log('   ✅ 广告观看记录已清空');
    
    // 删除挖矿合约
    await connection.query('DELETE FROM mining_contracts WHERE user_id = ?', [userId]);
    console.log('   ✅ 挖矿合约已清空');
    
    // 删除免费合约记录
    await connection.query('DELETE FROM free_contract_records WHERE user_id = ?', [userId]);
    console.log('   ✅ 免费合约记录已清空');
    
    // 删除积分交易记录
    await connection.query('DELETE FROM points_transaction WHERE user_id = ?', [userId]);
    console.log('   ✅ 积分交易记录已清空');
    
    // 删除比特币交易记录
    await connection.query('DELETE FROM bitcoin_transaction_records WHERE user_id = ?', [userId]);
    console.log('   ✅ 比特币交易记录已清空');
    
    // 删除提现记录
    await connection.query('DELETE FROM withdrawal_records WHERE user_id = ?', [userId]);
    console.log('   ✅ 提现记录已清空');
    
    // 删除邀请关系
    await connection.query('DELETE FROM invitation_relationship WHERE user_id = ? OR referrer_user_id = ?', [userId, userId]);
    console.log('   ✅ 邀请关系已清空');
    
    // 删除邀请返利记录
    await connection.query('DELETE FROM invitation_rebate WHERE user_id = ?', [userId]);
    console.log('   ✅ 邀请返利记录已清空');
    
    // 5. 重置用户信息（保留比特币余额）
    console.log('\n🔄 步骤5: 重置用户信息...');
    
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
    
    // 重置user_status表（保留比特币余额）
    await connection.query(
      `UPDATE user_status SET
        total_invitation_rebate = 0,
        total_withdrawal_amount = 0,
        last_balance_update_time = CURRENT_TIMESTAMP
      WHERE user_id = ?`,
      [userId]
    );
    console.log('   ✅ user_status表已重置（保留比特币余额）');
    
    // 6. 提交事务
    await connection.commit();
    
    // 7. 验证结果
    console.log('\n✅ 步骤6: 验证重置结果...');
    const [resetUser] = await connection.query(
      'SELECT user_id, user_points, user_level FROM user_information WHERE user_id = ?',
      [userId]
    );
    
    const [resetStatus] = await connection.query(
      'SELECT current_bitcoin_balance, bitcoin_accumulated_amount FROM user_status WHERE user_id = ?',
      [userId]
    );
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║           重置完成！                                   ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('\n当前用户状态:');
    console.log('  • 比特币余额:', resetStatus[0].current_bitcoin_balance, '(保留)');
    console.log('  • 累计挖矿产出:', resetStatus[0].bitcoin_accumulated_amount, '(保留)');
    console.log('  • 积分:', resetUser[0].user_points, '(重置为0)');
    console.log('  • 等级:', resetUser[0].user_level, '(重置为1)');
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
console.log('\n⚠️  警告：此操作将清空用户的所有数据（保留比特币余额）！\n');
console.log('用户ID:', userId);
console.log('\n按 Ctrl+C 取消，或等待3秒后自动执行...\n');

setTimeout(() => {
  resetUserData();
}, 3000);
