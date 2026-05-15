// auth.js
// JWT 认证中间件：从请求头读取 Bearer Token，校验合法性，并把解码后的用户信息放到 req.user
const jwt = require('jsonwebtoken'); // 引入 jsonwebtoken 库，用于生成与校验 JWT
const redisClient = require('../config/redis');
const pool = require('../config/database_native');

// 活跃心跳：每5分钟最多写库一次，利用 Redis NX+TTL 做分布式限流
async function _updateActiveTime(userId) {
  try {
    const key = `active:hb:${userId}`;
    // SET key 1 EX 300 NX —— 只在 key 不存在时设置，避免5分钟内重复写库
    const set = redisClient.isReady()
      ? await redisClient.client.set(key, '1', 'EX', 300, 'NX')
      : 'OK'; // Redis 不可用时退化为每次都写库
    if (set === 'OK') {
      pool.query(
        'UPDATE user_status SET last_login_time = NOW() WHERE user_id = ?',
        [userId]
      ).catch(() => {});
    }
  } catch (_) {}
}

/**
 * JWT 认证中间件
 * 1. 从 Authorization 头获取 Bearer Token
 * 2. 校验 Token 是否存在
 * 3. 校验 Token 是否有效（用 JWT_SECRET）
 * 4. 校验通过后将用户信息挂载到 req.user
 * 5. 校验失败返回 401/403/500
 */
function authenticateToken(req, res, next) { // 定义中间件函数（req：请求、res：响应、next：下一个处理器）
  const authHeader = req.headers['authorization']; // 从请求头里获取 Authorization 字段（理论格式："Bearer <token>"）

  const token = authHeader && authHeader.split(' ')[1]; // 如果有 Authorization 时按空格切分，取第二段作为 token；否则为 undefined
  if (!token) return res.status(401).json({ error: '未提供Token' }); // 若没带 token，返回 401 未授权

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('❌ [auth] 环境变量 JWT_SECRET 未设置！请在 .env 中配置强随机密钥。');
    return res.status(500).json({ error: '服务器配置错误' });
  }
  jwt.verify(token, secret, (err, user) => { // 用密钥校验 token（会同时解码出 payload）回调里的 user 就是 token 里携带的 payload 对象
    if (err) {
      // Token 过期：返回 401，前端会自动跳转到登录页
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token已过期，请重新登录' });
      }
      // Token 被篡改或签名不符：返回 403
      return res.status(403).json({ error: 'Token无效' });
    }
    req.user = user; // 如果校验通过：把解码出来的用户信息挂到 req.user，后面的路由可以直接用。
    // 非阻塞心跳：任何已认证请求都视作用户活跃，每5分钟更新一次 last_login_time
    if (user && user.user_id) {
      _updateActiveTime(user.user_id);
    }
    next(); // 放行：交给后面的中间件或路由处理
  });
}

module.exports = authenticateToken; // 导出中间件函数，供路由使用

/**
 * 可选 JWT 认证中间件（用于 verify-purchase 等端点）
 * - 有有效 token：解码并挂载 req.user，供业务层做用户身份绑定校验
 * - 无 token 或 token 无效/过期：直接放行，req.user 保持 undefined
 *   安全性由 purchase_token（Google Play）/ receipt（Apple）本身保障
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next(); // 无 token，直接放行

  const secret = process.env.JWT_SECRET;
  if (!secret) return next(); // 配置缺失，不阻断

  jwt.verify(token, secret, (err, user) => {
    if (!err) req.user = user; // 只在有效时挂载
    next(); // 无论成功/失败都放行
  });
}

module.exports.optionalAuth = optionalAuth;
