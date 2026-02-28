/**
 * 数据库迁移脚本：添加 android_id 和 invitation_code 唯一索引
 * 执行方式：node backend/migrations/run_20260124_add_unique_indexes.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;

async function runMigration() {
  let connection;
  
  try {
    console.log('🔗 连接数据库...');
    console.log(`   主机: ${process.env.DB_HOST}`);
    console.log(`   数据库: ${process.env.DB_NAME}`);
    
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log('✅ 数据库连接成功\n');

    // 1. 检查重复的 android_id
    console.log('1️⃣ 检查重复的 android_id...');
    const [duplicateAndroidIds] = await connection.query(`
      SELECT android_id, COUNT(*) as count
      FROM user_information
      WHERE android_id IS NOT NULL AND android_id != ''
      GROUP BY android_id
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateAndroidIds.length > 0) {
      console.log('   ⚠️ 发现重复的 android_id:');
      duplicateAndroidIds.forEach(row => {
        console.log(`      ${row.android_id}: ${row.count} 条记录`);
      });
      
      // 清理重复数据（保留最早的记录）
      console.log('   🧹 清理重复数据...');
      await connection.query(`
        DELETE t1 FROM user_information t1
        INNER JOIN user_information t2 
        WHERE t1.id > t2.id 
          AND t1.android_id = t2.android_id
          AND t1.android_id IS NOT NULL
          AND t1.android_id != ''
      `);
      console.log('   ✅ 重复数据已清理');
    } else {
      console.log('   ✅ 无重复的 android_id\n');
    }

    // 2. 检查重复的 invitation_code
    console.log('2️⃣ 检查重复的 invitation_code...');
    const [duplicateInvCodes] = await connection.query(`
      SELECT invitation_code, COUNT(*) as count
      FROM user_information
      WHERE invitation_code IS NOT NULL AND invitation_code != ''
      GROUP BY invitation_code
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateInvCodes.length > 0) {
      console.log('   ⚠️ 发现重复的 invitation_code:');
      duplicateInvCodes.forEach(row => {
        console.log(`      ${row.invitation_code}: ${row.count} 条记录`);
      });
      console.log('   ❌ 请手动处理重复的邀请码！');
      process.exit(1);
    } else {
      console.log('   ✅ 无重复的 invitation_code\n');
    }

    // 3. 删除旧索引
    console.log('3️⃣ 删除旧索引...');
    try {
      await connection.query('DROP INDEX idx_android_id ON user_information');
      console.log('   ✅ 删除 idx_android_id');
    } catch (err) {
      console.log('   ℹ️ idx_android_id 不存在');
    }
    
    try {
      await connection.query('DROP INDEX idx_invitation_code ON user_information');
      console.log('   ✅ 删除 idx_invitation_code');
    } catch (err) {
      console.log('   ℹ️ idx_invitation_code 不存在');
    }
    console.log('');

    // 4. 扩展 android_id 字段长度
    console.log('4️⃣ 扩展 android_id 字段长度...');
    await connection.query(`
      ALTER TABLE user_information
      MODIFY COLUMN android_id VARCHAR(255) NULL
      COMMENT 'Android设备ID（支持长指纹）'
    `);
    console.log('   ✅ android_id 字段已扩展到 VARCHAR(255)\n');

    // 5. 添加 android_id 唯一索引
    console.log('5️⃣ 添加 android_id 唯一索引...');
    await connection.query(`
      CREATE UNIQUE INDEX idx_android_id_unique 
      ON user_information(android_id)
    `);
    console.log('   ✅ idx_android_id_unique 创建成功\n');

    // 6. 添加 invitation_code 唯一索引
    console.log('6️⃣ 添加 invitation_code 唯一索引...');
    await connection.query(`
      CREATE UNIQUE INDEX idx_invitation_code_unique 
      ON user_information(invitation_code)
    `);
    console.log('   ✅ idx_invitation_code_unique 创建成功\n');

    // 7. 添加其他索引
    console.log('7️⃣ 添加其他索引...');
    const indexes = [
      { name: 'idx_gaid', column: 'gaid' },
      { name: 'idx_register_ip', column: 'register_ip' },
      { name: 'idx_country', column: 'country' },
      { name: 'idx_user_creation_time', column: 'user_creation_time' }
    ];
    
    for (const index of indexes) {
      try {
        await connection.query(`CREATE INDEX ${index.name} ON user_information(${index.column})`);
        console.log(`   ✅ ${index.name} 创建成功`);
      } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME') {
          console.log(`   ℹ️ ${index.name} 已存在`);
        } else {
          throw err;
        }
      }
    }
    console.log('');

    // 8. 验证索引
    console.log('8️⃣ 验证索引...');
    const [indexes_result] = await connection.query('SHOW INDEX FROM user_information');
    console.log('   当前索引列表:');
    const uniqueIndexes = indexes_result.filter(idx => idx.Non_unique === 0);
    const normalIndexes = indexes_result.filter(idx => idx.Non_unique === 1);
    
    console.log('\n   唯一索引:');
    [...new Set(uniqueIndexes.map(idx => idx.Key_name))].forEach(name => {
      const cols = uniqueIndexes.filter(idx => idx.Key_name === name).map(idx => idx.Column_name);
      console.log(`      ${name} (${cols.join(', ')})`);
    });
    
    console.log('\n   普通索引:');
    [...new Set(normalIndexes.map(idx => idx.Key_name))].forEach(name => {
      const cols = normalIndexes.filter(idx => idx.Key_name === name).map(idx => idx.Column_name);
      console.log(`      ${name} (${cols.join(', ')})`);
    });
    console.log('');

    // 9. 显示表结构
    console.log('9️⃣ 验证字段结构...');
    const [columns] = await connection.query('DESCRIBE user_information');
    const androidIdCol = columns.find(col => col.Field === 'android_id');
    const invCodeCol = columns.find(col => col.Field === 'invitation_code');
    
    console.log(`   android_id: ${androidIdCol.Type} ${androidIdCol.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    console.log(`   invitation_code: ${invCodeCol.Type} ${invCodeCol.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    console.log('');

    console.log('✅ 迁移完成！');
    console.log('\n📋 迁移总结:');
    console.log('   ✅ android_id 唯一索引已添加');
    console.log('   ✅ invitation_code 唯一索引已添加');
    console.log('   ✅ android_id 字段长度已扩展到 255');
    console.log('   ✅ 查询性能索引已添加');
    console.log('\n⚠️ 下一步:');
    console.log('   1. 更新 Sequelize 模型代码');
    console.log('   2. 更新 authController.js 使用 findOrCreate');
    console.log('   3. 重启应用并测试');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    console.error('   错误详情:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行迁移
runMigration();
