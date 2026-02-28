const sequelize = require('./src/config/database');

async function checkActiveUsers() {
  try {
    const now = new Date();
    
    const users = await sequelize.query(`
      SELECT DISTINCT user_id
      FROM (
        SELECT DISTINCT user_id 
        FROM free_contract_records 
        WHERE mining_status = 'mining' 
        AND free_contract_end_time > ?
        
        UNION
        
        SELECT DISTINCT user_id 
        FROM mining_contracts 
        WHERE mining_status = 'mining' 
        AND contract_end_time > ?
      ) AS active_users
    `, {
      replacements: [now, now],
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('活跃挖矿用户数:', users.length);
    console.log('用户列表:', users);
    
    if (users.length > 0) {
      // 检查第一个用户的合约详情
      const testUserId = users[0].user_id;
      console.log(`\n检查用户 ${testUserId} 的合约详情:`);
      
      const [freeContracts] = await sequelize.query(`
        SELECT * FROM free_contract_records 
        WHERE user_id = '${testUserId}' 
        AND mining_status = 'mining' 
        AND free_contract_end_time > NOW()
      `);
      
      console.log('免费合约:', freeContracts);
      
      const [paidContracts] = await sequelize.query(`
        SELECT * FROM mining_contracts 
        WHERE user_id = '${testUserId}' 
        AND mining_status = 'mining' 
        AND contract_end_time > NOW()
      `);
      
      console.log('付费合约:', paidContracts);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

checkActiveUsers();
