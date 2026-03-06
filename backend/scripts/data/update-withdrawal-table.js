/**
 * 更新withdrawal_records表结构
 * 扩展user_id字段长度以支持更长的用户ID
 */

require('dotenv').config();
const sequelize = require('../src/config/database');

async function updateTable() {
  try {
    console.log('===== 更新 withdrawal_records 表结构 =====\n');
    
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功\n');

    // 修改user_id字段长度
    console.log('📋 修改 user_id 字段长度: VARCHAR(15) -> VARCHAR(30)');
    await sequelize.query(`
      ALTER TABLE withdrawal_records 
      MODIFY COLUMN user_id VARCHAR(30) NOT NULL COMMENT '用户唯一标识符'
    `);
    console.log('✅ user_id 字段更新成功\n');

    // 修改email字段长度
    console.log('📋 修改 email 字段长度: VARCHAR(30) -> VARCHAR(60)');
    await sequelize.query(`
      ALTER TABLE withdrawal_records 
      MODIFY COLUMN email VARCHAR(60) NOT NULL COMMENT '用户邮箱地址'
    `);
    console.log('✅ email 字段更新成功\n');

    // 验证修改
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
      AND TABLE_NAME = 'withdrawal_records'
      AND COLUMN_NAME = 'user_id'
    `);

    if (columns.length > 0) {
      console.log('📊 字段信息:');
      console.log(`   名称: ${columns[0].COLUMN_NAME}`);
      console.log(`   类型: ${columns[0].COLUMN_TYPE}`);
      console.log(`   注释: ${columns[0].COLUMN_COMMENT}`);
    }

    console.log('\n✅ 表结构更新完成!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 更新失败!');
    console.error(`错误: ${error.message}`);
    process.exit(1);
  }
}

updateTable();
