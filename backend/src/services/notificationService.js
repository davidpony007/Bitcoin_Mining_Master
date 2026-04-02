'use strict';
/**
 * notificationService.js
 * FCM HTTP v1 API 封装 + 发送去重工具
 *
 * 依赖环境变量:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — Firebase 服务账号 JSON 字符串（或文件路径）
 *   FIREBASE_PROJECT_ID            — Firebase 项目 ID（可不传，从 JSON 中自动读取）
 *
 * 安装依赖: npm install google-auth-library
 */

let GoogleAuth;
try {
  ({ GoogleAuth } = require('google-auth-library'));
} catch (e) {
  console.warn('⚠️ [notificationService] google-auth-library 未安装，推送通知不可用:', e.message);
}
const https = require('https');
const pool = require('../config/database_native');

// ── 初始化 Google Auth ────────────────────────────────────────
let _auth = null;
let _projectId = null;

function _getAuth() {
  if (!GoogleAuth) {
    throw new Error('❌ google-auth-library 未安装，推送通知不可用');
  }
  if (_auth) return { auth: _auth, projectId: _projectId };

  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawJson) {
    throw new Error('❌ 环境变量 FIREBASE_SERVICE_ACCOUNT_JSON 未设置，无法发送推送通知');
  }

  let credentials;
  try {
    credentials = JSON.parse(rawJson);
  } catch {
    throw new Error('❌ FIREBASE_SERVICE_ACCOUNT_JSON 不是合法 JSON');
  }

  _projectId = process.env.FIREBASE_PROJECT_ID || credentials.project_id;
  _auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });

  return { auth: _auth, projectId: _projectId };
}

// ── FCM 发送核心 ──────────────────────────────────────────────
/**
 * 向单个设备发送 FCM 通知
 * @param {string} fcmToken   - 设备 FCM token
 * @param {string} title      - 通知标题
 * @param {string} body       - 通知正文
 * @param {object} [data]     - 自定义数据键值对（字符串值）
 * @returns {{ success: boolean, error?: string }}
 */
async function sendPushToDevice(fcmToken, title, body, data = {}) {
  try {
    const { auth, projectId } = _getAuth();
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;

    const payload = JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        data: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channel_id: 'mining_alerts',
          },
        },
      },
    });

    return await new Promise((resolve) => {
      const req = https.request(
        {
          hostname: 'fcm.googleapis.com',
          path: `/v1/projects/${projectId}/messages:send`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: `FCM status ${res.statusCode}: ${raw}` });
            }
          });
        }
      );
      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.write(payload);
      req.end();
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── 去重查询 ──────────────────────────────────────────────────
/**
 * 检查是否在近 withinHours 小时内已向该用户发过同类型通知
 * @param {string} userId
 * @param {string} notificationType
 * @param {string|null} referenceId   - 合约ID等，null 表示不限
 * @param {number} withinHours
 */
async function wasSentRecently(userId, notificationType, referenceId, withinHours) {
  const [rows] = await pool.query(
    `SELECT id FROM notification_log
     WHERE user_id = ?
       AND notification_type = ?
       AND (reference_id = ? OR (reference_id IS NULL AND ? IS NULL))
       AND sent_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     LIMIT 1`,
    [userId, notificationType, referenceId, referenceId, withinHours]
  );
  return rows.length > 0;
}

/**
 * 记录已发送的通知（防止重复）
 */
async function logNotification(userId, notificationType, referenceId = null) {
  await pool.query(
    `INSERT INTO notification_log (user_id, notification_type, reference_id) VALUES (?, ?, ?)`,
    [userId, notificationType, referenceId]
  );
}

/**
 * 批量发送推送 + 自动记录日志
 * @param {Array<{ userId, fcmToken, platform }>} targets
 * @param {string} notificationType
 * @param {string|null} referenceId
 * @param {string} title
 * @param {string} body
 * @param {object} data
 * @param {number} dedupeHours  - 多少小时内不重复发
 */
async function sendBatch(targets, notificationType, referenceId, title, body, data = {}, dedupeHours = 20) {
  let sent = 0;
  let skipped = 0;

  for (const { userId, fcmToken } of targets) {
    try {
      const alreadySent = await wasSentRecently(userId, notificationType, referenceId, dedupeHours);
      if (alreadySent) {
        skipped++;
        continue;
      }

      const result = await sendPushToDevice(fcmToken, title, body, data);
      if (result.success) {
        await logNotification(userId, notificationType, referenceId);
        sent++;
      } else {
        console.warn(`⚠️ [notification] FCM 发送失败 user=${userId}: ${result.error}`);
        // token 无效时清理（FCM 会返回 404 / UNREGISTERED）
        if (result.error && (result.error.includes('404') || result.error.includes('UNREGISTERED'))) {
          await pool.query('DELETE FROM push_tokens WHERE user_id = ?', [userId]);
        }
      }
    } catch (err) {
      console.error(`❌ [notification] 发送异常 user=${userId}:`, err.message);
    }
  }

  return { sent, skipped };
}

module.exports = { sendPushToDevice, wasSentRecently, logNotification, sendBatch };
