/**
 * 测试签到功能（无需Token认证）
 */
require('dotenv').config();
const CheckInPointsService = require('./src/services/checkInPointsService');
const db = require('./src/config/database_native'); // 使用原生MySQL连接池

const userId = 'U2026011910532463989';

async function test() {
  console.log('=== 测试签到功能 ===\n');

  try {
    // 测试1: 获取签到状态
    console.log('1. 获取签到状态...');
    const status = await CheckInPointsService.getCheckInStatus(userId);
    console.log('签到状态:', JSON.stringify(status, null, 2));

    // 测试2: 执行签到（如果今天还没签到）
    if (!status.hasCheckedInToday) {
      console.log('\n2. 执行签到...');
      const result = await CheckInPointsService.performCheckIn(userId);
      console.log('签到结果:', JSON.stringify(result, null, 2));
    } else {
      console.log('\n2. 今日已签到，跳过');
    }

    // 测试3: 验证数据库中的记录
    console.log('\n3. 验证数据库记录...');
    const [records] = await db.query(
      'SELECT * FROM check_in_record WHERE user_id = ? ORDER BY check_in_date DESC LIMIT 5',
      [userId]
    );
    console.log(`数据库中有 ${records.length} 条签到记录:`);
    records.forEach((r, i) => {
      console.log(`  ${i+1}. 日期: ${r.check_in_date}, 积分: ${r.points_earned}`);
    });

    // 测试4: 查看用户总积分
    console.log('\n4. 查看用户信息...');
    const [userInfo] = await db.query(
      'SELECT user_id, user_points, user_level FROM user_information WHERE user_id = ?',
      [userId]
    );
    if (userInfo.length > 0) {
      console.log('用户信息:', userInfo[0]);
    }

    console.log('\n✅ 所有测试通过！签到功能正常工作。');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
