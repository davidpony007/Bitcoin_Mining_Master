// 主入口文件，负责初始化 Express 应用、加载中间件、路由、数据库连接及安全配置
// 加载环境变量配置（.env 文件），用于管理敏感信息和环境参数
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 验证关键环境变量
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error('❌ 严重错误：数据库配置缺失！');
  console.error('请检查 backend/.env 文件中的配置：');
  console.error({
    DB_HOST: process.env.DB_HOST || '❌ 未设置',
    DB_USER: process.env.DB_USER || '❌ 未设置',
    DB_PASSWORD: process.env.DB_PASSWORD ? '✅ 已设置' : '❌ 未设置',
    DB_NAME: process.env.DB_NAME || '❌ 未设置'
  });
  process.exit(1);
}

// 仅在开发环境打印连接信息，生产环境不暴露数据库地址
if (process.env.NODE_ENV !== 'production') {
  console.log('✅ 环境变量加载成功:', {
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT
  });
} else {
  console.log('✅ 环境变量加载成功（生产环境，连接信息已隐藏）');
}

// 引入第三方核心模块
const express = require('express'); // Web 框架
const bodyParser = require('body-parser'); // 解析请求体
const cors = require('cors'); // 处理跨域
const timeout = require('connect-timeout'); // 请求超时控制
const morgan = require('morgan'); // HTTP 请求日志
const winston = require('winston'); // 日志管理
const helmet = require('helmet'); // 安全 HTTP 头

// 引入自定义中间件和路由模块
// 限流中间件：防止暴力攻击和接口滥用（可选：若 express-rate-limit 未安装则降级为无限流）
let globalLimiter, authLimiter, withdrawalLimiter;
try {
  ({ globalLimiter, authLimiter, withdrawalLimiter } = require('./middleware/rateLimiter'));
} catch (e) {
  console.warn('⚠️ [rateLimiter] express-rate-limit 未安装，限流功能已禁用:', e.message);
  const passthrough = (req, res, next) => next();
  globalLimiter = authLimiter = withdrawalLimiter = passthrough;
}
const errorHandler = require('./middleware/errorHandler'); // 全局错误处理，捕获所有异常
const userRoutes = require('./routes/userRoutes'); // 用户相关接口路由
const userInformationRoutes = require('./routes/userInformationRoutes'); // 用户信息接口路由
const userStatusRoutes = require('./routes/userStatusRoutes'); // 用户状态接口路由
const miningRoutes = require('./routes/miningRoutes'); // 挖矿相关接口路由
const authRoutes = require('./routes/authRoutes'); // 认证相关接口路由
const publicRoutes = require('./routes/publicRoutes'); // 公共信息接口路由
const adminRoutes = require('./routes/adminRoutes'); // 管理员相关接口路由

// 游戏机制路由（新增）
const levelRoutes = require('./routes/levelRoutes'); // 等级系统接口路由
const checkInRoutes = require('./routes/checkInRoutes'); // 签到系统接口路由
const adRoutes = require('./routes/adRoutes'); // 广告系统接口路由
const invitationRoutes = require('./routes/invitationRoutes'); // 邀请系统接口路由
const pointsRoutes = require('./routes/pointsRoutes'); // 积分系统接口路由
const countryRoutes = require('./routes/countryRoutes'); // 国家配置接口路由
const userSettingsRoutes = require('./routes/userSettingsRoutes'); // 用户设置接口路由
const multiplierRoutes = require('./routes/multiplierRoutes'); // 倍率系统接口路由
const countryMiningRoutes = require('./routes/countryMiningRoutes'); // 国家挖矿倍率配置路由
const miningContractRoutes = require('./routes/miningContractRoutes'); // 挖矿合约路由（广告、签到、邀请）
const paidContractRoutes = require('./routes/paidContractRoutes'); // 付费合约路由
const paymentRoutes = require('./routes/paymentRoutes'); // IAP支付验证路由
const contractStatusRoutes = require('./routes/contractStatusRoutes'); // 合约状态检查路由
const balanceRoutes = require('./routes/balanceRoutes'); // 余额相关接口路由（实时余额、挖矿速率）
const miningPoolRoutes = require('./routes/miningPoolRoutes'); // Mining Pool路由（电池增加挖矿时间）
const dailyCheckInRoutes = require('./routes/dailyCheckInRoutes'); // 每日签到路由
const bitcoinRoutes = require('./routes/bitcoinRoutes'); // 比特币价格路由
const withdrawalRoutes = require('./routes/withdrawalRoutes'); // 提现相关路由
const bitcoinTransactionRoutes = require('./routes/bitcoinTransactionRoutes'); // 比特币交易记录路由
const appConfigRoutes = require('./routes/appConfigRoutes'); // App版本配置路由
const pushNotificationRoutes = require('./routes/pushNotificationRoutes'); // 推送通知接口

