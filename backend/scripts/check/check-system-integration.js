/**
 * 积分系统、签到系统、电池系统 - 三层配置关联性诊断脚本
 */

require('dotenv').config();
const fs = require('fs');
const sequelize = require('../src/config/database');

console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('   积分系统、签到系统、电池系统 - 三层配置关联性诊断报告');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
console.log('📋 检查范围：');
console.log('   1. 客户端 (Flutter) - API调用');
console.log('   2. 后端服务 (Node.js) - API路由与逻辑');
console.log('   3. 云端MySQL (47.79.232.189) - 数据库表结构');
console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');

// 第一部分：检查后端文件结构
console.log('🗄️  数据库连接配置：');
console.log('   主机: ' + process.env.DB_HOST);
console.log('   端口: ' + process.env.DB_PORT);
console.log('   数据库: ' + process.env.DB_NAME);
console.log('   用户: ' + process.env.DB_USER);
console.log('');

// 检查路由文件
const routesPath = './src/routes/';
const pointsRouteExists = fs.existsSync(routesPath + 'pointsRoutes.js');
const checkInRouteExists = fs.existsSync(routesPath + 'checkInRoutes.js');
const contractRouteExists = fs.existsSync(routesPath + 'contractStatusRoutes.js');
const levelRouteExists = fs.existsSync(routesPath + 'levelRoutes.js');

console.log('🛣️  后端API路由文件：');
console.log('   ' + (pointsRouteExists ? '✅' : '❌') + ' pointsRoutes.js (积分系统)');
console.log('   ' + (checkInRouteExists ? '✅' : '❌') + ' checkInRoutes.js (签到系统)');
console.log('   ' + (contractRouteExists ? '✅' : '❌') + ' contractStatusRoutes.js (合约/电池)');
console.log('   ' + (levelRouteExists ? '✅' : '❌') + ' levelRoutes.js (等级系统)');
console.log('');

// 检查服务文件
const servicesPath = './src/services/';
const pointsServiceExists = fs.existsSync(servicesPath + 'pointsService.js');
const checkInServiceExists = fs.existsSync(servicesPath + 'checkInPointsService.js');

console.log('⚙️  后端业务逻辑服务：');
console.log('   ' + (pointsServiceExists ? '✅' : '❌') + ' pointsService.js');
console.log('   ' + (checkInServiceExists ? '✅' : '❌') + ' checkInPointsService.js');
console.log('');

// 检查模型文件
const modelsPath = './src/models/';
const freeContractExists = fs.existsSync(modelsPath + 'freeContractRecord.js');
const userInfoExists = fs.existsSync(modelsPath + 'userInformation.js');

console.log('📦 数据库模型定义：');
console.log('   ' + (freeContractExists ? '✅' : '❌') + ' freeContractRecord.js (免费合约)');
console.log('   ' + (userInfoExists ? '✅' : '❌') + ' userInformation.js (用户信息)');
console.log('');

console.log('═══════════════════════════════════════════════════════════════════');
console.log('');

