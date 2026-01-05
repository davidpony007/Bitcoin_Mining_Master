// 主入口文件，负责初始化 Express 应用、加载中间件、路由、数据库连接及安全配置
// 加载环境变量配置（.env 文件），用于管理敏感信息和环境参数
require('dotenv').config();

// 引入第三方核心模块
const express = require('express'); // Web 框架
const bodyParser = require('body-parser'); // 解析请求体
const cors = require('cors'); // 处理跨域
const timeout = require('connect-timeout'); // 请求超时控制
const morgan = require('morgan'); // HTTP 请求日志
const winston = require('winston'); // 日志管理
const helmet = require('helmet'); // 安全 HTTP 头

// 引入自定义中间件和路由模块
// 已移除限流中间件 rateLimiter（按 IP 易误伤正常用户），如需再次启用可在 middleware 目录恢复
const errorHandler = require('./middleware/errorHandler'); // 全局错误处理，捕获所有异常
const userRoutes = require('./routes/userRoutes'); // 用户相关接口路由
const userInformationRoutes = require('./routes/userInformationRoutes'); // 用户信息接口路由
// const userStatusRoutes = require('./routes/userStatusRoutes'); // 用户状态接口路由 - 暂时禁用,有路由错误
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
const corsOptions = {
  origin: ['http://localhost:3000', 'https://yourdomain.com'], // 允许的前端地址
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // 允许的 HTTP 方法
  allowedHeaders: ['Content-Type', 'Authorization'], // 允许的请求头
  credentials: true // 允许携带 cookie
};
app.use(cors(corsOptions)); // 注册跨域中间件

// 信任代理（Nginx 反向代理后获取真实 IP）
app.set('trust proxy', 1); // 信任第一层代理

// 注册通用中间件
// 全局限流功能已禁用：如需恢复，请重新引入并 app.use(rateLimiter)
app.use(timeout('10s')); // 请求超时 10 秒，防止接口阻塞
app.use(bodyParser.json()); // 解析 JSON 请求体，支持 application/json
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } })); // 记录 HTTP 请求日志到 winston
app.use(helmet()); // 增强 HTTP 头安全，防止常见 Web 攻击

// 注册 API 路由，将不同业务模块分离
app.use('/api/users', userRoutes); // 用户相关接口
app.use('/api/userInformation', userInformationRoutes); // 用户信息表接口
// app.use('/api/userStatus', userStatusRoutes); // 用户状态接口 - 暂时禁用
app.use('/api/mining', miningRoutes); // 挖矿相关接口
app.use('/api/auth', authRoutes); // 认证相关接口
app.use('/api/public', publicRoutes); // 公共信息接口
app.use('/api/admin', adminRoutes); // 管理员相关接口

// 游戏机制路由（新增）
app.use('/api/level', levelRoutes); // 等级系统接口
app.use('/api/checkin', checkInRoutes); // 签到系统接口
app.use('/api/ad', adRoutes); // 广告系统接口
app.use('/api/invitation', invitationRoutes); // 邀请系统接口
app.use('/api/points', pointsRoutes); // 积分系统接口
app.use('/api/country', countryRoutes); // 国家配置接口
app.use('/api/user-settings', userSettingsRoutes); // 用户设置接口
app.use('/api/multiplier', multiplierRoutes); // 倍率系统接口
app.use('/api/country-mining', countryMiningRoutes); // 国家挖矿倍率配置接口

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
const CountryConfigService = require('./services/countryConfigService');
const redisClient = require('./config/redis');
const { startAllScheduledTasks } = require('./jobs/scheduledTasks');

// 初始化游戏机制相关配置
async function initGameMechanics() {
  try {
    console.log('开始初始化游戏机制...');
    
    // 初始化 Redis 连接
    await redisClient.connect();
    console.log('✓ Redis 连接成功');
    
    // 初始化等级配置
    await LevelService.initLevelConfig();
    console.log('✓ 等级配置加载成功');
    
    // 初始化签到奖励配置
    await CheckInService.initRewardConfig();
    console.log('✓ 签到奖励配置加载成功');
    
    // 初始化国家配置
    await CountryConfigService.loadAllConfigs();
    console.log('✓ 国家配置加载成功');
    
    console.log('游戏机制初始化完成！');
  } catch (error) {
    console.error('游戏机制初始化失败:', error);
    throw error;
  }
}

// 启动服务前同步数据库结构，确保所有表已创建
sequelize.sync().then(async () => {
  console.log('数据库已同步');
  
  // 初始化游戏机制
  await initGameMechanics();
  
  // 启动 HTTP 服务，监听指定端口
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    
    // 启动游戏机制定时任务
    startAllScheduledTasks();
    
    // 启动分组余额调度
    // startMiningBalanceScheduler(); // 暂时禁用,等待修复数据库连接问题
    // 启动用户状态调度
    // startUserStatusScheduler(); // 暂时禁用
    console.log('旧调度器已暂时禁用,等待数据库连接稳定后启用');
  });
}).catch(err => {
  // 数据库连接失败时输出错误
  console.error('数据库连接失败:', err);
});

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