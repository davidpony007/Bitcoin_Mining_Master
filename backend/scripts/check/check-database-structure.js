/**
 * 检查云端数据库实际结构
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

async function checkStructure() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功\n');

    // 获取所有表
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME, TABLE_COMMENT
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
      ORDER BY TABLE_NAME
    `);

    console.log('===== 数据库表列表 =====\n');
    for (const table of tables) {
      console.log(`📋 ${table.TABLE_NAME}`);
      console.log(`   注释: ${table.TABLE_COMMENT || '(无)'}\n`);

      // 获取该表的所有字段
      const [columns] = await sequelize.query(`
        SELECT 
          COLUMN_NAME,
          COLUMN_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          EXTRA,
          COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
        AND TABLE_NAME = '${table.TABLE_NAME}'
        ORDER BY ORDINAL_POSITION
      `);

      console.log('   字段:');
      for (const col of columns) {
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        const extra = col.EXTRA ? `(${col.EXTRA})` : '';
        const comment = col.COLUMN_COMMENT || '(无注释)';
        console.log(`   - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} ${nullable} ${extra}`);
        console.log(`     注释: ${comment}`);
      }
      console.log('');
    }

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

checkStructure();
