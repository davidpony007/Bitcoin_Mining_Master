'use strict';

/**
 * Google Play Real-time Developer Notifications (RTDN) 处理器
 * 通过 Pub/Sub 推送接收 Google Play 订阅事件，主动创建/更新订单和合约
 * 文档: https://developer.android.com/google/play/billing/rtdn-reference
 *
 * 核心用途：当 App 崩溃/网络异常导致 verifyPurchase 未上报时，
 * 服务器可通过此 webhook 补录订单和合约，防止漏单。
 *
 * 通知类型（subscriptionNotification.notificationType）：
 *   1  SUBSCRIPTION_RECOVERED         - 从账户冻结中恢复
 *   2  SUBSCRIPTION_RENEWED           - 成功续订（Google 自动扣款）
 *   3  SUBSCRIPTION_CANCELED          - 用户取消（到期前仍有服务）
 *   4  SUBSCRIPTION_PURCHASED         - 新购订阅
 *   5  SUBSCRIPTION_ON_HOLD           - 进入账户冻结
 *   6  SUBSCRIPTION_IN_GRACE_PERIOD   - 进入宽限期（扣款失败但仍有服务）
 *   7  SUBSCRIPTION_RESTARTED         - 取消后重新激活
 *   12 SUBSCRIPTION_REVOKED           - 退款并立即撤销（需立即取消合约）
 *   13 SUBSCRIPTION_EXPIRED           - 完全过期
 */

const { UserOrder, UserInformation, MiningContract, UserStatus } = require('../models');
const { Op } = require('sequelize');
const googlePlayVerifyService = require('../services/googlePlayVerifyService');
const paidContractService = require('../services/paidContractService');
const PaidProductService = require('../services/paidProductService');
const SubscriptionPointsService = require('../services/subscriptionPointsService');
const refundReclaimService = require('../services/refundReclaimService');

async function isAccountRestricted(userId) {
  if (!userId) return false;

  const [info, status] = await Promise.all([
    UserInformation.findOne({ where: { user_id: userId }, attributes: ['is_banned'] }),
    UserStatus.findOne({ where: { user_id: userId }, attributes: ['user_status'] }),
  ]);

  return !!(info?.is_banned || ['disabled', 'deleted'].includes(status?.user_status));
}

// Google Play 订阅产品 ID → 后端产品 ID 映射
// subscriptionId 来自 RTDN 通知，与 Play Console 里配置的订阅 ID 一致
const SUBSCRIPTION_ID_MAP = {
  'p04.99': 'p0499',
  'p06.99': 'p0699',
  'p09.99': 'p0999',
  'p19.99': 'p1999',
  // 兼容直接用后端 ID 的情况
  'p0499': 'p0499',
  'p0699': 'p0699',
  'p0999': 'p0999',
  'p1999': 'p1999',
};

const NOTIFICATION_TYPE = {
  SUBSCRIPTION_RECOVERED: 1,
  SUBSCRIPTION_RENEWED: 2,
  SUBSCRIPTION_CANCELED: 3,
  SUBSCRIPTION_PURCHASED: 4,
  SUBSCRIPTION_ON_HOLD: 5,
  SUBSCRIPTION_IN_GRACE_PERIOD: 6,
  SUBSCRIPTION_RESTARTED: 7,
  SUBSCRIPTION_PRICE_CHANGE_CONFIRMED: 8,
  SUBSCRIPTION_DEFERRED: 9,
  SUBSCRIPTION_PAUSED: 10,
  SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED: 11,
  SUBSCRIPTION_REVOKED: 12,
  SUBSCRIPTION_EXPIRED: 13,
};

/**
 * POST /api/payment/google-play-rtdn
 * Pub/Sub 推送入口 — 不需要 JWT 鉴权，通过 query token 验证
 */
