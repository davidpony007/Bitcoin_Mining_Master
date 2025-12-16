/**
 * 创建国家挖矿配置表
 * 
 * 功能说明:
 * - 为不同国家的用户设置不同的挖矿速率倍率
 * - 支持动态调整各国家的挖矿倍率
 * - 提供默认倍率配置
 * 
 * 执行方式:
 * node migrations/create-country-mining-config.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// 国家挖矿倍率配置数据
const countryConfigs = [
  { country_code: 'US', country_name: 'United State', country_name_cn: '美国', mining_multiplier: 26 },
  { country_code: 'AU', country_name: 'Australia', country_name_cn: '澳大利亚', mining_multiplier: 26 },
  { country_code: 'CA', country_name: 'Canada', country_name_cn: '加拿大', mining_multiplier: 26 },
  { country_code: 'UK', country_name: 'United Kingdom', country_name_cn: '英国', mining_multiplier: 18 },
  { country_code: 'DE', country_name: 'Germany', country_name_cn: '德国', mining_multiplier: 18 },
  { country_code: 'FR', country_name: 'France', country_name_cn: '法国', mining_multiplier: 18 },
  { country_code: 'NZ', country_name: 'New Zealand', country_name_cn: '新西兰', mining_multiplier: 18 },
  { country_code: 'KR', country_name: 'South Korea', country_name_cn: '韩国', mining_multiplier: 18 },
  { country_code: 'CH', country_name: 'Switzerland', country_name_cn: '瑞士', mining_multiplier: 18 }
];

async function createCountryMiningConfig() {
  let connection;
  
  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '47.79.232.189',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'bitcoin_mining_master'
    });

    console.log('✅ 数据库连接成功\n');

    // 1. 创建表
    console.log('📝 步骤 1: 创建 country_mining_config 表...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS country_mining_config (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
        country_code VARCHAR(2) NOT NULL COMMENT '国家代码 (ISO 3166-1 alpha-2)',
        country_name VARCHAR(100) NOT NULL COMMENT '国家英文名称',
        country_name_cn VARCHAR(100) NOT NULL COMMENT '国家中文名称',
        mining_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00 COMMENT '挖矿速率倍率',
        is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        UNIQUE KEY uk_country_code (country_code),
        INDEX idx_is_active (is_active),
        INDEX idx_mining_multiplier (mining_multiplier)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='国家挖矿速率配置表';
    `;

    await connection.execute(createTableSQL);
    console.log('✅ 表创建成功\n');

    // 2. 插入初始数据
    console.log('📝 步骤 2: 插入国家配置数据...');
    
    const insertSQL = `
      INSERT INTO country_mining_config 
        (country_code, country_name, country_name_cn, mining_multiplier, is_active)
      VALUES 
        (?, ?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE
        country_name = VALUES(country_name),
        country_name_cn = VALUES(country_name_cn),
        mining_multiplier = VALUES(mining_multiplier),
        updated_at = CURRENT_TIMESTAMP
    `;

    let insertedCount = 0;
    let updatedCount = 0;

    for (const config of countryConfigs) {
      const [result] = await connection.execute(insertSQL, [
        config.country_code,
        config.country_name,
        config.country_name_cn,
        config.mining_multiplier
      ]);

      if (result.affectedRows === 1) {
        insertedCount++;
        console.log(`   ✓ 插入: ${config.country_code} - ${config.country_name_cn} (${config.mining_multiplier}x)`);
      } else {
        updatedCount++;
        console.log(`   ↻ 更新: ${config.country_code} - ${config.country_name_cn} (${config.mining_multiplier}x)`);
      }
    }

    console.log(`\n✅ 数据插入完成: ${insertedCount} 条新增, ${updatedCount} 条更新\n`);

    // 3. 验证数据
    console.log('📝 步骤 3: 验证数据...');
    
    const [rows] = await connection.execute(`
      SELECT 
        country_code,
        country_name_cn,
        mining_multiplier,
        is_active
      FROM country_mining_config
      ORDER BY mining_multiplier DESC, country_code ASC
    `);

    console.log('\n当前配置:');
    console.log('┌────────────┬──────────────┬──────────────┬────────┐');
    console.log('│ 国家代码   │ 中文名称     │ 挖矿倍率     │ 状态   │');
    console.log('├────────────┼──────────────┼──────────────┼────────┤');
    
    rows.forEach(row => {
      const status = row.is_active ? '✓ 启用' : '✗ 禁用';
      console.log(
        `│ ${row.country_code.padEnd(10)} │ ${row.country_name_cn.padEnd(12)} │ ${String(row.mining_multiplier).padEnd(12)} │ ${status.padEnd(6)} │`
      );
    });
    
    console.log('└────────────┴──────────────┴──────────────┴────────┘');

    // 4. 统计信息
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_countries,
        COUNT(DISTINCT mining_multiplier) as multiplier_levels,
        MIN(mining_multiplier) as min_multiplier,
        MAX(mining_multiplier) as max_multiplier,
        AVG(mining_multiplier) as avg_multiplier
      FROM country_mining_config
      WHERE is_active = TRUE
    `);

    console.log('\n📊 统计信息:');
    console.log(`   总国家数: ${stats[0].total_countries}`);
    console.log(`   倍率等级: ${stats[0].multiplier_levels} 个`);
    console.log(`   最低倍率: ${stats[0].min_multiplier}x`);
    console.log(`   最高倍率: ${stats[0].max_multiplier}x`);
    console.log(`   平均倍率: ${parseFloat(stats[0].avg_multiplier).toFixed(2)}x`);

    console.log('\n🎉 迁移完成!\n');

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 执行迁移
if (require.main === module) {
  createCountryMiningConfig();
}

module.exports = createCountryMiningConfig;
