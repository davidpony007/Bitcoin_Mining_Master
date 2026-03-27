'use strict';
/**
 * notificationCronJob.js
 * 推送通知定时任务 — 4 个场景
 *
 * 场景 1: 免费合约即将到期（剩余 2 小时）    — 每 30 分钟扫描
 * 场景 2: 每日签到提醒（当日未签到）         — 每天 UTC 02:00
 * 场景 3: 付费订阅即将到期（3天 / 1天 前）   — 每天 UTC 10:00
 * 场景 4: 沉默用户召回（3天未开 App，仅发一次）— 每天 UTC 09:00
 */

const cron = require('node-cron');
const pool = require('../config/database_native');
const { sendBatch } = require('../services/notificationService');

// ── 通知类型常量 ──────────────────────────────────────────────
const NOTIF_TYPE = {
  FREE_CONTRACT_EXPIRY:     'FREE_CONTRACT_EXPIRY',
  DAILY_CHECKIN:            'DAILY_CHECKIN',
  PAID_CONTRACT_EXPIRY_3D:  'PAID_CONTRACT_EXPIRY_3D',
  PAID_CONTRACT_EXPIRY_1D:  'PAID_CONTRACT_EXPIRY_1D',
  SILENT_USER_RECALL:       'SILENT_USER_RECALL',
};

// ── 场景 1: 免费合约到期提醒 ──────────────────────────────────
/**
 * 找出所有 Free Ad Reward 合约在 1.5h～2.5h 内到期的用户，
 * 且该合约在 20h 内未发过提醒，向其推送通知。
 */
async function checkFreeContractExpiry() {
  try {
    const [rows] = await pool.query(
      `SELECT mc.id AS contract_id, mc.user_id, pt.fcm_token, pt.platform
       FROM mining_contracts mc
       INNER JOIN push_tokens pt ON pt.user_id = mc.user_id
       WHERE mc.contract_type = 'Free Ad Reward'
         AND mc.is_cancelled = 0
         AND mc.contract_end_time BETWEEN DATE_ADD(NOW(), INTERVAL 90 MINUTE)
                                      AND DATE_ADD(NOW(), INTERVAL 150 MINUTE)`
    );

    if (rows.length === 0) return;

    const targets = rows.map((r) => ({
      userId:   r.user_id,
      fcmToken: r.fcm_token,
      platform: r.platform,
      contractId: String(r.contract_id),
    }));

    // 为每条合约单独去重（同一合约不在 20h 内发第二次）
    for (const t of targets) {
      const { sent, skipped } = await sendBatch(
        [t],
        NOTIF_TYPE.FREE_CONTRACT_EXPIRY,
        t.contractId,
        '⏰ Mining Contract Expiring Soon',
        'Your free mining contract expires in 2 hours. Watch an ad to keep earning BTC →',
        { screen: 'dashboard', action: 'watch_ad' },
        20
      );
      if (sent > 0) console.log(`📤 [notif] FREE_CONTRACT_EXPIRY sent user=${t.userId} contract=${t.contractId}`);
      if (skipped > 0) console.log(`⏭️ [notif] FREE_CONTRACT_EXPIRY skipped(already sent) user=${t.userId}`);
    }
  } catch (err) {
    console.error('❌ [notif] checkFreeContractExpiry failed:', err.message);
  }
}

// ── 场景 2: 每日签到提醒 ──────────────────────────────────────
/**
 * 在 UTC 02:00 执行：找出所有今天（UTC）尚未签到、
 * 有 push_token、且 7 天内活跃的用户，推送每日签到提醒。
 * 当天内不重复发（dedupeHours=22）。
 */
async function sendCheckInReminders() {
  try {
    // 用 user_check_in 表（记录签到日期）排除已签到用户
    const [rows] = await pool.query(
      `SELECT pt.user_id, pt.fcm_token, pt.platform
       FROM push_tokens pt
       WHERE pt.last_active_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND pt.user_id NOT IN (
           SELECT user_id
           FROM user_check_in
           WHERE check_in_date = CURDATE()
         )`
    );

    if (rows.length === 0) {
      console.log('ℹ️ [notif] DAILY_CHECKIN: 所有活跃用户今日已签到，无需推送');
      return;
    }

    const targets = rows.map((r) => ({
      userId:   r.user_id,
      fcmToken: r.fcm_token,
      platform: r.platform,
    }));

    const { sent, skipped } = await sendBatch(
      targets,
      NOTIF_TYPE.DAILY_CHECKIN,
      null,
      '🔥 Daily Check-in Ready!',
      'Tap to claim your daily +4 points and a new mining contract.',
      { screen: 'checkin' },
      22
    );
    console.log(`📤 [notif] DAILY_CHECKIN sent=${sent} skipped=${skipped}`);
  } catch (err) {
    console.error('❌ [notif] sendCheckInReminders failed:', err.message);
  }
}

// ── 场景 3: 付费订阅到期提醒 ──────────────────────────────────
/**
 * 在 UTC 10:00 执行：
 *   - 3 天前通知：contract_end_time 在 2.5d～3.5d 内
 *   - 1 天前通知：contract_end_time 在 0.5d～1.5d 内
 */
