/**
 * 奖励系统完整测试脚本
 * 测试以下功能：
 * 1. 广告观看奖励（每日20积分封顶）
 * 2. 邀请单个好友奖励（完成5次广告后触发，6积分）
 * 3. 邀请10人里程碑奖励（30积分，可重复）
 * 4. 下级广告观看返佣（每10次1积分）
 */

const AdPointsService = require('./src/services/adPointsService');
const InvitationPointsService = require('./src/services/invitationPointsService');
const db = require('./src/config/database');

async function testRewardSystem() {
  console.log('\n========== 开始测试奖励系统 ==========\n');

  try {
    // 测试用户
    const referrerId = 'TEST_REFERRER_001';
    const refereeId = 'TEST_REFEREE_001';

    console.log('📋 测试场景：');
    console.log('1. 广告观看奖励（每日20积分封顶）');
    console.log('2. 邀请单个好友奖励（被邀请人完成5次广告，邀请人获得6积分）');
    console.log('3. 下级广告观看返佣（下级每看10次广告，邀请人获得1积分）');
    console.log('4. 邀请10人里程碑奖励（每10人30积分）\n');

    // ==================== 测试1: 广告观看奖励 ====================
    console.log('【测试1】广告观看奖励功能\n');
    
    // 清理测试数据
    await db.query('DELETE FROM ad_view_record WHERE user_id IN (?, ?)', [referrerId, refereeId]);
    await db.query('DELETE FROM points_transaction WHERE user_id IN (?, ?)', [referrerId, refereeId]);
    await db.query('DELETE FROM referral_milestone WHERE user_id = ?', [referrerId]);
    await db.query('DELETE FROM invitation_relationship WHERE user_id = ? OR referrer_user_id = ?', [refereeId, referrerId]);

    // 创建邀请关系
    await db.query(
      `INSERT INTO invitation_relationship (user_id, invitation_code, referrer_user_id, referrer_invitation_code)
       VALUES (?, ?, ?, ?)`,
      [refereeId, 'REF001', referrerId, 'REFER001']
    );
    console.log(`✓ 创建邀请关系：${referrerId} 邀请了 ${refereeId}\n`);

    // 被邀请人观看5次广告（应该自动触发邀请奖励）
    console.log('被邀请人观看广告...');
    for (let i = 1; i <= 5; i++) {
      const result = await AdPointsService.recordAdViewAndReward(refereeId);
      console.log(`  第${i}次观看：获得 ${result.pointsAwarded} 积分，今日累计 ${result.totalPointsToday} 积分`);
      
      if (i === 5 && result.referralReward) {
        console.log(`  🎉 触发邀请奖励！邀请人 ${result.referralReward.referrerId} 获得 ${result.referralReward.pointsEarned} 积分`);
      }
    }
    console.log('');

    // 被邀请人继续观看到10次（应该触发下级返佣）
    console.log('被邀请人继续观看广告到10次...');
    for (let i = 6; i <= 10; i++) {
      const result = await AdPointsService.recordAdViewAndReward(refereeId);
      console.log(`  第${i}次观看：获得 ${result.pointsAwarded} 积分`);
      
      if (i === 10 && result.subordinateReward) {
        console.log(`  🎉 触发下级返佣！邀请人获得 ${result.subordinateReward.rewardPoints} 积分`);
      }
    }
    console.log('');

    // 被邀请人继续观看到20次（测试每日上限）
    console.log('被邀请人继续观看到20次（测试每日上限）...');
    for (let i = 11; i <= 22; i++) {
      const result = await AdPointsService.recordAdViewAndReward(refereeId);
      console.log(`  第${i}次观看：获得 ${result.pointsAwarded} 积分，剩余 ${result.remainingViews} 次`);
      
      if (i === 20 && result.subordinateReward) {
        console.log(`  🎉 第20次观看触发下级返佣！邀请人获得 ${result.subordinateReward.rewardPoints} 积分`);
      }
      
      if (result.isLimitReached && i === 20) {
        console.log(`  ⚠️  达到每日上限（20积分）`);
      }
    }
    console.log('');

    // ==================== 测试2: 查询积分记录 ====================
    console.log('【测试2】查询积分记录\n');

    const [refereePoints] = await db.query(
      'SELECT SUM(points) as total FROM points_transaction WHERE user_id = ?',
      [refereeId]
    );
    console.log(`被邀请人总积分：${refereePoints[0].total || 0} 积分`);

    const [referrerPoints] = await db.query(
      'SELECT SUM(points) as total FROM points_transaction WHERE user_id = ?',
      [referrerId]
    );
    console.log(`邀请人总积分：${referrerPoints[0].total || 0} 积分`);

    const [referrerDetail] = await db.query(
      `SELECT points_type, points, description FROM points_transaction 
       WHERE user_id = ? ORDER BY created_at`,
      [referrerId]
    );
    console.log('\n邀请人积分明细：');
    referrerDetail.forEach(record => {
      console.log(`  - ${record.description}: ${record.points} 积分 (类型: ${record.points_type})`);
    });
    console.log('');

    // ==================== 测试3: 验证数据完整性 ====================
    console.log('【测试3】验证数据完整性\n');

    const [adRecords] = await db.query(
      'SELECT user_id, SUM(view_count) as total_views, SUM(points_earned) as total_points FROM ad_view_record GROUP BY user_id'
    );
    console.log('广告观看记录：');
    adRecords.forEach(record => {
      console.log(`  用户 ${record.user_id}: ${record.total_views} 次观看，获得 ${record.total_points} 积分`);
    });
    console.log('');

    const [milestones] = await db.query(
      'SELECT * FROM referral_milestone WHERE user_id = ? ORDER BY claimed_at',
      [referrerId]
    );
    console.log('邀请里程碑记录：');
    milestones.forEach(m => {
      console.log(`  ${m.milestone_type}: 第${m.milestone_count}次，获得 ${m.points_earned} 积分`);
    });
    console.log('');

    // ==================== 测试4: 里程碑奖励 ====================
    console.log('【测试4】测试10人邀请里程碑奖励\n');
    
    // 模拟创建10个已完成5次广告的被邀请人
    console.log('创建9个额外的被邀请人（总共10人）...');
    for (let i = 2; i <= 10; i++) {
      const testRefereeId = `TEST_REFEREE_${String(i).padStart(3, '0')}`;
      
      // 创建邀请关系
      await db.query(
        `INSERT INTO invitation_relationship (user_id, invitation_code, referrer_user_id, referrer_invitation_code)
         VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE user_id=user_id`,
        [testRefereeId, `REF${String(i).padStart(3, '0')}`, referrerId, 'REFER001']
      );
      
      // 模拟观看5次广告
      for (let j = 0; j < 5; j++) {
        await db.query(
          `INSERT INTO ad_view_record (user_id, view_date, view_count, points_earned)
           VALUES (?, CURDATE(), 5, 5)
           ON DUPLICATE KEY UPDATE view_count=5, points_earned=5`,
          [testRefereeId]
        );
      }
    }
    console.log('✓ 创建完成\n');

    // 尝试领取10人里程碑奖励
    console.log('领取10人邀请里程碑奖励...');
    const milestoneResult = await InvitationPointsService.handleTenFriendsMilestone(referrerId);
    
    if (milestoneResult.success) {
      console.log(`✅ 领取成功！`);
      console.log(`  - 有效邀请人数：${milestoneResult.validReferrals} 人`);
      console.log(`  - 发放奖励次数：${milestoneResult.rewardsGranted} 次`);
      console.log(`  - 总计积分：${milestoneResult.totalPoints} 积分`);
    } else {
      console.log(`❌ 领取失败：${milestoneResult.message}`);
    }
    console.log('');

    // 最终统计
    console.log('========== 测试完成 ==========\n');
    const [finalReferrerPoints] = await db.query(
      'SELECT SUM(points) as total FROM points_transaction WHERE user_id = ?',
      [referrerId]
    );
    console.log(`✅ 邀请人最终总积分：${finalReferrerPoints[0].total || 0} 积分`);
    console.log('');
    console.log('预期积分构成：');
    console.log('  - 单个好友邀请奖励：6积分 × 10人 = 60积分');
    console.log('  - 下级广告返佣：1积分 × 2次 = 2积分（第1个被邀请人看了20次）');
    console.log('  - 10人里程碑奖励：30积分 × 1次 = 30积分');
    console.log('  - 总计：92积分');
    console.log('');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    process.exit(0);
  }
}

// 运行测试
testRewardSystem();
