/**
 * 重置测试用户数据脚本
 * 清空积分、等级、合约、签到等所有数据，恢复初始状态
 */

require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);

async function resetTestUser(userId) {
  try {
    console.log('===== 开始重置用户数据 =====');
    console.log(`用户ID: ${userId}`);

    // 1. 重置用户基本信息（等级、积分、倍率）
    console.log('\n1️⃣  重置用户等级和积分...');
    await sequelize.query(
      `UPDATE user_information 
       SET user_level = 1,
           user_points = 0,
           mining_speed_multiplier = 1.000000
       WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.UPDATE }
    );
    console.log('   ✅ 等级重置为Lv.1，积分清零，倍率重置为1.0');

    // 2. 重置用户余额
    console.log('\n2️⃣  重置用户余额...');
    await sequelize.query(
      `UPDATE user_status 
       SET bitcoin_accumulated_amount = '0.000000000000000000',
           current_bitcoin_balance = '0.000000000000000000',
           total_invitation_rebate = '0.000000000000000000',
           total_withdrawal_amount = '0.000000000000000000'
       WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.UPDATE }
    );
    console.log('   ✅ BTC余额清零');

    // 3. 删除所有免费挖矿合约
    console.log('\n3️⃣  删除所有免费挖矿合约...');
    const freeContractResult = await sequelize.query(
      `DELETE FROM free_contract_records WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.DELETE }
    );
    console.log(`   ✅ 已删除免费合约记录`);

    // 4. 删除所有付费挖矿合约
    console.log('\n4️⃣  删除所有付费挖矿合约...');
    const paidContractResult = await sequelize.query(
      `DELETE FROM mining_contracts WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.DELETE }
    );
    console.log(`   ✅ 已删除付费合约记录`);

    // 5. 清空积分交易记录
    console.log('\n5️⃣  清空积分交易记录...');
    const pointsTxResult = await sequelize.query(
      `DELETE FROM points_transaction WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.DELETE }
    );
    console.log(`   ✅ 已删除积分记录`);

    // 6. 删除user_points表记录（如果存在）
    console.log('\n6️⃣  清空user_points表...');
    try {
      await sequelize.query(
        `DELETE FROM user_points WHERE user_id = :userId`,
        { replacements: { userId }, type: QueryTypes.DELETE }
      );
      console.log('   ✅ user_points表已清空');
    } catch (e) {
      console.log('   ⚠️  user_points表不存在或已清空');
    }

    // 7. 清空广告观看记录
    console.log('\n7️⃣  清空广告观看记录...');
    const adViewsResult = await sequelize.query(
      `DELETE FROM ad_view_record WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.DELETE }
    );
    console.log(`   ✅ 已删除广告记录`);

    // 8. 清空签到记录
    console.log('\n8️⃣  清空签到记录...');
    const checkInsResult = await sequelize.query(
      `DELETE FROM check_in_record WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.DELETE }
    );
    console.log(`   ✅ 已删除签到记录`);

    // 9. 清空user_check_in表
    console.log('\n9️⃣  清空user_check_in表...');
    const userCheckInsResult = await sequelize.query(
      `DELETE FROM user_check_in WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.DELETE }
    );
    console.log(`   ✅ 已删除user_check_in记录`);

    // 10. 清空累计签到奖励记录
    console.log('\n🔟 清空累计签到奖励记录...');
    const cumulativeRewardsResult = await sequelize.query(
      `DELETE FROM cumulative_check_in_reward WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.DELETE }
    );
    console.log(`   ✅ 已删除累计奖励记录`);

    // 11. 清空邀请里程碑记录
    console.log('\n1️⃣1️⃣  清空邀请里程碑记录...');
    const milestonesResult = await sequelize.query(
      `DELETE FROM referral_milestone WHERE user_id = :userId`,
      { replacements: { userId }, type: QueryTypes.DELETE }
    );
    console.log(`   ✅ 已删除里程碑记录`);

    console.log('\n===== ✅ 数据重置完成 =====');
    console.log('\n初始状态：');
    console.log('  🎮 等级: Lv.1');
    console.log('  ⭐ 积分: 0/20');
    console.log('  ⚡ 倍率: 1.0x');
    console.log('  💰 余额: 0 BTC');
    console.log('  📦 合约: 无');
    console.log('  🔋 电池: 48个空电池');
    console.log('  ✅ 签到: 无记录');
    console.log('  📝 积分记录: 无');

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 重置失败:', error);
    await sequelize.close();
    process.exit(1);
  }
}

// 从命令行参数获取用户ID，或使用默认测试用户
const userId = process.argv[2] || 'U2026011910532463989';

console.log('\n⚠️  警告：此操作将清空所有用户数据！');
console.log('按 Ctrl+C 取消，或等待3秒后自动继续...\n');

setTimeout(() => {
  resetTestUser(userId);
}, 3000);