async function sendPaidContractExpiryReminders() {
  try {
    // 3 天通知
    const [rows3d] = await pool.query(
      `SELECT mc.id AS contract_id, mc.user_id, mc.product_id,
              pt.fcm_token, pt.platform
       FROM mining_contracts mc
       INNER JOIN push_tokens pt ON pt.user_id = mc.user_id
       WHERE mc.contract_type = 'paid contract'
         AND mc.is_cancelled = 0
         AND mc.contract_end_time BETWEEN DATE_ADD(NOW(), INTERVAL 60 HOUR)
                                      AND DATE_ADD(NOW(), INTERVAL 84 HOUR)`
    );

    for (const r of rows3d) {
      const { sent } = await sendBatch(
        [{ userId: r.user_id, fcmToken: r.fcm_token, platform: r.platform }],
        NOTIF_TYPE.PAID_CONTRACT_EXPIRY_3D,
        String(r.contract_id),
        '📅 Subscription Expiring in 3 Days',
        'Your mining plan expires soon. Renew now to keep your hashrate active.',
        { screen: 'contracts', action: 'renew', product_id: r.product_id || '' },
        48
      );
      if (sent > 0) console.log(`📤 [notif] PAID_EXPIRY_3D user=${r.user_id} contract=${r.contract_id}`);
    }

    // 1 天通知
    const [rows1d] = await pool.query(
      `SELECT mc.id AS contract_id, mc.user_id, mc.product_id,
              pt.fcm_token, pt.platform
       FROM mining_contracts mc
       INNER JOIN push_tokens pt ON pt.user_id = mc.user_id
       WHERE mc.contract_type = 'paid contract'
         AND mc.is_cancelled = 0
         AND mc.contract_end_time BETWEEN DATE_ADD(NOW(), INTERVAL 12 HOUR)
                                      AND DATE_ADD(NOW(), INTERVAL 36 HOUR)`
    );

    for (const r of rows1d) {
      const { sent } = await sendBatch(
        [{ userId: r.user_id, fcmToken: r.fcm_token, platform: r.platform }],
        NOTIF_TYPE.PAID_CONTRACT_EXPIRY_1D,
        String(r.contract_id),
        '⚠️ Subscription Expiring Tomorrow',
        'Last chance! Your mining plan expires in less than 24 hours. Tap to renew.',
        { screen: 'contracts', action: 'renew', product_id: r.product_id || '' },
        20
      );
      if (sent > 0) console.log(`📤 [notif] PAID_EXPIRY_1D user=${r.user_id} contract=${r.contract_id}`);
    }
  } catch (err) {
    console.error('❌ [notif] sendPaidContractExpiryReminders failed:', err.message);
  }
}

// ── 场景 4: 沉默用户召回 ──────────────────────────────────────
/**
 * 在 UTC 09:00 执行：
 * 找出 last_active_at > 3 天 的用户，且 30 天内未发过召回通知，
 * 各发一次唤醒通知（每 30 天最多一次）。
 */
async function sendSilentUserRecalls() {
  try {
    const [rows] = await pool.query(
      `SELECT pt.user_id, pt.fcm_token, pt.platform
       FROM push_tokens pt
       WHERE pt.last_active_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
         AND pt.user_id NOT IN (
           SELECT DISTINCT user_id
           FROM notification_log
           WHERE notification_type = ?
             AND sent_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         )`,
      [NOTIF_TYPE.SILENT_USER_RECALL]
    );

    if (rows.length === 0) {
      console.log('ℹ️ [notif] SILENT_USER_RECALL: 无符合条件的沉默用户');
      return;
    }

    const targets = rows.map((r) => ({
      userId:   r.user_id,
      fcmToken: r.fcm_token,
      platform: r.platform,
    }));

    const { sent, skipped } = await sendBatch(
      targets,
      NOTIF_TYPE.SILENT_USER_RECALL,
      null,
      '₿ You Have Uncollected BTC Rewards',
      'Your mining contracts have been earning while you were away. Open to check your balance.',
      { screen: 'dashboard' },
      // dedupeHours = 720 (30天)，和 SQL 查询条件一致
      720
    );
    console.log(`📤 [notif] SILENT_USER_RECALL sent=${sent} skipped=${skipped}`);
  } catch (err) {
    console.error('❌ [notif] sendSilentUserRecalls failed:', err.message);
  }
}

// ── 启动所有通知定时任务 ──────────────────────────────────────
function startNotificationCronJobs() {
  // 场景 1: 每 30 分钟检查免费合约到期
  cron.schedule('*/30 * * * *', async () => {
    await checkFreeContractExpiry();
  });
  console.log('✓ [notif] 免费合约到期提醒任务已启动（每30分钟）');

  // 场景 2: 每天 UTC 02:00 推送签到提醒
  cron.schedule('0 2 * * *', async () => {
    console.log('[notif] 执行每日签到提醒...');
    await sendCheckInReminders();
  });
  console.log('✓ [notif] 每日签到提醒任务已启动（UTC 02:00）');

  // 场景 3: 每天 UTC 10:00 推送付费合约到期提醒
  cron.schedule('0 10 * * *', async () => {
    console.log('[notif] 执行付费合约到期提醒...');
    await sendPaidContractExpiryReminders();
  });
  console.log('✓ [notif] 付费合约到期提醒任务已启动（UTC 10:00）');

  // 场景 4: 每天 UTC 09:00 推送沉默用户召回
  cron.schedule('0 9 * * *', async () => {
    console.log('[notif] 执行沉默用户召回...');
    await sendSilentUserRecalls();
  });
  console.log('✓ [notif] 沉默用户召回任务已启动（UTC 09:00）');
}

module.exports = {
  startNotificationCronJobs,
  // 暴露单个函数便于手动触发测试
  checkFreeContractExpiry,
  sendCheckInReminders,
  sendPaidContractExpiryReminders,
  sendSilentUserRecalls,
};
