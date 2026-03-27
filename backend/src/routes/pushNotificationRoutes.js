'use strict';
/**
 * pushNotificationRoutes.js
 * 推送通知相关接口
 *
 * POST /api/notifications/register-token  — 注册/更新 FCM token
 * POST /api/notifications/active          — 上报活跃心跳（更新 last_active_at）
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database_native');

// ── POST /api/notifications/register-token ───────────────────
router.post('/register-token', async (req, res) => {
  const { user_id, fcm_token, platform, app_version } = req.body;

  if (!user_id || !fcm_token || !platform) {
    return res.status(400).json({ success: false, message: '缺少必要参数: user_id, fcm_token, platform' });
  }
  if (!['ios', 'android'].includes(platform)) {
    return res.status(400).json({ success: false, message: 'platform 必须为 ios 或 android' });
  }
  // fcm_token 长度限制（防注入）
  if (fcm_token.length > 300) {
    return res.status(400).json({ success: false, message: 'fcm_token 过长' });
  }

  try {
    await pool.query(
      `INSERT INTO push_tokens (user_id, fcm_token, platform, app_version, last_active_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         fcm_token      = VALUES(fcm_token),
         platform       = VALUES(platform),
         app_version    = VALUES(app_version),
         last_active_at = NOW()`,
      [user_id, fcm_token, platform, app_version || null]
    );

    res.json({ success: true, message: 'Token 注册成功' });
  } catch (err) {
    console.error('❌ [push] register-token 失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ── POST /api/notifications/active ───────────────────────────
// 每次 App 进入前台时调用，更新 last_active_at，用于沉默用户召回判断
router.post('/active', async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ success: false, message: '缺少 user_id' });
  }

  try {
    await pool.query(
      `UPDATE push_tokens SET last_active_at = NOW() WHERE user_id = ?`,
      [user_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('❌ [push] active update 失败:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

module.exports = router;
