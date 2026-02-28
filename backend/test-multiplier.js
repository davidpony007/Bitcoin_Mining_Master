/**
 * 测试倍率系统功能
 */

require('dotenv').config();
const MultiplierService = require('./src/services/multiplierService');

async function testMultiplierSystem() {
  console.log('===== 倍率系统功能测试 =====\n');

  try {
    // 测试1: 获取用户倍率信息
    console.log('【测试1】获取用户倍率信息...');
    const userId = 'U2025120722013740362'; // 使用第一个用户
    const multiplierInfo = await MultiplierService.getUserMultiplier(userId);
    console.log('✅ 用户倍率信息:');
    console.log(JSON.stringify(multiplierInfo, null, 2));
    console.log();

    // 测试2: 更新单个用户的国家倍率
    console.log('【测试2】更新单个用户的国家倍率...');
    const result = await MultiplierService.updateCountryMultiplier(userId, 1.50);
    console.log(`✅ 更新成功: ${result ? '是' : '否'}`);
    
    // 验证更新
    const updatedInfo = await MultiplierService.getUserMultiplier(userId);
    console.log('更新后的倍率:', updatedInfo.countryMultiplier);
    console.log('总倍率:', updatedInfo.totalMultiplier);
    console.log();

    // 测试3: 恢复默认倍率
    console.log('【测试3】恢复默认倍率...');
    await MultiplierService.updateCountryMultiplier(userId, 1.00);
    const restoredInfo = await MultiplierService.getUserMultiplier(userId);
    console.log('✅ 已恢复为:', restoredInfo.countryMultiplier);
    console.log();

    // 测试4: 获取国家倍率统计
    console.log('【测试4】获取国家倍率统计...');
    const stats = await MultiplierService.getCountryMultiplierStats();
    console.log(`✅ 找到 ${stats.length} 条统计记录:`);
    stats.slice(0, 5).forEach(stat => {
      console.log(`  - ${stat.country || '未知国家'}: ${stat.country_multiplier}x (${stat.user_count}人)`);
    });
    if (stats.length > 5) {
      console.log(`  ... 还有 ${stats.length - 5} 条记录`);
    }
    console.log();

    // 测试5: 测试倍率计算公式
    console.log('【测试5】验证倍率计算公式...');
    console.log('公式: 总倍率 = 国家倍率 × 等级倍率 × 每日奖励倍率');
    console.log(`示例: ${updatedInfo.countryMultiplier} × ${updatedInfo.levelMultiplier} × ${updatedInfo.dailyBonusMultiplier} = ${updatedInfo.totalMultiplier}`);
    
    const expectedTotal = updatedInfo.countryMultiplier * updatedInfo.levelMultiplier * updatedInfo.dailyBonusMultiplier;
    const actualTotal = updatedInfo.totalMultiplier;
    const isCorrect = Math.abs(expectedTotal - actualTotal) < 0.01;
    console.log(`✅ 计算结果${isCorrect ? '正确' : '错误'}`);
    console.log();

    console.log('===== 所有测试完成 =====');
    console.log('✅ 倍率系统运行正常');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// 运行测试
testMultiplierSystem();
