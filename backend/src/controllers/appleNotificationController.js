'use strict';

/**
 * Apple App Store Server Notifications — 同时支持 V1 和 V2 格式
 * 文档: https://developer.apple.com/documentation/appstoreservernotifications
 *
 * V1 格式: { password, notification_type, unified_receipt, ... }
 * V2 格式: { signedPayload: "eyJ..." }  ← JWT，Payload 未加密，仅 base64url 编码
 *
 * Apple 发出的事件类型：
 *   DID_RENEW                  - 订阅成功续订
 *   CANCEL                     - 用户申请退款（苹果客服退款）
 *   EXPIRED                    - 订阅已完全过期
 *   DID_FAIL_TO_RENEW          - 扣款失败（宽限期内）
 *   DID_RECOVER                - 扣款失败后恢复
 *   INTERACTIVE_RENEWAL        - 用户在 App 内主动升档/续订
 *   DID_CHANGE_RENEWAL_PREF    - 用户变更下一期订阅档位
 *   DID_CHANGE_RENEWAL_STATUS  - 用户开启/关闭自动续期（关闭 = 主动取消订阅）
 *   REVOKE                     - 家庭共享订阅被撤销
 */

const axios = require('axios');
const { UserOrder } = require('../models');
const paidContractService = require('../services/paidContractService');

const SHARED_SECRET = process.env.APPLE_IAP_SHARED_SECRET || '';

// Store product ID → backend product ID
const PRODUCT_MAP = {
  'appstore04.99': 'p0499',
  'appstore06.99': 'p0699',
  'appstore09.99': 'p0999',
  'appstore19.99': 'p1999',
};

/**
 * 解析 Apple V2 JWT signedPayload（JWT 的 payload 部分为 base64url，未加密）
 * 返回 { notificationType, subtype, data: { signedTransactionInfo, signedRenewalInfo } }
 * 若解析失败返回 null
 */
function parseV2SignedPayload(signedPayload) {
  try {
    const parts = signedPayload.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload;
  } catch (e) {
    console.warn('⚠️ [AppleNotif] V2 signedPayload 解析失败:', e.message);
    return null;
  }
}

/**
 * 解析 V2 中的 signedTransactionInfo / signedRenewalInfo JWT
 */
