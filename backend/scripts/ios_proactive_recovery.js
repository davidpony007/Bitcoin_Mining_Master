'use strict';
/**
 * ios_proactive_recovery.js
 * 主动补录脚本：通过 Apple App Store Server API 通知历史
 * 拉取 5/25-5/30 所有购买事件，无需用户打开 App 即可补录丢失订单和合约。
 *
 * 用法（在容器内运行）:
 *   node /app/scripts/ios_proactive_recovery.js
 */

try { require('dotenv').config({ path: '/app/.env' }); } catch (_) {}

const crypto  = require('crypto');
const https   = require('https');
const pool    = require('../src/config/database_native');
const { UserOrder, UserInformation, MiningContract } = require('../src/models');
const PaidProductService       = require('../src/services/paidProductService');
const SubscriptionPointsService = require('../src/services/subscriptionPointsService');

// ── App Store Server API 凭证 ─────────────────────────────────────────────────
const RAW_KEY   = (process.env.APPLE_APP_STORE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const KEY_ID    = process.env.APPLE_APP_STORE_API_KEY_ID;   // BM572GFFBV
const ISSUER_ID = process.env.APPLE_APP_STORE_ISSUER_ID;    // c9cb0c33-...
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID;              // com.cloudminingtool.bitcoinMiningMaster

// ── 补录时间窗口 ───────────────────────────────────────────────────────────────
const START_DATE = new Date('2026-05-25T00:00:00Z').getTime();
const END_DATE   = new Date('2026-05-31T00:00:00Z').getTime();

// ── 产品 ID 映射（Apple product_id → 后端 product_id）────────────────────────
const PRODUCT_MAP = {
  'appstore04.99': 'p0499',
  'appstore06.99': 'p0699',
  'appstore09.99': 'p0999',
  'appstore19.99': 'p1999',
  // 兜底：尝试 PaidProductService.resolveProductId
};

// ─────────────────────────────────────────────────────────────────────────────
// JWT 生成（ES256，App Store Connect API key）
// ─────────────────────────────────────────────────────────────────────────────
function generateJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: ISSUER_ID,
    iat: now,
    exp: now + 1200,
    aud: 'appstoreconnect-v1',
    bid: BUNDLE_ID,
  })).toString('base64url');
  const sig = crypto.sign(
    'sha256',
    Buffer.from(`${header}.${payload}`),
    { key: RAW_KEY, dsaEncoding: 'ieee-p1363' }
  ).toString('base64url');
  return `${header}.${payload}.${sig}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apple App Store Server API：GET 通知历史（分页）
// ─────────────────────────────────────────────────────────────────────────────
// paginationToken 是 URL 查询参数（不在请求体）
function httpsPost(body, jwt, paginationToken) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const qs   = paginationToken ? `?paginationToken=${encodeURIComponent(paginationToken)}` : '';
    const req = https.request({
      hostname: 'api.storekit.itunes.apple.com',
      path: `/inApps/v1/notifications/history${qs}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 500)}`));
        }
        try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function fetchAllNotifications() {
  const notifications = [];
  let paginationToken = undefined;
  let hasMore = true;
  let page = 0;

  while (hasMore) {
    page++;
    const jwt  = generateJWT();
    const body = { startDate: START_DATE, endDate: END_DATE };

    console.log(`  📄 第 ${page} 页 (token=${paginationToken || 'start'})...`);
    const resp = await httpsPost(body, jwt, paginationToken);

    // 打印首页的原始响应结构（调试用）
    if (page === 1) {
      const keys = Object.keys(resp);
      console.log(`  API 响应字段: [${keys.join(', ')}]`);
      console.log(`  hasMore=${resp.hasMore}  paginationToken=${resp.paginationToken}  signedPayloads.length=${resp.signedPayloads?.length || 0}`);
    }

    if (resp.notificationHistory && Array.isArray(resp.notificationHistory)) {
      // 每个条目：{ signedPayload: "eyJ...", sendAttempts: [...] }
      for (const item of resp.notificationHistory) {
        if (item.signedPayload) notifications.push(item.signedPayload);
      }
    }

    // 必须用 hasMore 字段控制翻页，而非 token 是否存在
    hasMore = resp.hasMore === true;
    paginationToken = hasMore ? resp.paginationToken : null;
  }

  return notifications;
}

// ─────────────────────────────────────────────────────────────────────────────
// JWS 解码（只取 payload，不做完整验签——可信来源是 API 直接响应，无需二次验签）
// ─────────────────────────────────────────────────────────────────────────────
function decodeJWS(jws) {
  try {
    if (!jws) return null;
    const parts = jws.split('.');
    if (parts.length < 2) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 [主动补录] Apple App Store Server API 通知历史查询...');
  console.log(`   时间范围: 2026-05-25 ~ 2026-05-30`);
  console.log(`   Bundle ID: ${BUNDLE_ID}  KeyID: ${KEY_ID}`);

  if (!RAW_KEY || !KEY_ID || !ISSUER_ID || !BUNDLE_ID) {
    throw new Error('缺少 App Store Server API 凭证，检查 .env 中的 APPLE_APP_STORE_* 变量');
  }

  // 1. 拉取全部通知
  console.log('\n📡 拉取 Apple 通知历史...');
  const signedPayloads = await fetchAllNotifications();
  console.log(`   共获取 ${signedPayloads.length} 条通知`);

  if (signedPayloads.length === 0) {
    console.log('✅ 无通知记录，退出。');
    await pool.end();
    return;
  }

  // 2. 解码并筛选购买类事件
  const PURCHASE_TYPES = new Set(['SUBSCRIBED', 'ONE_TIME_CHARGE', 'DID_RENEW', 'INTERACTIVE_RENEWAL']);
  let recovered = 0, skipped = 0, noUser = 0, noProduct = 0;

  for (const signedPayload of signedPayloads) {
    const notifPayload = decodeJWS(signedPayload);
    if (!notifPayload) continue;

    const notifType = notifPayload.notificationType || '';
    if (!PURCHASE_TYPES.has(notifType)) continue;

    const signedTxInfo = notifPayload.data?.signedTransactionInfo;
    const tx = decodeJWS(signedTxInfo);
    if (!tx) continue;

    const {
      originalTransactionId: origTxId,
      transactionId: txId,
      productId: appleProductId,
      purchaseDate,
      expiresDate,
      appAccountToken,
      type: txType,
    } = tx;

    // 只处理订阅类型
    if (txType && txType !== 'Auto-Renewable Subscription') continue;

    // 3. 找到对应用户
    let userId = null;
    if (appAccountToken) {
      const uInfo = await UserInformation.findOne({
        where: { apple_app_account_token: appAccountToken },
        attributes: ['user_id'],
      });
      if (uInfo) userId = uInfo.user_id;
    }

    if (!userId) {
      // 打印首条未匹配记录的完整解码字段（帮助诊断 appAccountToken 缺失原因）
      if (noUser === 0) {
        console.log('\n🔍 [诊断] 第一条未匹配交易的完整 JWS 解码字段:');
        console.log(JSON.stringify(tx, null, 2).slice(0, 1500));
        console.log('---\n');
      }
      // 通过 original_transaction_id 在已有订单里找（已有订单不需要补录）
      const existingOrder = await UserOrder.findOne({ where: { payment_network_id: origTxId } });
      if (existingOrder) { skipped++; continue; }
      noUser++;
      console.warn(`⚠️  找不到用户: appAccountToken=${appAccountToken} origTx=${origTxId} product=${appleProductId}`);
      continue;
    }

    // 4. 检查是否已有此合约
    const existingContract = await MiningContract.findOne({
      where: { user_id: userId, original_transaction_id: origTxId, contract_type: 'paid contract' },
    });
    if (existingContract) { skipped++; continue; }

    // 5. 解析产品
    let resolvedPid = PRODUCT_MAP[appleProductId];
    if (!resolvedPid) resolvedPid = await PaidProductService.resolveProductId(appleProductId);
    const pInfo = resolvedPid ? await PaidProductService.getProductInfo(resolvedPid) : null;
    if (!pInfo) {
      noProduct++;
      console.warn(`⚠️  未知产品 ID: ${appleProductId} user=${userId}`);
      continue;
    }

    // 6. 幂等检查：此 transaction 是否已有订单
    const existingOrder = await UserOrder.findOne({ where: { payment_gateway_id: txId } });
    if (existingOrder) { skipped++; continue; }

    // 7. 补录订单 + 合约
    try {
      const purchaseTs  = purchaseDate  ? new Date(purchaseDate)  : new Date();
      const expiryDate  = expiresDate   ? new Date(expiresDate)   : new Date(Date.now() + 30 * 24 * 3600 * 1000);
      const isExpired   = expiryDate < new Date();

      const uInfo = await UserInformation.findOne({ where: { user_id: userId }, attributes: ['email', 'apple_account', 'country_code'] });

      const newOrder = await UserOrder.create({
        user_id:             userId,
        email:               uInfo?.email || '',
        apple_account:       uInfo?.apple_account || null,
        product_id:          resolvedPid,
        product_name:        pInfo.product_name,
        product_price:       String(pInfo.product_price || 0),
        hashrate:            pInfo.hashrate_raw || 0,
        order_creation_time: purchaseTs,
        payment_time:        purchaseTs,
        currency_type:       'USD',
        country_code:        uInfo?.country_code || null,
        payment_gateway_id:  txId,
        payment_network_id:  origTxId,
        order_status:        isExpired ? 'expired' : 'active',
      });

      await MiningContract.create({
        user_id:                  userId,
        contract_type:            'paid contract',
        product_id:               resolvedPid,
        platform:                 'ios',
        contract_creation_time:   purchaseTs,
        contract_end_time:        expiryDate,
        hashrate:                 pInfo.hashrate_raw || 0,
        base_hashrate:            pInfo.hashrate_raw || 0,
        original_transaction_id:  origTxId,
        order_id:                 String(newOrder.id),
        is_cancelled:             isExpired ? 1 : 0,
        is_renewal:               notifType === 'DID_RENEW' ? 1 : 0,
      });

      // 补发积分
      try {
        await SubscriptionPointsService.awardSubscriptionPoints(userId, resolvedPid);
      } catch (pe) {
        console.warn(`⚠️  补录积分失败(非致命): ${pe.message}`);
      }

      console.log(`✅  补录: user=${userId} product=${appleProductId} origTx=${origTxId} expiry=${expiryDate.toISOString()} notif=${notifType}`);
      recovered++;
    } catch (err) {
      console.error(`❌  补录失败: user=${userId} origTx=${origTxId} err=${err.message}`);
    }
  }

  console.log(`
========================================
[主动补录] 完成
  已补录订单+合约:  ${recovered} 条
  已有记录跳过:     ${skipped} 条
  找不到用户:       ${noUser} 条
  未知产品ID:       ${noProduct} 条
========================================`);

  await pool.end();
}

main().catch(err => {
  console.error('❌ 脚本出错:', err.message);
  process.exit(1);
});
