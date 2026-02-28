// rateLimiter.js (deprecated)
// 已废弃：为避免误伤共享出口用户，限流功能被移除。
// 为保证历史引用不崩溃，这里导出一个“无操作”中间件。

function rateLimiter(_req, _res, next) {
  // 直接放行，不做任何计算或拦截
  return next();
}

module.exports = rateLimiter;