// 数据库相关配置，使用 Sequelize ORM 连接 MySQL 数据库
const sequelize = require('./config/database');
// const User = require('./models/user'); // 已移除，无需 user.js 文件

// 创建 winston 日志器，支持文件和控制台输出
const logger = winston.createLogger({
  level: 'info', // 日志级别
  format: winston.format.combine(
    winston.format.timestamp(), // 添加时间戳
    winston.format.json() // JSON 格式输出
  ),
  transports: [
    // 错误日志输出到 logs/error.log
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // 所有日志输出到 logs/combined.log
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
// 开发环境下输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

// 初始化 Express 应用
const app = express();
// 端口号优先使用环境变量 PORT，否则默认 8888
const PORT = process.env.PORT || 8888;

// 跨域配置，允许指定来源、方法、头部等，提升安全性
// 生产环境请替换为实际的前端域名
const corsOptions = {
  origin: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',') 
    : ['http://localhost:3000'], // 开发环境默认允许本地前端
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // 允许的 HTTP 方法
  allowedHeaders: ['Content-Type', 'Authorization'], // 允许的请求头
  credentials: true // 允许携带 cookie
};
app.use(cors(corsOptions)); // 注册跨域中间件

// 信任代理（Nginx 反向代理后获取真实 IP）
app.set('trust proxy', 1); // 信任第一层代理

// 注册通用中间件
app.use(globalLimiter);  // 全局限流：每IP每15分钟200次
app.use(timeout('55s')); // 请求超时 55 秒（payment验证需调用Apple API两次，从国内到Apple服务器网络延迟可达20s+/次，需充分余量；nginx proxy_read_timeout=60s）
app.use(bodyParser.json({ limit: '1mb' })); // 全局限制 1MB，防止大载荷 DoS
app.use('/api/payment', bodyParser.json({ limit: '50mb' })); // IAP 收据最大可达 10MB+，仅支付路由放开至 50MB
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } })); // 记录 HTTP 请求日志到 winston
app.use(helmet()); // 增强 HTTP 头安全，防止常见 Web 攻击

// 注册 API 路由，将不同业务模块分离
app.use('/api/users', userRoutes); // 用户相关接口
app.use('/api/user', userRoutes); // 用户相关接口（单数形式）
app.use('/api/userInformation', userInformationRoutes); // 用户信息表接口
app.use('/api/userStatus', userStatusRoutes); // 用户状态接口
app.use('/api/mining', miningRoutes); // 挖矿相关接口
app.use('/api/auth', authRoutes); // 认证相关接口（登录类路由在 authRoutes.js 内单独限流）
app.use('/api/withdrawal', withdrawalLimiter, withdrawalRoutes); // 提现接口（含严格限流：每IP每小时10次）
app.use('/api/public', publicRoutes); // 公共信息接口
app.use('/api/admin', adminRoutes); // 管理员相关接口

// 游戏机制路由（新增）
app.use('/api/level', levelRoutes); // 等级系统接口
app.use('/api/checkin', checkInRoutes); // 签到系统接口 - 已启用（表结构验证通过）
app.use('/api/check-in', dailyCheckInRoutes); // 每日签到挖矿合约接口
app.use('/api/ad', adRoutes); // 广告系统接口
app.use('/api/invitation', invitationRoutes); // 邀请系统接口
app.use('/api/points', pointsRoutes); // 积分系统接口
app.use('/api/country', countryRoutes); // 国家配置接口
app.use('/api/user-settings', userSettingsRoutes); // 用户设置接口
app.use('/api/multiplier', multiplierRoutes); // 倍率系统接口
app.use('/api/country-mining', countryMiningRoutes); // 国家挖矿倍率配置接口
app.use('/api/mining-contracts', miningContractRoutes); // 挖矿合约接口（广告、签到、邀请）
app.use('/api/paid-contracts', paidContractRoutes); // 付费合约接口
app.use('/api/payment', paymentRoutes); // IAP支付验证接口（Android + iOS）
app.use('/api/contract-status', contractStatusRoutes); // 合约状态检查接口
app.use('/api/balance', balanceRoutes); // 余额相关接口（实时余额查询、挖矿速率查询、缓存清理）
app.use('/api/mining-pool', miningPoolRoutes); // Mining Pool接口（使用电池增加挖矿时间）
app.use('/api/bitcoin', bitcoinRoutes); // 比特币价格接口
// /api/withdrawal 已在上方含限流版本注册，此处不重复注册
app.use('/api/bitcoin-transactions', bitcoinTransactionRoutes); // 比特币交易记录接口
app.use('/api/app', appConfigRoutes); // App版本配置接口（公开，客户端启动时调用）
app.use('/api/notifications', pushNotificationRoutes); // 推送通知接口（token注册、活跃上报）