exports.handleNotification = async (req, res) => {
  // 1. 验证 webhook 密钥（防止伪造请求）
  const secret = process.env.GOOGLE_PLAY_RTDN_SECRET;
  if (!secret) {
    console.error('❌ [RTDN] GOOGLE_PLAY_RTDN_SECRET 未配置，拒绝处理请求');
    return res.status(200).end();
  }
  if (secret && req.query.token !== secret) {
    console.warn('⚠️ [RTDN] 非法请求：token 不匹配，来源 IP:', req.ip);
    // 返回 200 防止 Pub/Sub 无限重试，但不处理
    return res.status(200).end();
  }

  // 2. 解码 Pub/Sub 消息体
  let notification;
  try {
    const message = req.body?.message;
    if (!message?.data) {
      console.warn('⚠️ [RTDN] 消息为空或格式错误:', JSON.stringify(req.body).substring(0, 200));
      return res.status(200).end(); // 返回 200 避免 Pub/Sub 无限重试
    }
    const decoded = Buffer.from(message.data, 'base64').toString('utf8');
    notification = JSON.parse(decoded);
  } catch (e) {
    console.error('❌ [RTDN] 消息解析失败:', e.message);
    return res.status(200).end();
  }

  const { subscriptionNotification } = notification;

  // 只处理订阅通知（忽略一次性商品通知 oneTimeProductNotification 等）
  if (!subscriptionNotification) {
    console.log(`ℹ️ [RTDN] 非订阅通知，忽略`);
    return res.status(200).end();
  }

  const { notificationType, purchaseToken, subscriptionId } = subscriptionNotification;
  console.log(`📩 [RTDN] 收到通知: type=${notificationType} subscriptionId=${subscriptionId} token=${purchaseToken?.substring(0, 30)}...`);

  // 3. 立即响应 200，避免 Pub/Sub 超时后重试（处理逻辑异步进行）
  res.status(200).end();

  // 4. 异步处理
  try {
    await processNotification(notificationType, purchaseToken, subscriptionId);
  } catch (err) {
    console.error('❌ [RTDN] 处理通知异常:', err.message, err.stack?.substring(0, 500));
  }
};

// ── 内部处理函数 ─────────────────────────────────────────────

async function processNotification(notificationType, purchaseToken, subscriptionId) {
  const backendProductId = SUBSCRIPTION_ID_MAP[subscriptionId];
  if (!backendProductId) {
    console.warn(`⚠️ [RTDN] 未知 subscriptionId: ${subscriptionId}，跳过`);
    return;
  }

  // 向 Google Play API 获取订阅详情（含 obfuscatedExternalAccountId = userId）
  if (!googlePlayVerifyService.isInitialized) {
    console.error('❌ [RTDN] Google Play 验证服务未初始化，跳过');
    return;
  }

  const packageName = process.env.ANDROID_PACKAGE_NAME || 'com.cloudminingtool.bitcoin_mining_app';
  let subDetails;
  try {
    subDetails = await googlePlayVerifyService.getSubscriptionV2Details(packageName, purchaseToken);
  } catch (err) {
    console.error(`❌ [RTDN] 获取订阅详情失败: ${err.message}`);
    return;
  }

  // 从 obfuscatedExternalAccountId 取得 userId
  const userId = subDetails?.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (!userId) {
    console.warn(`⚠️ [RTDN] 订阅未绑定 userId（obfuscatedExternalAccountId 为空）: token=${purchaseToken?.substring(0, 30)}`);
    return;
  }

  // 从 lineItems 取到期时间 & 最新订单号
  const expiryTime = subDetails?.lineItems?.[0]?.expiryTime
    ? new Date(subDetails.lineItems[0].expiryTime)
    : null;
  const orderId = subDetails?.latestOrderId; // e.g. GPA.3339-...

  console.log(`🔍 [RTDN] user=${userId} product=${backendProductId} orderId=${orderId} expiry=${expiryTime?.toISOString()} type=${notificationType}`);

  // 被封禁/禁用用户：拒绝新增订单或续费入账，防止继续刷单。
  // 退款/过期类事件仍允许继续处理，以便及时回收权益。
  const restricted = await isAccountRestricted(userId);
  if (restricted && [
    NOTIFICATION_TYPE.SUBSCRIPTION_PURCHASED,
    NOTIFICATION_TYPE.SUBSCRIPTION_RECOVERED,
    NOTIFICATION_TYPE.SUBSCRIPTION_RESTARTED,
    NOTIFICATION_TYPE.SUBSCRIPTION_RENEWED,
  ].includes(notificationType)) {
    console.warn(`⛔ [RTDN] 受限账户事件被忽略: user=${userId} type=${notificationType}`);
    return;
  }

  switch (notificationType) {
    // 新购 / 恢复 / 重新激活
    case NOTIFICATION_TYPE.SUBSCRIPTION_PURCHASED:
    case NOTIFICATION_TYPE.SUBSCRIPTION_RECOVERED:
    case NOTIFICATION_TYPE.SUBSCRIPTION_RESTARTED:
      await handlePurchased(userId, backendProductId, purchaseToken, orderId, expiryTime);
      break;

    // 续订（Google 自动扣款成功）
    case NOTIFICATION_TYPE.SUBSCRIPTION_RENEWED:
      await handleRenewed(userId, backendProductId, purchaseToken, orderId, expiryTime);
      break;

    // 退款并立即撤销（需立即停止挖矿）
    case NOTIFICATION_TYPE.SUBSCRIPTION_REVOKED:
      await handleRevoked(userId, purchaseToken, orderId);
      break;

    // 完全过期（宽限期结束，所有续费尝试失败）
    case NOTIFICATION_TYPE.SUBSCRIPTION_EXPIRED:
      await handleExpired(userId);
      break;

    // 用户主动取消：不立即停止，等自然到期
    case NOTIFICATION_TYPE.SUBSCRIPTION_CANCELED:
      console.log(`ℹ️ [RTDN] 用户已取消订阅（到期前仍有服务）: user=${userId} expiry=${expiryTime?.toISOString()}`);
      break;

    // 宽限期：不立即停止
    case NOTIFICATION_TYPE.SUBSCRIPTION_IN_GRACE_PERIOD:
      console.log(`ℹ️ [RTDN] 订阅进入宽限期: user=${userId}`);
      break;

    // 账户冻结：不立即停止（已有到期时间控制）
    case NOTIFICATION_TYPE.SUBSCRIPTION_ON_HOLD:
      console.log(`ℹ️ [RTDN] 订阅进入账户冻结: user=${userId}`);
      break;

    default:
      console.log(`ℹ️ [RTDN] 忽略通知类型: ${notificationType} user=${userId}`);
  }
}

