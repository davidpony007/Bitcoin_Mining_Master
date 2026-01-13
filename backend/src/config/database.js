// database.js
// 数据库连接配置文件，负责初始化 Sequelize 实例并连接 MySQL 数据库

// 引入 Sequelize ORM，用于操作 MySQL 数据库，ORM全称是 Object-Relational Mapping（对象关系映射）
const { Sequelize } = require('sequelize');

// 创建 Sequelize 实例，配置数据库连接参数
// 优先使用环境变量，便于不同环境部署和安全管理
// 安全：所有敏感信息必须通过环境变量配置，不允许硬编码
const sequelize = new Sequelize(
  process.env.DB_NAME || 'bitcoin_mining_master', // 数据库名
  process.env.DB_USER || 'root',                  // 用户名（默认使用本地root）
  process.env.DB_PASS || '',                      // 密码（必须通过环境变量配置）
  {
    host: process.env.DB_HOST || '127.0.0.1',     // 数据库主机地址（默认本地）
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306, // 端口号
    dialect: 'mysql', // 数据库类型
    logging: false    // 禁止 SQL 日志输出，提升性能
  }
);

// 导出 sequelize 实例，供其他模块（如模型、服务等）使用
module.exports = sequelize;
