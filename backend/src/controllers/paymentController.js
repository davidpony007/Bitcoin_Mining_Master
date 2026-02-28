'use strict';

const axios = require('axios');
const { UserOrder } = require('../models');
const paidContractService = require('../services/paidContractService');

// Store product ID → backend product ID 映射
// key = Google Play Console / App Store 中的商品ID
// value = 内部合约商品ID
const PRODUCT_MAP = {
  // Google Play Console 当前商品ID（p04.99 格式）
  'p04.99': 'p0499',
  'p06.99': 'p0699',
  'p09.99': 'p0999',
  'p19.99': 'p1999',
  // 兼容旧命名（如后续迁移）
  mining_starter_monthly: 'p0499',
  mining_standard_monthly: 'p0699',
  mining_advanced_monthly: 'p0999',
  mining_premium_monthly: 'p1999',
};

// 商品信息（用于记录订单）
const PRODUCT_INFO = {
  p0499: { name: 'Mining Starter Monthly', price: 4.99 },
  p0699: { name: 'Mining Standard Monthly', price: 6.99 },
  p0999: { name: 'Mining Advanced Monthly', price: 9.99 },
  p1999: { name: 'Mining Premium Monthly', price: 19.99 },
};

/**
 * POST /api/payment/verify-purchase
 * Body: {
 *   user_id, platform ('android'|'ios'),
 *   store_product_id, backend_product_id,
 *   transaction_id,
 *   verification_data (iOS base64 receipt),
 *   purchase_token (Android only)
 * }
 */
exports.verifyPurchase = async (req, res) => {
  const {
    user_id,
    platform,
    store_product_id,
    backend_product_id,
    transaction_id,
    verification_data,
    purchase_token,
  } = req.body;

  // ── 基础参数校验 ──────────────────────────────────────────
  if (!user_id || !platform || !store_product_id || !transaction_id) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: user_id, platform, store_product_id, transaction_id',
    });
  }

  // 确定 backend_product_id（优先使用客户端传来的，否则自动推导）
  const resolvedBackendProductId =
    backend_product_id || PRODUCT_MAP[store_product_id];

  if (!resolvedBackendProductId) {
    return res.status(400).json({
      success: false,
      message: `未知的商品ID: ${store_product_id}`,
    });
  }

  if (!['android', 'ios'].includes(platform)) {
    return res.status(400).json({
      success: false,
      message: `不支持的平台: ${platform}`,
    });
  }

  try {
    // ── 防重复校验：检查 transaction_id 是否已处理 ──────────
    const existingOrder = await UserOrder.findOne({
      where: { payment_gateway_id: transaction_id },
    });
    if (existingOrder) {
      return res.status(200).json({
        success: true,
        message: '订单已处理（重复请求），合约已激活',
        orderId: existingOrder.id,
      });
    }

    // ── 平台收据验证 ─────────────────────────────────────────
    if (platform === 'ios') {
      if (!verification_data) {
        return res.status(400).json({
          success: false,
          message: 'iOS 平台缺少 verification_data (收据)',
        });
      }
      const verifyResult = await verifyAppleReceipt(
        verification_data,
        transaction_id,
        store_product_id
      );
      if (!verifyResult.valid) {
        return res.status(400).json({
          success: false,
          message: `Apple 收据验证失败: ${verifyResult.reason}`,
        });
      }
    }
    // Android：Google Play 服务端验证可选。
    // 生产环境建议调用 Google Play Developer API 验证 purchase_token，
    // 但需要服务账号授权，本期先做信任模式（purchase_token 存档备查）。
    // if (platform === 'android' && !purchase_token) { ... }

    // ── 创建付费合约 ─────────────────────────────────────────
    const productMeta = PRODUCT_INFO[resolvedBackendProductId] || {};

    const contract = await paidContractService.createPaidContract(
      user_id,
      resolvedBackendProductId,
      transaction_id
    );

    // ── 记录订单 ─────────────────────────────────────────────
    await UserOrder.create({
      user_id,
      product_id: resolvedBackendProductId,
      product_name: productMeta.name || store_product_id,
      product_price: productMeta.price || 0,
      payment_time: new Date(),
      currency_type: 'USD',
      payment_gateway_id: transaction_id,
      payment_network_id: purchase_token || null,
      order_status: 'completed',
    });

    return res.status(200).json({
      success: true,
      message: '购买验证成功，合约已激活',
      contractId: contract?.id,
    });
  } catch (err) {
    console.error('❌ [paymentController] verifyPurchase 异常:', err);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误，请联系客服',
    });
  }
};

// ── Apple 收据验证辅助函数 ────────────────────────────────────

/**
 * 向 Apple 服务器验证 IAP 收据
 * @param {string} receiptData  base64 编码的收据
 * @param {string} transactionId 期望匹配的交易ID
 * @param {string} productId    期望匹配的商品ID
 * @returns {{ valid: boolean, reason?: string }}
 */
async function verifyAppleReceipt(receiptData, transactionId, productId) {
  const sharedSecret = process.env.APPLE_IAP_SHARED_SECRET || '';

  const payload = {
    'receipt-data': receiptData,
    password: sharedSecret,
    'exclude-old-transactions': true,
  };

  // 先尝试生产环境，21007 → 切换到沙盒
  let appleUrl = 'https://buy.itunes.apple.com/verifyReceipt';
  let appleRes;

  try {
    appleRes = await axios.post(appleUrl, payload, { timeout: 10000 });
  } catch (e) {
    return { valid: false, reason: `Apple 服务器请求失败: ${e.message}` };
  }

  const { status, latest_receipt_info } = appleRes.data;

  // 21007 = 沙盒收据发到了生产环境，切换到沙盒
  if (status === 21007) {
    try {
      appleRes = await axios.post(
        'https://sandbox.itunes.apple.com/verifyReceipt',
        payload,
        { timeout: 10000 }
      );
    } catch (e) {
      return { valid: false, reason: `Apple 沙盒请求失败: ${e.message}` };
    }
  }

  const finalStatus = appleRes.data.status;
  if (finalStatus !== 0) {
    return { valid: false, reason: `Apple 状态码: ${finalStatus}` };
  }

  // 检查收据中是否存在对应的交易
  const receipts = appleRes.data.latest_receipt_info || [];
  const match = receipts.find(
    (r) =>
      r.transaction_id === transactionId ||
      r.original_transaction_id === transactionId
  );

  if (!match) {
    return {
      valid: false,
      reason: `收据中未找到 transaction_id: ${transactionId}`,
    };
  }

  if (match.product_id !== productId) {
    return {
      valid: false,
      reason: `商品ID不匹配: 期望 ${productId}，实际 ${match.product_id}`,
    };
  }

  return { valid: true };
}
