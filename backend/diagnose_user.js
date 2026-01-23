const mysql = require('mysql2/promise');

const userId = 'U2026011910532463989';

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  用户 ${userId} 数据诊断`);
  console.log('═══════════════════════════════════════════════════════\n');

  const connection = await mysql.createConnection({
    host: '47.79.232.189',
    user: 'bitcoin_mining_master',
    password: 'FzFbWmwMptnN3ABE',
    database: 'bitcoin_mining_master',
    port: 3306
  });

  try {
    const tables = [
      'user_information',
      'user_status',
      'user_points',
      'free_contract_records',
      'check_in_record',
      'ad_view_record',
      'points_transaction',
      'cumulative_check_in_reward',
      'bitcoin_transaction_records',
      'mining_contracts'
    ];

    console.log('【1】检查用户在各表中的存在情况\n');
    
    const results = {};
    
    for (const table of tables) {
      try {
        const [rows] = await connection.query(
          `SELECT * FROM ${table} WHERE user_id = ?`,
          [userId]
        );
        
        results[table] = rows;
        const status = rows.length > 0 ? '✅' : '❌';
        console.log(`${status} ${table.padEnd(35)} ${rows.length} 条记录`);
        
      } catch (error) {
        console.log(`⚠️  ${table.padEnd(35)} 查询失败: ${error.message}`);
      }
    }

    console.log('\n【2】用户详细信息\n');

    if (results.user_information && results.user_information.length > 0) {
      const user = results.user_information[0];
      console.log('用户基本信息:');
      console.log(`  用户ID: ${user.user_id}`);
      console.log(`  邮箱: ${user.email || '未设置'}`);
      console.log(`  Google账号: ${user.google_account || '未设置'}`);
      console.log(`  积分: ${user.user_points || 0}`);
      console.log(`  等级: ${user.user_level || 1}`);
      console.log(`  国家: ${user.country || '未设置'}`);
      console.log(`  邀请码: ${user.invitation_code || '未设置'}`);
      console.log(`  推荐人邀请码: ${user.referrer_invitation_code || '未设置'}`);
      console.log(`  创建时间: ${user.created_at}`);
      console.log(`  最后登录: ${user.last_login_time || '未记录'}`);
    } else {
      console.log('❌ 用户在 user_information 表中不存在！');
    }

    if (results.user_status && results.user_status.length > 0) {
      console.log('\n用户挖矿状态:');
      const status = results.user_status[0];
      console.log(`  当前余额: ${status.current_bitcoin_balance || 0} BTC`);
      console.log(`  总收益: ${status.total_bitcoin_mined || 0} BTC`);
      console.log(`  挖矿速度: ${status.mining_speed || 0} GH/s`);
    }

    console.log('\n【3】空表总记录数统计\n');

    const emptyTables = ['check_in_record', 'ad_view_record', 'bitcoin_transaction_records', 
                         'cumulative_check_in_reward', 'mining_contracts'];
    
    for (const table of emptyTables) {
      const [count] = await connection.query(`SELECT COUNT(*) as total FROM ${table}`);
      console.log(`${table.padEnd(35)} 总记录数: ${count[0].total}`);
    }

    console.log('\n【4】诊断结论\n');

    const hasUserData = results.user_information && results.user_information.length > 0;
    const hasCheckIn = results.check_in_record && results.check_in_record.length > 0;
    const hasAdView = results.ad_view_record && results.ad_view_record.length > 0;
    const hasPoints = results.points_transaction && results.points_transaction.length > 0;

    if (!hasUserData) {
      console.log('❌ 严重问题: 用户不存在于user_information表中');
      console.log('   建议: 检查用户注册流程');
    } else {
      console.log('✅ 用户基本信息存在');
      
      if (!hasCheckIn && !hasAdView && !hasPoints) {
        console.log('\n⚠️  核心功能数据全部为空');
        console.log('   最可能原因: 用户尚未使用这些功能');
        console.log('   建议操作:');
        console.log('     1. 在模拟器中打开应用');
        console.log('     2. 手动点击 "Check In Now" 按钮');
        console.log('     3. 手动点击 "Watch Ad" 按钮');
        console.log('     4. 再次运行此诊断脚本');
      } else {
        console.log('\n✅ 部分功能已被使用:');
        if (hasCheckIn) console.log('   - 签到功能已使用');
        if (hasAdView) console.log('   - 广告功能已使用');
        if (hasPoints) console.log('   - 积分系统已使用');
      }
    }

    console.log('\n【5】建议的测试步骤\n');
    console.log('1. 检查后端服务是否运行:');
    console.log('   curl http://localhost:8888/api/checkin/status?user_id=' + userId);
    console.log('');
    console.log('2. 手动执行签到API:');
    console.log(`   curl -X POST "http://localhost:8888/api/checkin" -H "Content-Type: application/json" -d '{"user_id": "${userId}"}'`);
    console.log('');
    console.log('3. 在模拟器中测试:');
    console.log('   flutter run -d emulator-5554');
    console.log('   然后在应用中点击各功能按钮');

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ 诊断完成');
    console.log('═══════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
})();
