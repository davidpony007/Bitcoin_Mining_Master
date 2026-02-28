/**
 * 原生MySQL连接池配置
 * 用于需要直接使用SQL查询的场景
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// 创建MySQL连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || '47.79.232.189',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'fe2c82a2e5b8e2a3',
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
