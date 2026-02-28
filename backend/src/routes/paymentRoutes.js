'use strict';

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// POST /api/payment/verify-purchase — 验证 IAP 收据并发放付费合约
router.post('/verify-purchase', paymentController.verifyPurchase);

module.exports = router;
