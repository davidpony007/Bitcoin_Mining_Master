'use strict';
/**
 * ios_recovery_push.js
 * 一次性脚本：向 5/25-5/30 注册、0 活跃付费合约的 iOS 用户推送通知，
 * 促使其打开 App 触发 sync-ios-status 自动补录丢失订单。
 *
 * 用法（在容器内运行）:
 *   node /app/scripts/ios_recovery_push.js
 */

// 加载 .env（容器内直接有环境变量，此行仅本地调试用）
try { require('dotenv').config({ path: '/app/.env' }); } catch (_) {}

const pool = require('../src/config/database_native');
const { sendBatch } = require('../src/services/notificationService');

const NOTIFICATION_TYPE = 'IOS_SUBSCRIPTION_RECOVERY_20260530';

async function main() {
  console.log('🚀 [iOS恢复推送] 开始查询目标用户...');

  // 查找 5/25-5/30 注册、系统为 iOS、且当前没有活跃付费合约的用户中有 push token 的
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
         AND mc.is_cancelled = 0
         AND mc.contract_end_time > NOW()
      ) AS active_paid_contracts
    FROM user_information ui
    JOIN push_tokens pt ON pt.user_id = ui.user_id AND pt.platform = 'ios'
    WHERE ui.system = 'iOS'
      AND ui.user_creation_time >= '2026-05-25 00:00:00'
      AND ui.user_creation_time <  '2026-05-31 00:00:00'
    HAVING active_paid_contracts = 0
    ORDER BY ui.user_creation_time ASC
  `);

  console.log(`📋 [iOS恢复推送] 找到 ${rows.length} 名目标用户（5/25-5/30 注册、无活跃付费合约）`);

  if (rows.length === 0) {
    console.log('✅ 没有需要推送的用户，退出。');
    await pool.end();
    return;
  }

  // 打印前 5 条预览
  rows.slice(0, 5).forEach(r => {
    console.log(`  - ${r.user_id} (${r.email || 'no email'}) 注册于 ${r.reg_time}`);
  });
  if (rows.length > 5) console.log(`  ... 共 ${rows.length} 条`);

  const targets = rows.map(r => ({
    userId: r.user_id,
    fcmToken: r.fcm_token,
    platform: r.platform,
  }));

  const title = 'Mining Status Update 🔧';
  const body  = 'Your subscription has been synced. Open the app to check your active mining contract.';
  const data  = { action: 'sync_ios_status', screen: 'subscription' };

  console.log('\n📨 [iOS恢复推送] 开始发送推送通知...');
  const { sent, skipped } = await sendBatch(
    targets,
    NOTIFICATION_TYPE,
    null,           // referenceId
    title,
    body,
    data,
    72              // 72 小时去重（一次性脚本只推一次）
  );

  console.log(`\n✅ [iOS恢复推送] 完成: 成功发送 ${sent} 条，跳过（已发过）${skipped} 条，失败 ${targets.length - sent - skipped} 条`);
  await pool.end();
}

main().catch(err => {
  console.error('❌ [iOS恢复推送] 脚本出错:', err);
  process.exit(1);
});
