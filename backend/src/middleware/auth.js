// auth.js
// JWT 认证中间件：从请求头读取 Bearer Token，校验合法性，并把解码后的用户信息放到 req.user
const jwt = require('jsonwebtoken'); // 引入 jsonwebtoken 库，用于生成与校验 JWT

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

  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  jwt.verify(token, secret, (err, user) => { // 用密钥校验 token（会同时解码出 payload）回调里的 user 就是 token 里携带的 payload 对象
    if (err) return res.status(403).json({ error: 'Token无效' }); // 如果校验失败（例如过期/被篡改/不匹配），则返回 403（禁止访问）
    req.user = user; // 如果校验通过：把解码出来的用户信息挂到 req.user，后面的路由可以直接用。
    next(); // 放行：交给后面的中间件或路由处理
  });
}

module.exports = authenticateToken; // 导出中间件函数，供路由使用
