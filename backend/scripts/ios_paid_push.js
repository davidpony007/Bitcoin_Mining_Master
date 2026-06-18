'use strict';
/**
 * ios_paid_push.js
 * 一次性脚本：向 5/25-5/30 注册、已有付费合约的 iOS 用户推送通知，
 * 告知其订阅状态正常，引导打开 App 查看收益。
 *
 * 用法（在容器内运行）:
 *   node /app/scripts/ios_paid_push.js
 */

try { require('dotenv').config({ path: '/app/.env' }); } catch (_) {}

const pool = require('../src/config/database_native');
const { sendBatch } = require('../src/services/notificationService');

const NOTIFICATION_TYPE = 'IOS_SUBSCRIPTION_RECOVERY_20260530'; // 同一类型，已推过的自动跳过

async function main() {
  console.log('🚀 [iOS付费用户推送] 开始查询目标用户...');

  // 5/25-5/30 注册的 iOS 用户、有 push token、且已有至少 1 条付费合约
  const [rows] = await pool.query(`
    SELECT DISTINCT
      ui.user_id,
      ui.email,
      pt.fcm_token,
      pt.platform,
      ui.user_creation_time AS reg_time,
      (SELECT COUNT(*) FROM mining_contracts mc
       WHERE mc.user_id = ui.user_id
         AND mc.contract_type = 'paid contract'
      ) AS total_paid_contracts
    FROM user_information ui
    JOIN push_tokens pt ON pt.user_id = ui.user_id AND pt.platform = 'ios'
    WHERE ui.system = 'iOS'
      AND ui.user_creation_time >= '2026-05-25 00:00:00'
      AND ui.user_creation_time <  '2026-05-31 00:00:00'
    HAVING total_paid_contracts > 0
    ORDER BY ui.user_creation_time ASC
  `);

  console.log(`📋 [iOS付费用户推送] 找到 ${rows.length} 名已有付费合约的目标用户`);

  if (rows.length === 0) {
    console.log('✅ 没有需要推送的用户，退出。');
    await pool.end();
    return;
  }

  rows.slice(0, 5).forEach(r => {
    console.log(`  - ${r.user_id} (${r.email || 'no email'}) 合约数=${r.total_paid_contracts}`);
  });
  if (rows.length > 5) console.log(`  ... 共 ${rows.length} 条`);

  const targets = rows.map(r => ({
    userId: r.user_id,
    fcmToken: r.fcm_token,
    platform: r.platform,
  }));

  const title = 'Your Mining Subscription is Active! ⛏️';
  const body  = 'Your subscription is confirmed and your miner is running. Open the app to check your earnings.';
  const data  = { action: 'open_subscription', screen: 'subscription' };

  console.log('\n📨 [iOS付费用户推送] 开始发送推送通知...');
  const { sent, skipped } = await sendBatch(
    targets,
    NOTIFICATION_TYPE,
    null,
    title,
    body,
    data,
    72   // 72 小时去重（与前一脚本同类型，若已推过会自动跳过）
  );

  console.log(`\n✅ [iOS付费用户推送] 完成: 成功发送 ${sent} 条，跳过（已推过）${skipped} 条，失败 ${targets.length - sent - skipped} 条`);
  await pool.end();
}

main().catch(err => {
  console.error('❌ [iOS付费用户推送] 脚本出错:', err);
  process.exit(1);
});
