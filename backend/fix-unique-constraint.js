/**
 * 删除withdrawal_records表上user_id字段的UNIQUE约束
 */

const pool = require('./src/config/database_native');

async function fixUniqueConstraint() {
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    console.log('🔍 检查withdrawal_records表结构...');
    
    // 1. 查看表的创建语句
    const [createTableResult] = await connection.query('SHOW CREATE TABLE withdrawal_records');
    console.log('\n当前表结构:');
    console.log(createTableResult[0]['Create Table']);
    
    // 2. 查看所有索引
    const [indexes] = await connection.query('SHOW INDEX FROM withdrawal_records');
    console.log('\n当前索引:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.Key_name}: ${idx.Column_name} (Non_unique: ${idx.Non_unique})`);
    });
    
    // 3. 查找UNIQUE约束
    const uniqueIndexes = indexes.filter(idx => idx.Non_unique === 0 && idx.Key_name !== 'PRIMARY');
    
    if (uniqueIndexes.length === 0) {
      console.log('\n✅ 没有找到需要删除的UNIQUE约束');
      return;
    }
    
    console.log('\n📝 找到以下UNIQUE约束:');
    const uniqueKeyNames = [...new Set(uniqueIndexes.map(idx => idx.Key_name))];
    uniqueKeyNames.forEach(keyName => {
      console.log(`  - ${keyName}`);
    });
    
    // 4. 删除user_id相关的UNIQUE约束
    for (const keyName of uniqueKeyNames) {
      const relatedColumns = uniqueIndexes.filter(idx => idx.Key_name === keyName);
      const hasUserId = relatedColumns.some(idx => idx.Column_name === 'user_id');
      
      if (hasUserId) {
        console.log(`\n🔧 正在删除UNIQUE约束: ${keyName}...`);
        try {
          await connection.query(`ALTER TABLE withdrawal_records DROP INDEX ${keyName}`);
          console.log(`✅ 成功删除: ${keyName}`);
        } catch (error) {
          console.error(`❌ 删除失败: ${error.message}`);
        }
      }
    }
    
    // 5. 验证结果
    const [newIndexes] = await connection.query('SHOW INDEX FROM withdrawal_records');
    console.log('\n✅ 修改后的索引:');
    newIndexes.forEach(idx => {
      console.log(`  - ${idx.Key_name}: ${idx.Column_name} (Non_unique: ${idx.Non_unique})`);
    });
    
    console.log('\n🎉 UNIQUE约束删除完成！');
    
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

fixUniqueConstraint();
