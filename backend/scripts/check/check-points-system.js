/**
 * 检查等级积分机制的实现状态
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

async function checkPointsSystem() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功\n');

    console.log('===== 检查等级积分机制实现状态 =====\n');

    // 1. 检查积分相关表是否存在
    console.log('📋 第一步：检查积分相关数据表\n');
    
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME, TABLE_COMMENT
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
      ORDER BY TABLE_NAME
    `);

    const tableNames = tables.map(t => t.TABLE_NAME);
    
    const requiredTables = {
      'user_points': '用户积分表（存储每个用户的当前积分）',
      'points_transaction': '积分交易记录表（记录所有积分变动）',
      'user_check_in': '签到记录表（每日签到记录）',
      'consecutive_check_in_reward': '连续签到奖励记录表',
      'ad_view_record': '广告观看记录表',
      'level_config': '等级配置表',
      'check_in_reward_config': '签到奖励配置表'
    };

    console.log('需要的表：');
    for (const [table, desc] of Object.entries(requiredTables)) {
      const exists = tableNames.includes(table);
      const status = exists ? '✅ 已存在' : '❌ 不存在';
      console.log(`  ${status} - ${table}: ${desc}`);
      
      if (exists) {
        const tableInfo = tables.find(t => t.TABLE_NAME === table);
        if (tableInfo.TABLE_COMMENT) {
          console.log(`     注释: ${tableInfo.TABLE_COMMENT}`);
        }
      }
    }

    // 2. 检查现有表结构
    console.log('\n\n📋 第二步：检查现有相关表的字段\n');
    
    const existingRelevantTables = tableNames.filter(t => 
      t.includes('check') || t.includes('level') || t.includes('user')
    );

    for (const tableName of existingRelevantTables) {
      console.log(`\n表: ${tableName}`);
      const [columns] = await sequelize.query(`
        SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
        AND TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
      `);
      
      columns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (${col.COLUMN_COMMENT || '无注释'})`);
      });
    }

    // 3. 总结分析
    console.log('\n\n===== 功能实现状态分析 =====\n');
    
    const features = [
      {
        name: '每观看一次广告增加1积分（每日封顶20积分）',
        tables: ['ad_view_record', 'user_points', 'points_transaction'],
        status: 'unknown'
      },
      {
        name: '每邀请1个好友增加6积分',
        tables: ['invitation_relationship', 'user_points', 'points_transaction'],
        status: 'unknown'
      },
      {
        name: '每邀请10个好友额外增加30积分',
        tables: ['invitation_relationship', 'user_points', 'points_transaction'],
        status: 'unknown'
      },
      {
        name: '完成每日签到增加4积分',
        tables: ['user_check_in', 'user_points', 'points_transaction'],
        status: 'unknown'
      },
      {
        name: '连续签到3/7/15/30天奖励',
        tables: ['user_check_in', 'consecutive_check_in_reward', 'check_in_reward_config'],
        status: tableNames.includes('check_in_reward_config') ? 'partial' : 'missing'
      },
      {
        name: '被邀请的下级每看10次广告本人增加1积分',
        tables: ['ad_view_record', 'invitation_relationship', 'points_transaction'],
        status: 'unknown'
      },
      {
        name: '等级配置（积分区间、挖矿速度倍数）',
        tables: ['level_config'],
        status: tableNames.includes('level_config') ? 'exists' : 'missing'
      }
    ];

    console.log('功能清单：\n');
    features.forEach((feature, index) => {
      const hasAllTables = feature.tables.every(t => tableNames.includes(t));
      let statusIcon = '❌';
      let statusText = '未实现';
      
      if (feature.status === 'exists') {
        statusIcon = '✅';
        statusText = '表已创建';
      } else if (feature.status === 'partial') {
        statusIcon = '⚠️';
        statusText = '部分实现';
      } else if (hasAllTables) {
        statusIcon = '✅';
        statusText = '表已准备';
      }
      
      console.log(`${index + 1}. ${statusIcon} ${feature.name}`);
      console.log(`   状态: ${statusText}`);
      console.log(`   所需表: ${feature.tables.join(', ')}`);
      console.log('');
    });

    // 4. 建议
    console.log('\n===== 实现建议 =====\n');
    console.log('需要创建的表：');
    console.log('1. user_points - 存储用户当前积分');
    console.log('2. points_transaction - 记录所有积分变动（获得/消耗）');
    console.log('3. ad_view_record - 广告观看记录（含每日限制）');
    console.log('4. user_check_in - 每日签到记录');
    console.log('5. consecutive_check_in_reward - 连续签到奖励领取记录');
    console.log('\n需要实现的后端接口：');
    console.log('1. POST /api/points/ad-view - 观看广告增加积分');
    console.log('2. POST /api/points/check-in - 每日签到');
    console.log('3. GET /api/points/balance - 查询积分余额');
    console.log('4. GET /api/points/transactions - 查询积分记录');
    console.log('5. GET /api/level/current - 查询当前等级');
    console.log('6. POST /api/points/referral-reward - 邀请奖励计算');

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

checkPointsSystem();
