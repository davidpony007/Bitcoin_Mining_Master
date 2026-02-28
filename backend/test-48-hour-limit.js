/**
 * 测试48小时限制
 */
const pool = require('./src/config/database_native');

async function test() {
  try {
    const userId = 'U2026011910532463989';
    
    console.log('🧪 测试48小时限制...\n');
    
    // 1. 查询当前合约状态
    const [contracts] = await pool.query(
      `SELECT id, free_contract_end_time, 
              TIMESTAMPDIFF(SECOND, NOW(), free_contract_end_time) as remaining_seconds
       FROM free_contract_records 
       WHERE user_id = ? 
       AND free_contract_type = 'ad free contract'
       AND mining_status = 'mining' 
       AND free_contract_end_time > NOW()
       ORDER BY free_contract_creation_time DESC
       LIMIT 1`,
      [userId]
    );
    
    if (contracts.length > 0) {
      const remainingSeconds = contracts[0].remaining_seconds;
      const remainingHours = Math.floor(remainingSeconds / 3600);
      const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
      
      console.log('📊 当前合约状态:');
      console.log(`   剩余时间: ${remainingHours}小时${remainingMinutes}分钟 (${remainingSeconds}秒)`);
      console.log(`   电池数量: ${Math.ceil(remainingSeconds / 3600)}`);
      console.log(`   是否已满: ${remainingSeconds >= 48 * 3600 ? '是 ⚠️' : '否'}\n`);
      
      if (remainingSeconds >= 48 * 3600) {
        console.log('⚠️ 电池槽已满（≥48小时），无法继续增加时间');
      } else {
        const canAddHours = Math.floor((48 * 3600 - remainingSeconds) / 3600);
        console.log(`✅ 还可以增加 ${canAddHours} 小时`);
      }
    } else {
      console.log('📊 当前没有活跃合约');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    process.exit(0);
  }
}

test();
