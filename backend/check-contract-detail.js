const sequelize = require('./src/config/database');

async function checkContract() {
  try {
    const [contracts] = await sequelize.query(`
      SELECT 
        user_id, 
        free_contract_type, 
        mining_status, 
        free_contract_creation_time, 
        free_contract_end_time, 
        hashrate,
        NOW() as now_time
      FROM free_contract_records 
      WHERE free_contract_type = 'ad free contract' 
      ORDER BY free_contract_creation_time DESC 
      LIMIT 1
    `);
    
    if (contracts.length > 0) {
      console.log('最新创建的广告合约:');
      console.log(contracts[0]);
      console.log('\n合约状态分析:');
      console.log(`- 挖矿状态: ${contracts[0].mining_status}`);
      console.log(`- 创建时间: ${contracts[0].free_contract_creation_time}`);
      console.log(`- 结束时间: ${contracts[0].free_contract_end_time}`);
      console.log(`- 当前时间: ${contracts[0].now_time}`);
      console.log(`- 是否过期: ${new Date(contracts[0].free_contract_end_time) < new Date(contracts[0].now_time)}`);
    } else {
      console.log('未找到广告合约');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

checkContract();
