/**
 * 为数据库中没有注释的表添加中文注释
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

// 表名到中文注释的映射
const tableComments = {
  'userInformation': '用户信息表 - 存储用户基本信息、余额、等级等核心数据',
  'free_contract_records': '免费合约记录表 - 记录用户的免费挖矿合约（签到、广告奖励等）',
  'paid_contract_records': '付费合约记录表 - 记录用户购买的付费挖矿合约',
  'invitation_mining_records': '邀请挖矿记录表 - 记录通过邀请好友获得的挖矿合约',
  'transaction_records': '交易记录表 - 记录用户的所有交易（充值、提现、转账等）',
  'mining_pool_batteries': '挖矿电池池表 - 记录用户的48个电池槽状态',
  'check_in_records': '签到记录表 - 记录用户的每日签到历史',
  'check_in_milestones': '签到里程碑表 - 记录用户达成的签到里程碑奖励',
  'user_points': '用户积分表 - 记录用户当前积分余额和累计积分',
  'points_transactions': '积分交易记录表 - 记录所有积分变动明细',
  'user_levels': '用户等级表 - 记录用户的等级信息和升级历史',
  'mock_servers': 'Mock服务器配置表 - 用于测试的模拟服务器配置',
  'ad_mining_contracts': '广告挖矿合约表 - 已废弃，功能已迁移到free_contract_records',
  'invitation_info': '邀请信息表 - 存储用户的邀请码和邀请关系',
  'cumulative_checkin_reward': '累计签到奖励表 - 记录用户累计签到天数和奖励',
  'redis_cache': 'Redis缓存表 - 用于持久化重要的缓存数据',
  'system_config': '系统配置表 - 存储全局系统配置参数',
  'user_sessions': '用户会话表 - 记录用户登录会话信息',
  'admin_users': '管理员用户表 - 存储后台管理员账号信息',
  'audit_logs': '审计日志表 - 记录系统重要操作日志',
};

async function addTableComments() {
  let connection;
  
  try {
    console.log('🔗 正在连接云端MySQL数据库...\n');
    
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '47.79.232.189',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'bitcoin_mining_master'
    });

    console.log(`✅ 成功连接到: ${process.env.DB_HOST || '47.79.232.189'}:${process.env.DB_PORT || 3306}\n`);

    // 查询所有表及其注释
    const [tables] = await connection.query(`
      SELECT 
        TABLE_NAME,
        TABLE_COMMENT
      FROM 
        information_schema.TABLES
      WHERE 
        TABLE_SCHEMA = ?
      ORDER BY 
        TABLE_NAME
    `, [process.env.DB_NAME || 'bitcoin_mining_master']);

    console.log('📊 数据库表状态:\n');
    console.log('┌─────────────────────────────────────┬────────────────────────────────────────────┐');
    console.log('│ 表名                                │ 当前注释                                    │');
    console.log('├─────────────────────────────────────┼────────────────────────────────────────────┤');

    const tablesToUpdate = [];

    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      const currentComment = table.TABLE_COMMENT || '';
      const paddedName = tableName.padEnd(35);
      const paddedComment = (currentComment || '(无注释)').padEnd(40);
      
      console.log(`│ ${paddedName} │ ${paddedComment} │`);
      
      // 如果表没有注释且我们有预定义的注释，加入更新列表
      if (!currentComment && tableComments[tableName]) {
        tablesToUpdate.push({
          name: tableName,
          comment: tableComments[tableName]
        });
      }
    }

    console.log('└─────────────────────────────────────┴────────────────────────────────────────────┘\n');

    // 如果没有需要更新的表
    if (tablesToUpdate.length === 0) {
      console.log('✅ 所有表都已有注释，无需更新！\n');
      return;
    }

    // 显示将要更新的表
    console.log(`📝 发现 ${tablesToUpdate.length} 个表需要添加注释:\n`);
    
    for (const table of tablesToUpdate) {
      console.log(`   📌 ${table.name}`);
      console.log(`      → ${table.comment}\n`);
    }

    console.log('🔄 开始添加表注释...\n');

    // 更新表注释
    for (const table of tablesToUpdate) {
      try {
        await connection.query(
          `ALTER TABLE \`${table.name}\` COMMENT = ?`,
          [table.comment]
        );
        console.log(`   ✅ ${table.name} - 注释添加成功`);
      } catch (error) {
        console.error(`   ❌ ${table.name} - 注释添加失败: ${error.message}`);
      }
    }

    console.log('\n🎉 表注释添加完成！\n');

    // 验证更新结果
    console.log('🔍 验证更新结果:\n');
    const [updatedTables] = await connection.query(`
      SELECT 
        TABLE_NAME,
        TABLE_COMMENT
      FROM 
        information_schema.TABLES
      WHERE 
        TABLE_SCHEMA = ?
        AND TABLE_NAME IN (${tablesToUpdate.map(() => '?').join(',')})
      ORDER BY 
        TABLE_NAME
    `, [process.env.DB_NAME || 'bitcoin_mining_master', ...tablesToUpdate.map(t => t.name)]);

    console.log('┌─────────────────────────────────────┬────────────────────────────────────────────┐');
    console.log('│ 表名                                │ 更新后的注释                                │');
    console.log('├─────────────────────────────────────┼────────────────────────────────────────────┤');

    for (const table of updatedTables) {
      const paddedName = table.TABLE_NAME.padEnd(35);
      const paddedComment = (table.TABLE_COMMENT || '(无)').padEnd(40);
      console.log(`│ ${paddedName} │ ${paddedComment} │`);
    }

    console.log('└─────────────────────────────────────┴────────────────────────────────────────────┘\n');

  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    console.error('错误详情:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 执行脚本
addTableComments();
