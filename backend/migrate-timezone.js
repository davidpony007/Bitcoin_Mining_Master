/**
 * 数据库迁移脚本 - 添加国家倍率字段
 * 直接连接云端 MySQL 执行
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  console.log('==================== 数据库迁移开始 ====================\n');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  console.log('✅ 已连接到云端 MySQL:', process.env.DB_HOST);
  console.log('数据库:', process.env.DB_NAME);
  console.log('\n开始执行迁移...\n');

  try {
    // 检查字段是否已存在
    console.log('📋 检查 country_multiplier 字段是否存在...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'user_information'
        AND COLUMN_NAME = 'country_multiplier'
    `, [process.env.DB_NAME]);

    if (columns.length === 0) {
      // 添加 country_multiplier 字段
      console.log('\n➕ 添加 country_multiplier 字段...');
      await connection.execute(`
        ALTER TABLE user_information 
        ADD COLUMN country_multiplier DECIMAL(4,2) DEFAULT 1.00 
        COMMENT '国家挖矿速度倍率,默认1.00'
      `);
      console.log('✅ country_multiplier 字段添加成功');
    } else {
      console.log('⏭️  country_multiplier 字段已存在,跳过添加');
    }

    // 验证字段
    console.log('\n📋 验证字段配置...');
    const [fieldInfo] = await connection.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'user_information'
        AND COLUMN_NAME = 'country_multiplier'
    `, [process.env.DB_NAME]);

    if (fieldInfo.length > 0) {
      const col = fieldInfo[0];
      console.log('\n字段配置:');
      console.log(`  字段名: ${col.COLUMN_NAME}`);
      console.log(`  类型: ${col.COLUMN_TYPE}`);
      console.log(`  默认值: ${col.COLUMN_DEFAULT}`);
      console.log(`  注释: ${col.COLUMN_COMMENT}`);
    }

    // 更新已有用户的默认值
    console.log('\n🔄 更新已有用户的默认倍率...');
    const [updateResult] = await connection.execute(`
      UPDATE user_information 
      SET country_multiplier = 1.00 
      WHERE country_multiplier IS NULL
    `);
    console.log(`✅ 更新了 ${updateResult.affectedRows} 条记录`);

    // 显示当前用户倍率分布
    console.log('\n📊 当前用户倍率分布:');
    const [stats] = await connection.execute(`
      SELECT country_multiplier, COUNT(*) as count 
      FROM user_information 
      GROUP BY country_multiplier 
      ORDER BY country_multiplier DESC
    `);
    stats.forEach(row => {
      console.log(`  倍率 ${row.country_multiplier}x: ${row.count} 个用户`);
    });

    console.log('\n==================== 迁移完成 ✅ ====================');

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('\n连接已关闭');
    process.exit(0);
  }
}

migrate();
