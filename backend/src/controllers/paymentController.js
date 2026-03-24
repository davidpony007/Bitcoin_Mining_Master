'use strict';

const axios = require('axios');
const { UserOrder, UserInformation } = require('../models');
const paidContractService = require('../services/paidContractService');
const PaidProductService = require('../services/paidProductService');

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

  console.log(`🛒 [paymentController] verifyPurchase 收到请求: user=${user_id} platform=${platform} product=${store_product_id} txId=${transaction_id}`);

  // ── 基础参数校验 ──────────────────────────────────────────
  if (!user_id || !platform || !store_product_id || !transaction_id) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: user_id, platform, store_product_id, transaction_id',
    });
  }

  // 确定 backend_product_id（优先使用客户端传来的，否则从 DB 产品表推导）
  const resolvedBackendProductId =
    backend_product_id || (await PaidProductService.resolveProductId(store_product_id));

  if (!resolvedBackendProductId) {
    return res.status(400).json({
      success: false,
      message: `未知的商品ID: ${store_product_id}`,
    });
  }

  // 提前加载产品元信息（供后续订单记录使用）
  const productInfo = await PaidProductService.getProductInfo(resolvedBackendProductId);

  if (!['android', 'ios'].includes(platform)) {
    return res.status(400).json({
      success: false,
      message: `不支持的平台: ${platform}`,
    });
  }

  try {
    // ── 防重复校验：检查 transaction_id 是否已处理 ──────────
    // iOS 自动续期订阅用 original_transaction_id（同一订阅生命周期内不变）
    // 存在则说明是"续订"，更新合约到期时间即可
    const lookupId = transaction_id;
    const existingOrder = await UserOrder.findOne({
      where: { payment_gateway_id: lookupId },
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

      // ── iOS 自动续期订阅：续订处理 ────────────────────────
      // original_transaction_id 在整个订阅生命周期内不变，用它识别续订
      const originalTxId = verifyResult.originalTransactionId;
      if (originalTxId && originalTxId !== transaction_id) {
        // 当前 transaction_id 是新交易，但 original_transaction_id 已存在 → 续订
        const renewalOrder = await UserOrder.findOne({
          where: { payment_network_id: originalTxId },
        });
        if (renewalOrder) {
          // 更新现有合约到期时间
          const newExpiry = verifyResult.expiresDateMs
            ? new Date(parseInt(verifyResult.expiresDateMs))
            : null;
          if (newExpiry) {
            const { MiningContract } = require('../models');
            await MiningContract.update(
              { contract_end_time: newExpiry },
              { where: { user_id: user_id, contract_type: 'paid contract' } }
            );
          }
          // 记录续订交易
          const renewUser = await UserInformation.findOne({ where: { user_id }, attributes: ['email'] });
          await UserOrder.create({
            user_id,
            email: renewUser?.email || '',
            product_id: resolvedBackendProductId,
            product_name: productInfo?.product_name || store_product_id,
            product_price: String(productInfo?.product_price || 0),
            hashrate: productInfo?.hashrate_raw || 0,
            order_creation_time: new Date(),
            payment_time: new Date(),
            currency_type: 'USD',
            payment_gateway_id: transaction_id,
            payment_network_id: originalTxId,
            order_status: 'renewing',
          });
          return res.status(200).json({
            success: true,
            message: '订阅续订成功，合约已延期',
            renewed: true,
            newExpiry,
          });
        }
      }

      // 新订阅：继续后续流程，携带 expiresDate 和 originalTxId
      req._iosSubscriptionMeta = {
        originalTransactionId: originalTxId || transaction_id,
        expiresDateMs: verifyResult.expiresDateMs,
      };
    }
    // Android：Google Play 服务端验证可选。
    // 生产环境建议调用 Google Play Developer API 验证 purchase_token，
    // 但需要服务账号授权，本期先做信任模式（purchase_token 存档备查）。
    // if (platform === 'android' && !purchase_token) { ... }

    // ── 创建付费合约 ─────────────────────────────────────────
    // iOS 自动续期：使用 Apple 收据中的到期时间
    const iosMeta = req._iosSubscriptionMeta;
    const expiresDate = iosMeta?.expiresDateMs
      ? new Date(parseInt(iosMeta.expiresDateMs))
      : null;

    // 查询用户邮箱（仅用于订单记录，设备登录用户可能无邮箱）
    const user = await UserInformation.findOne({
      where: { user_id },
      attributes: ['email'],
    });
    // 用户不在 DB 时不阻断购买（收据已通过 Apple 验证，必须创建合约）
    const userEmail = user?.email || '';
    if (!user) {
      console.warn(`⚠️ [paymentController] 用户 ${user_id} 不在 user_information 表，继续创建合约（邮箱置空）`);
    }

    const contract = await paidContractService.createPaidContract(
      user_id,
      resolvedBackendProductId,
      transaction_id,
      expiresDate
    );

    // ── 记录订单 ─────────────────────────────────────────────
    const originalTxId = iosMeta?.originalTransactionId || purchase_token || transaction_id;
    await UserOrder.create({
      user_id,
      email: userEmail,
      product_id: resolvedBackendProductId,
      product_name: productInfo?.product_name || store_product_id,
      product_price: String(productInfo?.product_price || 0),
      hashrate: productInfo?.hashrate_raw || 0,
      order_creation_time: new Date(),
      payment_time: new Date(),
      currency_type: 'USD',
      payment_gateway_id: transaction_id,
      payment_network_id: originalTxId,
      order_status: 'active',
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
  // 自动续期订阅：取最新一条（expires_date_ms 最大的那条）
  const latestReceipt = receipts.reduce((best, r) => {
    if (!best) return r;
    return parseInt(r.expires_date_ms || '0') > parseInt(best.expires_date_ms || '0') ? r : best;
  }, null);

  const match = receipts.find(
    (r) =>
      r.transaction_id === transactionId ||
      r.original_transaction_id === transactionId
  ) || latestReceipt;

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

  return {
    valid: true,
    originalTransactionId: match.original_transaction_id,
    expiresDateMs: match.expires_date_ms || null,
  };
}
