// init-database-from-models.js
// 使用 Sequelize 模型自动创建本地数据库结构

const sequelize = require('./src/config/database');
const models = require('./src/models');

async function initDatabase() {
  try {
    console.log('🔌 连接数据库...');
    
    // 测试连接
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功\n');
    
    console.log('📊 数据库信息:');
    console.log(`   主机: ${sequelize.config.host}`);
    console.log(`   端口: ${sequelize.config.port}`);
    console.log(`   数据库: ${sequelize.config.database}`);
    console.log(`   用户: ${sequelize.config.username}`);
    console.log('');
    
    console.log('🔄 同步数据库结构...');
    console.log('⚠️  注意: 这将根据模型定义创建/更新表结构\n');
    
    // 同步所有模型到数据库
    // force: false 表示不会删除已存在的表
    // alter: true 表示会修改表结构以匹配模型
    await sequelize.sync({ alter: true });
    
    console.log('✅ 数据库结构同步成功！\n');
    
    // 获取所有表
    const [tables] = await sequelize.query(
      "SHOW TABLES"
    );
    
    console.log('📋 当前数据库中的表:');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });
    
    console.log(`\n共 ${tables.length} 个表`);
    
    // 显示每个表的结构
    console.log('\n📝 表结构详情:\n');
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      const [columns] = await sequelize.query(`DESCRIBE \`${tableName}\``);
      
      console.log(`表: ${tableName}`);
      console.log('-----------------------------------');
      columns.forEach(col => {
        console.log(`  ${col.Field.padEnd(30)} ${col.Type.padEnd(20)} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.original) {
      console.error('   原始错误:', error.original.message);
    }
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔒 数据库连接已关闭');
  }
}

// 运行初始化
initDatabase();
