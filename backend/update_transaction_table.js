// 修改bitcoin_transaction_records表的user_id字段长度
require('dotenv').config();
const sequelize = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function updateTableStructure() {
  try {
    console.log('🔧 开始修改bitcoin_transaction_records表结构...\n');

    // 1. 删除UNIQUE索引（如果存在）
    console.log('📝 步骤1: 删除user_id的UNIQUE索引...');
    try {
      await sequelize.query('ALTER TABLE bitcoin_transaction_records DROP INDEX user_id', {
        type: QueryTypes.RAW
      });
      console.log('  ✅ UNIQUE索引已删除');
    } catch (e) {
      console.log('  ℹ️ UNIQUE索引不存在或已删除');
    }

    // 2. 修改user_id字段长度从VARCHAR(15)改为VARCHAR(25)
    console.log('\n📝 步骤2: 修改user_id字段长度...');
    await sequelize.query(
      'ALTER TABLE bitcoin_transaction_records MODIFY COLUMN user_id VARCHAR(25) NOT NULL',
      { type: QueryTypes.RAW }
    );
    console.log('  ✅ user_id字段长度已更新为VARCHAR(25)');

    // 3. 添加普通索引（不是UNIQUE）
    console.log('\n📝 步骤3: 添加user_id的普通索引...');
    try {
      await sequelize.query(
        'ALTER TABLE bitcoin_transaction_records ADD INDEX idx_user_id_tx (user_id)',
        { type: QueryTypes.RAW }
      );
      console.log('  ✅ 普通索引已添加');
    } catch (e) {
      console.log('  ℹ️ 索引已存在');
    }

    // 4. 验证修改
    console.log('\n📊 验证表结构:');
    const [structure] = await sequelize.query(
      "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'bitcoin_mining_master' AND TABLE_NAME = 'bitcoin_transaction_records' AND COLUMN_NAME = 'user_id'",
      { type: QueryTypes.SELECT }
    );
    console.log('  user_id字段结构:', structure);

    console.log('\n✅ 表结构修改完成！');
    process.exit(0);

  } catch (error) {
    console.error('❌ 修改失败:', error);
    process.exit(1);
  }
}

// 运行修改
updateTableStructure();