// 健康检查接口，检测数据库连接状态，便于监控和自动化运维
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate(); // 检查数据库连接
    res.json({ status: 'ok', db: 'connected', timestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// 处理 404 未找到，所有未匹配路由均返回 JSON 错误
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 全局错误处理，捕获所有未处理异常，统一返回格式
app.use(errorHandler);

// 挖矿余额调度逻辑
// const { startMiningBalanceScheduler } = require('./utils/miningBalance');
// 用户状态调度逻辑
// const { startUserStatusScheduler } = require('./utils/userStatusScheduler');

// 游戏机制服务初始化
const LevelService = require('./services/levelService');
const CheckInService = require('./services/checkInService');
const CountryMiningService = require('./services/countryMiningService');
const bitcoinPriceService = require('./services/bitcoinPriceService'); // 比特币价格服务
const redisClient = require('./config/redis');
const { startAllScheduledTasks } = require('./jobs/scheduledTasks');
const BalanceSyncTask = require('./jobs/balanceSyncTask');
const { startNotificationCronJobs } = require('./jobs/notificationCronJob');
const ReferralRebateTask = require('./jobs/referralRebateTask');

// 初始化游戏机制相关配置
async function initGameMechanics() {
  try {
    logger.info('开始初始化游戏机制...');
    
    // 初始化 Redis 连接
    await redisClient.connect();
    logger.info('✓ Redis 连接成功');
    
    // 初始化等级配置
    await LevelService.initLevelConfig();
    logger.info('✓ 等级配置加载成功');
    
    // 不需要初始化旧的CheckInService配置（使用新的CheckInPointsService，无需预加载配置）
    // CheckInService.initRewardConfig() 已废弃
    
    // 初始化国家挖矿配置
    const configs = await CountryMiningService.getAllConfigs({ activeOnly: true });
    logger.info(`✓ 国家挖矿配置加载成功，共 ${configs.length} 个国家`);
    
    // 启动比特币价格自动更新（每小时更新一次）
    bitcoinPriceService.startAutoUpdate();
    logger.info('✓ 比特币价格自动更新已启动');
    
    logger.info('游戏机制初始化完成！');
  } catch (error) {
    logger.error('游戏机制初始化失败:', error);
    throw error;
  }
}

// 启动服务前同步数据库结构，确保所有表已创建
// sequelize.sync().then(async () => {
//   logger.info('数据库已同步');
  
//   // 初始化游戏机制
//   await initGameMechanics();
  
//   // 启动 HTTP 服务，监听指定端口
//   app.listen(PORT, '0.0.0.0', () => {
//     logger.info(`Server is running on 0.0.0.0:${PORT}`);
    
//     // 启动游戏机制定时任务
//     startAllScheduledTasks();
    
//     // 启动余额同步和返利定时任务 - 暂时禁用以避免数据库连接池耗尽
//     // BalanceSyncTask.start();
//     // logger.info('✓ 余额同步任务已启动（每2小时执行一次）');

// ⚠️ 临时禁用Sequelize sync，直接启动服务（已改用原生MySQL连接池）
(async () => {
  try {
    logger.info('使用原生MySQL连接池，跳过Sequelize sync');
    
    // 初始化游戏机制
    await initGameMechanics();
    
    // 启动 HTTP 服务，监听指定端口
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server is running on 0.0.0.0:${PORT}`);
      
      // 启动游戏机制定时任务
      startAllScheduledTasks();
      
      // 启动返利定时任务
      ReferralRebateTask.start();
      logger.info('✓ 推荐返利任务已启动（每2小时执行一次）');

      // 启动余额同步定时任务（每2小时写入 mining_reward 交易记录）
      BalanceSyncTask.start();
      logger.info('✓ 余额同步任务已启动（每2小时执行一次）');

      // 启动推送通知定时任务（合约到期、签到提醒、沉默召回）
      startNotificationCronJobs();
      logger.info('✓ 推送通知定时任务已启动');
    
    // 旧调度器已废弃
    logger.info('旧调度器已暂时禁用,等待数据库连接稳定后启用');
    });
  } catch (err) {
    // 数据库连接失败时输出错误
    logger.error('服务启动失败:', err);
    process.exit(1);
  }
})();

// 安全防护说明：
// SQL注入防护：
// 1. 使用 Sequelize 等 ORM 自动防止 SQL 注入
// 2. 不要拼接 SQL 字符串，所有查询都用参数化
// 3. 用户输入需校验和过滤，防止恶意数据

// XSS/CSRF 防护：
// 1. 对用户输入进行转义和校验，防止跨站脚本攻击
// 2. 前端渲染时使用安全模板，避免注入
// 3. 建议集成 helmet 中间件增强安全性

// 代码示例：集成 helmet
// const helmet = require('helmet');
// app.use(helmet()); // 增强 HTTP 头安全