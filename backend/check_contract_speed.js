const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '47.79.232.189',
  user: 'bitcoin_mining_master',
  password: 'FzFbWmwMptnN3ABE',
  database: 'bitcoin_mining_master'
});

const userId = 'U2026012402243718810';

async function checkDuplicateUpdates() {
  const conn = await pool.getConnection();
  try {
    console.log('\n=== 检查签到合约是否应该有1.36倍加成 ===');
    
    // 查询签到合约详细信息
    const [signInContract] = await conn.query(`
      SELECT 
        id,
        free_contract_type,
        hashrate,
        free_contract_creation_time,
        free_contract_end_time,
        TIMESTAMPDIFF(SECOND, NOW(), free_contract_end_time) as remaining
      FROM free_contract_records 
      WHERE user_id = ? 
        AND free_contract_type = 'daily sign-in free contract'
        AND mining_status = 'mining' 
        AND free_contract_end_time > NOW()
      ORDER BY free_contract_creation_time DESC
      LIMIT 1
    `, [userId]);
    
    if (signInContract.length > 0) {
      const contract = signInContract[0];
      console.log(`\n签到合约ID: ${contract.id}`);
      console.log(`创建时间: ${contract.free_contract_creation_time}`);
      console.log(`结束时间: ${contract.free_contract_end_time}`);
      console.log(`当前速率: ${parseFloat(contract.hashrate).toExponential(5)} BTC/秒`);
      console.log(`剩余时间: ${contract.remaining}秒`);
      
      // 基础速度应该是 0.000000000000139
      const baseSpeed = 0.000000000000139;
      const actualSpeed = parseFloat(contract.hashrate);
      const multiplier = actualSpeed / baseSpeed;
      
      console.log(`\n基础速度: ${baseSpeed.toExponential(5)} BTC/秒`);
      console.log(`当前是基础速度的 ${multiplier.toFixed(2)} 倍`);
      console.log(`预期应该是基础速度的 1.36 倍 (签到加成)`);
      
      if (Math.abs(multiplier - 1.36) < 0.01) {
        console.log('✅ 签到合约速率正确 (1.36倍)');
      } else if (Math.abs(multiplier - 1.0) < 0.01) {
        console.log('❌ 签到合约速率错误：应该是1.36倍，实际只有1.0倍');
      } else {
        console.log(`⚠️  签到合约速率异常：实际是${multiplier.toFixed(2)}倍`);
      }
    } else {
      console.log('没有活跃的签到合约');
    }
    
    // 查询广告合约
    console.log('\n=== 检查广告合约 ===');
    const [adContract] = await conn.query(`
      SELECT 
        id,
        free_contract_type,
        hashrate,
        free_contract_creation_time,
        free_contract_end_time
      FROM free_contract_records 
      WHERE user_id = ? 
        AND free_contract_type = 'ad free contract'
        AND mining_status = 'mining' 
        AND free_contract_end_time > NOW()
      ORDER BY free_contract_creation_time DESC
      LIMIT 1
    `, [userId]);
    
    if (adContract.length > 0) {
      const contract = adContract[0];
      const baseSpeed = 0.000000000000139;
      const actualSpeed = parseFloat(contract.hashrate);
      const multiplier = actualSpeed / baseSpeed;
      
      console.log(`广告合约ID: ${contract.id}`);
      console.log(`当前速率: ${actualSpeed.toExponential(5)} BTC/秒`);
      console.log(`是基础速度的 ${multiplier.toFixed(2)} 倍`);
      console.log(`预期应该是基础速度的 1.0 倍 (无加成)`);
    }
    
    console.log('\n=== 检查用户等级和国家系数 ===');
    
    // 查询用户等级
    const [levelInfo] = await conn.query(`
      SELECT level, speed_multiplier 
      FROM user_level 
      WHERE user_id = ?
    `, [userId]);
    
    if (levelInfo.length > 0) {
      console.log(`用户等级: ${levelInfo[0].level}`);
      console.log(`等级速度倍数: ${levelInfo[0].speed_multiplier}`);
    }
    
    // 查询用户国家
    const [userInfo] = await conn.query(`
      SELECT country 
      FROM user_information 
      WHERE user_id = ?
    `, [userId]);
    
    if (userInfo.length > 0) {
      console.log(`用户国家: ${userInfo[0].country || '未设置'}`);
      
      // 查询国家系数
      if (userInfo[0].country) {
        const [countryInfo] = await conn.query(`
          SELECT mining_multiplier 
          FROM country_mining_multipliers 
          WHERE country_code = ?
        `, [userInfo[0].country]);
        
        if (countryInfo.length > 0) {
          console.log(`国家挖矿系数: ${countryInfo[0].mining_multiplier}`);
        }
      }
    }
    
  } finally {
    conn.release();
    await pool.end();
  }
}

checkDuplicateUpdates();
