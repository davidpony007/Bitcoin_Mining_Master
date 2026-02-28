/**
 * 修复远程数据库 free_contract_records 表结构
 * 添加缺失的字段
 */

const pool = require('./src/config/database_native');

async function fixDatabase() {
  const conn = await pool.getConnection();
  
  try {
    console.log('🔍 检查远程数据库表结构...');
    
    // 1. 查看当前表结构
    const [columns] = await conn.query('DESCRIBE free_contract_records');
    console.log('\n当前字段:');
    columns.forEach(c => console.log(`  - ${c.Field} (${c.Type})`));
    
    const fieldNames = columns.map(c => c.Field);
    const missingFields = [];
    
    // 2. 检查缺失的字段
    if (!fieldNames.includes('free_contract_revenue')) {
      missingFields.push('free_contract_revenue');
    }
    if (!fieldNames.includes('base_hashrate')) {
      missingFields.push('base_hashrate');
    }
    if (!fieldNames.includes('has_daily_bonus')) {
      missingFields.push('has_daily_bonus');
    }
    if (!fieldNames.includes('mining_status')) {
      missingFields.push('mining_status');
    }
    
    if (missingFields.length === 0) {
      console.log('\n✅ 所有字段都存在，无需修复');
      conn.release();
      process.exit(0);
    }
    
    console.log(`\n缺失的字段: ${missingFields.join(', ')}`);
    console.log('\n⚙️  开始添加缺失字段...\n');
    
    // 3. 添加缺失字段
    if (missingFields.includes('free_contract_revenue')) {
      console.log('添加 free_contract_revenue...');
      await conn.query(`
        ALTER TABLE free_contract_records 
        ADD COLUMN free_contract_revenue DECIMAL(18,18) DEFAULT 0 
        COMMENT '合约总收益(BTC)' 
        AFTER free_contract_type
      `);
      console.log('✅ free_contract_revenue 已添加');
    }
    
    if (missingFields.includes('base_hashrate')) {
      console.log('添加 base_hashrate...');
      await conn.query(`
        ALTER TABLE free_contract_records 
        ADD COLUMN base_hashrate DECIMAL(18,18) DEFAULT 0.000000000000139 
        COMMENT '纯基础算力(不含任何倍数)' 
        AFTER hashrate
      `);
      console.log('✅ base_hashrate 已添加');
    }
    
    if (missingFields.includes('has_daily_bonus')) {
      console.log('添加 has_daily_bonus...');
      await conn.query(`
        ALTER TABLE free_contract_records 
        ADD COLUMN has_daily_bonus TINYINT(1) DEFAULT 0 
        COMMENT '是否包含签到加成(1.36倍)' 
        AFTER base_hashrate
      `);
      console.log('✅ has_daily_bonus 已添加');
    }
    
    if (missingFields.includes('mining_status')) {
      console.log('添加 mining_status...');
      await conn.query(`
        ALTER TABLE free_contract_records 
        ADD COLUMN mining_status ENUM('completed', 'mining', 'error') 
        COMMENT '挖矿状态' 
        AFTER has_daily_bonus
      `);
      console.log('✅ mining_status 已添加');
    }
    
    // 4. 验证
    console.log('\n验证修复结果...');
    const [newColumns] = await conn.query('DESCRIBE free_contract_records');
    console.log('\n更新后的字段:');
    newColumns.forEach(c => console.log(`  - ${c.Field} (${c.Type})`));
    
    console.log('\n🎉 数据库表结构修复完成！');
    
  } catch (error) {
    console.error('\n❌ 修复失败:', error.message);
    console.error(error.stack);
  } finally {
    conn.release();
    process.exit(0);
  }
}

fixDatabase();
