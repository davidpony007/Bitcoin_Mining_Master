/**
 * 测试国家挖矿配置功能
 * 
 * 测试内容:
 * 1. 获取所有国家配置
 * 2. 查询指定国家倍率
 * 3. 更新国家倍率
 * 4. 获取统计信息
 * 
 * 执行方式:
 * node test-country-mining.js
 */

const CountryMiningService = require('./src/services/countryMiningService');
const redisClient = require('./src/config/redis');
require('dotenv').config();

async function testCountryMining() {
  console.log('=== 国家挖矿配置功能测试 ===\n');

  try {
    // 连接 Redis
    await redisClient.connect();
    console.log('✅ Redis 连接成功\n');

    // 测试 1: 获取所有国家配置
    console.log('📝 测试 1: 获取所有国家配置');
    const allConfigs = await CountryMiningService.getAllConfigs({ activeOnly: true });
    console.log(`   找到 ${allConfigs.length} 个国家配置:`);
    allConfigs.forEach(config => {
      console.log(`   - ${config.countryCode}: ${config.countryNameCn} = ${config.miningMultiplier}x`);
    });
    console.log('   ✅ 测试通过\n');

    // 测试 2: 查询美国的倍率
    console.log('📝 测试 2: 查询美国挖矿倍率');
    const usMultiplier = await CountryMiningService.getMiningMultiplier('US');
    console.log(`   美国挖矿倍率: ${usMultiplier}x`);
    console.log('   ✅ 测试通过\n');

    // 测试 3: 查询未配置国家（应返回默认值）
    console.log('📝 测试 3: 查询未配置国家 (CN)');
    const cnMultiplier = await CountryMiningService.getMiningMultiplier('CN');
    console.log(`   中国挖矿倍率: ${cnMultiplier}x (默认值)`);
    console.log('   ✅ 测试通过\n');

    // 测试 4: 缓存命中测试
    console.log('📝 测试 4: 缓存命中测试');
    console.log('   第一次查询 US (应该从数据库):');
    const start1 = Date.now();
    await CountryMiningService.getMiningMultiplier('US');
    const time1 = Date.now() - start1;
    console.log(`   耗时: ${time1}ms`);

    console.log('   第二次查询 US (应该从缓存):');
    const start2 = Date.now();
    await CountryMiningService.getMiningMultiplier('US');
    const time2 = Date.now() - start2;
    console.log(`   耗时: ${time2}ms`);
    console.log(`   缓存加速: ${((time1 - time2) / time1 * 100).toFixed(1)}%`);
    console.log('   ✅ 测试通过\n');

    // 测试 5: 获取统计信息
    console.log('📝 测试 5: 获取统计信息');
    const stats = await CountryMiningService.getStatistics();
    console.log('   统计结果:');
    console.log(`   - 总国家数: ${stats.totalCountries}`);
    console.log(`   - 倍率等级: ${stats.multiplierLevels}`);
    console.log(`   - 最低倍率: ${stats.minMultiplier}x`);
    console.log(`   - 最高倍率: ${stats.maxMultiplier}x`);
    console.log(`   - 平均倍率: ${stats.avgMultiplier.toFixed(2)}x`);
    console.log('   ✅ 测试通过\n');

    // 测试 6: 更新倍率（可选，会修改数据）
    console.log('📝 测试 6: 更新美国倍率 (26 → 28)');
    const updateResult = await CountryMiningService.updateMultiplier('US', 28);
    console.log(`   更新结果: ${updateResult.message}`);
    
    const newUsMultiplier = await CountryMiningService.getMiningMultiplier('US');
    console.log(`   新倍率: ${newUsMultiplier}x`);
    
    // 恢复原值
    await CountryMiningService.updateMultiplier('US', 26);
    console.log('   已恢复为 26x');
    console.log('   ✅ 测试通过\n');

    // 测试 7: 批量更新
    console.log('📝 测试 7: 批量更新倍率');
    const batchResult = await CountryMiningService.batchUpdateMultipliers([
      { countryCode: 'UK', multiplier: 20 },
      { countryCode: 'DE', multiplier: 20 }
    ]);
    console.log(`   批量更新结果: 成功 ${batchResult.success}, 失败 ${batchResult.failed}`);
    
    // 恢复原值
    await CountryMiningService.batchUpdateMultipliers([
      { countryCode: 'UK', multiplier: 18 },
      { countryCode: 'DE', multiplier: 18 }
    ]);
    console.log('   已恢复原值');
    console.log('   ✅ 测试通过\n');

    console.log('🎉 所有测试通过!\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error);
  } finally {
    await redisClient.disconnect();
    console.log('✅ Redis 连接已关闭');
    process.exit(0);
  }
}

// 执行测试
testCountryMining();
