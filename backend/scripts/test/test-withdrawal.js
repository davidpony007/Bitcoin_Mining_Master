/**
 * 测试提现功能
 */

require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');
const sequelize = require('../src/config/database');

async function testWithdrawal() {
  try {
    console.log('===== 测试提现功能 =====\n');
    
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功\n');

    // 1. 检查表结构
    console.log('📋 检查withdrawal_records表结构:');
    const [fields] = await sequelize.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'withdrawal_records'
      AND COLUMN_NAME IN ('user_id', 'email')
    `);
    
    fields.forEach(field => {
      console.log(`   ${field.COLUMN_NAME}: ${field.COLUMN_TYPE}`);
    });
    console.log('');

    // 2. 测试插入数据
    const testUserId = 'U2026011910532463989';
    const testEmail = `${testUserId}@cloudminingtool.com`;
    
    console.log('🧪 测试插入数据:');
    console.log(`   user_id: ${testUserId} (长度: ${testUserId.length})`);
    console.log(`   email: ${testEmail} (长度: ${testEmail.length})`);
    
    try {
      await sequelize.query(`
        INSERT INTO withdrawal_records 
        (user_id, email, wallet_address, withdrawal_request_amount, network_fee, received_amount, withdrawal_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, {
        replacements: [
          testUserId,
          testEmail,
          '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          0.01,
          0.0000079,
          0.0099921,
          'pending'
        ],
        type: QueryTypes.INSERT
      });
      console.log('✅ 插入成功!\n');
      
      // 查询刚插入的记录
      const [records] = await sequelize.query(`
        SELECT id, user_id, email, withdrawal_status, withdrawal_request_amount
        FROM withdrawal_records
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 1
      `, {
        replacements: [testUserId]
      });
      
      console.log('📊 插入的记录:');
      console.log(JSON.stringify(records[0], null, 2));
      
    } catch (error) {
      console.log('❌ 插入失败:', error.message);
    }

    console.log('\n✅ 测试完成!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败!');
    console.error(`错误: ${error.message}`);
    process.exit(1);
  }
}

testWithdrawal();
