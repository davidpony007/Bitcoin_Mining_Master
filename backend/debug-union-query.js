const sequelize = require('./src/config/database');

async function debugQuery() {
  try {
    const now = new Date();
    console.log('当前时间:', now);
    
    // 检查免费合约
    console.log('\n=== 检查免费合约 ===');
    const [freeUsers] = await sequelize.query(`
      SELECT DISTINCT user_id 
      FROM free_contract_records 
      WHERE mining_status = 'mining' 
      AND free_contract_end_time > ?
    `, {
      replacements: [now]
    });
    console.log('免费合约用户:', freeUsers);
    
    // 检查付费合约
    console.log('\n=== 检查付费合约 ===');
    const [paidUsers] = await sequelize.query(`
      SELECT DISTINCT user_id 
      FROM mining_contracts 
      WHERE mining_status = 'mining' 
      AND contract_end_time > ?
    `, {
      replacements: [now]
    });
    console.log('付费合约用户:', paidUsers);
    
    // 使用UNION查询
    console.log('\n=== 使用UNION查询 ===');
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
    console.log('UNION结果:', users);
    console.log('用户数:', users.length);
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

debugQuery();
