require('dotenv').config();
const sequelize = require('./src/config/database');

console.log('');
console.log('=== 系统集成检查 ===');
console.log('');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    
    const tables = ['user_information', 'free_contract_records', 'check_in_record', 'points_transaction_record'];
    
    console.log('');
    console.log('数据库表检查:');
    for (const table of tables) {
      try {
        const [rows] = await sequelize.query(`SELECT COUNT(*) as cnt FROM ${table} LIMIT 1`);
        console.log(`  ✅ ${table}: ${rows[0].cnt} 行`);
      } catch (e) {
        console.log(`  ❌ ${table}: 不存在`);
      }
    }
    
    console.log('');
    process.exit(0);
  } catch (e) {
    console.error('❌ 错误:', e.message);
    process.exit(1);
  }
})();
