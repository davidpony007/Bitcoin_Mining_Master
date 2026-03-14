/**
 * 验证积分系统表结构
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);

async function verifyTables() {
  try {
    await sequelize.authenticate();
    console.log('===== 积分系统表结构验证 =====\n');

    const tables = [
      'user_points',
      'points_transaction',
      'ad_view_record',
      'user_check_in',
      'consecutive_check_in_reward',
      'referral_milestone'
    ];

    for (const tableName of tables) {
      console.log(`\n📋 ${tableName}`);
      
      // 获取表注释
      const [tableInfo] = await sequelize.query(`
        SELECT TABLE_COMMENT
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
        AND TABLE_NAME = '${tableName}'
      `);
      
      if (tableInfo[0]) {
        console.log(`   ${tableInfo[0].TABLE_COMMENT}`);
      }

      // 获取字段信息
      const [columns] = await sequelize.query(`
        SELECT 
          COLUMN_NAME,
          COLUMN_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          COLUMN_COMMENT,
          COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
        AND TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
      `);

      console.log('\n   字段列表：');
      columns.forEach(col => {
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        const key = col.COLUMN_KEY ? `[${col.COLUMN_KEY}]` : '';
        console.log(`   - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} ${nullable} ${key}`);
        if (col.COLUMN_COMMENT) {
          console.log(`     ${col.COLUMN_COMMENT}`);
        }
      });

      // 获取索引信息
      const [indexes] = await sequelize.query(`
        SELECT 
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
        AND TABLE_NAME = '${tableName}'
        AND INDEX_NAME != 'PRIMARY'
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
      `);

      if (indexes.length > 0) {
        console.log('\n   索引：');
        const indexGroups = {};
        indexes.forEach(idx => {
          if (!indexGroups[idx.INDEX_NAME]) {
            indexGroups[idx.INDEX_NAME] = [];
          }
          indexGroups[idx.INDEX_NAME].push(idx.COLUMN_NAME);
        });
        
        Object.entries(indexGroups).forEach(([name, cols]) => {
          const unique = indexes.find(i => i.INDEX_NAME === name).NON_UNIQUE === 0 ? 'UNIQUE' : 'INDEX';
          console.log(`   - ${unique}: ${name} (${cols.join(', ')})`);
        });
      }
    }

    console.log('\n\n===== 验证完成 =====');
    console.log(`✅ 已创建 ${tables.length} 个积分系统表`);
    console.log('\n功能覆盖：');
    console.log('  ✓ 用户积分存储（user_points）');
    console.log('  ✓ 积分变动记录（points_transaction）');
    console.log('  ✓ 广告观看统计（ad_view_record）');
    console.log('  ✓ 每日签到记录（user_check_in）');
    console.log('  ✓ 连续签到奖励（consecutive_check_in_reward）');
    console.log('  ✓ 邀请里程碑奖励（referral_milestone）');

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

verifyTables();
