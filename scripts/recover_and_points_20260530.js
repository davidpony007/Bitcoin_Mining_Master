'use strict';
/**
 * 漏单补录 + 积分补发脚本 — 2026-05-29/30
 *
 * 任务：
 *   1. 补录 5/30 两笔漏单（GPA.3310, GPA.3373）→ user_orders + mining_contracts + acknowledge
 *   2. 补发 5/29 全部 5 笔 + 5/30 全部 2 笔 的订阅积分（幂等，重复执行安全）
 *
 * 执行方式：
 *   docker cp recover_and_points_20260530.js bitcoin_backend_prod:/tmp/
 *   docker exec bitcoin_backend_prod node /tmp/recover_and_points_20260530.js
 */

const googlePlayVerifyService = require('/app/src/services/googlePlayVerifyService');
const paidContractService     = require('/app/src/services/paidContractService');
const PaidProductService      = require('/app/src/services/paidProductService');
const SubscriptionPointsService = require('/app/src/services/subscriptionPointsService');
const { UserOrder, UserInformation, MiningContract } = require('/app/src/models');

const PACKAGE_NAME = 'com.cloudminingtool.bitcoin_mining_app';

// ── 5/30 两笔新漏单（userId 待 API 查询确认）─────────────────────────────────
const NEW_ORDERS_5_30 = [
  {
    gpaOrderId:    'GPA.3310-1260-4280-50670',
    purchaseToken: 'ekhilffkmmlmkjeoceaobcbm.AO-J1OyMExWLSBieY5g8boRaoAIcGTR99SJN6VXDj6frIlw_4KPJEQlEla3vYTcwdIhFDNfp8CrNn5ybCFzneoUdMRIc4PVKQkii6ncCKs5gM9KrQ2G1eR2co0qzmE6VCnd9qfOl_IYR',
    subscriptionId: 'p06.99',
    productId:     'p0699',
    purchaseTime:  new Date('2026-05-30T04:54:00Z'),
    note:          'USD 6.99  (来自截图 04:54 UTC)',
  },
  {
    gpaOrderId:    'GPA.3373-0392-3662-91211',
    purchaseToken: 'cjdlldhbjmgehgieaobgkcgj.AO-J1OwJCTmpacYLPLw0bohKdeDlBGvNN12qMF3KGLajfiZjulhxb9cOTErMwmx14PciKMggR23Q4_-DHI1QhjpdbkMUnYGsqTKIzLtOWeaZltG61J3j_JakKbBbp4z_Xs-T4pt0dSow',
    subscriptionId: 'p06.99',
    productId:     'p0699',
    purchaseTime:  new Date('2026-05-30T01:08:00Z'),
    note:          'NGN 10,000.00  (来自截图 01:08 UTC)',
  },
];

