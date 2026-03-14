/**
 * 原生MySQL连接池配置
 * 用于需要直接使用SQL查询的场景
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// 创建MySQL连接池
// ⚠️ 安全：所有连接参数必须来自环境变量，禁止硬编码任何默认值
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error('❌ [database_native] 数据库配置缺失！请检查 .env 文件中的 DB_HOST, DB_USER, DB_PASSWORD');
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'bitcoin_mining_master',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 30000, // 连接超时30秒
  timezone: '+00:00' // 使用UTC时区
});

module.exports = pool;
