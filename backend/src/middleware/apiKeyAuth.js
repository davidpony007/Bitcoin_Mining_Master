/**
 * 轻量级API密钥认证中间件
 * 用于保护公开API，防止恶意调用
 */

const crypto = require('crypto');

// API密钥配置（生产环境应该从环境变量读取）
const API_KEYS = {
  // 移动应用密钥
  'mobile_app': process.env.API_KEY_MOBILE || 'btc_mining_app_2026_secret_key_v1',
};

// 请求签名验证（可选，更安全）
const ENABLE_SIGNATURE = process.env.ENABLE_API_SIGNATURE === 'true';

/**
 * 简单API Key验证
 * 客户端在请求头中添加: X-API-Key: xxx
 */
function simpleApiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key is required',
      code: 'MISSING_API_KEY'
    });
  }

  // 验证API Key
  const validKey = Object.values(API_KEYS).includes(apiKey);
  
  if (!validKey) {
    console.warn(`❌ Invalid API key attempt: ${apiKey.substring(0, 10)}...`);
    return res.status(403).json({
      success: false,
      message: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  next();
}

/**
 * 请求签名验证（更安全的方案）
 * 
 * 客户端需要：
 * 1. 生成timestamp
 * 2. 计算签名: HMAC-SHA256(timestamp + user_id + api_key)
 * 3. 在请求头添加: 
 *    X-API-Key: xxx
 *    X-Timestamp: xxx
 *    X-Signature: xxx
 */
function signatureAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const timestamp = req.headers['x-timestamp'];
  const signature = req.headers['x-signature'];
  const userId = req.body.user_id || req.query.user_id;

  // 基础验证
  if (!apiKey || !timestamp || !signature || !userId) {
    return res.status(401).json({
      success: false,
      message: 'Missing authentication parameters',
      code: 'MISSING_AUTH_PARAMS'
    });
  }

  // 验证API Key存在
  const validKey = Object.values(API_KEYS).includes(apiKey);
  if (!validKey) {
    return res.status(403).json({
      success: false,
      message: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  // 验证时间戳（防重放攻击）
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  const timeDiff = Math.abs(now - requestTime);
  
  // 允许5分钟的时间差
  if (timeDiff > 5 * 60 * 1000) {
    return res.status(401).json({
      success: false,
      message: 'Request expired',
      code: 'REQUEST_EXPIRED'
    });
  }

  // 验证签名
  const expectedSignature = crypto
    .createHmac('sha256', apiKey)
    .update(`${timestamp}:${userId}`)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.warn(`❌ Invalid signature for user: ${userId}`);
    return res.status(403).json({
      success: false,
      message: 'Invalid signature',
      code: 'INVALID_SIGNATURE'
    });
  }

  next();
}

/**
 * 导出中间件（根据配置选择验证方式）
 */
module.exports = ENABLE_SIGNATURE ? signatureAuth : simpleApiKeyAuth;
module.exports.simpleApiKeyAuth = simpleApiKeyAuth;
module.exports.signatureAuth = signatureAuth;
module.exports.API_KEYS = API_KEYS;
