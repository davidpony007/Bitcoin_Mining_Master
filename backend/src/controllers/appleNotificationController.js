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

const crypto = require('crypto');
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

// Apple Root CA - G3 证书 SHA-256 指纹（固定根证书，防止伪造证书链）
// 来源: https://www.apple.com/certificateauthority/
const APPLE_ROOT_CA_G3_FP = '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';

/**
 * 将 JWS ES256 原始签名（r||s 各 32 字节，共 64 字节）转换为 ASN.1 DER 格式
 * Node.js crypto.verify 需要 DER 编码的 ECDSA 签名
 */
function rawEcSigToDer(raw) {
  if (raw.length !== 64) return raw;
  const encInt = (b) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    const t = b.slice(i);
    return (t[0] & 0x80) ? Buffer.concat([Buffer.from([0x00]), t]) : t;
  };
  const r = encInt(raw.slice(0, 32));
  const s = encInt(raw.slice(32));
  return Buffer.concat([
    Buffer.from([0x30, 2 + r.length + 2 + s.length]),
    Buffer.from([0x02, r.length]), r,
    Buffer.from([0x02, s.length]), s,
  ]);
}

/**
 * 验证 Apple V2 JWS 签名并返回 payload
 * 利用 JWT 头部 x5c 内嵌证书链完成验证，无需 Apple API 密钥
 * 验证流程：
 *   1. 用叶子证书公钥验证 JWT 签名（ES256）
 *   2. 验证证书链（每张证书由上级签名）
 *   3. 固定根证书指纹为 Apple Root CA - G3
 * @param {string} jws - Apple JWS 字符串
 * @returns {{ valid: boolean, payload: object|null, error?: string }}
 */
