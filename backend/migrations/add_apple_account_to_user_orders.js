/**
 * 数据库迁移脚本：向 user_orders 表添加 apple_account 字段
 * 执行方式：node backend/migrations/add_apple_account_to_user_orders.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function runMigration() {
  let connection;
  try {
    console.log('🔗 连接数据库...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    console.log('✅ 数据库连接成功\n');

    // 检查字段是否已存在
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_orders' AND COLUMN_NAME = 'apple_account'`,
      [process.env.DB_NAME]
    );

    if (cols.length > 0) {
      console.log('ℹ️  apple_account 字段已存在，跳过迁移');
      return;
    }

    // 在 google_account 之后添加 apple_account
    await connection.query(
      `ALTER TABLE user_orders
       ADD COLUMN apple_account VARCHAR(100) DEFAULT NULL COMMENT '用户Apple账号'
       AFTER google_account`
    );
    console.log('✅ 成功添加 apple_account 字段到 user_orders 表');
  } catch (err) {
    console.error('❌ 迁移失败:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