/**
 * 处理新购 / 恢复 / 重新激活
 * 核心场景：App 未调用 verifyPurchase → 服务端补录订单+合约
 */
async function handlePurchased(userId, productId, purchaseToken, orderId, expiryTime) {
  if (!orderId) {
    console.warn(`⚠️ [RTDN] PURCHASED 事件无 orderId，跳过: user=${userId}`);
    return;
  }

  // 检查订单是否已存在（App 已正常上报 verifyPurchase，或 RTDN 已处理过）
  // payment_gateway_id 存 orderId（GPA.xxx），payment_network_id 存 purchaseToken
  const existingOrder = await UserOrder.findOne({ where: { payment_gateway_id: orderId } });
  if (existingOrder) {
    // 订单已存在，检查合约是否也存在
    const activeContract = await MiningContract.findOne({
      where: { user_id: userId, product_id: productId, contract_type: 'paid contract', is_cancelled: 0 },
    });
    if (!activeContract) {
      // 订单有但合约没有 → 补建合约（丢单补建）
      console.warn(`⚠️ [RTDN] 丢单补建：订单已存在但无活跃合约: user=${userId} orderId=${orderId}`);
      await paidContractService.createPaidContract(userId, productId, orderId, expiryTime, 'android', purchaseToken);
      console.log(`✅ [RTDN] 补建合约成功: user=${userId}`);
      // 补发首次订阅积分（幂等，失败不阻断）
      try {
        await SubscriptionPointsService.awardSubscriptionPoints(userId, productId);
      } catch (pointsErr) {
        console.warn(`⚠️ [RTDN] 补建合约积分发放失败（不影响主流程）: ${pointsErr.message}`);
      }
    } else {
      console.log(`ℹ️ [RTDN] 订单和合约均已存在，无需处理: user=${userId} orderId=${orderId}`);
    }
    return;
  }

  // ── 全新订单：App 未上报，服务端补录 ──────────────────────
  console.log(`🆕 [RTDN] 补录新购订单: user=${userId} product=${productId} orderId=${orderId}`);
  const productInfo = await PaidProductService.getProductInfo(productId);
  const user = await UserInformation.findOne({ where: { user_id: userId }, attributes: ['email'] });

  try {
    await UserOrder.create({
      user_id: userId,
      email: user?.email || '',
      product_id: productId,
      product_name: productInfo?.product_name || productId,
      product_price: String(productInfo?.product_price || 0),
      hashrate: productInfo?.hashrate_raw || 0,
      order_creation_time: new Date(),
      payment_time: new Date(),
      currency_type: 'USD',
      payment_gateway_id: orderId,         // orderId（GPA.xxx）→ 平台判断依据（LIKE 'GPA.%' = Android）
      payment_network_id: purchaseToken,   // purchaseToken → 用于 Google Play API 验证
      order_status: 'active',
    });
  } catch (dupErr) {
    if (dupErr.name === 'SequelizeUniqueConstraintError') {
      console.log(`ℹ️ [RTDN] 并发重复订单被 UNIQUE 约束拦截: token=${purchaseToken?.substring(0, 20)}`);
      return;
    }
    throw dupErr;
  }

  await paidContractService.createPaidContract(userId, productId, orderId, expiryTime, 'android', purchaseToken);
  // 发放首次订阅积分（幂等，失败不阻断主流程）
  try {
    await SubscriptionPointsService.awardSubscriptionPoints(userId, productId);
  } catch (pointsErr) {
    console.warn(`⚠️ [RTDN] 积分发放失败（不影响主流程）: ${pointsErr.message}`);
  }
  console.log(`✅ [RTDN] 补录订单+合约成功: user=${userId} product=${productId} orderId=${orderId}`);
}

