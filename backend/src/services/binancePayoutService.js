/**
 * BinancePayoutService — 通过币安 API 向用户发放 BTC
 *
 * 支持两种打款方式：
 *   1. 链上提现（wallet_address 为普通 BTC 地址）
 *      → POST /sapi/v1/capital/withdraw/apply
 *   2. 币安 UID 转账（wallet_address 为 6~12 位纯数字）
 *      → 需要通过币安 App 手动操作，或接入 Binance Pay 商户 API
 *        本服务会识别并返回 BINANCE_UID 类型，由上层决定处理方式
 *
 * 环境变量（在 .env 或服务器环境中配置）：
 *   BINANCE_API_KEY    — 币安 API Key（需开启"提现"权限 + IP 白名单）
 *   BINANCE_API_SECRET — 币安 API Secret
 *
 * 注意：
 *   - 链上 BTC 提现有最低金额限制（通常 0.001 BTC）
 *   - 每次调用后建议间隔 ≥ 200ms，避免触发速率限制
 *   - 生产环境必须在币安后台将服务器 IP 加入 API 白名单
 */

const crypto = require('crypto');
const axios  = require('axios');

const BINANCE_BASE_URL = 'https://api.binance.com';

// 判断是否为币安 UID（6~12 位纯数字）
function isBinanceUID(address) {
  return /^\d{6,12}$/.test(String(address || '').trim());
}

// HMAC-SHA256 签名
function signQuery(queryString, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(queryString)
    .digest('hex');
}

/**
 * 发起链上 BTC 提现
 *
 * @param {object} opts
 * @param {string}  opts.address       — 目标 BTC 钱包地址
 * @param {number}  opts.amount        — 实际到账金额（已扣手续费，单位 BTC）
 * @param {string} [opts.coin]         — 币种，默认 BTC
 * @param {string} [opts.network]      — 链网络，默认 BTC（也可用 BEP20/TRC20 等）
 * @param {string} [opts.clientOrderId] — 幂等 ID，建议传入 `wd_<dbId>`，防止重复打款
 * @returns {Promise<{ binanceId: string }>}
 */
async function withdrawToAddress({ address, amount, coin = 'BTC', network = 'BTC', clientOrderId }) {
  const apiKey    = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('BINANCE_API_KEY 或 BINANCE_API_SECRET 未配置，请在环境变量中设置');
  }

  const timestamp = Date.now();
  const params = {
    coin,
    address,
    amount:  parseFloat(amount).toFixed(8),
    network,
    timestamp,
  };
  if (clientOrderId) {
    // withdrawOrderId 用作幂等键；相同 ID 重复提交会报错而非重复打款
    params.withdrawOrderId = String(clientOrderId).substring(0, 32);
  }

  const queryString = new URLSearchParams(params).toString();
  const signature   = signQuery(queryString, apiSecret);

  const response = await axios.post(
    `${BINANCE_BASE_URL}/sapi/v1/capital/withdraw/apply`,
    null,
    {
      params:  { ...params, signature },
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 15000,
    }
  );

  return { binanceId: response.data.id };
}

/**
 * 查询提现历史，按 coin 过滤（最近 90 天）
 *
 * @param {string} [coin='BTC']
 * @returns {Promise<Array>}
 */
async function getWithdrawHistory(coin = 'BTC') {
  const apiKey    = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('BINANCE_API_KEY / BINANCE_API_SECRET 未配置');

  const timestamp   = Date.now();
  const params      = { coin, timestamp };
  const queryString = new URLSearchParams(params).toString();
  const signature   = signQuery(queryString, apiSecret);

  const response = await axios.get(
    `${BINANCE_BASE_URL}/sapi/v1/capital/withdraw/history`,
    {
      params:  { ...params, signature },
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 10000,
    }
  );

  return response.data; // 数组
}

/**
 * 验证 API Key 是否有效（查询账户权限）
 * @returns {Promise<{ canWithdraw: boolean, canDeposit: boolean }>}
 */
async function verifyApiKey() {
  const apiKey    = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('BINANCE_API_KEY / BINANCE_API_SECRET 未配置');

  const timestamp   = Date.now();
  const params      = { timestamp };
  const queryString = new URLSearchParams(params).toString();
  const signature   = signQuery(queryString, apiSecret);

  const response = await axios.get(
    `${BINANCE_BASE_URL}/sapi/v1/account/apiRestrictions`,
    {
      params:  { ...params, signature },
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 10000,
    }
  );

  return {
    enableWithdrawals:  !!response.data.enableWithdrawals,
    enableReading:      !!response.data.enableReading,
    ipRestrict:         !!response.data.ipRestrict,
  };
}

module.exports = { withdrawToAddress, getWithdrawHistory, verifyApiKey, isBinanceUID };
