const mysql = require('mysql2/promise');
require('dotenv').config();

const userId = 'U2026012402243718810';

async function deleteUserData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('🔍 开始删除用户数据:', userId);
    
    // 获取所有表
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);
    
    console.log('\n📋 数据库中的表:', tableNames.join(', '));
    
    // 先查看每个表中是否有该用户的数据
    console.log('\n🔍 检查各表中的数据...');
    for (const table of tableNames) {
      try {
        // 检查表结构
        const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
        const columnNames = columns.map(col => col.Field);
        
        // 如果表有 user_id 或 userId 列
        if (columnNames.includes('user_id')) {
          const [rows] = await connection.query(`SELECT COUNT(*) as count FROM \`${table}\` WHERE user_id = ?`, [userId]);
          if (rows[0].count > 0) {
            console.log(`  - ${table}: ${rows[0].count} 条记录`);
          }
        } else if (columnNames.includes('userId')) {
          const [rows] = await connection.query(`SELECT COUNT(*) as count FROM \`${table}\` WHERE userId = ?`, [userId]);
          if (rows[0].count > 0) {
            console.log(`  - ${table}: ${rows[0].count} 条记录`);
          }
        }
      } catch (err) {
        // 忽略错误
      }
    }
    
    // 开始删除
    console.log('\n🗑️  开始删除数据...');
    
    await connection.beginTransaction();
    
    // 删除用户相关数据
    const deleteTables = [
      'user_information',
      'user_points',
      'user_status',
      'user_check_in',
      'points_transaction',
      'free_contract_records',
      'mining_contracts',
      'ad_view_record',
      'bitcoin_transaction_records',
      'invitation_relationship',
      'invitation_rebate',
      'user_log',
      'user_orders',
      'withdrawal_records',
    ];
    
    for (const table of deleteTables) {
      try {
        // 检查表是否存在
        if (!tableNames.includes(table)) {
          continue;
        }
        
        // 检查列名
        const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
        const columnNames = columns.map(col => col.Field);
        
        if (columnNames.includes('user_id')) {
          const [result] = await connection.query(`DELETE FROM \`${table}\` WHERE user_id = ?`, [userId]);
          if (result.affectedRows > 0) {
            console.log(`  ✅ ${table}: 删除了 ${result.affectedRows} 条记录`);
          }
        } else if (columnNames.includes('userId')) {
          const [result] = await connection.query(`DELETE FROM \`${table}\` WHERE userId = ?`, [userId]);
          if (result.affectedRows > 0) {
            console.log(`  ✅ ${table}: 删除了 ${result.affectedRows} 条记录`);
          }
        }
      } catch (err) {
        console.log(`  ❌ ${table}: ${err.message}`);
      }
    }
    
    await connection.commit();
    console.log('\n✅ 用户数据删除完成!');
    
  } catch (err) {
    await connection.rollback();
    console.error('❌ 删除失败:', err);
  } finally {
    await connection.end();
  }
}

deleteUserData().catch(console.error);
