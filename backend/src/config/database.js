// database.js
// 数据库连接配置文件，负责初始化 Sequelize 实例并连接 MySQL 数据库

// 加载环境变量
require('dotenv').config();

// 引入 Sequelize ORM，用于操作 MySQL 数据库，ORM全称是 Object-Relational Mapping（对象关系映射）
const { Sequelize } = require('sequelize');

// 验证必需的环境变量
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error('❌ 数据库配置缺失！请检查 .env 文件中的 DB_HOST, DB_USER, DB_PASSWORD');
  console.error('当前配置:', {
    DB_HOST: process.env.DB_HOST || '未设置',
    DB_USER: process.env.DB_USER || '未设置',
    DB_PASSWORD: process.env.DB_PASSWORD ? '已设置' : '未设置',
    DB_NAME: process.env.DB_NAME || '未设置'
  });
}

// 创建 Sequelize 实例，配置数据库连接参数
// 优先使用环境变量，便于不同环境部署和安全管理
// 安全：所有敏感信息必须通过环境变量配置，不允许硬编码
const sequelize = new Sequelize(
  process.env.DB_NAME || 'bitcoin_mining_master', // 数据库名
  process.env.DB_USER,                            // 用户名（从环境变量读取）
  process.env.DB_PASSWORD || process.env.DB_PASS, // 密码（从环境变量读取）
  {
    host: process.env.DB_HOST,                    // 数据库主机地址（从环境变量读取）
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306, // 端口号
    dialect: 'mysql', // 数据库类型
    logging: false,   // 禁止 SQL 日志输出，提升性能
    timezone: '+00:00', // 设置为UTC时区，确保时间处理一致性
    pool: {
      max: 10,        // 最大连接数
      min: 0,         // 最小连接数
      acquire: 30000, // 连接超时时间 (ms)
      idle: 10000     // 连接空闲超时 (ms)
    },
    dialectOptions: {
      connectTimeout: 10000  // MySQL 连接超时 (ms)
    }
  }
);

console.log('✅ Sequelize 配置加载成功:', {
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER
});

// 导出 sequelize 实例，供其他模块（如模型、服务等）使用
module.exports = sequelize;
