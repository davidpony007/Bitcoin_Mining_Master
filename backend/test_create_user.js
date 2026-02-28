// 测试创建用户到云服务器 MySQL 数据库
// 使用方法: node test_create_user.js

require('dotenv').config();
const axios = require('axios');

// 配置
const API_BASE_URL = 'http://47.79.232.189:8888'; // 云服务器地址
// const API_BASE_URL = 'http://localhost:8888'; // 本地测试地址

// 生成随机用户ID
function generateUserId() {
  return 'USER' + Date.now() + Math.floor(Math.random() * 1000);
}

// 生成随机邀请码
function generateInvitationCode() {
  return 'INV' + Date.now().toString().slice(-8);
}

// 生成随机邮箱
function generateEmail() {
  return `test${Date.now()}@example.com`;
}

// 测试创建用户
async function testCreateUser() {
  console.log('======================================');
  console.log('测试创建用户到云服务器 MySQL');
  console.log('======================================\n');

  // 准备测试数据
  const testUser = {
    user_id: generateUserId(),
    invitation_code: generateInvitationCode(),
    email: generateEmail(),
    android_id: 'android_' + Date.now(),
    gaid: 'gaid_' + Date.now(),
    register_ip: '192.168.1.100',
    country: 'US'
  };

  console.log('📝 准备创建的用户信息:');
  console.log(JSON.stringify(testUser, null, 2));
  console.log('');

  try {
    // 1. 先测试健康检查
    console.log('🔍 步骤 1: 检查服务器健康状态...');
    const healthCheck = await axios.get(`${API_BASE_URL}/api/health`, {
      timeout: 5000
    });
    console.log('✅ 服务器状态:', healthCheck.data);
    console.log('');

    // 2. 创建用户信息
    console.log('🔍 步骤 2: 创建用户信息...');
    const createResponse = await axios.post(
      `${API_BASE_URL}/api/userInformation`,
      testUser,
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ 用户创建成功!');
    console.log('📊 返回数据:', JSON.stringify(createResponse.data, null, 2));
    console.log('');

    // 3. 创建用户状态记录
    console.log('🔍 步骤 3: 创建用户状态记录...');
    const userStatusData = {
      user_id: testUser.user_id,
      bitcoin_accumulated_amount: 0,
      current_bitcoin_balance: 0,
      total_invitation_rebate: 0,
      total_withdrawal_amount: 0
    };

    // 注意：这个接口可能需要 token，先跳过或者你需要实现无 token 版本
    console.log('⚠️  创建用户状态需要认证 token，暂时跳过');
    console.log('   你可以手动在数据库中创建或修改 userStatusRoutes.js 移除认证');
    console.log('');

    // 4. 验证用户已创建
    console.log('🔍 步骤 4: 验证用户是否创建成功...');
    const verifyResponse = await axios.get(
      `${API_BASE_URL}/api/userInformation`,
      { timeout: 5000 }
    );
    
    const createdUser = verifyResponse.data.find(u => u.user_id === testUser.user_id);
    if (createdUser) {
      console.log('✅ 验证成功! 用户已存在于数据库中');
      console.log('📊 数据库中的用户信息:', JSON.stringify(createdUser, null, 2));
    } else {
      console.log('❌ 验证失败! 未找到刚创建的用户');
    }
    console.log('');

    console.log('======================================');
    console.log('✅ 测试完成!');
    console.log('======================================');
    console.log('');
    console.log('📌 创建的用户信息:');
    console.log(`   用户ID: ${testUser.user_id}`);
    console.log(`   邀请码: ${testUser.invitation_code}`);
    console.log(`   邮箱: ${testUser.email}`);
    console.log('');
    console.log('💡 下一步建议:');
    console.log('   1. 登录 phpMyAdmin 验证数据: http://47.79.232.189:8888/phpmyadmin');
    console.log('   2. 查看 user_information 表');
    console.log('   3. 手动创建对应的 user_status 记录');
    console.log('');

  } catch (error) {
    console.error('❌ 测试失败!');
    console.error('');
    
    if (error.response) {
      // 服务器返回错误
      console.error('📛 服务器错误:');
      console.error('   状态码:', error.response.status);
      console.error('   错误信息:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // 请求发出但没有响应
      console.error('📛 网络错误:');
      console.error('   无法连接到服务器:', API_BASE_URL);
      console.error('   请检查:');
      console.error('   1. 服务器是否正在运行?');
      console.error('   2. 防火墙是否开放 8888 端口?');
      console.error('   3. 网络连接是否正常?');
    } else {
      // 其他错误
      console.error('📛 未知错误:');
      console.error('   ', error.message);
    }
    console.error('');
  }
}

// 执行测试
testCreateUser();
