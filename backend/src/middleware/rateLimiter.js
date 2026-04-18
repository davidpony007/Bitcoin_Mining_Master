// rateLimiter.js
// 基于 express-rate-limit 的限流中间件
// 防止暴力攻击、DoS 和接口滥用

const rateLimit = require('express-rate-limit');

/**
 * 通用全局限流：每个IP每15分钟最多1000个请求
 * 移动端 App 有多个轮询接口，200/15min 太低，实际正常使用即可触发
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000,
  standardHeaders: true,    // 在响应头返回 RateLimit-* 标准字段
  legacyHeaders: false,
  message: {
    success: false,
    error: '请求过于频繁，请稍后再试',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  // 跳过内部健康检查
  skip: (req) => req.path === '/api/health'
});

/**
 * 认证接口严格限流：每个IP每15分钟最多30次
 * 专用于 /api/auth/* 防止暴力破解
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: '认证请求过于频繁，请15分钟后再试',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

/**
 * 提现接口严格限流：每个IP每小时最多10次
 * 仅限用户侧提现申请接口，管理员路由(/admin/*)自动跳过
 */
const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: '提现请求过于频繁，请1小时后再试',
    code: 'WITHDRAWAL_RATE_LIMIT_EXCEEDED'
  },
  // 管理员操作路由不受限流约束
  skip: (req) => req.path.startsWith('/admin/') || req.path.startsWith('/approve/') || req.path.startsWith('/reject/')
});

/**
 * 管理员登录严格限流：每IP每15分钟最多5次
 * 防止暴力破解管理后台账号
 */
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: '登录尝试过于频繁，请15分钟后再试',
    code: 'ADMIN_LOGIN_RATE_LIMIT_EXCEEDED'
  }
});

module.exports = { globalLimiter, authLimiter, withdrawalLimiter, adminLoginLimiter };