function verifyAndParseV2JWS(jws) {
  try {
    const parts = jws.split('.');
    if (parts.length !== 3) return { valid: false, payload: null, error: 'Not a 3-part JWS' };

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const x5c = header.x5c;
    if (!Array.isArray(x5c) || x5c.length < 2) {
      return { valid: false, payload: null, error: 'x5c chain missing or too short' };
    }

    // base64-DER → PEM
    const certs = x5c.map(b64 => {
      const lines = b64.match(/.{1,64}/g) || [];
      return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
    });

    // 验证 JWT 签名（ES256 = ECDSA-P256-SHA256）
    const message = `${parts[0]}.${parts[1]}`;
    const derSig = rawEcSigToDer(Buffer.from(parts[2], 'base64url'));
    const leafCert = new crypto.X509Certificate(certs[0]);
    const v = crypto.createVerify('SHA256');
    v.update(message);
    if (!v.verify(leafCert.publicKey, derSig)) {
      return { valid: false, payload: null, error: 'JWS signature invalid' };
    }

    // 验证证书链
    for (let i = 0; i < certs.length - 1; i++) {
      const child = new crypto.X509Certificate(certs[i]);
      const parent = new crypto.X509Certificate(certs[i + 1]);
      if (!child.verify(parent.publicKey)) {
        return { valid: false, payload: null, error: `Chain broken at index ${i}` };
      }
    }

    // 固定根证书（Apple Root CA - G3）
    const rootFp = new crypto.X509Certificate(certs[certs.length - 1])
      .fingerprint256.replace(/:/g, '').toLowerCase();
    if (rootFp !== APPLE_ROOT_CA_G3_FP) {
      return { valid: false, payload: null, error: `Root CA fingerprint mismatch: ${rootFp}` };
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, payload: null, error: e.message };
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
      // 验证 JWS 签名（x5c 证书链 + 固定根证书 Apple Root CA G3）
      const { valid: jwsValid, payload: v2, error: jwsError } = verifyAndParseV2JWS(req.body.signedPayload);
      if (!jwsValid || !v2) {
        console.warn(`⚠️ [AppleNotif V2] JWS 验证失败，拒绝请求: ${jwsError}`);
        return;
      }

      // ── V2 安全校验 ──────────────────────────────────────
      // 1. bundleId 校验：防止伪造请求或其他 App 通知误触发
      const expectedBundleId = process.env.APPLE_BUNDLE_ID;
      const receivedBundleId = v2.data?.bundleId || v2.bundleId;
      if (expectedBundleId && receivedBundleId && receivedBundleId !== expectedBundleId) {
        console.warn(`⚠️ [AppleNotif V2] bundleId 不匹配，拒绝: received=${receivedBundleId} expected=${expectedBundleId}`);
        return;
      }
      // 2. 时间戳防重放：signedDate 超过 1 小时的通知直接丢弃
      const signedDate = v2.signedDate;
      if (signedDate && Math.abs(Date.now() - signedDate) > 3600 * 1000) {
        console.warn(`⚠️ [AppleNotif V2] signedDate 超过 1 小时，忽略（可能重放攻击）: ${new Date(signedDate).toISOString()}`);
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

      // DID_RENEW → 续订成功，更新合约到期时间
      if (notification_type === 'DID_RENEW' || notification_type === 'DID_RECOVER' || notification_type === 'INTERACTIVE_RENEWAL') {
        let newExpiry = txInfo?.expiresDate ? new Date(txInfo.expiresDate) : null;
        if (newExpiry && original_transaction_id) {
          // 沙盒续订周期为 5 分钟，Apple 给出的 expiresDate = now+5min
          // 与首次购买保持一致：若到期时间 < now+1小时，回退到自然月计算，避免覆盖为 5 分钟
          const ONE_HOUR_MS = 3600 * 1000;
          if (newExpiry.getTime() <= Date.now() + ONE_HOUR_MS) {
            const fallback = new Date();
            fallback.setMonth(fallback.getMonth() + 1);
            console.warn(`⚠️ [AppleNotif V2] 续订到期时间不可靠(${newExpiry.toISOString()})，回退自然月: ${fallback.toISOString()}`);
            newExpiry = fallback;
          }
          const order = await UserOrder.findOne({ where: { payment_network_id: original_transaction_id } });
          if (order) {
            const { MiningContract } = require('../models');
            await MiningContract.update(
              { contract_end_time: newExpiry, is_cancelled: 0 },
              { where: { user_id: order.user_id, original_transaction_id, contract_type: 'paid contract' } }
            );
            // 补录续订订单（避免重复：同一 transaction_id 只记录一次）
            const newTxId = txInfo?.transactionId || txInfo?.transaction_id;
            if (newTxId) {
              const already = await UserOrder.findOne({ where: { payment_gateway_id: newTxId } });
              if (!already) {
                await UserOrder.create({
                  user_id: order.user_id,
                  email: order.email,
                  apple_account: order.apple_account || null,
                  product_id: PRODUCT_MAP[product_id] || order.product_id,
                  product_name: order.product_name,
                  product_price: order.product_price,
                  hashrate: order.hashrate,
                  order_creation_time: new Date(),
                  payment_time: new Date(),
                  currency_type: 'USD',
                  payment_gateway_id: newTxId,
                  payment_network_id: original_transaction_id,
                  order_status: 'renewing',
                });
              }
            }
            console.log(`✅ [AppleNotif V2] 续订延期: origTx=${original_transaction_id} newExpiry=${newExpiry.toISOString()}`);
          }
        }
        return;
      }

      // DID_CHANGE_RENEWAL_STATUS + AUTO_RENEW_DISABLED → 区分明确取消 vs 档位切换
      // autoRenewProductId 缺失 = 明确取消（立即停止挖矿）
      // autoRenewProductId 存在 = 升/降档切换，当期继续有效
      if (notification_type === 'DID_CHANGE_RENEWAL_STATUS' && subtype === 'AUTO_RENEW_DISABLED') {
        const autoRenewProductId = renewalInfo?.autoRenewProductId;
        if (!autoRenewProductId) {
          // ⚠️ 用户关闭了自动续期，但当期合约继续有效直到 contract_end_time。
          // markContractCancelled 内置 10 分钟时间窗口保护，若合约仍在有效期内，此处不会实际取消。
          console.log(`ℹ️ [AppleNotif V2] 用户关闭自动续期，当期继续有效（到期后正式停止）: original_tx=${original_transaction_id}`);
          await markContractCancelled(original_transaction_id);
        } else {
          console.log(`ℹ️ [AppleNotif V2] 档位切换（非明确取消），当期继续有效: original_tx=${original_transaction_id} nextPlan=${autoRenewProductId}`);
        }
        return;
      }
      // AUTO_RENEW_ENABLED → 用户重新开启自动续费（取消后反悔），恢复合约活跃状态
      if (notification_type === 'DID_CHANGE_RENEWAL_STATUS' && subtype === 'AUTO_RENEW_ENABLED') {
        const { MiningContract } = require('../models');
        await MiningContract.update(
          { is_cancelled: 0 },
          { where: { original_transaction_id, contract_type: 'paid contract' } }
        );
        console.log(`✅ [AppleNotif V2] 用户恢复自动续费，合约重新激活: original_tx=${original_transaction_id}`);
        return;
      }
      // SUBSCRIBED/RESUBSCRIBE → 用户重新订阅（到期后全新购买同一产品），恢复合约活跃状态并更新到期时间
      if (notification_type === 'SUBSCRIBED' && subtype === 'RESUBSCRIBE') {
        const { MiningContract } = require('../models');
        const order = await UserOrder.findOne({ where: { payment_network_id: original_transaction_id } });
        if (order) {
          // 更新到期时间（同 DID_RENEW 的沙盒保护逻辑）
          let resubExpiry = txInfo?.expiresDate ? new Date(txInfo.expiresDate) : null;
          if (resubExpiry) {
            const ONE_HOUR_MS = 3600 * 1000;
            if (resubExpiry.getTime() <= Date.now() + ONE_HOUR_MS) {
              const fallback = new Date();
              fallback.setMonth(fallback.getMonth() + 1);
              console.warn(`⚠️ [AppleNotif V2] RESUBSCRIBE 到期时间不可靠(${resubExpiry.toISOString()})，回退自然月: ${fallback.toISOString()}`);
              resubExpiry = fallback;
            }
          }
          const updateFields = { is_cancelled: 0 };
          if (resubExpiry) updateFields.contract_end_time = resubExpiry;
          await MiningContract.update(
            updateFields,
            { where: { user_id: order.user_id, original_transaction_id, contract_type: 'paid contract' } }
          );
          console.log(`✅ [AppleNotif V2] 用户重新订阅，合约恢复${resubExpiry ? ` 新到期: ${resubExpiry.toISOString()}` : ''}: original_tx=${original_transaction_id}`);
        }
        return;
      }
      // EXPIRED → 订阅自然到期（带时间窗口保护，防止 DID_RENEW 竞态）
      if (notification_type === 'EXPIRED') {
        await markContractCancelled(original_transaction_id);
        return;
      }
      // REVOKE → 家庭共享订阅被撤销（本质是退款），强制终止
      // REFUND → 苹果客服退款成功，强制终止
      if (notification_type === 'REVOKE' || notification_type === 'REFUND') {
        await markContractRefunded(original_transaction_id);
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

    // ⚠️ 多订阅组安全处理：Apple V1 通知的 latest_receipt_info 包含该 App 所有 Plan 的收据。
    // 若用户同时持有 4 个 Plan（各独立订阅组），必须先按触发事件的产品过滤，
    // 否则 reduce 会取到到期时间最晚的 Plan（错误的合约），导致错误 Plan 被续期/取消。
    // Apple 在 V1 通知根节点提供 auto_renew_product_id 标明本次事件的具体产品。
    const triggerProductId = req.body.auto_renew_product_id;
    const receiptsForEvent = (triggerProductId && receipts.length > 1)
      ? receipts.filter(r => r.product_id === triggerProductId)
      : receipts;
    const relevantReceipts = receiptsForEvent.length > 0 ? receiptsForEvent : receipts;

    // 在过滤后的收据里取 expires_date_ms 最大的一条（该产品最新一期）
    const latest = relevantReceipts.reduce((best, r) => {
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
          // 沙盒续订周期为 5 分钟，Apple 给出的 expires_date_ms = now+5min
          // 与首次购买保持一致：若到期时间 < now+1小时，回退到自然月计算，避免覆盖为 5 分钟
          const ONE_HOUR_MS = 3600 * 1000;
          let effectiveExpiry = newExpiry;
          if (newExpiry.getTime() <= Date.now() + ONE_HOUR_MS) {
            effectiveExpiry = new Date();
            effectiveExpiry.setMonth(effectiveExpiry.getMonth() + 1);
            console.warn(`⚠️ [AppleNotif V1] 续订到期时间不可靠(${newExpiry.toISOString()})，回退自然月: ${effectiveExpiry.toISOString()}`);
          }
          // 通过 original_transaction_id 找到用户ID
          const order = await UserOrder.findOne({
            where: { payment_network_id: original_transaction_id },
          });
          if (order) {
            const { MiningContract } = require('../models');
            // 精准更新：只延期与该 original_transaction_id 对应的合约
            await MiningContract.update(
              { contract_end_time: effectiveExpiry },
              { where: { user_id: order.user_id, original_transaction_id, contract_type: 'paid contract' } }
            );
            // 避免重复记录同一 transaction_id
            const already = await UserOrder.findOne({ where: { payment_gateway_id: transaction_id } });
            if (!already) {
              await UserOrder.create({
                user_id: order.user_id,
                email: order.email,
                apple_account: order.apple_account || null,
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
            console.log(`✅ [AppleNotif] 续订合约延期至 ${effectiveExpiry.toISOString()}`);
          } else {
            console.warn(`⚠️ [AppleNotif] 找不到 original_tx=${original_transaction_id} 对应的订单`);
          }
        }
        break;
      }

      case 'DID_CHANGE_RENEWAL_STATUS': {
        // 用户关闭/开启自动续期
        // ⚠️ 关闭自动续期只表示当期结束后不再续订，当前有效期内合约依然有效，不能立即取消。
        // 合约到期时会自然过期（contract_end_time 届时 contractRewardService 不再产生收益）。
        const pendingRenewal = req.body.unified_receipt?.pending_renewal_info || [];
        const pendingItem = pendingRenewal.find(p => p.original_transaction_id === original_transaction_id);
        const autoRenewStatus = pendingItem?.auto_renew_status;
        if (autoRenewStatus === '0' || autoRenewStatus === 0) {
          console.log(`ℹ️ [AppleNotif V1] 用户关闭自动续期，当期继续有效: original_tx=${original_transaction_id}`);
        } else {
          // 用户重新开启自动续期：若 is_cancelled 被误设为 1（通知乱序），重置回 0
          console.log(`✅ [AppleNotif V1] 用户重新开启自动续期: original_tx=${original_transaction_id}`);
          const { MiningContract } = require('../models');
          await MiningContract.update(
            { is_cancelled: 0 },
            { where: { original_transaction_id, contract_type: 'paid contract' } }
          );
        }
        break;
      }

      case 'CANCEL': {
        // 苹果客服退款：立即强制终止挖矿（不受时间窗口限制）
        await markContractRefunded(original_transaction_id);
        break;
      }
      case 'EXPIRED': {
        // 订阅自然到期：使用带时间窗口保护的取消（防止与 DID_RENEW 竞态）
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
 * 辅助函数：退款场景 — 强制立即终止合约挖矿，无时间窗口限制
 * 与 markContractCancelled 的区别:
 *   1. 无 contract_end_time 时间窗口限制（退款立即生效，不管合约是否在有效期内）
 *   2. 同时更新 contract_end_time = NOW()，确保 contractRewardService 不再计算后续收益
 *      （contractRewardService 只检查 contract_end_time，不检查 is_cancelled）
 *   3. 订单状态更新为 refund successful
 * ⚠️ 不扣除已产出的 BTC 余额 — 已挖收益属于已消费的服务，不可追溯回收。
 */
async function markContractRefunded(originalTransactionId) {
  if (!originalTransactionId) return;
  try {
    const { MiningContract } = require('../models');
    // 强制终止：不受有效期限制，退款即停止挖矿
    // 必须同时更新 contract_end_time，因为 contractRewardService 只检查该字段
    const now = new Date();
    const [rows] = await MiningContract.update(
      { is_cancelled: 1, contract_end_time: now },
      {
        where: {
          original_transaction_id: originalTransactionId,
          contract_type: 'paid contract',
          is_cancelled: 0,
        },
      }
    );
    if (rows > 0) {
      await UserOrder.update(
        { order_status: 'refund successful' },
        { where: { payment_network_id: originalTransactionId } }
      );
      console.log(`💸 [AppleNotif] 退款合约已强制终止挖矿: original_tx=${originalTransactionId} (rows=${rows})`);
    } else {
      console.log(`ℹ️ [AppleNotif] 退款通知但未找到有效合约（已取消或不存在）: original_tx=${originalTransactionId}`);
    }
  } catch (err) {
    console.error(`❌ [AppleNotif] markContractRefunded 异常: original_tx=${originalTransactionId}`, err.message);
  }
}

/**
 * 辅助函数：通过 original_transaction_id 找到对应订单和合约，标记为已取消
 * ⚠️ 仅当合约的 contract_end_time 已到期或距到期 ≤ 10 分钟时才取消。
 * 防止 EXPIRED 通知晚于 DID_RENEW 到达，导致续订合约被误取消。
 */
async function markContractCancelled(originalTransactionId) {
  if (!originalTransactionId) return;
  try {
    const { MiningContract, Sequelize } = require('../models');
    const { Op } = Sequelize;
    // 只取消 contract_end_time 在 10 分钟内已到期或即将到期的合约
    // 若 DID_RENEW 已将到期时间延长至未来，则跳过取消
    const cutoff = new Date(Date.now() + 10 * 60 * 1000); // now + 10min
    const [rows] = await MiningContract.update(
      { is_cancelled: 1 },
      {
        where: {
          original_transaction_id: originalTransactionId,
          contract_type: 'paid contract',
          is_cancelled: 0,
          contract_end_time: { [Op.lte]: cutoff },
        },
      }
    );
    if (rows > 0) {
      // 同步标记关联订单
      await UserOrder.update(
        { order_status: 'complete' },
        { where: { payment_network_id: originalTransactionId } }
      );
      console.log(`📴 [AppleNotif] 合约已标记取消: original_tx=${originalTransactionId} (rows=${rows})`);
    } else {
      console.log(`ℹ️ [AppleNotif] EXPIRED 通知但合约仍在有效期内（DID_RENEW 已延期），跳过取消: original_tx=${originalTransactionId}`);
    }
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

    const { MiningContract, Sequelize } = require('../models');
    const { Op } = Sequelize;
    // ⚠️ 与 markContractCancelled 保持一致：只允许取消已到期或即将到期（10分钟内）的合约。
    // 防止在计费周期中途误取消活跃合约（Apple 政策：取消后当期仍有效）。
    const cutoff = new Date(Date.now() + 10 * 60 * 1000);
    // 安全性：只允许操作属于当前用户的合约
    const contract = await MiningContract.findOne({
      where: {
        user_id: userId,
        original_transaction_id: originalTransactionId,
        contract_type: 'paid contract',
        is_cancelled: 0,
        contract_end_time: { [Op.lte]: cutoff },
      },
    });

    if (!contract) {
      // 合约不存在、已取消、或尚在有效期内（时间窗口保护）
      return res.status(200).json({
        success: true,
        message: '合约不存在、已取消或仍在有效期内',
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
