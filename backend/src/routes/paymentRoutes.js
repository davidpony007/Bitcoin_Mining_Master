'use strict';

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const appleNotificationController = require('../controllers/appleNotificationController');

// POST /api/payment/verify-purchase — 验证 IAP 收据并发放付费合约
router.post('/verify-purchase', paymentController.verifyPurchase);

// POST /api/payment/apple-notifications — Apple S2S 服务端通知（续期/取消/到期）
// 注意：此接口不需要 JWT 鉴权，Apple 通过 shared secret 验证
router.post('/apple-notifications', appleNotificationController.handleNotification);

module.exports = router;
