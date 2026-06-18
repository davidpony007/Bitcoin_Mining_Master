'use strict';

/**
 * Apple App Store Server API Service
 * Documentation: https://developer.apple.com/documentation/appstoreserverapi
 *
 * 必需环境变量:
 *   APPLE_APP_STORE_API_KEY_ID  - 10 位 Key ID（App Store Connect → Users & Access → Keys）
 *   APPLE_APP_STORE_ISSUER_ID   - UUID Issuer ID（同页面顶部）
 *   APPLE_APP_STORE_PRIVATE_KEY - P8 私钥文件内容（包含 -----BEGIN PRIVATE KEY----- 行）
 *   APPLE_BUNDLE_ID             - 应用 Bundle ID（如 com.xxx.bitcoinmining）
 *
 * API 端点:
 *   GET /inApps/v2/subscriptions/{originalTransactionId}  — 订阅当前状态
 *   GET /inApps/v1/refund/lookup/{originalTransactionId}  — 退款历史查询
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');

class AppleAppStoreService {
  constructor() {
    this.keyId      = process.env.APPLE_APP_STORE_API_KEY_ID   || '';
    this.issuerId   = process.env.APPLE_APP_STORE_ISSUER_ID    || '';
    this.bundleId   = process.env.APPLE_BUNDLE_ID              || '';
    // P8 私钥内容：支持 \n 转义（Docker env 常见写法）
    this.privateKey = (process.env.APPLE_APP_STORE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    this.baseUrl    = 'https://api.storekit.itunes.apple.com';

    this.isConfigured = !!(this.keyId && this.issuerId && this.privateKey && this.bundleId);

    if (this.isConfigured) {
      console.log('✅ Apple App Store Server API 服务初始化成功');
    } else {
      const missing = [
        !this.keyId      && 'APPLE_APP_STORE_API_KEY_ID',
        !this.issuerId   && 'APPLE_APP_STORE_ISSUER_ID',
        !this.privateKey && 'APPLE_APP_STORE_PRIVATE_KEY',
        !this.bundleId   && 'APPLE_BUNDLE_ID',
      ].filter(Boolean).join(', ');
      console.warn(`⚠️ Apple App Store Server API 未配置，缺少: ${missing}`);
    }
  }

  /** 生成 App Store Connect API JWT（有效期 1 小时） */
  _generateJWT() {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { iss: this.issuerId, iat: now, exp: now + 3600, aud: 'appstoreconnect-v1', bid: this.bundleId },
      this.privateKey,
      { algorithm: 'ES256', keyid: this.keyId, header: { typ: 'JWT', alg: 'ES256', kid: this.keyId } }
    );
  }

  /**
   * 解码 JWS payload（不做完整签名验证，信任 Apple API 直接返回的数据）
   * @param {string} jws
   * @returns {object|null}
   */
  _decodeJWSPayload(jws) {
    try {
      const parts = jws.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch { return null; }
  }

  /**
   * 查询订阅当前状态
   * @param {string} originalTransactionId
   * @returns {{ success: boolean, status?: number, autoRenewStatus?: number,
   *             expirationIntent?: number, error?: string, missingCredentials?: boolean }}
   */
  async getSubscriptionStatus(originalTransactionId) {
    if (!this.isConfigured) {
      return {
        success: false,
        missingCredentials: true,
        error: `需要配置: APPLE_APP_STORE_API_KEY_ID, APPLE_APP_STORE_ISSUER_ID, APPLE_APP_STORE_PRIVATE_KEY, APPLE_BUNDLE_ID`,
      };
    }
    try {
      const token = this._generateJWT();
      const url   = `${this.baseUrl}/inApps/v1/subscriptions/${originalTransactionId}`;
      const resp  = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      const data = resp.data;

      // 解析 lastTransactions 中最新一条
      let status = null;
      let autoRenewStatus = null;
      let expirationIntent = null;

      const groups = data.data || [];
      for (const group of groups) {
        const txs = group.lastTransactions || [];
        for (const tx of txs) {
          // status: 1=active,2=expired,3=billing_retry,4=grace_period,5=revoked
          if (tx.status !== undefined) status = tx.status;
          if (tx.signedRenewalInfo) {
            const renewalInfo = this._decodeJWSPayload(tx.signedRenewalInfo);
            if (renewalInfo) {
              autoRenewStatus    = renewalInfo.autoRenewStatus;    // 0=cancelled,1=will_renew
              expirationIntent   = renewalInfo.expirationIntent;   // 1=customer_cancelled,2=billing_error,...
            }
          }
        }
      }

      return { success: true, status, autoRenewStatus, expirationIntent, raw: data };
    } catch (err) {
      if (err.response?.status === 404) return { success: false, error: '订阅不存在', notFound: true };
      console.error(`❌ Apple 订阅状态查询失败 [${originalTransactionId}]:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * 通过 transactionId 获取订阅详情（不需要收据，ASAPI 直查）
   * 对于首次购买，transactionId === originalTransactionId，可直接用于查订阅。
   * 用途：客户端收据被截断导致 Apple verifyReceipt 返回 21002 时的降级兜底。
   *
   * @param {string} transactionId  - 客户端上报的 transaction_id（首购时即 originalTransactionId）
   * @param {string} [expectedProductId] - 期望的 Apple product_id（如 'appstore04.99'），用于校验
   * @returns {{
   *   success: boolean,
   *   transactionId?: string,
   *   originalTransactionId?: string,
   *   expiresDateMs?: string,
   *   productId?: string,
   *   appAccountToken?: string,
   *   error?: string,
   *   notFound?: boolean,
   *   missingCredentials?: boolean,
   * }}
   */
  async getTransactionInfo(transactionId, expectedProductId) {
    if (!this.isConfigured) {
      return { success: false, missingCredentials: true, error: 'Apple App Store Server API 未配置' };
    }
    if (!transactionId) {
      return { success: false, error: 'transactionId 为空' };
    }
    try {
      const token = this._generateJWT();
      // 对于首次购买 transactionId === originalTransactionId，可直接调用订阅查询接口
      const url = `${this.baseUrl}/inApps/v1/subscriptions/${transactionId}`;
      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      const groups = resp.data?.data || [];
      for (const group of groups) {
        for (const tx of (group.lastTransactions || [])) {
          // status 1=active, 3=billing_retry, 4=grace_period — 这些都属于仍活跃的订阅
          if (tx.status === 1 || tx.status === 3 || tx.status === 4) {
            const txInfo = this._decodeJWSPayload(tx.signedTransactionInfo);
            if (!txInfo) continue;
            // 若指定了期望的 productId，跳过不匹配的
            if (expectedProductId && txInfo.productId !== expectedProductId) continue;
            const expiresMs = txInfo.expiresDate ? String(txInfo.expiresDate) : null;
            return {
              success: true,
              transactionId:         txInfo.transactionId         || transactionId,
              originalTransactionId: txInfo.originalTransactionId || transactionId,
              expiresDateMs:         expiresMs,
              productId:             txInfo.productId,
              appAccountToken:       txInfo.appAccountToken || null,
              price:                 txInfo.price ?? null,
              priceAmountMicros:     txInfo.priceAmountMicros ?? null,
            };
          }
        }
      }
      return { success: false, error: '未找到活跃订阅' };
    } catch (err) {
      if (err.response?.status === 404) {
        return { success: false, error: '订阅不存在', notFound: true };
      }
      console.error(`❌ [ASAPI] getTransactionInfo 失败 [${transactionId}]:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * 查询退款历史（有退款则返回退款交易列表）
   * @param {string} originalTransactionId
   * @returns {{ success: boolean, hasRefund: boolean, refundCount?: number, error?: string }}
   */
  async getRefundHistory(originalTransactionId) {
    if (!this.isConfigured) {
      return { success: false, missingCredentials: true, error: 'Apple API 未配置' };
    }
    try {
      const token = this._generateJWT();
      const url   = `${this.baseUrl}/inApps/v1/refund/lookup/${originalTransactionId}`;
      const resp  = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      const signed = resp.data?.signedTransactions || [];
      return { success: true, hasRefund: signed.length > 0, refundCount: signed.length };
    } catch (err) {
      // 404 = no refund record（正常情况）
      if (err.response?.status === 404) return { success: true, hasRefund: false, refundCount: 0 };
      console.error(`❌ Apple 退款查询失败 [${originalTransactionId}]:`, err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new AppleAppStoreService();