/**
 * 处理续订（Google 自动扣款成功）
 */
async function handleRenewed(userId, productId, purchaseToken, orderId, expiryTime) {
  if (!expiryTime) {
    console.warn(`⚠️ [RTDN] RENEWED 事件无 expiryTime，跳过: user=${userId}`);
    return;
  }

  // 查找该档位的活跃合约并更新到期时间
  // 必须按 product_id 过滤：用户可同时持有多个档位的合约，续订只能更新对应档位
  const contract = await MiningContract.findOne({
    where: { user_id: userId, product_id: productId, contract_type: 'paid contract', is_cancelled: 0 },
    order: [['id', 'DESC']],
  });

  if (contract) {
    await MiningContract.update(
      { contract_end_time: expiryTime, original_transaction_id: purchaseToken, is_renewal: 1, is_cancelled: 0 },
      { where: { id: contract.id } }
    );
    console.log(`✅ [RTDN] 续订合约延期: user=${userId} contractId=${contract.id} newExpiry=${expiryTime.toISOString()}`);
  } else {
    // 无活跃合约，降级为新购处理
    console.warn(`⚠️ [RTDN] RENEWED 但无活跃合约，按新购处理: user=${userId}`);
    await handlePurchased(userId, productId, purchaseToken, orderId, expiryTime);
    return;
  }

  // 记录续订订单（幂等：同一 orderId 只建一条，续订用 orderId 作唯一 key）
  if (orderId) {
    const existingOrder = await UserOrder.findOne({ where: { payment_gateway_id: orderId } });
    if (!existingOrder) {
      const productInfo = await PaidProductService.getProductInfo(productId);
      const user = await UserInformation.findOne({ where: { user_id: userId }, attributes: ['email'] });
      await UserOrder.create({
        user_id: userId,
        email: user?.email || '',
        product_id: productId,
        product_name: productInfo?.product_name || productId,
        product_price: String(productInfo?.product_price || 0),
        hashrate: productInfo?.hashrate_raw || 0,
        order_creation_time: new Date(),
        payment_time: new Date(),
        currency_type: 'USD',
        payment_gateway_id: orderId,         // 续订 orderId（GPA.xxx..0001..）→ 平台判断依据
        payment_network_id: purchaseToken,   // purchaseToken → 用于 Google Play API 验证
        order_status: 'renewed',
      });
      console.log(`✅ [RTDN] 续订订单已记录: user=${userId} orderId=${orderId}`);
    }
  }
}

