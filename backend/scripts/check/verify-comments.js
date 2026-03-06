/**
 * 快速验证数据库注释
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);

async function verifyComments() {
  try {
    await sequelize.authenticate();
    
    // 查询所有表的注释
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME, TABLE_COMMENT
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
      AND TABLE_COMMENT != ''
      ORDER BY TABLE_NAME
    `);

    console.log('✅ 已添加中文注释的表:\n');
    tables.forEach(t => {
      console.log(`📋 ${t.TABLE_NAME}: ${t.TABLE_COMMENT}`);
    });

    // 随机抽查几个表的字段注释
    const sampleTables = ['user_information', 'bitcoin_transaction_records', 'user_status'];
    
    console.log('\n\n✅ 字段注释示例:\n');
    
    for (const tableName of sampleTables) {
      console.log(`\n📋 ${tableName}:`);
      const [cols] = await sequelize.query(`
        SELECT COLUMN_NAME, COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
        AND TABLE_NAME = '${tableName}'
        AND COLUMN_COMMENT != ''
        ORDER BY ORDINAL_POSITION
        LIMIT 5
      `);
      
      cols.forEach(c => {
        console.log(`   ${c.COLUMN_NAME}: ${c.COLUMN_COMMENT}`);
      });
    }

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

verifyComments();
