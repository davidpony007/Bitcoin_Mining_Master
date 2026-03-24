'use strict';

/**
 * Apple App Store Server Notifications V1
 * 文档: https://developer.apple.com/documentation/appstoreservernotifications
 *
 * 在 App Store Connect → App Information → App Store Server Notifications
 * 中填写此 URL：https://你的域名/api/payment/apple-notifications
 *
 * Apple 会在以下事件时推送通知（POST JSON）：
 *   DID_RENEW           - 订阅成功续订
 *   CANCEL              - 用户取消订阅（仍有剩余服务时间）
 *   EXPIRED             - 订阅已完全过期
 *   DID_FAIL_TO_RENEW   - 扣款失败（宽限期内）
 *   DID_RECOVER         - 扣款失败后恢复
 *   INTERACTIVE_RENEWAL - 用户在 App 内主动升档/续订
 *   DID_CHANGE_RENEWAL_PREF - 用户变更下一期订阅档位
 */

const axios = require('axios');
const { UserOrder } = require('../models');
const paidContractService = require('../services/paidContractService');

const SHARED_SECRET = process.env.APPLE_IAP_SHARED_SECRET || '';

// Store product ID → backend product ID
const PRODUCT_MAP = {
  'p04.99': 'p0499',
  'p06.99': 'p0699',
  'p09.99': 'p0999',
  'p19.99': 'p1999',
};

/**
 * POST /api/payment/apple-notifications
 * Apple Server-to-Server Notification endpoint (no auth middleware)
 */
exports.handleNotification = async (req, res) => {
  // 先返回 200 告知 Apple 已收到（避免 Apple 重试）
  res.status(200).json({ received: true });

  try {
    const { notification_type, password, unified_receipt, latest_receipt_info } = req.body;

    // 校验 shared secret，防止伪造请求
    if (password !== SHARED_SECRET) {
      console.warn('⚠️ [AppleNotif] shared secret 不匹配，忽略');
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

    const {
      original_transaction_id,
      transaction_id,
      product_id,
      expires_date_ms,
      cancellation_date_ms,
    } = latest;

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
            await MiningContract.update(
              { contract_end_time: newExpiry },
              { where: { user_id: order.user_id, contract_type: 'paid contract' } }
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

      case 'CANCEL':
      case 'EXPIRED': {
        // 取消/过期：立即标记合约为已取消，状态变为 Not Active，并标记订单完成
        const order = await UserOrder.findOne({
          where: { payment_network_id: original_transaction_id },
        });
        if (order) {
          // 标记订单完成
          await UserOrder.update(
            { order_status: 'complete' },
            { where: { payment_network_id: original_transaction_id } }
          );
          // 立即标记该用户的对应付费合约为已取消，前端将显示 Not Active
          const { MiningContract } = require('../models');
          const cancelled = await MiningContract.update(
            { is_cancelled: 1, contract_end_time: new Date() },
            {
              where: {
                user_id: order.user_id,
                contract_type: 'paid contract',
                is_cancelled: 0,
              },
            }
          );
          console.log(`📴 [AppleNotif] 订阅 ${notification_type}，合约已标记取消 (rows=${cancelled[0]})`);
        } else {
          console.warn(`⚠️ [AppleNotif] ${notification_type}: 找不到 original_tx=${original_transaction_id} 对应的订单`);
        }
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
