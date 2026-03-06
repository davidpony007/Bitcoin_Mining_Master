/**
 * 数据库迁移脚本
 * 应用所有模型更新到实际数据库
 */

const sequelize = require('../src/config/database');

async function migrateDatabse() {
  try {
    console.log('⚡ 开始数据库迁移...\n');
    
    // 1. 先删除旧的外键约束（如果存在）
    console.log('1️⃣ 检查并删除旧外键约束...');
    
    try {
      await sequelize.query(`
        ALTER TABLE free_contract_records 
        DROP FOREIGN KEY free_contract_records_ibfk_1
      `);
      console.log('   ✓ 删除 free_contract_records 旧外键');
    } catch (e) {
      if (!e.message.includes('check that it exists')) {
        console.log('   ℹ️  free_contract_records 无旧外键');
      }
    }
    
    try {
      await sequelize.query(`
        ALTER TABLE mining_contracts 
        DROP FOREIGN KEY mining_contracts_ibfk_1
      `);
      console.log('   ✓ 删除 mining_contracts 旧外键');
    } catch (e) {
      if (!e.message.includes('check that it exists')) {
        console.log('   ℹ️  mining_contracts 无旧外键');
      }
    }
    
    // 2. 扩展字段长度
    console.log('\n2️⃣ 修改字段长度...');
    await sequelize.query(`
      ALTER TABLE free_contract_records 
      MODIFY COLUMN user_id VARCHAR(30) NOT NULL
    `);
    console.log('   ✓ free_contract_records.user_id: VARCHAR(15) → VARCHAR(30)');
    
    await sequelize.query(`
      ALTER TABLE mining_contracts 
      MODIFY COLUMN user_id VARCHAR(30) NOT NULL
    `);
    console.log('   ✓ mining_contracts.user_id: VARCHAR(15) → VARCHAR(30)');
    
    // 3. 添加user_information表缺失字段（如果不存在）
    console.log('\n3️⃣ 添加缺失字段...');
    
    try {
      await sequelize.query(`
        ALTER TABLE user_information 
        ADD COLUMN user_level INT DEFAULT 1 COMMENT '用户等级'
      `);
      console.log('   ✓ user_information.user_level已添加');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('   ℹ️  user_information.user_level已存在');
      } else throw e;
    }
    
    try {
      await sequelize.query(`
        ALTER TABLE user_information 
        ADD COLUMN user_points INT DEFAULT 0 COMMENT '用户积分'
      `);
      console.log('   ✓ user_information.user_points已添加');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('   ℹ️  user_information.user_points已存在');
      } else throw e;
    }
    
    try {
      await sequelize.query(`
        ALTER TABLE user_information 
        ADD COLUMN mining_speed_multiplier DECIMAL(8, 6) DEFAULT 1.000000 COMMENT '挖矿速度倍率'
      `);
      console.log('   ✓ user_information.mining_speed_multiplier已添加');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('   ℹ️  user_information.mining_speed_multiplier已存在');
      } else throw e;
    }
    
    // 4. 添加外键约束（检查是否已存在）
    console.log('\n4️⃣ 添加外键约束...');
    
    try {
      await sequelize.query(`
        ALTER TABLE free_contract_records 
        ADD CONSTRAINT fk_free_contract_user 
        FOREIGN KEY (user_id) 
        REFERENCES user_information(user_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
      `);
      console.log('   ✓ free_contract_records → user_information');
    } catch (e) {
      if (e.message.includes('Duplicate foreign key')) {
        console.log('   ℹ️  free_contract_records外键已存在');
      } else {
        console.warn('   ⚠️  free_contract_records外键添加失败:', e.message);
      }
    }
    
    try {
      await sequelize.query(`
        ALTER TABLE mining_contracts 
        ADD CONSTRAINT fk_mining_contract_user 
        FOREIGN KEY (user_id) 
        REFERENCES user_information(user_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
      `);
      console.log('   ✓ mining_contracts → user_information');
    } catch (e) {
      if (e.message.includes('Duplicate foreign key')) {
        console.log('   ℹ️  mining_contracts外键已存在');
      } else {
        console.warn('   ⚠️  mining_contracts外键添加失败:', e.message);
      }
    }
    
    try {
      await sequelize.query(`
        ALTER TABLE user_status 
        ADD CONSTRAINT fk_user_status_user 
        FOREIGN KEY (user_id) 
        REFERENCES user_information(user_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
      `);
      console.log('   ✓ user_status → user_information');
    } catch (e) {
      if (e.message.includes('Duplicate foreign key')) {
        console.log('   ℹ️  user_status外键已存在');
      } else {
        console.warn('   ⚠️  user_status外键添加失败:', e.message);
      }
    }
    
    // 5. 添加复合索引
    console.log('\n5️⃣ 添加性能优化索引...');
    
    try {
      await sequelize.query(`
        CREATE INDEX idx_active_mining 
        ON free_contract_records(mining_status, free_contract_end_time, user_id)
      `);
      console.log('   ✓ free_contract_records.idx_active_mining');
    } catch (e) {
      if (e.message.includes('Duplicate key')) {
        console.log('   ℹ️  free_contract_records.idx_active_mining已存在');
      } else {
        console.warn('   ⚠️  free_contract_records索引添加失败:', e.message);
      }
    }
    
    try {
      await sequelize.query(`
        CREATE INDEX idx_active_mining 
        ON mining_contracts(mining_status, contract_end_time, user_id)
      `);
      console.log('   ✓ mining_contracts.idx_active_mining');
    } catch (e) {
      if (e.message.includes('Duplicate key')) {
        console.log('   ℹ️  mining_contracts.idx_active_mining已存在');
      } else {
        console.warn('   ⚠️  mining_contracts索引添加失败:', e.message);
      }
    }
    
    console.log('\n✅ 数据库迁移完成！\n');
    
    // 6. 验证结果
    console.log('6️⃣ 验证迁移结果...');
    const [tables] = await sequelize.query(`
      SELECT 
        table_name,
        column_name,
        column_type,
        is_nullable,
        column_key,
        extra
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
      AND table_name IN ('user_information', 'free_contract_records', 'mining_contracts', 'user_status')
      ORDER BY table_name, ordinal_position
    `);
    
    console.log('\n📋 关键表结构:');
    let currentTable = '';
    tables.forEach(col => {
      if (col.table_name !== currentTable) {
        currentTable = col.table_name;
        console.log(`\n   [${currentTable}]`);
      }
      const key = col.column_key === 'PRI' ? '🔑' : col.column_key === 'MUL' ? '🔗' : '  ';
      console.log(`   ${key} ${col.column_name}: ${col.column_type}`);
    });
    
    console.log('\n\n🎉 数据库已成功升级！');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行迁移
migrateDatabse();
