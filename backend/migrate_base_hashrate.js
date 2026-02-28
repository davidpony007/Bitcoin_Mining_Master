/**
 * 数据迁移脚本：为现有合约填充 base_hashrate 字段
 */

const sequelize = require('./src/config/database');

async function migrateData() {
  try {
    console.log('========================================');
    console.log('开始数据迁移：填充 base_hashrate 字段');
    console.log('========================================\n');

    // 1. 迁移免费合约
    console.log('1. 迁移免费合约...');
    const [freeResult] = await sequelize.query(`
      UPDATE free_contract_records 
      SET 
        base_hashrate = 0.000000000000139,
        has_daily_bonus = CASE 
          WHEN free_contract_type LIKE '%Check-in%' THEN 1 
          ELSE 0 
        END
      WHERE base_hashrate IS NULL
    `);
    
    console.log(`✅ 更新了 ${freeResult.affectedRows || 0} 条免费合约记录\n`);

    // 2. 迁移付费合约
    console.log('2. 迁移付费合约...');
    const [paidResult] = await sequelize.query(`
      UPDATE mining_contracts 
      SET base_hashrate = hashrate
      WHERE base_hashrate IS NULL
    `);
    
    console.log(`✅ 更新了 ${paidResult.affectedRows || 0} 条付费合约记录\n`);

    // 3. 验证迁移结果
    console.log('3. 验证迁移结果...\n');
    
    // 免费合约统计
    const freeStats = await sequelize.query(`
      SELECT 
        free_contract_type,
        COUNT(*) as count,
        MIN(base_hashrate) as min_base,
        MAX(base_hashrate) as max_base,
        SUM(CASE WHEN has_daily_bonus = 1 THEN 1 ELSE 0 END) as with_bonus
      FROM free_contract_records
      GROUP BY free_contract_type
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('免费合约统计:');
    console.table(freeStats);

    // 付费合约统计
    const paidStats = await sequelize.query(`
      SELECT 
        COUNT(*) as total_contracts,
        MIN(base_hashrate) as min_hashrate,
        MAX(base_hashrate) as max_hashrate
      FROM mining_contracts
      WHERE base_hashrate IS NOT NULL
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('\n付费合约统计:');
    console.table(paidStats);

    console.log('\n========================================');
    console.log('✅ 数据迁移完成！');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
    process.exit(1);
  }
}

migrateData();
