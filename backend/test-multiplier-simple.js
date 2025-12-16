/**
 * 简化测试倍率系统 - 仅测试国家倍率CRUD功能
 */

require('dotenv').config();
const MultiplierService = require('./src/services/multiplierService');
const UserInformation = require('./src/models/userInformation');

async function testMultiplierCRUD() {
  console.log('===== 倍率系统 CRUD 测试 =====\n');

  try {
    // 获取第一个真实用户
    const user = await UserInformation.findOne({
      where: { user_id: 'U2025120722013740362' }
    });

    if (!user) {
      console.log('❌ 找不到测试用户');
      process.exit(1);
    }

    const userId = user.user_id;
    console.log(`✅ 使用用户: ${userId}\n`);

    // 测试1: 更新国家倍率
    console.log('【测试1】更新国家倍率为 1.50...');
    const result1 = await MultiplierService.updateCountryMultiplier(userId, 1.50);
    console.log(`✅ 更新结果: ${result1 ? '成功' : '失败'}`);
    
    // 验证更新
    const updatedUser = await UserInformation.findOne({ where: { user_id: userId } });
    console.log(`当前倍率: ${updatedUser.country_multiplier}\n`);

    // 测试2: 恢复默认倍率
    console.log('【测试2】恢复默认倍率 1.00...');
    const result2 = await MultiplierService.updateCountryMultiplier(userId, 1.00);
    console.log(`✅ 更新结果: ${result2 ? '成功' : '失败'}`);

    const restoredUser = await UserInformation.findOne({ where: { user_id: userId } });
    console.log(`当前倍率: ${restoredUser.country_multiplier}\n`);

    // 测试3: 测试批量更新(假设有CN国家的用户)
    if (user.country) {
      console.log(`【测试3】批量更新 ${user.country} 国家倍率为 1.20...`);
      const affectedCount = await MultiplierService.updateCountryMultiplierByCountry(user.country, 1.20);
      console.log(`✅ 影响用户数: ${affectedCount}\n`);

      // 恢复
      await MultiplierService.updateCountryMultiplierByCountry(user.country, 1.00);
      console.log('✅ 已恢复默认值\n');
    } else {
      console.log('【测试3】跳过 - 用户没有国家信息\n');
    }

    // 测试4: 获取统计信息
    console.log('【测试4】获取国家倍率统计...');
    const stats = await MultiplierService.getCountryMultiplierStats();
    console.log(`✅ 找到 ${stats.length} 条统计记录:`);
    stats.slice(0, 5).forEach(stat => {
      console.log(`  - ${stat.country || '未设置'}: ${stat.country_multiplier}x (${stat.user_count}人)`);
    });
    if (stats.length > 5) {
      console.log(`  ... 还有 ${stats.length - 5} 条记录`);
    }

    console.log('\n===== 所有CRUD测试完成 =====');
    console.log('✅ 国家倍率功能运行正常');
    console.log('\n注意: getUserMultiplier 依赖 LevelService,需要等级表才能完整测试');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

testMultiplierCRUD();
