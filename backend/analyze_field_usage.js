#!/usr/bin/env node

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// 分析数据库字段使用情况
async function analyzeDatabase() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('        数据库字段使用情况完整分析');
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
    console.log('【步骤 1/4】获取数据库所有表...\n');
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]).sort();
    
    console.log(`找到 ${tableNames.length} 个表\n`);

    // 2. 获取每个表的字段信息
    console.log('【步骤 2/4】分析表结构和字段...\n');
    
    const dbStructure = {};
    
    for (const tableName of tableNames) {
      const [columns] = await connection.query(`DESCRIBE ${tableName}`);
      
      const [columnComments] = await connection.query(
        `SELECT COLUMN_NAME, COLUMN_COMMENT, DATA_TYPE, COLUMN_TYPE
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = 'bitcoin_mining_master' AND TABLE_NAME = ?`,
        [tableName]
      );
      
      const commentMap = {};
      columnComments.forEach(row => {
        commentMap[row.COLUMN_NAME] = {
          comment: row.COLUMN_COMMENT,
          dataType: row.DATA_TYPE,
          columnType: row.COLUMN_TYPE
        };
      });
      
      const [countResult] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      
      dbStructure[tableName] = {
        recordCount: countResult[0].count,
        fields: columns.map(col => ({
          name: col.Field,
          type: col.Type,
          null: col.Null,
          key: col.Key,
          default: col.Default,
          extra: col.Extra,
          comment: commentMap[col.Field]?.comment || '',
          dataType: commentMap[col.Field]?.dataType || '',
          columnType: commentMap[col.Field]?.columnType || ''
        }))
      };
      
      console.log(`  ✓ ${tableName} (${dbStructure[tableName].recordCount} 条记录, ${dbStructure[tableName].fields.length} 个字段)`);
    }
    
    console.log('\n【步骤 3/4】扫描后端代码中的字段使用情况...\n');
    
    // 3. 扫描后端代码
    const backendPath = path.join(__dirname, 'src');
    const fieldUsage = {};
    
    for (const tableName of tableNames) {
      fieldUsage[tableName] = {};
      
      for (const field of dbStructure[tableName].fields) {
        const fieldName = field.name;
        fieldUsage[tableName][fieldName] = {
          usedInBackend: false,
          locations: [],
          sqlStatements: []
        };
        
        try {
          // 搜索字段名在代码中的使用
          const grepCmd = `grep -r "${fieldName}" ${backendPath} --include="*.js" 2>/dev/null || true`;
          const result = execSync(grepCmd, { encoding: 'utf8' });
          
          if (result.trim()) {
            const lines = result.split('\n').filter(l => l);
            if (lines.length > 0) {
              fieldUsage[tableName][fieldName].usedInBackend = true;
              fieldUsage[tableName][fieldName].locations = lines.slice(0, 5); // 保留前5个位置
            }
          }
        } catch (error) {
          // 忽略错误继续
        }
      }
    }
    
    console.log('✓ 后端代码扫描完成\n');
    
    console.log('【步骤 4/4】生成分析报告...\n');
    
    // 4. 生成报告
    let report = `# 数据库字段使用情况完整分析报告\n\n`;
    report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
    report += `数据库: bitcoin_mining_master\n`;
    report += `表总数: ${tableNames.length}\n\n`;
    report += `---\n\n`;
    
    // 统计信息
    let totalFields = 0;
    let usedFields = 0;
    let unusedFields = 0;
    const unusedFieldsList = [];
    
    report += `## 📊 总体统计\n\n`;
    
    for (const tableName of tableNames) {
      const table = dbStructure[tableName];
      totalFields += table.fields.length;
      
      let tableUsedCount = 0;
      for (const field of table.fields) {
        if (fieldUsage[tableName][field.name].usedInBackend) {
          tableUsedCount++;
          usedFields++;
        } else {
          unusedFields++;
          unusedFieldsList.push({
            table: tableName,
            field: field.name,
            type: field.type,
            comment: field.comment,
            recordCount: table.recordCount
          });
        }
      }
    }
    
    report += `- 总字段数: ${totalFields}\n`;
    report += `- 已使用字段: ${usedFields} (${(usedFields/totalFields*100).toFixed(1)}%)\n`;
    report += `- 未使用字段: ${unusedFields} (${(unusedFields/totalFields*100).toFixed(1)}%)\n\n`;
    
    // 未使用字段详细列表
    report += `## ⚠️ 未使用字段列表 (${unusedFields}个)\n\n`;
    
    if (unusedFields === 0) {
      report += `✅ 所有字段都已被使用，无冗余字段。\n\n`;
    } else {
      report += `以下字段在后端代码中未找到明显的使用记录，建议评估是否保留：\n\n`;
      
      let currentTable = '';
      for (const item of unusedFieldsList) {
        if (item.table !== currentTable) {
          currentTable = item.table;
          report += `\n### ${currentTable}\n\n`;
          report += `记录数: ${item.recordCount}\n\n`;
          report += `| 字段名 | 类型 | 说明 | 建议 |\n`;
          report += `|--------|------|------|------|\n`;
        }
        
        // 判断是否可能是系统字段
        const isSystemField = ['id', 'created_at', 'updated_at', 'deleted_at', 'create_time', 'update_time'].includes(item.field);
        const isMetaField = item.field.endsWith('_at') || item.field.endsWith('_time') || item.field === 'id';
        
        let recommendation = '';
        if (isSystemField || isMetaField) {
          recommendation = '✅ 保留（系统字段）';
        } else if (item.recordCount === 0) {
          recommendation = '❌ 可删除（空表字段）';
        } else {
          recommendation = '⚠️ 需评估';
        }
        
        report += `| ${item.field} | ${item.type} | ${item.comment || '-'} | ${recommendation} |\n`;
      }
    }
    
    // 每个表的详细分析
    report += `\n---\n\n## 📋 表字段详细分析\n\n`;
    
    for (const tableName of tableNames) {
      const table = dbStructure[tableName];
      report += `### ${tableName}\n\n`;
      report += `- 记录数: ${table.recordCount}\n`;
      report += `- 字段数: ${table.fields.length}\n\n`;
      
      report += `| 字段名 | 类型 | 使用状态 | 说明 |\n`;
      report += `|--------|------|----------|------|\n`;
      
      for (const field of table.fields) {
        const used = fieldUsage[tableName][field.name].usedInBackend;
        const status = used ? '✅ 使用中' : '⚠️ 未使用';
        report += `| ${field.name} | ${field.type} | ${status} | ${field.comment || '-'} |\n`;
      }
      
      report += `\n`;
    }
    
    // 空表列表
    const emptyTables = tableNames.filter(t => dbStructure[t].recordCount === 0);
    if (emptyTables.length > 0) {
      report += `## 🗑️ 空表列表 (${emptyTables.length}个)\n\n`;
      report += `以下表中没有任何数据记录：\n\n`;
      for (const tableName of emptyTables) {
        const fieldCount = dbStructure[tableName].fields.length;
        report += `- **${tableName}** (${fieldCount} 个字段)\n`;
      }
      report += `\n建议：空表可能是预留的功能表，如果确认不再使用，建议删除以减少维护成本。\n\n`;
    }
    
    // 保存报告
    await fs.writeFile('DATABASE_FIELD_USAGE_ANALYSIS.md', report);
    console.log('✅ 完整分析报告已生成: DATABASE_FIELD_USAGE_ANALYSIS.md\n');
    
    // 保存JSON数据
    const jsonData = {
      analyzedAt: new Date().toISOString(),
      database: 'bitcoin_mining_master',
      tableCount: tableNames.length,
      totalFields,
      usedFields,
      unusedFields,
      tables: dbStructure,
      fieldUsage,
      unusedFieldsList
    };
    
    await fs.writeFile('field_usage_data.json', JSON.stringify(jsonData, null, 2));
    console.log('✅ 原始数据已导出: field_usage_data.json\n');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 分析摘要');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`总表数: ${tableNames.length}`);
    console.log(`总字段数: ${totalFields}`);
    console.log(`已使用字段: ${usedFields} (${(usedFields/totalFields*100).toFixed(1)}%)`);
    console.log(`未使用字段: ${unusedFields} (${(unusedFields/totalFields*100).toFixed(1)}%)`);
    console.log(`空表数: ${emptyTables.length}\n`);
    
    if (unusedFields > 0) {
      console.log('⚠️  发现未使用字段，请查看报告进行评估');
    } else {
      console.log('✅ 所有字段都在使用中');
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ 分析完成！');
    console.log('═══════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await connection.end();
  }
}

// 执行分析
analyzeDatabase().catch(error => {
  console.error('分析失败:', error);
  process.exit(1);
});
