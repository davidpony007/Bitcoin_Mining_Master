const pool = require('./src/config/database_native');

async function checkTable() {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.query('DESCRIBE points_transaction');
    console.log('\n===== points_transaction表结构 =====');
    rows.forEach(row => {
      console.log(`${row.Field} - ${row.Type} - ${row.Null} - ${row.Key}`);
    });
    
  } finally {
    connection.release();
    await pool.end();
  }
}

checkTable().catch(console.error);
