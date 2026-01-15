const sequelize = require('./src/config/database');

async function checkUserInfoColumns() {
  try {
    const [cols] = await sequelize.query('DESCRIBE user_information');
    console.log('user_information表字段:');
    cols.forEach(c => console.log(`- ${c.Field}: ${c.Type}`));
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

checkUserInfoColumns();