// ── 5/29 五笔（mining_contracts 已存在，只需补发积分）────────────────────────
const KNOWN_ORDERS_5_29 = [
  { userId: 'U2026052917584616547', productId: 'p1999', gpaOrderId: 'GPA.3315-2446-2761-70069' },
  { userId: 'U2026052917584616547', productId: 'p0999', gpaOrderId: 'GPA.3370-4233-6987-03276' },
  { userId: 'U2026052506175849576', productId: 'p0499', gpaOrderId: 'GPA.3343-8078-1646-34146' },
  { userId: 'U2026052506175849576', productId: 'p0699', gpaOrderId: 'GPA.3340-7958-4016-41163' },
  { userId: 'U2026052503415768816', productId: 'p0499', gpaOrderId: 'GPA.3331-2432-7705-38091' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 工具：通过 purchaseToken 查找对应的 DB user_id
// 方式：先从 Google Play API 拿 obfuscatedExternalAccountId；
//       若为空，则退而检查 user_orders.payment_network_id 匹配（理论上5/30不存在）
// ─────────────────────────────────────────────────────────────────────────────
async function resolveUserId(order, subDetails) {
  // 方式 1：obfuscatedExternalAccountId（Flutter 客户端设置 accountId 后才有）
  const obfId = subDetails?.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (obfId && obfId.startsWith('U')) {
    const user = await UserInformation.findOne({ where: { user_id: obfId } });
    if (user) {
      console.log(`   userId (via obfuscatedId): ${obfId}`);
      return obfId;
    }
    console.warn(`   ⚠️  obfuscatedId=${obfId} 在 DB 中找不到对应用户`);
  }

  // 方式 2：payment_network_id 反查（极低概率但保险）
  const existingByToken = await UserOrder.findOne({
    where: { payment_network_id: order.purchaseToken },
  });
  if (existingByToken) {
    console.log(`   userId (via payment_network_id): ${existingByToken.user_id}`);
    return existingByToken.user_id;
  }

  // 方式 3：emailAddress（Google Play API v1 字段，v2 不一定有）
  const email = subDetails?.emailAddress;
  if (email) {
    const userByEmail = await UserInformation.findOne({ where: { email } });
    if (userByEmail) {
      console.log(`   userId (via email ${email}): ${userByEmail.user_id}`);
      return userByEmail.user_id;
    }
    console.warn(`   ⚠️  email=${email} 在 DB 中找不到对应用户`);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 补录一笔新漏单（含积分发放）
// ─────────────────────────────────────────────────────────────────────────────
async function recoverNewOrder(order) {
  const { gpaOrderId, purchaseToken, subscriptionId, productId, purchaseTime, note } = order;
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`▶  ${gpaOrderId}`);
  console.log(`   ${note}`);

  // 先查 Google Play API
  console.log(`📡 获取订阅详情...`);
  let subDetails;
  try {
    subDetails = await googlePlayVerifyService.getSubscriptionV2Details(PACKAGE_NAME, purchaseToken);
  } catch (err) {
    console.error(`❌ Google Play API 失败: ${err.message}`);
    return { success: false, gpaOrderId, error: `Google API: ${err.message}` };
  }

  const apiOrderId = subDetails?.latestOrderId;
  const expiryTime = subDetails?.lineItems?.[0]?.expiryTime
    ? new Date(subDetails.lineItems[0].expiryTime)
    : null;
  console.log(`   latestOrderId:  ${apiOrderId}`);
  console.log(`   expiryTime:     ${expiryTime?.toISOString() || '(null)'}`);
  console.log(`   obfuscatedId:   ${subDetails?.externalAccountIdentifiers?.obfuscatedExternalAccountId || '(未设置)'}`);

  // 解析 userId
  const userId = await resolveUserId(order, subDetails);
  if (!userId) {
    console.error(`❌ 无法确定 userId，跳过此笔订单（需手动指定）`);
    return { success: false, gpaOrderId, error: 'userId not found', needsManual: true, subDetails };
  }
  console.log(`   userId: ${userId}`);

  // 幂等检查
  const existingOrder = await UserOrder.findOne({ where: { payment_gateway_id: gpaOrderId } });
  if (existingOrder) {
    console.log(`ℹ️  user_orders 已存在 (id=${existingOrder.id})，跳过创建`);
  } else {
    // 获取产品信息和用户邮箱
    const productInfo = await PaidProductService.getProductInfo(productId);
    const user = await UserInformation.findOne({ where: { user_id: userId }, attributes: ['email'] });

    try {
      await UserOrder.create({
        user_id:            userId,
        email:              user?.email || '',
        product_id:         productId,
        product_name:       productInfo?.product_name || productId,
        product_price:      String(productInfo?.product_price || 0),
        hashrate:           productInfo?.hashrate_raw || 0,
        order_creation_time: purchaseTime,
        payment_time:       purchaseTime,
        currency_type:      'USD',
        payment_gateway_id: gpaOrderId,
        payment_network_id: purchaseToken,
        order_status:       'active',
      });
      console.log(`✅ user_orders 创建成功`);
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        console.log(`ℹ️  user_orders 唯一约束冲突，跳过`);
      } else {
        console.error(`❌ user_orders 创建失败: ${err.message}`);
        return { success: false, gpaOrderId, error: `user_orders: ${err.message}` };
      }
    }
  }

  // 检查并补建 mining_contracts
  const existingContract = await MiningContract.findOne({
    where: { order_id: gpaOrderId },
  });
  if (existingContract) {
    console.log(`ℹ️  mining_contracts 已存在 (id=${existingContract.id})，跳过`);
  } else {
    try {
      const contractResult = await paidContractService.createPaidContract(
        userId,
        productId,
        gpaOrderId,    // → mining_contracts.order_id (varchar 80)
        expiryTime,
        'android',
        purchaseToken, // → mining_contracts.original_transaction_id (varchar 700)
      );
      if (contractResult.success) {
        console.log(`✅ mining_contracts 创建成功 (id=${contractResult.contract?.id})`);
        console.log(`   到期: ${contractResult.contract?.endTime || expiryTime}`);
      } else {
        console.error(`❌ 合约创建失败: ${contractResult.message}`);
        return { success: false, gpaOrderId, error: `contract: ${contractResult.message}` };
      }
    } catch (err) {
      console.error(`❌ 合约异常: ${err.message}`);
      return { success: false, gpaOrderId, error: `contract: ${err.message}` };
    }
  }

  // Acknowledge
  console.log(`🔐 Acknowledge 订阅 (${subscriptionId})...`);
  const ackResult = await googlePlayVerifyService.acknowledgeSubscription(
    PACKAGE_NAME, subscriptionId, purchaseToken,
  );
  if (ackResult.success) {
    console.log(`✅ Acknowledge 成功`);
  } else {
    console.warn(`⚠️  Acknowledge 失败（不影响合约）: ${ackResult.error}`);
  }

  // 积分发放
  console.log(`🎁 发放订阅积分 (${productId})...`);
  const pointsResult = await SubscriptionPointsService.awardSubscriptionPoints(userId, productId);
  if (pointsResult.awarded) {
    console.log(`✅ 积分发放成功 (+${pointsResult.pointsAwarded}分)`);
  } else if (pointsResult.reason === 'already_awarded') {
    console.log(`ℹ️  积分已发放过，跳过`);
  } else {
    console.warn(`⚠️  积分发放失败: ${pointsResult.reason} ${pointsResult.error || ''}`);
  }

  return { success: true, gpaOrderId, userId, acknowledged: ackResult.success, pointsResult };
}

// ─────────────────────────────────────────────────────────────────────────────
// 仅补发积分（5/29 已存在的订单）
// ─────────────────────────────────────────────────────────────────────────────
async function awardPointsOnly(order) {
  const { userId, productId, gpaOrderId } = order;
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`🎁 补发积分  ${gpaOrderId}`);
  console.log(`   userId=${userId}  productId=${productId}`);

  const pointsResult = await SubscriptionPointsService.awardSubscriptionPoints(userId, productId);
  if (pointsResult.awarded) {
    console.log(`✅ 积分发放成功 (+${pointsResult.pointsAwarded}分)`);
  } else if (pointsResult.reason === 'already_awarded') {
    console.log(`ℹ️  积分已发放过，跳过（幂等）`);
  } else {
    console.warn(`⚠️  积分发放失败: ${pointsResult.reason} ${pointsResult.error || ''}`);
  }
  return pointsResult;
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`🚀 补录 + 积分补发脚本  ${new Date().toISOString()}`);
  console.log(`   PACKAGE_NAME: ${PACKAGE_NAME}`);
  console.log(`   Google Play 服务: ${googlePlayVerifyService.isInitialized ? '✅ 已初始化' : '❌ 未初始化'}`);
  console.log(`${'═'.repeat(72)}`);

  if (!googlePlayVerifyService.isInitialized) {
    console.error('❌ Google Play 验证服务未初始化，无法继续');
    process.exit(1);
  }

  const manualNeeded = [];

  // ── Phase 1：补录 5/30 新漏单 ─────────────────────────────────────────────
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`📋 Phase 1：补录 5/30 两笔新漏单`);
  console.log(`${'═'.repeat(72)}`);

  const results5_30 = [];
  for (const order of NEW_ORDERS_5_30) {
    try {
      const result = await recoverNewOrder(order);
      results5_30.push(result);
      if (result.needsManual) manualNeeded.push({ order, subDetails: result.subDetails });
    } catch (err) {
      console.error(`💥 未捕获异常 (${order.gpaOrderId}): ${err.stack}`);
      results5_30.push({ success: false, gpaOrderId: order.gpaOrderId, error: err.message });
    }
  }

  // ── Phase 2：补发 5/29 全部积分 ──────────────────────────────────────────
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`📋 Phase 2：补发 5/29 五笔漏单积分`);
  console.log(`${'═'.repeat(72)}`);

  for (const order of KNOWN_ORDERS_5_29) {
    try {
      await awardPointsOnly(order);
    } catch (err) {
      console.error(`💥 积分补发异常 (${order.gpaOrderId}): ${err.message}`);
    }
  }

  // ── 汇总 ─────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`📊 5/30 补录结果：`);
  for (const r of results5_30) {
    const icon = r.success ? '✅' : (r.needsManual ? '⚠️ ' : '❌');
    console.log(`  ${icon} ${r.gpaOrderId}${r.userId ? '  userId=' + r.userId : ''}${r.error ? '  → ' + r.error : ''}`);
  }

  if (manualNeeded.length > 0) {
    console.log(`\n⚠️  以下订单需要手动指定 userId（Google Play API 未返回 obfuscatedExternalAccountId）：`);
    for (const { order, subDetails } of manualNeeded) {
      console.log(`  ${order.gpaOrderId}  product=${order.productId}  purchaseTime=${order.purchaseTime.toISOString()}`);
      if (subDetails) {
        console.log(`    API 返回数据：`);
        console.log(`    - latestOrderId: ${subDetails.latestOrderId}`);
        console.log(`    - startTime:     ${subDetails.lineItems?.[0]?.autoRenewingPlan?.autoRenewEnabled}`);
        console.log(`    - expiryTime:    ${subDetails.lineItems?.[0]?.expiryTime}`);
        console.log(`    - linkedPurchaseToken: ${subDetails.linkedPurchaseToken || '(无)'}`);
        console.log(`    完整 externalAccountIdentifiers:`);
        console.log(`    ${JSON.stringify(subDetails.externalAccountIdentifiers || {})}`);
      }
    }
    console.log(`\n  解决方法：在脚本中 manualUserIds 部分填入正确的 userId，然后重跑`);
  }

  // 验证最终积分状态
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`📊 最终积分状态验证（通过 DB 查询）`);
  const pool = require('/app/src/config/database_native');
  const knownUsers = [
    'U2026052917584616547', 'U2026052506175849576', 'U2026052503415768816',
    ...results5_30.filter(r => r.userId).map(r => r.userId),
  ];
  const uniqueUsers = [...new Set(knownUsers)];

  for (const uid of uniqueUsers) {
    const [rows] = await pool.query(
      `SELECT up.total_points, up.available_points,
              GROUP_CONCAT(spa.product_id ORDER BY spa.awarded_at) AS awarded_products
       FROM user_points up
       LEFT JOIN subscription_point_awards spa ON spa.user_id = up.user_id
       WHERE up.user_id = ?
       GROUP BY up.user_id`,
      [uid]
    );
    if (rows.length > 0) {
      const r = rows[0];
      console.log(`  ${uid}: total=${r.total_points}  available=${r.available_points}  订阅积分档位=[${r.awarded_products || '无'}]`);
    } else {
      console.log(`  ${uid}: (无积分记录)`);
    }
  }

  console.log(`${'═'.repeat(72)}\n`);
  process.exit(manualNeeded.length > 0 ? 2 : 0);
}

main().catch(err => {
  console.error('💥 主流程异常:', err);
  process.exit(1);
});
