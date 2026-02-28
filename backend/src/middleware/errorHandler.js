// errorHandler.js                                         // 文件名：全局错误处理中间件
// 作用：捕获所有未处理异常，规范日志与响应格式，避免错误信息泄露到客户端

/**                                                        // 开始定义错误处理中间件（必须 4 个参数，Express 才识别）
 * 全局错误处理中间件（Express 约定签名：err, req, res, next） // 约定四参：err 异常对象，req 请求，res 响应，next 下一个处理器
 * - 记录错误日志，便于排查                                 // 统一记录错误，方便定位问题
 * - 根据错误类型与环境返回合适的状态码与消息                // 对已知错误给出更准确的状态码
 * - 避免在生产环境泄露内部堆栈与实现细节                    // 保护安全
 */
function errorHandler(err, req, res, _next) {              // 将 next 命名为 _next 表示可能不直接使用，但保持签名完整
  if (res.headersSent) {                                   // 如果响应头已发送，说明部分响应已写入
    return _next(err);                                     // 交由默认错误处理（避免重复写入响应导致错误）
  }

  let status = err?.status || err?.statusCode || 500;      // 优先使用错误自带的状态码，否则默认为 500（服务器错误）

  if ((err?.name === 'JsonWebTokenError'                   // 针对常见 JWT 错误类型（签名错误/格式错误）
    || err?.name === 'TokenExpiredError') && status < 400) {
    status = 401;                                          // 若未设置状态码，则默认使用 401 未认证
  }

  if ((err?.name || '').startsWith('Sequelize')            // 针对常见数据库校验/唯一约束等客户端错误
    && status < 400) {
    status = 400;                                          // 视为 400 请求不合法
  }

  const isProd = process.env.NODE_ENV === 'production';    // 判断是否生产环境，用于控制信息暴露
  const clientMsg = (status >= 500 && isProd)              // 生产环境且服务端错误：隐藏内部细节
    ? '服务器内部错误'                                      // 给出通用错误提示
    : (err?.message || '请求处理失败');                    // 非生产或非 5xx：返回具体报错信息

  // 结构化错误日志，包含关键信息，便于追踪（不要把这些敏感信息回传给客户端）
  console.error('服务器错误:', {                            // 统一使用对象打印，方便日志收集系统解析
    method: req?.method,                                   // HTTP 方法
    url: req?.originalUrl || req?.url,                     // 请求路径
    status,                                                // 返回的状态码
    message: err?.message,                                 // 错误消息
    name: err?.name,                                       // 错误类型名称
    code: err?.code,                                       // 业务/系统错误码（若有）
    stack: err?.stack                                      // 堆栈信息（仅日志，不返回客户端）
  });

  const payload = { error: clientMsg };                    // 基本响应体：只暴露安全、必要的信息
  if (!isProd && status >= 500 && err?.name) {             // 在非生产环境且 5xx 时，可附加少量调试信息
    payload.details = err.name;                            // 附上错误类型名称，便于本地调试
  }

  return res.status(status).json(payload);                 // 按计算出的状态码与安全消息返回 JSON 响应
}

module.exports = errorHandler;                             // 导出中间件供 app.use(...) 挂载
