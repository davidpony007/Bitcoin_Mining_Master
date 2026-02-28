const mysql = require('mysql2/promise');
const fs = require('fs').promises;

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('        数据库字段使用情况分析');
  console.log('═══════════════════════════════════════════════════════\n');

  const connection = await mysql.createConnection({
    host: '47.79.232.189',
    user: 'bitcoin_mining_master',
    password: 'FzFbWmwMptnN3ABE',
    database: 'bitcoin_mining_master',
    port: 3306
  });

  console.log('✅ 已连接到云端MySQL数据库\n');

  try {
    // 1. 获取所有表
    console.log('【步骤 1】获取所有表...\n');
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);
    
    console.log(`找到 ${tableNames.length} 个表:`);
    tableNames.forEach((table, idx) => {
      console.log(`  ${idx + 1}. ${table}`);
    });
    console.log('');

    // 2. 获取每个表的详细信息
    console.log('【步骤 2】分析表结构...\n');
    
    const tableDetails = {};
    
    for (const tableName of tableNames) {
      // 获取字段信息
      const [columns] = await connection.query(`DESCRIBE ${tableName}`);
      
      // 获取表注释
      const [tableInfo] = await connection.query(
        `SELECT TABLE_COMMENT FROM information_schema.TABLES 
         WHERE TABLE_SCHEMA = 'bitcoin_mining_master' AND TABLE_NAME = ?`,
        [tableName]
      );
      
      // 获取字段注释
      const [columnComments] = await connection.query(
        `SELECT COLUMN_NAME, COLUMN_COMMENT 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = 'bitcoin_mining_master' AND TABLE_NAME = ?`,
        [tableName]
      );
      
      const commentMap = {};
      columnComments.forEach(row => {
        commentMap[row.COLUMN_NAME] = row.COLUMN_COMMENT;
      });
      
      // 获取记录数
      const [countResult] = await connection.query(
        `SELECT COUNT(*) as count FROM ${tableName}`
      );
      
      tableDetails[tableName] = {
        comment: tableInfo[0].TABLE_COMMENT || '',
        recordCount: countResult[0].count,
        columns: columns.map(col => ({
          name: col.Field,
          type: col.Type,
          null: col.Null,
          key: col.Key,
          default: col.Default,
          extra: col.Extra,
          comment: commentMap[col.Field] || ''
        }))
      };
      
      console.log(`✓ ${tableName} (${tableDetails[tableName].recordCount} 条记录)`);
    }
    
    console.log('\n【步骤 3】生成详细报告...\n');
    
    // 3. 生成JSON报告
    const reportJson = {
      database: 'bitcoin_mining_master',
      host: '47.79.232.189',
      analyzedAt: new Date().toISOString(),
      tableCount: tableNames.length,
      tables: tableDetails
    };
    
    await fs.writeFile(
      'database_structure.json',
      JSON.stringify(reportJson, null, 2)
    );
    
    console.log('✅ 数据库结构已导出到: database_structure.json');
    
    // 4. 生成Markdown报告
    let markdown = `# 数据库表结构分析报告\n\n`;
    markdown += `- 数据库: bitcoin_mining_master\n`;
    markdown += `- 主机: 47.79.232.189\n`;
    markdown += `- 分析时间: ${new Date().toLocaleString('zh-CN')}\n`;
    markdown += `- 表总数: ${tableNames.length}\n\n`;
    markdown += `---\n\n`;
    
    for (const tableName of tableNames.sort()) {
      const table = tableDetails[tableName];
      markdown += `## ${tableName}\n\n`;
      
      if (table.comment) {
        markdown += `**表说明:** ${table.comment}\n\n`;
      }
      
      markdown += `**记录数:** ${table.recordCount}\n\n`;
      markdown += `**字段列表:**\n\n`;
      markdown += `| 字段名 | 类型 | 可空 | 键 | 默认值 | 额外 | 说明 |\n`;
      markdown += `|--------|------|------|-----|--------|------|------|\n`;
      
      table.columns.forEach(col => {
        markdown += `| ${col.name} `;
        markdown += `| ${col.type} `;
        markdown += `| ${col.null} `;
        markdown += `| ${col.key || '-'} `;
        markdown += `| ${col.default === null ? 'NULL' : (col.default || '-')} `;
        markdown += `| ${col.extra || '-'} `;
        markdown += `| ${col.comment || '-'} |\n`;
      });
      
      markdown += `\n`;
    }
    
    await fs.writeFile('database_structure.md', markdown);
    console.log('✅ 表结构文档已生成: database_structure.md\n');
    
    // 5. 统计信息
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 统计信息');
    console.log('═══════════════════════════════════════════════════════\n');
    
    let totalColumns = 0;
    let totalRecords = 0;
    const tablesByRecords = [];
    
    for (const [tableName, details] of Object.entries(tableDetails)) {
      totalColumns += details.columns.length;
      totalRecords += details.recordCount;
      tablesByRecords.push({
        name: tableName,
        records: details.recordCount,
        columns: details.columns.length
      });
    }
    
    tablesByRecords.sort((a, b) => b.records - a.records);
    
    console.log(`总表数: ${tableNames.length}`);
    console.log(`总字段数: ${totalColumns}`);
    console.log(`总记录数: ${totalRecords}\n`);
    
    console.log('记录数 TOP 10:');
    tablesByRecords.slice(0, 10).forEach((table, idx) => {
      console.log(`  ${idx + 1}. ${table.name.padEnd(30)} ${table.records.toString().padStart(8)} 条记录 (${table.columns} 个字段)`);
    });
    
    console.log('\n空表:');
    const emptyTables = tablesByRecords.filter(t => t.records === 0);
    if (emptyTables.length > 0) {
      emptyTables.forEach(table => {
        console.log(`  ⚠️  ${table.name} (${table.columns} 个字段)`);
      });
    } else {
      console.log('  无空表');
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ 分析完成！');
    console.log('═══════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
})();
