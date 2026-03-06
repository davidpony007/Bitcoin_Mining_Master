const mysql = require('mysql2/promise');

async function updateLevelNames() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '47.79.232.189',
      user: 'bitcoin_mining_master',
      password: 'FzFbWmwMptnN3ABE',
      database: 'bitcoin_mining_master',
      port: 3306
    });

    console.log('✅ 数据库连接成功');

    const updates = [
      { level: 1, name: 'LV.1 Novice Miner' },
      { level: 2, name: 'LV.2 Junior Miner' },
      { level: 3, name: 'LV.3 Intermediate Miner' },
      { level: 4, name: 'LV.4 Senior Miner' },
      { level: 5, name: 'LV.5 Expert Miner' },
      { level: 6, name: 'LV.6 Master Miner' },
      { level: 7, name: 'LV.7 Legendary Miner' },
      { level: 8, name: 'LV.8 Epic Miner' },
      { level: 9, name: 'LV.9 Mythic Miner' }
    ];

    for (const update of updates) {
      await connection.execute(
        'UPDATE level_config SET level_name = ? WHERE level = ?',
        [update.name, update.level]
      );
      console.log(`✅ 更新等级 ${update.level}: ${update.name}`);
    }

    // 验证结果
    const [rows] = await connection.execute(
      'SELECT level, level_name, speed_multiplier FROM level_config ORDER BY level'
    );
    
    console.log('\n📊 更新后的等级配置:');
    console.table(rows);

  } catch (error) {
    console.error('❌ 更新失败:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

updateLevelNames();
