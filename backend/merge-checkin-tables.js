/**
 * 合并签到表：将 check_in_record 功能合并到 user_check_in，然后删除 check_in_record
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function mergeCheckInTables() {
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

    // 步骤1: 检查两表数据量
    console.log('📊 步骤1: 检查表数据状态\n');
    const [checkInRecordCount] = await connection.query(`SELECT COUNT(*) as cnt FROM check_in_record`);
    const [userCheckInCount] = await connection.query(`SELECT COUNT(*) as cnt FROM user_check_in`);
    
    console.log(`   check_in_record: ${checkInRecordCount[0].cnt} 条记录`);
    console.log(`   user_check_in:   ${userCheckInCount[0].cnt} 条记录\n`);

    if (checkInRecordCount[0].cnt > 0) {
      console.log('⚠️  警告: check_in_record 表中有数据，需要先迁移数据！');
      console.log('❌ 终止操作，请先手动处理数据迁移。\n');
      return;
    }

    // 步骤2: 优化 user_check_in 表结构
    console.log('🔧 步骤2: 优化 user_check_in 表结构\n');
    
    // 2.1 修改 points_earned 默认值从 0 改为 4（与 check_in_record 保持一致）
    console.log('   - 修改 points_earned 默认值为 4...');
    await connection.query(`
      ALTER TABLE user_check_in 
      MODIFY COLUMN points_earned int(11) DEFAULT 4 COMMENT '签到获得的积分'
    `);
    console.log('     ✅ 已修改\n');

    // 2.2 添加字段注释
    console.log('   - 添加字段注释...');
    await connection.query(`
      ALTER TABLE user_check_in 
      MODIFY COLUMN user_id varchar(50) NOT NULL COMMENT '用户ID',
      MODIFY COLUMN check_in_date date NOT NULL COMMENT '签到日期',
      MODIFY COLUMN created_at timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      MODIFY COLUMN consecutive_days int(11) DEFAULT 1 COMMENT '连续签到天数',
      MODIFY COLUMN daily_bonus_active tinyint(1) DEFAULT 0 COMMENT '每日奖励是否激活',
      MODIFY COLUMN bonus_expire_time timestamp NULL COMMENT '奖励过期时间'
    `);
    console.log('     ✅ 已添加\n');

    // 步骤3: 删除 check_in_record 表
    console.log('🗑️  步骤3: 删除 check_in_record 表\n');
    await connection.query(`DROP TABLE IF EXISTS check_in_record`);
    console.log('   ✅ check_in_record 表已删除\n');

    // 步骤4: 验证结果
    console.log('🔍 步骤4: 验证表结构\n');
    const [tables] = await connection.query(`
      SHOW TABLES LIKE '%check_in%'
    `);
    
    console.log('   当前签到相关表:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   - ${tableName}`);
    });

    console.log('\n   user_check_in 表结构:');
    const [columns] = await connection.query(`SHOW FULL COLUMNS FROM user_check_in`);
    console.table(columns.map(col => ({
      '字段': col.Field,
      '类型': col.Type,
      '默认值': col.Default,
      '注释': col.Comment
    })));

    console.log('\n🎉 表合并完成！');
    console.log('\n📋 后续步骤:');
    console.log('   1. ✅ 数据库表结构已更新');
    console.log('   2. ⏳ 需要修改后端代码，将所有 check_in_record 改为 user_check_in');
    console.log('   3. ⏳ 需要更新服务层代码的字段引用');

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

mergeCheckInTables();
