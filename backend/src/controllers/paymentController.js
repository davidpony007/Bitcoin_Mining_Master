'use strict';

const axios = require('axios');
const { UserOrder, UserInformation } = require('../models');
const paidContractService = require('../services/paidContractService');
const PaidProductService = require('../services/paidProductService');
const SubscriptionPointsService = require('../services/subscriptionPointsService');

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
        console.warn(`⚠️ [paymentController] iOS 收据验证失败: ${verifyResult.reason} | txId=${transaction_id}`);
        return res.status(400).json({
          success: false,
          message: `Apple 收据验证失败: ${verifyResult.reason}`,
        });
      }

      // ── iOS 自动续期订阅：续订处理 ────────────────────────
      // original_transaction_id 在整个订阅生命周期内不变，用它识别续订
      // ⚠️ 必须同时过滤 user_id，防止不同 App 用户使用同一 Apple 沙盒账号导致误匹配
      const originalTxId = verifyResult.originalTransactionId;
      if (originalTxId && originalTxId !== transaction_id) {
        // 当前 transaction_id 是新交易，但 original_transaction_id 已存在 → 续订
        const renewalOrder = await UserOrder.findOne({
          where: { payment_network_id: originalTxId, user_id: user_id },
        });
        if (renewalOrder) {
          console.log(`🔄 [paymentController] iOS 续订检测: user=${user_id} originalTxId=${originalTxId} newTxId=${transaction_id}`);
          // 更新现有合约到期时间
          // ✅ 用 original_transaction_id + user_id 精准定位，避免误改其他用户的合约
          const newExpiry = verifyResult.expiresDateMs
            ? new Date(parseInt(verifyResult.expiresDateMs))
            : null;
          if (newExpiry) {
            const { MiningContract } = require('../models');
            await MiningContract.update(
              { contract_end_time: newExpiry },
              { where: { original_transaction_id: originalTxId, user_id: user_id } }
            );
            console.log(`✅ [paymentController] 续订合约到期时间已更新: user=${user_id} newExpiry=${newExpiry}`);
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

    // ── 先写订单记录（payment_gateway_id 有 UNIQUE 约束）────
    // 利用 DB 唯一约束作为并发互斥锁：并发请求中只有第一个能成功 INSERT，
    // 其余请求触发 SequelizeUniqueConstraintError，直接返回"已处理"，
    // 从而确保每笔 transaction_id 只创建一条合约。
    const originalTxId = iosMeta?.originalTransactionId || purchase_token || transaction_id;
    let newOrder;
    try {
      newOrder = await UserOrder.create({
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
    } catch (dupErr) {
      if (dupErr.name === 'SequelizeUniqueConstraintError') {
        console.log(`⚠️ [paymentController] 并发重复请求被 UNIQUE 约束拦截: txId=${transaction_id}`);
        return res.status(200).json({
          success: true,
          message: '订单已处理（并发重复请求），合约已激活',
        });
      }
      throw dupErr; // 其他 DB 错误继续向上抛出
    }

    // 订单写入成功，继续创建合约
    const contract = await paidContractService.createPaidContract(
      user_id,
      resolvedBackendProductId,
      transaction_id,
      expiresDate,
      platform,                                      // ios / android
      iosMeta?.originalTransactionId || (platform === 'android' ? purchase_token : null)
    );

    // ── 订阅积分奖励（首次订阅该档位 +20 分，幂等，失败不阻断主流程）────
    const pointsResult = await SubscriptionPointsService.awardSubscriptionPoints(
      user_id,
      resolvedBackendProductId
    );

    return res.status(200).json({
      success: true,
      message: '购买验证成功，合约已激活',
      contractId: contract?.id,
      orderId: newOrder?.id,
      pointsAwarded: pointsResult.awarded ? pointsResult.pointsAwarded : 0,
      pointsReason: pointsResult.awarded ? '首次订阅积分奖励' : null,
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

  // 如果未配置 shared secret，记录警告（仍继续，Apple 对免费沙盒 App 可能不需要）
  if (!sharedSecret) {
    console.warn('⚠️ [IAP] APPLE_IAP_SHARED_SECRET 未配置，自动续期订阅验证可能失败（21004）');
  }

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
    console.error(`❌ [IAP] Apple 生产环境请求失败: ${e.message}`);
    return { valid: false, reason: `Apple 服务器请求失败: ${e.message}` };
  }

  let currentStatus = appleRes.data.status;
  console.log(`📡 [IAP] Apple 生产环境响应状态: ${currentStatus} | txId=${transactionId}`);

  // 21007 = 沙盒收据发到了生产环境，切换到沙盒
  if (currentStatus === 21007) {
    console.log(`🔄 [IAP] 沙盒收据，切换到沙盒环境验证 | txId=${transactionId}`);
    try {
      appleRes = await axios.post(
        'https://sandbox.itunes.apple.com/verifyReceipt',
        payload,
        { timeout: 10000 }
      );
      currentStatus = appleRes.data.status;
      console.log(`📡 [IAP] Apple 沙盒响应状态: ${currentStatus} | txId=${transactionId}`);
    } catch (e) {
      console.error(`❌ [IAP] Apple 沙盒请求失败: ${e.message}`);
      return { valid: false, reason: `Apple 沙盒请求失败: ${e.message}` };
    }
  }

  // 21004 = shared secret 不匹配（未配置时常见）
  // 在沙盒/开发环境下，如果 shared secret 未配置，降级为仅信任客户端 transaction_id
  if (currentStatus === 21004 && !sharedSecret) {
    console.warn(`⚠️ [IAP] Apple 返回 21004（shared secret 未配置），降级信任客户端数据: txId=${transactionId} productId=${productId}`);
    return {
      valid: true,
      originalTransactionId: transactionId,
      expiresDateMs: String(Date.now() + 30 * 24 * 3600 * 1000), // 默认30天
    };
  }

  const finalStatus = appleRes.data.status;
  if (finalStatus !== 0) {
    console.warn(`⚠️ [IAP] Apple 收据验证失败，状态码 ${finalStatus} | txId=${transactionId}`);
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
    console.warn(`⚠️ [IAP] 收据中未找到 txId=${transactionId}，receipts 共 ${receipts.length} 条`);
    return {
      valid: false,
      reason: `收据中未找到 transaction_id: ${transactionId}`,
    };
  }

  if (match.product_id !== productId) {
    console.warn(`⚠️ [IAP] 商品ID不匹配: 期望 ${productId}，实际 ${match.product_id} | txId=${transactionId}`);
    return {
      valid: false,
      reason: `商品ID不匹配: 期望 ${productId}，实际 ${match.product_id}`,
    };
  }

  console.log(`✅ [IAP] Apple 收据验证通过: txId=${transactionId} product=${productId} expires=${match.expires_date_ms}`);
  return {
    valid: true,
    originalTransactionId: match.original_transaction_id,
    expiresDateMs: match.expires_date_ms || null,
  };
}

/**
 * POST /api/payment/sync-ios-status
 * 客户端在打开合约页面 / App 恢复前台时，主动发送最新收据，
 * 后端重新验证并更新订阅状态（to prevent Apple notification delivery failures affecting display）
 * 需要 JWT 鉴权
 * Body: { verification_data }
 */
exports.syncIosStatus = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.user_id;
    const { verification_data } = req.body;

    if (!userId || !verification_data) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    const sharedSecret = process.env.APPLE_IAP_SHARED_SECRET || '';
    const payload = {
      'receipt-data': verification_data,
      password: sharedSecret,
      'exclude-old-transactions': false, // 需要完整历史来判断各产品状态
    };

    // 先尝试生产，21007 → 沙盒
    let appleUrl = 'https://buy.itunes.apple.com/verifyReceipt';
    let appleRes;
    try {
      appleRes = await axios.post(appleUrl, payload, { timeout: 15000 });
    } catch (e) {
      return res.status(500).json({ success: false, message: `Apple 请求失败: ${e.message}` });
    }

    if (appleRes.data.status === 21007) {
      try {
        appleRes = await axios.post('https://sandbox.itunes.apple.com/verifyReceipt', payload, { timeout: 15000 });
      } catch (e) {
        return res.status(500).json({ success: false, message: `Apple 沙盒请求失败: ${e.message}` });
      }
    }

    if (appleRes.data.status !== 0) {
      return res.status(400).json({ success: false, message: `Apple 验证失败: status=${appleRes.data.status}` });
    }

    const pendingRenewalInfo = appleRes.data.pending_renewal_info || [];
    const latestReceiptInfo = appleRes.data.latest_receipt_info || [];

    const { MiningContract } = require('../models');
    let cancelledCount = 0;
    let updatedExpiry = 0;

    for (const renewalItem of pendingRenewalInfo) {
      const origTxId = renewalItem.original_transaction_id;
      const autoRenewStatus = renewalItem.auto_renew_status; // '0' = 已关闭自动续期

      // 找对应的最新收据信息更新 contract_end_time
      const latestEntry = latestReceiptInfo
        .filter(r => r.original_transaction_id === origTxId)
        .sort((a, b) => parseInt(b.expires_date_ms || '0') - parseInt(a.expires_date_ms || '0'))[0];

      const contracts = await MiningContract.findAll({
        where: { user_id: userId, original_transaction_id: origTxId, contract_type: 'paid contract' },
      });

      for (const contract of contracts) {
        // 更新 contract_end_time 为 Apple 实际到期时间
        if (latestEntry?.expires_date_ms) {
          const appleExpiry = new Date(parseInt(latestEntry.expires_date_ms));
          if (contract.contract_end_time?.getTime() !== appleExpiry.getTime()) {
            await contract.update({ contract_end_time: appleExpiry });
            updatedExpiry++;
            console.log(`🔄 [syncIos] 更新合约到期时间: user=${userId} origTx=${origTxId} newExpiry=${appleExpiry.toISOString()}`);
          }
        }

        // 如果自动续期已关闭，标记取消
        if ((autoRenewStatus === '0' || autoRenewStatus === 0) && contract.is_cancelled === 0) {
          await contract.update({ is_cancelled: 1 });
          cancelledCount++;
          console.log(`📴 [syncIos] 标记合约取消（自动续期已关闭）: user=${userId} origTx=${origTxId}`);
        }
      }
    }

    console.log(`✅ [syncIos] 同步完成: user=${userId} cancelled=${cancelledCount} expiry_updated=${updatedExpiry}`);
    return res.status(200).json({
      success: true,
      cancelledCount,
      updatedExpiry,
      message: `同步完成 (${cancelledCount} 个合约已标记取消)`,
    });
  } catch (err) {
    console.error('❌ [syncIos] 异常:', err);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};
