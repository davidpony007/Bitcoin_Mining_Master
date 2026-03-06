// 测试比特币交易记录功能
require('dotenv').config();
const sequelize = require('../src/config/database');
const { QueryTypes } = require('sequelize');

async function testTransactionRecords() {
  try {
    console.log('🧪 开始测试交易记录功能...\n');

    const userId = 'U2026011910532463989';

    // 1. 插入测试交易记录
    console.log('📝 步骤1: 插入测试交易记录...');
    
    const testRecords = [
      {
        user_id: userId,
        transaction_type: 'paid contract',
        transaction_amount: '0.000012345678901234',
        transaction_status: 'success'
      },
      {
        user_id: userId,
        transaction_type: 'daily sign-in free contract',
        transaction_amount: '0.000001234567890123',
        transaction_status: 'success'
      },
      {
        user_id: userId,
        transaction_type: 'subordinate rebate',
        transaction_amount: '0.000000123456789012',
        transaction_status: 'success'
      },
      {
        user_id: userId,
        transaction_type: 'withdrawal',
        transaction_amount: '0.015000000000000000',
        transaction_status: 'success'
      }
    ];

    for (const record of testRecords) {
      await sequelize.query(
        `INSERT INTO bitcoin_transaction_records 
         (user_id, transaction_type, transaction_amount, transaction_status, transaction_creation_time)
         VALUES (:user_id, :transaction_type, :transaction_amount, :transaction_status, NOW())`,
        {
          replacements: record,
          type: QueryTypes.INSERT
        }
      );
      console.log(`  ✅ 插入 ${record.transaction_type} 记录`);
    }

    // 2. 查询测试记录
    console.log('\n📊 步骤2: 查询交易记录...');
    const records = await sequelize.query(
      `SELECT 
        id,
        user_id,
        transaction_type,
        transaction_amount,
        transaction_status,
        transaction_creation_time
       FROM bitcoin_transaction_records
       WHERE user_id = :userId
       ORDER BY transaction_creation_time DESC
       LIMIT 10`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT
      }
    );

    console.log(`  找到 ${records.length} 条记录：`);
    records.forEach(record => {
      console.log(`  📄 ID: ${record.id}`);
      console.log(`     类型: ${record.transaction_type}`);
      console.log(`     金额: ${record.transaction_amount} BTC`);
      console.log(`     状态: ${record.transaction_status}`);
      console.log(`     时间: ${record.transaction_creation_time}`);
      console.log('');
    });

    // 3. 测试API端点
    console.log('🌐 步骤3: 测试API端点...');
    console.log('  请运行以下命令测试API:');
    console.log(`  curl "http://localhost:8888/api/bitcoin-transactions/records?userId=${userId}&limit=10" | jq '.'`);
    console.log('');

    // 4. 统计信息
    const [stats] = await sequelize.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN transaction_type IN ('ad free contract', 'daily sign-in free contract', 'invitation free contract', 'paid contract') THEN transaction_amount ELSE 0 END) as total_mining,
        SUM(CASE WHEN transaction_type = 'subordinate rebate' THEN transaction_amount ELSE 0 END) as total_rebate,
        SUM(CASE WHEN transaction_type = 'withdrawal' AND transaction_status = 'success' THEN transaction_amount ELSE 0 END) as total_withdrawal
       FROM bitcoin_transaction_records
       WHERE user_id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT
      }
    );

    console.log('📈 统计信息:');
    console.log(`  总记录数: ${stats.total}`);
    console.log(`  挖矿总收益: ${parseFloat(stats.total_mining).toFixed(18)} BTC`);
    console.log(`  返利总收益: ${parseFloat(stats.total_rebate).toFixed(18)} BTC`);
    console.log(`  提现总额: ${parseFloat(stats.total_withdrawal).toFixed(18)} BTC`);

    console.log('\n✅ 测试完成！');
    process.exit(0);

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testTransactionRecords();
