/**
 * 查询数据库中的所有表
 */

require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);

async function showTables() {
  try {
    const tables = await sequelize.query('SHOW TABLES', { type: QueryTypes.SELECT });
    console.log('\n数据库中的所有表：');
    tables.forEach((row, i) => {
      const tableName = Object.values(row)[0];
      console.log(`${i + 1}. ${tableName}`);
    });
    
    await sequelize.close();
  } catch (error) {
    console.error('查询失败:', error.message);
    await sequelize.close();
  }
}

showTables();
