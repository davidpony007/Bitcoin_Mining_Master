const mysql = require('mysql2/promise');
require('dotenv').config();

async function createUser() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const userId = 'U2026012402243718810';
  
  try {
    // 检查用户是否存在
    const [existing] = await connection.execute(
      'SELECT * FROM user_status WHERE user_id = ?',
      [userId]
    );

    if (existing.length > 0) {
      console.log('✅ 用户状态已存在');
      console.log(JSON.stringify(existing[0], null, 2));
    } else {
      console.log('📝 创建用户状态记录...');
      await connection.execute(`
        INSERT INTO user_status (
          user_id,
          current_bitcoin_balance,
          bitcoin_accumulated_amount,
          total_invitation_rebate,
          total_withdrawal_amount,
          last_login_time,
          user_status,
          last_balance_update_time
        ) VALUES (?, 0, 0, 0, 0, NOW(), 'active within 3 days', NOW())
      `, [userId]);
      
      console.log('✅ 用户状态创建成功!');
      
      // 读取创建的记录
      const [newRecord] = await connection.execute(
        'SELECT * FROM user_status WHERE user_id = ?',
        [userId]
      );
      console.log(JSON.stringify(newRecord[0], null, 2));
    }
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

createUser();
