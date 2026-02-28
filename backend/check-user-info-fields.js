require('dotenv').config();
const {Sequelize} = require('sequelize');
const seq = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST, 
  port: process.env.DB_PORT, 
  dialect: 'mysql', 
  logging: false
});

(async()=>{
  await seq.authenticate();
  const [cols]=await seq.query(`
    SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA='bitcoin_mining_master' 
    AND TABLE_NAME='user_information' 
    ORDER BY ORDINAL_POSITION
  `);
  
  console.log('\n===== user_information 表所有字段 =====\n');
  cols.forEach(c=>console.log(`- ${c.COLUMN_NAME}: ${c.COLUMN_TYPE} (${c.COLUMN_COMMENT||'无注释'})`));
  
  const hasPoints = cols.find(c => c.COLUMN_NAME.includes('point'));
  const hasLevel = cols.find(c => c.COLUMN_NAME.includes('level'));
  
  console.log('\n===== 检查结果 =====');
  console.log(hasPoints ? `✅ 找到积分字段: ${hasPoints.COLUMN_NAME}` : '❌ 未找到积分字段');
  console.log(hasLevel ? `✅ 找到等级字段: ${hasLevel.COLUMN_NAME}` : '❌ 未找到等级字段');
  
  await seq.close();
  process.exit(0);
})().catch(e=>{
  console.error(e.message); 
  process.exit(1);
});
