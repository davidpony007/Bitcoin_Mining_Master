const sequelize = require('./src/config/database');

async function checkTimeZone() {
  try {
    // 使用NOW()作为对比
    console.log('=== 使用 NOW() 查询 ===');
    const [withNow] = await sequelize.query(`
      SELECT 
        user_id,
        free_contract_end_time,
        NOW() as current_db_time,
        CASE 
          WHEN free_contract_end_time > NOW() THEN 'active'
          ELSE 'expired'
        END as status
      FROM free_contract_records 
      WHERE mining_status = 'mining'
      AND free_contract_type = 'ad free contract'
      ORDER BY free_contract_creation_time DESC
      LIMIT 1
    `);
    
    if (withNow.length > 0) {
      console.log('合约状态:', withNow[0]);
    } else {
      console.log('未找到挖矿中的合约');
    }
    
    // 直接查询不用时间比较
    console.log('\n=== 不用时间比较查询 ===');
    const [contracts] = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM free_contract_records 
      WHERE mining_status = 'mining'
    `);
    console.log('挖矿中的合约数:', contracts[0].total);
    
    // 使用NOW()的UNION查询
    console.log('\n=== 使用NOW()的UNION查询 ===');
    const [activeUsers] = await sequelize.query(`
      SELECT DISTINCT user_id
      FROM (
        SELECT DISTINCT user_id 
        FROM free_contract_records 
        WHERE mining_status = 'mining' 
        AND free_contract_end_time > NOW()
        
        UNION
        
        SELECT DISTINCT user_id 
        FROM mining_contracts 
        WHERE mining_status = 'mining' 
        AND contract_end_time > NOW()
      ) AS active_users
    `);
    console.log('活跃用户:', activeUsers);
    console.log('用户数:', activeUsers.length);
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

checkTimeZone();
