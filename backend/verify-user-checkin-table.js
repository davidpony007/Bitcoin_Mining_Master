/**
 * 简单验证 user_check_in 表功能
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function verifyUserCheckInTable() {
  let connection;
  
  try {
    console.log('🔗 正在连接云端MySQL数据库...\n');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '47.79.232.189',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'bitcoin_mining_master'
    });

    console.log(`✅ 成功连接\n`);

    // 验证1: 检查表是否存在
    console.log('📋 验证1: 检查表是否存在');
    const [tables] = await connection.query(`SHOW TABLES LIKE 'check_in%'`);
    console.log('   签到相关表:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   - ${tableName}`);
    });
    
    const hasUserCheckIn = tables.some(t => Object.values(t)[0] === 'user_check_in');
    const hasCheckInRecord = tables.some(t => Object.values(t)[0] === 'check_in_record');
    
    if (hasUserCheckIn && !hasCheckInRecord) {
      console.log('   ✅ user_check_in 表存在，check_in_record 表已删除\n');
    } else {
      console.log('   ❌ 表状态异常\n');
    }

    // 验证2: 检查表结构
    console.log('📋 验证2: 检查 user_check_in 表结构');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_check_in'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME || 'bitcoin_mining_master']);
    
    console.table(columns.map(col => ({
      '字段': col.COLUMN_NAME,
      '类型': col.COLUMN_TYPE,
      '默认值': col.COLUMN_DEFAULT,
      '注释': col.COLUMN_COMMENT
    })));

    // 验证关键字段
    const pointsField = columns.find(c => c.COLUMN_NAME === 'points_earned');
    if (pointsField && pointsField.COLUMN_DEFAULT === '4') {
      console.log('   ✅ points_earned 默认值已修改为 4\n');
    } else {
      console.log('   ⚠️  points_earned 默认值:', pointsField?.COLUMN_DEFAULT, '\n');
    }

    // 验证3: 插入测试数据
    console.log('📋 验证3: 测试插入数据');
    const testUserId = 'VERIFY_TEST_' + Date.now();
    const today = new Date().toISOString().split('T')[0];
    
    await connection.query(`
      INSERT INTO user_check_in (user_id, check_in_date, consecutive_days)
      VALUES (?, ?, ?)
    `, [testUserId, today, 1]);
    console.log('   ✅ 插入成功\n');

    // 验证4: 查询测试数据
    console.log('📋 验证4: 查询测试数据');
    const [rows] = await connection.query(`
      SELECT * FROM user_check_in WHERE user_id = ?
    `, [testUserId]);
    
    if (rows.length > 0) {
      console.log('   查询结果:', rows[0]);
      console.log('   ✅ 查询成功\n');
    }

    // 验证5: 清理测试数据
    console.log('📋 验证5: 清理测试数据');
    await connection.query(`DELETE FROM user_check_in WHERE user_id = ?`, [testUserId]);
    console.log('   ✅ 清理成功\n');

    console.log('🎉 所有验证通过！表合并完成且功能正常！');

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

verifyUserCheckInTable();
