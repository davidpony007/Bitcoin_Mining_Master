// 添加password字段到user_information表
const mysql = require('mysql2/promise');

async function addPasswordColumn() {
  const connection = await mysql.createConnection({
    host: '47.79.232.189',
    port: 3306,
    user: 'bitcoin_mining_master',
    password: 'FzFbWmwMptnN3ABE',
    database: 'bitcoin_mining_master'
  });

  try {
    console.log('📊 正在检查password字段是否存在...');
    
    // 检查字段是否已存在
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'bitcoin_mining_master' 
        AND TABLE_NAME = 'user_information' 
        AND COLUMN_NAME = 'password'
    `);

    if (columns.length > 0) {
      console.log('✅ password字段已存在，无需添加');
    } else {
      console.log('➕ 添加password字段到user_information表...');
      
      await connection.query(`
        ALTER TABLE user_information 
        ADD COLUMN password VARCHAR(255) NULL 
        COMMENT '用户密码(bcrypt加密)' 
        AFTER email
      `);
      
      console.log('✅ password字段添加成功！');
    }

  } catch (error) {
    console.error('❌ 操作失败:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// 执行迁移
addPasswordColumn()
  .then(() => {
    console.log('✅ 数据库迁移完成');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ 数据库迁移失败:', err);
    process.exit(1);
  });