function parseSignedInfo(signedInfo) {
  try {
    if (!signedInfo) return null;
    const parts = signedInfo.split('.');
    if (parts.length < 2) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * POST /api/payment/apple-notifications
 * Apple Server-to-Server Notification endpoint (no auth middleware)
 */
exports.handleNotification = async (req, res) => {
  // 先返回 200 告知 Apple 已收到（避免 Apple 重试）
  res.status(200).json({ received: true });

  try {
    // ── 判断是 V1 还是 V2 格式 ────────────────────────────
    let notification_type, original_transaction_id, product_id,
        expires_date_ms, auto_renew_status;

    if (req.body.signedPayload) {
      // ── Apple V2 格式 ──────────────────────────────────
      const v2 = parseV2SignedPayload(req.body.signedPayload);
      if (!v2) {
        console.warn('⚠️ [AppleNotif] V2 signedPayload 无法解析，忽略');
        return;
      }
      notification_type = v2.notificationType || v2.notification_type;
      const subtype = v2.subtype || '';
      const txInfo = parseSignedInfo(v2.data?.signedTransactionInfo);
      const renewalInfo = parseSignedInfo(v2.data?.signedRenewalInfo);

      original_transaction_id = txInfo?.originalTransactionId || txInfo?.original_transaction_id;
      product_id = txInfo?.productId || txInfo?.product_id;
      expires_date_ms = txInfo?.expiresDate ? String(txInfo.expiresDate) : null;
      auto_renew_status = renewalInfo?.autoRenewStatus ?? renewalInfo?.auto_renew_status;

      console.log(`📲 [AppleNotif V2] ${notification_type}/${subtype} | product=${product_id} | original_tx=${original_transaction_id} | auto_renew=${auto_renew_status}`);

      // DID_CHANGE_RENEWAL_STATUS + subtype=AUTO_RENEW_DISABLED → 用户关闭自动续期 = 取消
      if (notification_type === 'DID_CHANGE_RENEWAL_STATUS' && subtype === 'AUTO_RENEW_DISABLED') {
        await markContractCancelled(original_transaction_id);
        return;
      }
      // EXPIRED + 任何子类型 → 订阅完全过期
      if (notification_type === 'EXPIRED' || notification_type === 'REVOKE') {
        await markContractCancelled(original_transaction_id);
        return;
      }
      // 其他 V2 类型暂时记录后忽略
      console.log(`ℹ️ [AppleNotif V2] 忽略事件: ${notification_type}/${subtype}`);
      return;
    }

    // ── Apple V1 格式 ──────────────────────────────────────
    const { password, unified_receipt, latest_receipt_info } = req.body;
    notification_type = req.body.notification_type;

    // 校验 shared secret，防止伪造请求
    if (password !== SHARED_SECRET) {
      console.warn(`⚠️ [AppleNotif V1] shared secret 不匹配，忽略 (received=${(password || '').substring(0, 6)}...)`);
      return;
    }

    // 取最新收据信息（unified_receipt 是 V1 API 的标准字段）
    const receipts =
      (unified_receipt && unified_receipt.latest_receipt_info) ||
      latest_receipt_info ||
      [];

    if (!receipts || receipts.length === 0) {
      console.warn(`⚠️ [AppleNotif] ${notification_type}: 无收据信息`);
      return;
    }

    // 取 expires_date_ms 最大的那条（最新一期）
    const latest = receipts.reduce((best, r) => {
      return parseInt(r.expires_date_ms || '0') > parseInt(best?.expires_date_ms || '0') ? r : best;
    });

    // 赋值到外层已声明的变量（避免与 V2 路径的 let 声明冲突）
    original_transaction_id = latest.original_transaction_id;
    const transaction_id = latest.transaction_id;
    product_id = latest.product_id;
    expires_date_ms = latest.expires_date_ms;
    const cancellation_date_ms = latest.cancellation_date_ms;

    const backendProductId = PRODUCT_MAP[product_id];
    console.log(`📲 [AppleNotif] ${notification_type} | product=${product_id} | original_tx=${original_transaction_id}`);

    switch (notification_type) {
      case 'DID_RENEW':
      case 'INTERACTIVE_RENEWAL':
      case 'DID_RECOVER': {
        // 续订成功：更新合约到期时间，并补录交易记录
        const newExpiry = expires_date_ms ? new Date(parseInt(expires_date_ms)) : null;
        if (newExpiry) {
          // 通过 original_transaction_id 找到用户ID
          const order = await UserOrder.findOne({
            where: { payment_network_id: original_transaction_id },
          });
          if (order) {
            const { MiningContract } = require('../models');
            // 精准更新：只延期与该 original_transaction_id 对应的合约
            await MiningContract.update(
              { contract_end_time: newExpiry },
              { where: { user_id: order.user_id, original_transaction_id, contract_type: 'paid contract' } }
            );
            // 避免重复记录同一 transaction_id
            const already = await UserOrder.findOne({ where: { payment_gateway_id: transaction_id } });
            if (!already) {
              await UserOrder.create({
                user_id: order.user_id,
                email: order.email,
                product_id: backendProductId || order.product_id,
                product_name: order.product_name,
                product_price: order.product_price,
                hashrate: order.hashrate,
                order_creation_time: new Date(),
                payment_time: new Date(),
                currency_type: 'USD',
                payment_gateway_id: transaction_id,
                payment_network_id: original_transaction_id,
                order_status: 'renewing',
              });
            }
            console.log(`✅ [AppleNotif] 续订合约延期至 ${newExpiry.toISOString()}`);
          } else {
            console.warn(`⚠️ [AppleNotif] 找不到 original_tx=${original_transaction_id} 对应的订单`);
          }
        }
        break;
      }

      case 'DID_CHANGE_RENEWAL_STATUS': {
        // 用户关闭自动续期（= 主动取消订阅，当期服务继续到期为止）
        // V1 格式通过 pending_renewal_info 中 auto_renew_status 判断
        const pendingRenewal = req.body.unified_receipt?.pending_renewal_info || [];
        const pendingItem = pendingRenewal.find(p => p.original_transaction_id === original_transaction_id);
        const autoRenewStatus = pendingItem?.auto_renew_status;
        if (autoRenewStatus === '0' || autoRenewStatus === 0) {
          console.log(`📴 [AppleNotif V1] 用户关闭自动续期: original_tx=${original_transaction_id}`);
          await markContractCancelled(original_transaction_id);
        } else {
          console.log(`✅ [AppleNotif V1] 用户重新开启自动续期: original_tx=${original_transaction_id}`);
        }
        break;
      }

      case 'CANCEL':
      case 'EXPIRED': {
        // 取消（退款）/过期：立即标记合约为已取消
        await markContractCancelled(original_transaction_id);
        break;
      }

      case 'DID_FAIL_TO_RENEW': {
        // 扣款失败（Apple 会在宽限期内重试），暂不做任何操作
        console.log(`⚠️ [AppleNotif] 扣款失败 (DID_FAIL_TO_RENEW)，等待 Apple 重试`);
        break;
      }

      default:
        console.log(`ℹ️ [AppleNotif] 忽略事件: ${notification_type}`);
    }
  } catch (err) {
    console.error('❌ [AppleNotif] 处理通知异常:', err);
  }
};

/**
 * 辅助函数：通过 original_transaction_id 找到对应订单和合约，标记为已取消
 */
async function markContractCancelled(originalTransactionId) {
  if (!originalTransactionId) return;
  try {
    const { MiningContract } = require('../models');
    // 找所有匹配的合约（一个 original_transaction_id 对应一个合约）
    const [rows] = await MiningContract.update(
      { is_cancelled: 1 },
      {
        where: {
          original_transaction_id: originalTransactionId,
          contract_type: 'paid contract',
          is_cancelled: 0,
        },
      }
    );
    // 同步标记关联订单
    await UserOrder.update(
      { order_status: 'complete' },
      { where: { payment_network_id: originalTransactionId } }
    );
    console.log(`📴 [AppleNotif] 合约已标记取消: original_tx=${originalTransactionId} (rows=${rows})`);
  } catch (err) {
    console.error(`❌ [AppleNotif] markContractCancelled 异常: original_tx=${originalTransactionId}`, err.message);
  }
}

/**
 * POST /api/payment/cancel-subscription
 * 客户端主动取消通知端点 — 作为 Apple Server Notifications 的后备机制
 * 需要 JWT 鉴权，仅允许操作自己的合约
 * Body: { originalTransactionId }
 */
exports.cancelContractManually = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.user_id;
    const { originalTransactionId } = req.body;

    if (!userId || !originalTransactionId) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    const { MiningContract } = require('../models');
    // 安全性：只允许操作属于当前用户的合约
    const contract = await MiningContract.findOne({
      where: {
        user_id: userId,
        original_transaction_id: originalTransactionId,
        contract_type: 'paid contract',
        is_cancelled: 0,
      },
    });

    if (!contract) {
      // 可能已经取消，或不属于该用户
      return res.status(200).json({
        success: true,
        message: '合约不存在或已取消',
        alreadyCancelled: true,
      });
    }

    await contract.update({ is_cancelled: 1 });
    await UserOrder.update(
      { order_status: 'complete' },
      { where: { payment_network_id: originalTransactionId, user_id: userId } }
    );

    console.log(`📴 [cancelManual] 用户 ${userId} 主动取消合约: original_tx=${originalTransactionId}`);
    return res.status(200).json({ success: true, message: '合约已标记为取消' });
  } catch (err) {
    console.error('❌ [cancelManual] 异常:', err);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};
