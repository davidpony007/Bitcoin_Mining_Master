'use strict';
/**
 * 一次性脚本：推送"请更新到 1.0.3"到所有 iOS 用户
 * 运行方式：node /app/scripts/send_update_push.js
 */

const pool = require('../src/config/database_native');
const { sendBatch } = require('../src/services/notificationService');

async function main() {
  try {
    console.log('[UpdatePush] 查询 iOS push_tokens...');
    const [rows] = await pool.query(
      `SELECT user_id AS userId, fcm_token AS fcmToken, platform
       FROM push_tokens
       WHERE platform = 'ios'
         AND fcm_token IS NOT NULL
         AND fcm_token != ''`
    );

    console.log(`[UpdatePush] 找到 ${rows.length} 个 iOS token`);

    if (rows.length === 0) {
      console.log('[UpdatePush] 没有可发送的 token，退出');
      process.exit(0);
    }

    const title = 'Update Available';
    const body = 'Bitcoin Mining Master 1.0.3 is now available with important bug fixes. Tap to update on the App Store.';
    const data = { type: 'app_update', version: '1.0.3' };

    console.log(`[UpdatePush] 开始发送推送...`);
    const result = await sendBatch(
      rows,
      'app_update_1.0.3',
      '1.0.3',
      title,
      body,
      data,
      72  // 72小时内不重复发
    );

    console.log(`[UpdatePush] 完成 ✅ 发送成功: ${result.sent}, 跳过(已发): ${result.skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('[UpdatePush] 脚本异常:', err);
    process.exit(1);
  }
}

main();
