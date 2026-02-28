/**
 * 分析签到表结构，检查是否可以合并
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function analyzeCheckinTables() {
  let connection;
  
  try {
    console.log('🔗 正在连接云端MySQL数据库...\n');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '47.79.232.189',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'bitcoin_mining_master'
    });

    console.log(`✅ 成功连接到: ${process.env.DB_HOST || '47.79.232.189'}:${process.env.DB_PORT || 3306}\n`);

    // 表名列表
    const tables = ['check_in_record', 'user_check_in'];

    for (const tableName of tables) {
      console.log('═'.repeat(80));
      console.log(`📊 表名: ${tableName}`);
      console.log('═'.repeat(80));

      // 1. 查看表结构
      console.log('\n【表结构】');
      const [columns] = await connection.query(`
        SELECT 
          COLUMN_NAME as '字段名',
          COLUMN_TYPE as '类型',
          IS_NULLABLE as '可空',
          COLUMN_KEY as '键',
          COLUMN_DEFAULT as '默认值',
          EXTRA as '额外信息',
          COLUMN_COMMENT as '注释'
        FROM 
          information_schema.COLUMNS
        WHERE 
          TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY 
          ORDINAL_POSITION
      `, [process.env.DB_NAME || 'bitcoin_mining_master', tableName]);

      console.table(columns);

      // 2. 查看索引
      console.log('\n【索引信息】');
      const [indexes] = await connection.query(`
        SHOW INDEX FROM \`${tableName}\`
      `);
      
      const indexMap = {};
      indexes.forEach(idx => {
        if (!indexMap[idx.Key_name]) {
          indexMap[idx.Key_name] = {
            '索引名': idx.Key_name,
            '唯一': idx.Non_unique === 0 ? '是' : '否',
            '字段': []
          };
        }
        indexMap[idx.Key_name]['字段'].push(idx.Column_name);
      });

      Object.values(indexMap).forEach(idx => {
        idx['字段'] = idx['字段'].join(', ');
      });

      console.table(Object.values(indexMap));

      // 3. 查看数据量
      console.log('\n【数据统计】');
      const [count] = await connection.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);
      console.log(`   总记录数: ${count[0].total}`);

      if (count[0].total > 0) {
        // 查看最早和最晚的记录
        const [timeRange] = await connection.query(`
          SELECT 
            MIN(created_at) as earliest,
            MAX(created_at) as latest
          FROM \`${tableName}\`
          WHERE created_at IS NOT NULL
        `);
        
        if (timeRange[0].earliest) {
          console.log(`   最早记录: ${timeRange[0].earliest}`);
          console.log(`   最晚记录: ${timeRange[0].latest}`);
        }

        // 查看前5条记录示例
        console.log('\n【数据示例 (前5条)】');
        const [samples] = await connection.query(`SELECT * FROM \`${tableName}\` LIMIT 5`);
        console.table(samples);

        // 查看唯一用户数
        const [userCount] = await connection.query(`
          SELECT COUNT(DISTINCT user_id) as unique_users FROM \`${tableName}\`
        `);
        console.log(`\n   唯一用户数: ${userCount[0].unique_users}`);
      }

      console.log('\n');
    }

    // 4. 对比分析
    console.log('═'.repeat(80));
    console.log('📋 对比分析');
    console.log('═'.repeat(80));

    // 获取两个表的详细结构
    const [table1Cols] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_KEY, COLUMN_COMMENT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'check_in_record'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME || 'bitcoin_mining_master']);

    const [table2Cols] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_KEY, COLUMN_COMMENT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_check_in'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME || 'bitcoin_mining_master']);

    console.log('\n【字段对比】');
    console.log(`\ncheck_in_record 字段: ${table1Cols.map(c => c.COLUMN_NAME).join(', ')}`);
    console.log(`user_check_in 字段:   ${table2Cols.map(c => c.COLUMN_NAME).join(', ')}`);

    // 找出共同字段
    const commonFields = table1Cols
      .filter(c1 => table2Cols.some(c2 => c2.COLUMN_NAME === c1.COLUMN_NAME))
      .map(c => c.COLUMN_NAME);

    const onlyInTable1 = table1Cols
      .filter(c1 => !table2Cols.some(c2 => c2.COLUMN_NAME === c1.COLUMN_NAME))
      .map(c => c.COLUMN_NAME);

    const onlyInTable2 = table2Cols
      .filter(c2 => !table1Cols.some(c1 => c1.COLUMN_NAME === c2.COLUMN_NAME))
      .map(c => c.COLUMN_NAME);

    console.log(`\n✅ 共同字段 (${commonFields.length}个): ${commonFields.join(', ')}`);
    console.log(`\n⚠️  仅在 check_in_record (${onlyInTable1.length}个): ${onlyInTable1.join(', ') || '无'}`);
    console.log(`\n⚠️  仅在 user_check_in (${onlyInTable2.length}个): ${onlyInTable2.join(', ') || '无'}`);

    // 检查数据重复
    console.log('\n【数据重叠分析】');
    
    const [table1Count] = await connection.query(`SELECT COUNT(*) as cnt FROM check_in_record`);
    const [table2Count] = await connection.query(`SELECT COUNT(*) as cnt FROM user_check_in`);
    
    let overlap = [{ overlapping_records: 0 }];
    
    // 只有两表都有数据时才检查重叠
    if (table1Count[0].cnt > 0 && table2Count[0].cnt > 0) {
      const [overlapResult] = await connection.query(`
        SELECT 
          COUNT(*) as overlapping_records
        FROM check_in_record c1
        INNER JOIN user_check_in c2 
          ON c1.user_id = c2.user_id 
          AND DATE(c1.created_at) = DATE(c2.check_in_date)
      `);
      overlap = overlapResult;
      console.log(`   两表有相同 user_id 和日期的记录数: ${overlap[0].overlapping_records}`);
    } else {
      console.log(`   两表都为空，无需检查数据重叠`);
    }

    // 建议
    console.log('\n' + '═'.repeat(80));
    console.log('💡 合并建议');
    console.log('═'.repeat(80));

    console.log('\n基于以上分析:');
    console.log(`\n1. check_in_record: ${table1Count[0].cnt} 条记录`);
    console.log(`   user_check_in:   ${table2Count[0].cnt} 条记录`);
    console.log(`   数据重叠:        ${overlap[0].overlapping_records || 0} 条记录`);

    if (commonFields.length > 3 && overlap[0].overlapping_records > 0) {
      console.log('\n⚠️  发现显著数据重叠！建议合并这两个表。');
      console.log('\n推荐方案:');
      console.log('   - 保留功能更完整的表作为主表');
      console.log('   - 迁移另一个表的独有字段和数据');
      console.log('   - 更新代码引用');
      console.log('   - 删除冗余表');
    } else if (table1Count[0].cnt === 0 || table2Count[0].cnt === 0) {
      const emptyTable = table1Count[0].cnt === 0 ? 'check_in_record' : 'user_check_in';
      const activeTable = table1Count[0].cnt === 0 ? 'user_check_in' : 'check_in_record';
      console.log(`\n✅ ${emptyTable} 表为空，建议直接删除，统一使用 ${activeTable}`);
    } else {
      console.log('\n✅ 两表数据无重叠，可能服务不同用途，建议保留');
    }

  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    console.error('错误详情:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

analyzeCheckinTables();
