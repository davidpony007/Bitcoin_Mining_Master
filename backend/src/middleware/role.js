// role.js
// 角色权限校验中间件，用于保护需要特定角色（如 admin）的接口

/**
 * 生成角色校验中间件
 * @param {string} requiredRole - 需要的角色（如 'admin'）
 * @returns {function} Express 中间件
 *
 * 用法：router.get('/admin', requireRole('admin'), handler)
 * 依赖于 req.user（通常由 auth 中间件注入）
 *
 * 安全建议：
 * - req.user 必须可信，不能被用户伪造
 * - 生产环境建议配合 JWT 签名和数据库校验
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    // 检查用户是否已认证
    if (!req.user) {
      return res.status(401).json({ error: '未认证用户' });
    }
    // 检查用户角色是否匹配
    if (req.user.role !== requiredRole) {
      return res.status(403).json({ error: '无权限访问，需要' + requiredRole + '角色' });
    }
    next();
  };
}

/**
 * 管理员权限校验中间件
 * 用法：router.post('/admin/users', authenticate, requireAdmin, handler)
 */
function requireAdmin(req, res, next) {
  // 检查用户是否已认证
  if (!req.user) {
    return res.status(401).json({ error: '未认证用户' });
  }
  // 检查是否为管理员角色
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

module.exports = { requireRole, requireAdmin };