/**
 * 处理退款撤销（立即停止挖矿）
 * 仅取消与本次退款 purchaseToken 关联的合约，不影响用户的其他档位合约
 */
async function handleRevoked(userId, purchaseToken, orderId) {
  let cancelledCount = 0;

  // 优先通过 original_transaction_id = purchaseToken 精确定位合约
  const linkedContracts = await MiningContract.findAll({
    where: { user_id: userId, contract_type: 'paid contract', is_cancelled: 0, original_transaction_id: purchaseToken },
    attributes: ['id'],
  });

  const cancelPayload = { is_cancelled: 1, cancelled_at: new Date(), contract_end_time: new Date() };

  if (linkedContracts.length > 0) {
    const ids = linkedContracts.map(c => c.id);
    const [updated] = await MiningContract.update(
      cancelPayload,
      { where: { id: { [Op.in]: ids } } }
    );
    cancelledCount = updated;
    console.log(`✅ [RTDN] 退款撤销（精确匹配）: user=${userId} contractIds=${ids.join(',')} count=${updated}`);
  } else {
    // 回退：通过订单号找合约（payment_gateway_id 存 orderId）
    const order = orderId ? await UserOrder.findOne({ where: { payment_gateway_id: orderId }, attributes: ['id'] }) : null;
    if (order) {
      const [updated] = await MiningContract.update(
        cancelPayload,
        { where: { user_id: userId, contract_type: 'paid contract', is_cancelled: 0, order_id: String(order.id) } }
      );
      cancelledCount = updated;
      console.log(`✅ [RTDN] 退款撤销（通过订单匹配）: user=${userId} orderId=${orderId} count=${updated}`);
    } else {
      // 最终回退：若只有一个活跃合约，则直接取消；若有多个则只记录警告不操作
      const activeContracts = await MiningContract.findAll({
        where: { user_id: userId, contract_type: 'paid contract', is_cancelled: 0 },
        attributes: ['id'],
      });
      if (activeContracts.length === 1) {
        await MiningContract.update(cancelPayload, { where: { id: activeContracts[0].id } });
        cancelledCount = 1;
        console.log(`✅ [RTDN] 退款撤销（单合约回退）: user=${userId} contractId=${activeContracts[0].id}`);
      } else if (activeContracts.length > 1) {
        console.error(`❌ [RTDN] 退款撤销：无法精确定位合约，跳过取消操作（多合约用户，需人工处理）: user=${userId} purchaseToken=${purchaseToken?.substring(0, 30)} activeContracts=${activeContracts.map(c => c.id).join(',')}`);
      }
    }
  }

  // 更新对应订单状态为退款（purchaseToken 存于 payment_network_id）
  await UserOrder.update(
    { order_status: 'refund successful', refunded_at: new Date() },
    { where: { payment_network_id: purchaseToken } }
  );

  try {
    const reclaimResult = await refundReclaimService.reclaimForOriginalTransactionId(
      purchaseToken,
      'google_rtdn_revoke'
    );
    console.log(
      `✅ [RTDN] 退款追回完成: token=${purchaseToken?.substring(0, 30)} contracts=${reclaimResult.contractCount || 0} btc=${reclaimResult.deductedBtcTotal || 0} points=${reclaimResult.deductedPointsTotal || 0}`
    );
  } catch (reclaimErr) {
    console.error(`❌ [RTDN] 退款追回失败: token=${purchaseToken?.substring(0, 30)} error=${reclaimErr.message}`);
  }
}

/**
 * 处理完全过期（宽限期结束）
 */
async function handleExpired(userId) {
  // 取消所有已过期但 is_cancelled=0 的合约
  const [updated] = await MiningContract.update(
    { is_cancelled: 1 },
    {
      where: {
        user_id: userId,
        contract_type: 'paid contract',
        is_cancelled: 0,
        contract_end_time: { [Op.lt]: new Date() },
      },
    }
  );
  if (updated > 0) {
    console.log(`✅ [RTDN] 已过期合约标记取消: user=${userId} count=${updated}`);
  }
}
