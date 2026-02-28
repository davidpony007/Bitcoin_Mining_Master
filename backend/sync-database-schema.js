// sync-database-schema.js
// 比较云端和本地 MySQL 数据库结构，并同步到本地

const mysql = require('mysql2/promise');
const fs = require('fs').promises;

// 云端数据库配置
const cloudConfig = {
  host: '47.79.232.189',
  port: 3306,
  user: 'bitcoin_mining_master',
  password: 'FzFbWmwMptnN3ABE',
  database: 'bitcoin_mining_master'
};

// 本地数据库配置 - 请根据实际情况修改
const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '', // 请填入本地 MySQL root 密码
  multipleStatements: true
};

async function getTableStructure(connection, dbName) {
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    [dbName]
  );
  
  const structure = {};
  
  for (const table of tables) {
    const tableName = table.TABLE_NAME;
    const [columns] = await connection.query(`SHOW CREATE TABLE \`${dbName}\`.\`${tableName}\``);
    structure[tableName] = columns[0]['Create Table'];
  }
  
  return structure;
}

async function main() {
  let cloudConn, localConn;
  
  try {
    console.log('🔌 连接云端数据库...');
    cloudConn = await mysql.createConnection(cloudConfig);
    console.log('✅ 云端数据库连接成功\n');
    
    // 获取云端数据库结构
    console.log('📊 获取云端数据库结构...');
    const cloudStructure = await getTableStructure(cloudConn, 'bitcoin_mining_master');
    const cloudTables = Object.keys(cloudStructure).sort();
    
    console.log('云端数据库表列表：');
    cloudTables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table}`);
    });
    console.log(`\n共 ${cloudTables.length} 个表\n`);
    
    // 生成 SQL 导出文件
    const sqlContent = [
      '-- ==========================================',
      '-- Bitcoin Mining Master 数据库结构',
      '-- 从云端导出时间: ' + new Date().toLocaleString('zh-CN'),
      '-- ==========================================\n',
      '-- 创建数据库',
      'CREATE DATABASE IF NOT EXISTS `bitcoin_mining_master` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',
      'USE `bitcoin_mining_master`;\n',
      '-- 删除现有表（如果存在）'
    ];
    
    // 按依赖关系排序，先删除有外键的表
    const reverseTables = [...cloudTables].reverse();
    reverseTables.forEach(table => {
      sqlContent.push(`DROP TABLE IF EXISTS \`${table}\`;`);
    });
    
    sqlContent.push('\n-- 创建表结构\n');
    
    // 创建表
    cloudTables.forEach(table => {
      sqlContent.push(`-- 表: ${table}`);
      sqlContent.push(cloudStructure[table] + ';\n');
    });
    
    const sqlFile = sqlContent.join('\n');
    const outputPath = '/Users/davidpony/Desktop/Bitcoin Mining Master/backend/cloud-database-schema.sql';
    
    await fs.writeFile(outputPath, sqlFile, 'utf8');
    console.log(`✅ 数据库结构已导出到: ${outputPath}\n`);
    
    // 尝试连接本地数据库
    console.log('🔌 尝试连接本地数据库...');
    try {
      localConn = await mysql.createConnection(localConfig);
      console.log('✅ 本地数据库连接成功\n');
      
      // 获取本地数据库结构
      const [localDbs] = await localConn.query(
        "SHOW DATABASES LIKE 'bitcoin_mining_master'"
      );
      
      if (localDbs.length > 0) {
        console.log('📊 本地数据库已存在，获取表结构...');
        const localStructure = await getTableStructure(localConn, 'bitcoin_mining_master');
        const localTables = Object.keys(localStructure).sort();
        
        console.log('\n本地数据库表列表：');
        localTables.forEach((table, index) => {
          console.log(`  ${index + 1}. ${table}`);
        });
        console.log(`\n共 ${localTables.length} 个表\n`);
        
        // 比较差异
        const missingTables = cloudTables.filter(t => !localTables.includes(t));
        const extraTables = localTables.filter(t => !cloudTables.includes(t));
        
        if (missingTables.length > 0) {
          console.log('⚠️  本地缺失的表：');
          missingTables.forEach(table => console.log(`  - ${table}`));
          console.log('');
        }
        
        if (extraTables.length > 0) {
          console.log('⚠️  本地多余的表：');
          extraTables.forEach(table => console.log(`  - ${table}`));
          console.log('');
        }
        
        if (missingTables.length === 0 && extraTables.length === 0) {
          console.log('✅ 表数量一致\n');
        }
      } else {
        console.log('⚠️  本地数据库不存在\n');
      }
      
      // 询问是否导入
      console.log('📝 要同步数据库结构，请执行以下命令：');
      console.log(`\nmysql -u root -p < "${outputPath}"\n`);
      console.log('⚠️  注意：这将删除本地数据库的所有数据！');
      console.log('💡 建议：如需保留数据，请先备份\n');
      
    } catch (localError) {
      console.log('⚠️  本地数据库连接失败，请检查：');
      console.log('   1. MySQL 服务是否运行');
      console.log('   2. 脚本中的密码是否正确');
      console.log(`   错误信息: ${localError.message}\n`);
      
      console.log('📝 你可以手动导入数据库结构：');
      console.log(`\nmysql -u root -p < "${outputPath}"\n`);
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    if (cloudConn) await cloudConn.end();
    if (localConn) await localConn.end();
  }
}

main();
