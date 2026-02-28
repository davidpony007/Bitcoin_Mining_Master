const mysql = require('mysql2/promise');

const userId = 'U2026011910532463989';

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  检查用户 ${userId} 的数据存在情况`);
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
    // 检查所有表中是否有该用户的数据
    const tablesToCheck = [
      'user_information',
      'user_status', 
      'user_points',
      'free_contract_records',
      'check_in_record',
      'ad_view_record',
      'bitcoin_transaction_records',
      'cumulative_check_in_reward',
      'mining_contracts',
      'points_transaction',
      'user_check_in',
      'invitation_relationship'
    ];

    console.log('【步骤 1】检查用户在各表中的存在情况\n');

    const results = {};
    
    for (const table of tablesToCheck) {
      try {
        const [rows] = await connection.query(
          `SELECT * FROM ${table} WHERE user_id = ?`,
          [userId]
        );
        
        results[table] = {
          exists: rows.length > 0,
          count: rows.length,
          data: rows.length > 0 ? rows[0] : null
        };
        
        const status = rows.length > 0 ? '✅' : '❌';
        console.log(`${status} ${table.padEnd(35)} ${rows.length} 条记录`);
        
      } catch (error) {
        results[table] = {
          exists: false,
          count: 0,
          error: error.message
        };
        console.log(`⚠️  ${table.padEnd(35)} 查询失败: ${error.message}`);
      }
    }

    console.log('\n【步骤 2】检查空表的总记录数\n');

    const emptyTables = ['check_in_record', 'ad_view_record', 'bitcoin_transaction_records', 
                         'cumulative_check_in_reward', 'mining_contracts'];
    
    for (const table of emptyTables) {
      const [count] = await connection.query(`SELECT COUNT(*) as total FROM ${table}`);
      console.log(`${table.padEnd(35)} 总记录数: ${count[0].total}`);
    }

    console.log('\n【步骤 3】检查用户详细信息\n');

    if (results.user_information.exists) {
      console.log('用户基本信息:');
      const userData = results.user_information.data;
      console.log(`  用户ID: ${userData.user_id}`);
      console.log(`  邮箱: ${userData.email || '未设置'}`);
      console.log(`  积分: ${userData.user_points || 0}`);
      console.log(`  等级: ${userData.user_level || 1}`);
      console.log(`  国家: ${userData.country || '未设置'}`);
      console.log(`  邀请码: ${userData.invitation_code || '未设置'}`);
      console.log(`  创建时间: ${userData.created_at}`);
    } else {
      console.log('❌ 用户在 user_information 表中不存在！');
    }

    console.log('\n【步骤 4】检查相关Service使用的表名\n');

    // 检查代码中使用的表名
    const fs = require('fs').promises;
    const path = require('path');
    
    const servicesToCheck = [
      { name: 'checkInPointsService.js', tables: ['check_in_record', 'cumulative_check_in_reward'] },
      { name: 'adPointsService.js', tables: ['ad_view_record'] },
      { name: 'contractRewardService.js', tables: ['bitcoin_transaction_records', 'mining_contracts'] }
    ];

    for (const service of servicesToCheck) {
      const filePath = path.join(__dirname, 'src', 'services', service.name);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        
        console.log(`\n📄 ${service.name}:`);
        for (const table of service.tables) {
          const regex = new RegExp(table, 'g');
          const matches = content.match(regex);
          if (matches) {
            console.log(`  ✅ ${table}: 找到 ${matches.length} 处使用`);
          } else {
            console.log(`  ❌ ${table}: 未找到使用`);
          }
        }
      } catch (error) {
        console.log(`  ⚠️  ${service.name}: 文件不存在或无法读取`);
      }
    }

    console.log('\n【步骤 5】检查表结构是否匹配\n');

    for (const table of emptyTables) {
      try {
        const [columns] = await connection.query(`DESCRIBE ${table}`);
        console.log(`\n${table} 表结构:`);
        
        const hasUserId = columns.some(col => col.Field === 'user_id');
        console.log(`  user_id 字段: ${hasUserId ? '✅ 存在' : '❌ 不存在'}`);
        
        console.log(`  字段列表: ${columns.map(c => c.Field).join(', ')}`);
      } catch (error) {
        console.log(`  ❌ ${table}: ${error.message}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 分析结论');
    console.log('═══════════════════════════════════════════════════════\n');

    const existingTables = Object.keys(results).filter(t => results[t].exists);
    const missingTables = Object.keys(results).filter(t => !results[t].exists);

    console.log(`用户在 ${existingTables.length} 个表中有数据:`);
    existingTables.forEach(t => console.log(`  ✅ ${t}`));

    console.log(`\n用户在 ${missingTables.length} 个表中无数据:`);
    missingTables.forEach(t => console.log(`  ❌ ${t}`));

    console.log('\n可能的原因:');
    console.log('  1. 用户刚注册，尚未执行这些功能（签到、看广告等）');
    console.log('  2. API调用失败，数据未写入数据库');
    console.log('  3. 代码中使用了不同的表名');
    console.log('  4. 业务逻辑有问题，没有触发数据插入');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
  }
})();
