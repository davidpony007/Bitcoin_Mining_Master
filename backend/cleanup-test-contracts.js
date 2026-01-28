/**
 * 清除测试用户的合约数据
 * 用于删除修复前创建的错误合约（4小时而非2小时）
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function cleanupTestContracts() {
  let connection;
  
  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('✅ 数据库连接成功\n');
    
    const userId = 'U202601262124161924';
    
    // 1. 查询当前合约记录
    console.log('📋 查询当前合约记录...');
    const [contracts] = await connection.query(
      `SELECT id, user_id, free_contract_type, free_contract_creation_time, free_contract_end_time, 
              TIMESTAMPDIFF(HOUR, free_contract_creation_time, free_contract_end_time) as duration_hours 
       FROM free_contract_records 
       WHERE user_id = ? 
       ORDER BY free_contract_creation_time DESC`,
      [userId]
    );
    
    if (contracts.length === 0) {
      console.log('⚠️  未找到该用户的合约记录\n');
      return;
    }
    
    console.log(`\n找到 ${contracts.length} 条合约记录:\n`);
    console.table(contracts.map(c => ({
      ID: c.id,
      类型: c.free_contract_type,
      开始时间: c.free_contract_creation_time.toLocaleString('zh-CN'),
      结束时间: c.free_contract_end_time.toLocaleString('zh-CN'),
      时长: `${c.duration_hours} 小时`
    })));
    
    // 2. 删除合约记录
    console.log('\n🗑️  开始删除合约记录...');
    const [deleteResult] = await connection.query(
      'DELETE FROM free_contract_records WHERE user_id = ?',
      [userId]
    );
    
    console.log(`✅ 已删除 ${deleteResult.affectedRows} 条记录\n`);
    
    // 3. 验证删除
    const [afterDelete] = await connection.query(
      'SELECT COUNT(*) as count FROM free_contract_records WHERE user_id = ?',
      [userId]
    );
    
    console.log('✅ 验证结果:');
    console.log(`   剩余合约记录: ${afterDelete[0].count} 条`);
    
    if (afterDelete[0].count === 0) {
      console.log('\n✨ 测试数据清理完成！');
      console.log('现在可以让用户重新观看广告测试 2 小时合约创建功能\n');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('📌 数据库连接已关闭');
    }
  }
}

// 执行清理
cleanupTestContracts().catch(err => {
  console.error('执行失败:', err);
  process.exit(1);
});
