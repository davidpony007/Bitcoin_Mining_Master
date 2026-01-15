const sequelize = require('./src/config/database');

async function checkTables() {
  try {
    console.log('=== user_status表字段 ===');
    const [statusCols] = await sequelize.query('DESCRIBE user_status');
    statusCols.forEach(c => console.log(`- ${c.Field}: ${c.Type}`));
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

checkTables();