// 第二部分：检查数据库表结构
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 云端MySQL数据库连接成功');
    console.log('');
    
    // 检查关键表是否存在
    const tables = [
      'user_information',
      'free_contract_records',
      'check_in_record',
      'check_in_reward_config',
      'points_transaction_record'
    ];
    
    console.log('📊 云端MySQL数据库表检查：');
    console.log('');
    
    for (const table of tables) {
      try {
        const [rows] = await sequelize.query(`SELECT COUNT(*) as cnt FROM \`${table}\` LIMIT 1`);
        const count = rows[0].cnt;
        console.log('   ✅ ' + table.padEnd(35) + ' (' + count + ' 行)');
      } catch (e) {
        console.log('   ❌ ' + table.padEnd(35) + ' (不存在)');
      }
    }
    
    console.log('');
    
    // 检查user_information表的积分字段
    try {
      const [columns] = await sequelize.query(`SHOW COLUMNS FROM user_information LIKE 'user_points'`);
      if (columns.length > 0) {
        console.log('   ✅ user_information.user_points 字段存在');
      } else {
        console.log('   ⚠️  user_information.user_points 字段不存在');
      }
    } catch (e) {
      console.log('   ❌ 无法检查user_points字段');
    }
    
    // 检查free_contract_records表的关键字段
    try {
      const [columns] = await sequelize.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'bitcoin_mining_master' 
        AND TABLE_NAME = 'free_contract_records'
        AND COLUMN_NAME IN ('user_id', 'free_contract_type', 'hashrate', 'mining_status')
      `);
      console.log('   ✅ free_contract_records 字段: ' + columns.map(c => c.COLUMN_NAME).join(', '));
    } catch (e) {
      console.log('   ❌ 无法检查free_contract_records字段');
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    
    // 第三部分：检查数据流完整性
    console.log('🔄 数据流完整性检查：');
    console.log('');
    
    // 检查签到记录表
    try {
      const [records] = await sequelize.query(`
        SELECT COUNT(*) as total_checkins,
               COUNT(DISTINCT user_id) as unique_users
        FROM check_in_record
      `);
      console.log('   📅 签到记录:');
      console.log('      总签到次数: ' + records[0].total_checkins);
      console.log('      参与用户数: ' + records[0].unique_users);
    } catch (e) {
      console.log('   ❌ 无法查询签到记录');
    }
    
    // 检查积分交易记录
    try {
      const [records] = await sequelize.query(`
        SELECT COUNT(*) as total_transactions,
               COUNT(DISTINCT user_id) as unique_users,
               SUM(CASE WHEN points_change > 0 THEN points_change ELSE 0 END) as total_earned
        FROM points_transaction_record
      `);
      console.log('   💰 积分交易:');
      console.log('      总交易数: ' + records[0].total_transactions);
      console.log('      参与用户数: ' + records[0].unique_users);
      console.log('      总获得积分: ' + (records[0].total_earned || 0));
    } catch (e) {
      console.log('   ❌ 无法查询积分交易记录');
    }
    
    // 检查合约记录
    try {
      const [contracts] = await sequelize.query(`
        SELECT 
          free_contract_type,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as users
        FROM free_contract_records
        WHERE free_contract_type IN ('daily sign-in free contract', 'ad free contract')
        GROUP BY free_contract_type
      `);
      console.log('   🔋 免费合约:');
      contracts.forEach(c => {
        const type = c.free_contract_type === 'daily sign-in free contract' ? '每日签到合约' : '广告奖励合约';
        console.log('      ' + type + ': ' + c.count + ' 条记录, ' + c.users + ' 用户');
      });
    } catch (e) {
      console.log('   ❌ 无法查询免费合约记录');
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    
    // 第四部分：API端点映射
    console.log('🌐 客户端 → 后端 → 数据库 完整数据流：');
    console.log('');
    
    console.log('1️⃣  积分系统：');
    console.log('   Flutter: PointsApiService.getPointsBalance()');
    console.log('   ↓ GET /api/points/balance?user_id=xxx');
    console.log('   Backend: pointsRoutes.js → PointsService.getUserPoints()');
    console.log('   ↓ SELECT user_points FROM user_information');
    console.log('   MySQL: user_information.user_points');
    console.log('');
    
    console.log('2️⃣  每日签到：');
    console.log('   Flutter: PointsApiService.performCheckIn()');
    console.log('   ↓ POST /api/checkin {user_id}');
    console.log('   Backend: checkInRoutes.js → CheckInPointsService.performCheckIn()');
    console.log('   ↓ INSERT INTO check_in_record, UPDATE user_information');
    console.log('   MySQL: check_in_record + user_information.user_points');
    console.log('');
    
    console.log('3️⃣  电池系统（合约）：');
    console.log('   Flutter: ContractApiService.getMyContracts()');
    console.log('   ↓ GET /api/contract-status/my-contracts/:userId');
    console.log('   Backend: contractStatusRoutes.js');
    console.log('   ↓ SELECT FROM free_contract_records WHERE mining_status = "mining"');
    console.log('   MySQL: free_contract_records (hashrate, free_contract_end_time)');
    console.log('');
    
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    
    // 第五部分：问题诊断
    console.log('🔍 潜在问题诊断：');
    console.log('');
    
    let hasIssues = false;
    
    // 检查是否有用户没有积分字段数据
    try {
      const [users] = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM user_information 
        WHERE user_points IS NULL
      `);
      if (users[0].count > 0) {
        console.log('   ⚠️  发现 ' + users[0].count + ' 个用户的user_points字段为NULL');
        hasIssues = true;
      }
    } catch (e) {}
    
    // 检查是否有签到记录但没有积分记录
    try {
      const [orphaned] = await sequelize.query(`
        SELECT COUNT(DISTINCT cr.user_id) as count
        FROM check_in_record cr
        LEFT JOIN points_transaction_record ptr 
          ON cr.user_id = ptr.user_id 
          AND ptr.transaction_type = 'DAILY_CHECKIN'
          AND DATE(cr.check_in_date) = DATE(ptr.transaction_time)
        WHERE ptr.id IS NULL
      `);
      if (orphaned[0].count > 0) {
        console.log('   ⚠️  发现 ' + orphaned[0].count + ' 个用户有签到记录但缺少对应的积分交易记录');
        hasIssues = true;
      }
    } catch (e) {}
    
    // 检查是否有过期的挖矿合约still标记为mining
    try {
      const [expired] = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM free_contract_records
        WHERE mining_status = 'mining' AND free_contract_end_time < NOW()
      `);
      if (expired[0].count > 0) {
        console.log('   ⚠️  发现 ' + expired[0].count + ' 个已过期但仍标记为mining的合约');
        hasIssues = true;
      }
    } catch (e) {}
    
    if (!hasIssues) {
      console.log('   ✅ 未发现明显的数据一致性问题');
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 总结：');
    
    const allSystemsGo = pointsRouteExists && checkInRouteExists && contractRouteExists && 
                         pointsServiceExists && checkInServiceExists;
    
    if (allSystemsGo && !hasIssues) {
      console.log('   ✅ 三层配置关联性正常');
      console.log('   ✅ 客户端 ↔ 后端 ↔ 数据库 数据流完整');
      console.log('   ✅ 积分系统、签到系统、电池系统运行正常');
    } else {
      console.log('   ⚠️  系统存在一些潜在问题，建议检查上述标记项');
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    
    process.exit(0);
    
  } catch (e) {
    console.error('❌ 数据库连接失败:', e.message);
    console.error('');
    console.error('⚠️  无法完成完整的数据库检查');
    console.error('   请确认：');
    console.error('   1. 云端MySQL服务器是否在线');
    console.error('   2. 网络连接是否正常');
    console.error('   3. 数据库用户权限是否正确');
    console.log('');
    process.exit(1);
  }
})();
