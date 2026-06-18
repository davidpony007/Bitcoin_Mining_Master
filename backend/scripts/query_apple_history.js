'use strict';
/**
 * 查询指定 appAccountToken 对应的 Apple 交易历史（用于调查丢单）
 * 用法: node /app/scripts/query_apple_history.js <appAccountToken> [userId]
 */
try { require('dotenv').config({ path: '/app/.env' }); } catch (_) {}

const https = require('https');
const crypto = require('crypto');

const privateKey = (process.env.APPLE_APP_STORE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const keyId     = process.env.APPLE_APP_STORE_API_KEY_ID;
const issuerId  = process.env.APPLE_APP_STORE_ISSUER_ID;
const bundleId  = process.env.APPLE_BUNDLE_ID;

function makeJWT() {
  const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: issuerId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    aud: 'appstoreconnect-v1',
    bid: bundleId,
  })).toString('base64url');
  const data = `${header}.${payload}`;
  const sig = crypto.sign('SHA256', Buffer.from(data), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${data}.${sig.toString('base64url')}`;
}

function decodeJWS(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch (e) { return null; }
}

function appleRequest(path) {
  return new Promise((resolve, reject) => {
    const token = makeJWT();
    const options = {
      hostname: 'api.storekit.itunes.apple.com',
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    };
    https.get(options, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

async function main() {
  const accountToken = process.argv[2];
  const userId = process.argv[3] || '(未指定)';

  if (!accountToken) {
    console.log('用法: node query_apple_history.js <appAccountToken> [userId]');
    process.exit(1);
  }

  console.log(`\n🔍 查询用户 ${userId} 的 Apple 交易历史`);
  console.log(`   appAccountToken: ${accountToken}`);

  let allTransactions = [];
  let revision = null;
  let page = 1;

  while (true) {
    const qs = `?productType=AUTO_RENEWABLE_SUBSCRIPTION&appAccountToken=${accountToken}${revision ? '&revision=' + revision : ''}`;
    const { status, body } = await appleRequest(`/inApps/v1/history${qs}`);

    if (status !== 200) {
      console.log(`\n❌ Apple API 返回 HTTP ${status}`);
      console.log(body);
      break;
    }

    const resp = JSON.parse(body);
    const signedTxns = resp.signedTransactions || [];
    console.log(`   第 ${page} 页: ${signedTxns.length} 条交易`);

    for (const jws of signedTxns) {
      const tx = decodeJWS(jws);
      if (tx) allTransactions.push(tx);
    }

    if (resp.hasMore) {
      revision = resp.revision;
      page++;
    } else {
      break;
    }
  }

  if (allTransactions.length === 0) {
    console.log('\n⚠️  Apple 无此用户的交易记录（appAccountToken 未匹配到任何交易）');
    console.log('   可能原因：');
    console.log('   1. 购买时 App 版本较旧，未设置 applicationUserName');
    console.log('   2. 用户尚未完成购买');
    return;
  }

  console.log(`\n📋 共找到 ${allTransactions.length} 条交易：`);
  console.log('─'.repeat(80));

  // 按购买时间排序
  allTransactions.sort((a, b) => (a.purchaseDate || 0) - (b.purchaseDate || 0));

  for (const tx of allTransactions) {
    const purchaseDate = tx.purchaseDate ? new Date(tx.purchaseDate).toISOString() : 'N/A';
    const expiresDate  = tx.expiresDate  ? new Date(tx.expiresDate).toISOString()  : 'N/A';
    const isExpired    = tx.expiresDate  ? tx.expiresDate < Date.now() : true;
    const revoked      = tx.revocationDate ? `已撤销(${new Date(tx.revocationDate).toISOString()})` : '';

    console.log(`  产品: ${tx.productId}`);
    console.log(`  购买: ${purchaseDate}`);
    console.log(`  到期: ${expiresDate} ${isExpired ? '【已过期】' : '【有效】'}`);
    console.log(`  交易ID: ${tx.transactionId}  原始交易ID: ${tx.originalTransactionId}`);
    console.log(`  类型: ${tx.type}  续费: ${tx.offerType || '-'}  ${revoked}`);
    console.log('─'.repeat(80));
  }

  // 汇总
  const now = Date.now();
  const activeOnes = allTransactions.filter(tx => tx.expiresDate && tx.expiresDate > now && !tx.revocationDate);
  console.log(`\n✅ 有效订阅: ${activeOnes.length} 条`);
  if (activeOnes.length > 0) {
    console.log('👉 该用户确实有有效的 Apple 订阅，属于丢单！需要手动补录。');
    for (const tx of activeOnes) {
      console.log(`   产品: ${tx.productId}  到期: ${new Date(tx.expiresDate).toISOString()}  origTx: ${tx.originalTransactionId}`);
    }
  }
}

main().catch(err => { console.error('错误:', err.message); process.exit(1); });
