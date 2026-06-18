'use strict';

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const appleNotificationController = require('../controllers/appleNotificationController');
const googlePlayRtdnController = require('../controllers/googlePlayRtdnController');
const authenticate = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');

// POST /api/payment/verify-purchase — 验证 IAP 收据并发放付费合约
// 必须携带有效 JWT（authenticate），防止未认证请求伪造订阅
// 安全性由 JWT 身份验证 + Google Play purchase_token / Apple receipt 双重保障
router.post('/verify-purchase', authenticate, paymentController.verifyPurchase);

// POST /api/payment/apple-notifications — Apple S2S 服务端通知（续期/取消/到期）
// 注意：此接口不需要 JWT 鉴权，Apple 通过 shared secret 验证
router.post('/apple-notifications', appleNotificationController.handleNotification);

// POST /api/payment/cancel-subscription — 客户端主动取消通知（Apple 通知的后备机制）
// 需要 JWT 鉴权，确保只能操作自己的合约
router.post('/cancel-subscription', authenticate, appleNotificationController.cancelContractManually);

// POST /api/payment/sync-ios-status — 客户端发送最新收据，后端同步订阅真实状态
// 在 App 恢复前台、合约页面加载时调用，防止 Apple 服务端通知丢失导致状态不同步
router.post('/sync-ios-status', authenticate, paymentController.syncIosStatus);

// POST /api/payment/google-play-rtdn — Google Play 实时开发者通知 (RTDN)
// Pub/Sub 推送入口，无需 JWT，通过 ?token= 查询参数验证身份
// 核心作用：App 未调用 verifyPurchase 时，服务端主动补录订单+合约
router.post('/google-play-rtdn', googlePlayRtdnController.handleNotification);

module.exports = router;
