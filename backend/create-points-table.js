const sequelize = require('./src/config/database');
const fs = require('fs');

(async () => {
  try {
    console.log('📝 正在创建积分交易记录表...');
    console.log('');
    
    // 读取SQL文件
    const sqlContent = fs.readFileSync('./migrations/create_points_transaction_record.sql', 'utf8');
    
    // 提取CREATE TABLE语句（到第一个ENGINE之后的分号）
    const createTableRegex = /CREATE TABLE[\s\S]*?ENGINE=InnoDB[\s\S]*?;/;
    const match = sqlContent.match(createTableRegex);
    
    if (!match) {
      throw new Error('未找到完整的CREATE TABLE语句');
    }
    
    const createTableSQL = match[0];
    
    console.log('执行SQL语句...');
    await sequelize.query(createTableSQL);
    
    console.log('✅ points_transaction_record 表创建成功！');
    console.log('');
    
    // 验证表是否创建成功
    const [tables] = await sequelize.query("SHOW TABLES LIKE 'points_transaction_record'");
    if (tables.length > 0) {
      console.log('✅ 表已存在于数据库中');
      console.log('');
      
      // 显示表结构
      const [columns] = await sequelize.query('DESCRIBE points_transaction_record');
      console.log('📋 表结构:');
      console.log('');
      columns.forEach(col => {
        const field = col.Field.padEnd(22);
        const type = col.Type.padEnd(25);
        const nullable = (col.Null === 'YES' ? 'NULL' : 'NOT NULL').padEnd(10);
        const key = (col.Key || '').padEnd(5);
        console.log(`   ${field} ${type} ${nullable} ${key}`);
      });
      
      // 统计行数
      const [count] = await sequelize.query('SELECT COUNT(*) as cnt FROM points_transaction_record');
      console.log('');
      console.log(`📊 当前记录数: ${count[0].cnt} 行`);
    }
    
    console.log('');
    console.log('🎉 数据库表创建完成！');
    console.log('');
    console.log('✅ 积分系统现已完整:');
    console.log('   • user_information (用户积分)');
    console.log('   • check_in_record (签到记录)');
    console.log('   • points_transaction_record (积分交易历史) [新建]');
    console.log('   • free_contract_records (合约/电池)');
    console.log('');
    
    process.exit(0);
  } catch (e) {
    console.error('❌ 创建表失败:', e.message);
    console.error('');
    if (e.message.includes('already exists')) {
      console.log('ℹ️  表已经存在，无需重复创建');
      process.exit(0);
    }
    process.exit(1);
  }
})();
