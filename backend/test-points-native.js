const pool = require('./src/config/database_native');

async function checkPoints() {
  const connection = await pool.getConnection();
  
  try {
    const userId = 'U2026011910532463989';
    
    // 查询用户积分
    const [userRows] = await connection.query(
      'SELECT user_points, user_level FROM user_information WHERE user_id = ?',
      [userId]
    );
    
    console.log('\n===== 用户信息 =====');
    console.log('User ID:', userId);
    console.log('user_points:', userRows[0]?.user_points || 0);
    console.log('user_level:', userRows[0]?.user_level || 1);
    
    // 查询积分交易记录
    const [transRows] = await connection.query(
      'SELECT * FROM points_transaction WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    
    console.log('\n===== 积分交易记录 =====');
    console.log('总记录数:', transRows.length);
    transRows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.points_type}: ${row.points_change > 0 ? '+' : ''}${row.points_change}积分`);
      console.log(`   描述: ${row.description || '无'}`);
      console.log(`   余额: ${row.balance_after}, 时间: ${row.created_at}`);
    });
    
  } finally {
    connection.release();
    await pool.end();
  }
}

checkPoints().catch(console.error);
