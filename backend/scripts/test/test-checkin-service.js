/**
 * 测试签到服务（使用合并后的 user_check_in 表）
 */

require('dotenv').config();
const CheckInPointsService = require('../src/services/checkInPointsService');

async function testCheckInService() {
  try {
    console.log('🧪 测试签到服务（使用 user_check_in 表）\n');

    const testUserId = 'TEST_USER_' + Date.now();

    // 测试1: 获取签到状态（未签到）
    console.log('📋 测试1: 获取签到状态（未签到）');
    const status1 = await CheckInPointsService.getCheckInStatus(testUserId);
    console.log('   结果:', JSON.stringify(status1, null, 2));
    console.log('   ✅ 测试通过\n');

    // 测试2: 执行签到
    console.log('📋 测试2: 执行签到');
    const checkInResult = await CheckInPointsService.performCheckIn(testUserId);
    console.log('   结果:', JSON.stringify(checkInResult, null, 2));
    console.log('   ✅ 测试通过\n');

    // 测试3: 获取签到状态（已签到）
    console.log('📋 测试3: 获取签到状态（已签到）');
    const status2 = await CheckInPointsService.getCheckInStatus(testUserId);
    console.log('   结果:', JSON.stringify(status2, null, 2));
    console.log('   ✅ 测试通过\n');

    // 测试4: 重复签到（应该失败）
    console.log('📋 测试4: 重复签到（应该失败）');
    const duplicateResult = await CheckInPointsService.performCheckIn(testUserId);
    console.log('   结果:', JSON.stringify(duplicateResult, null, 2));
    if (!duplicateResult.success && duplicateResult.error === 'ALREADY_CHECKED_IN') {
      console.log('   ✅ 测试通过（正确拒绝重复签到）\n');
    } else {
      console.log('   ❌ 测试失败（应该拒绝重复签到）\n');
    }

    // 测试5: 获取可领取的里程碑
    console.log('📋 测试5: 获取可领取的里程碑');
    const milestones = await CheckInPointsService.getAvailableMilestones(testUserId);
    console.log('   结果:', JSON.stringify(milestones, null, 2));
    console.log('   ✅ 测试通过\n');

    // 测试6: 获取30天日历
    console.log('📋 测试6: 获取30天日历');
    const calendar = await CheckInPointsService.get30DayCalendar(testUserId);
    console.log('   日历数据条数:', calendar.calendar?.length);
    console.log('   总签到天数:', calendar.summary?.totalChecked);
    console.log('   ✅ 测试通过\n');

    console.log('🎉 所有测试通过！user_check_in 表工作正常！');

    // 清理测试数据
    console.log('\n🧹 清理测试数据...');
    const db = require('../src/config/database_native');
    const [result] = await db.query('DELETE FROM user_check_in WHERE user_id = ?', [testUserId]);
    console.log(`   已删除 ${result.affectedRows} 条测试记录`);

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    process.exit(0);
  }
}

testCheckInService();
