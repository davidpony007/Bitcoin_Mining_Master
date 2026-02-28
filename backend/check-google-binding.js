/**
 * 检查Google账号绑定情况
 * 验证Google账号是否正确保存到MySQL数据库
 */

const { sequelize } = require('./src/config/database');
const UserInformation = require('./src/models/userInformation');

async function checkGoogleBinding() {
  try {
    console.log('📊 检查Google账号绑定情况...\n');

    // 1. 查询所有已绑定Google账号的用户
    const usersWithGoogle = await UserInformation.findAll({
      where: {
        google_account: {
          [require('sequelize').Op.ne]: null
        }
      },
      attributes: ['user_id', 'google_account', 'email', 'android_id', 'created_at'],
      order: [['created_at', 'DESC']]
    });

    console.log(`✅ 找到 ${usersWithGoogle.length} 个已绑定Google账号的用户\n`);

    if (usersWithGoogle.length > 0) {
      console.log('📋 用户列表：');
      console.log('─'.repeat(100));
      usersWithGoogle.forEach((user, index) => {
        console.log(`${index + 1}. User ID: ${user.user_id}`);
        console.log(`   Google账号: ${user.google_account}`);
        console.log(`   邮箱: ${user.email || '未设置'}`);
        console.log(`   Android ID: ${user.android_id}`);
        console.log(`   创建时间: ${user.created_at}`);
        console.log('─'.repeat(100));
      });
    } else {
      console.log('⚠️  当前没有用户绑定Google账号');
    }

    // 2. 查询特定用户的Google绑定状态
    const testUserId = 'U2026012402243718810'; // 替换为你的user_id
    const testUser = await UserInformation.findOne({
      where: { user_id: testUserId }
    });

    console.log(`\n\n🔍 检查特定用户 (${testUserId}):`);
    if (testUser) {
      console.log('✅ 用户存在');
      console.log(`   User ID: ${testUser.user_id}`);
      console.log(`   Google账号: ${testUser.google_account || '未绑定'}`);
      console.log(`   邮箱: ${testUser.email || '未设置'}`);
      console.log(`   Android ID: ${testUser.android_id}`);
      console.log(`   创建时间: ${testUser.created_at}`);
      console.log(`   更新时间: ${testUser.updated_at}`);
    } else {
      console.log('❌ 用户不存在');
    }

    // 3. 统计信息
    const totalUsers = await UserInformation.count();
    const googleUsers = await UserInformation.count({
      where: {
        google_account: {
          [require('sequelize').Op.ne]: null
        }
      }
    });

    console.log('\n\n📈 统计信息：');
    console.log(`   总用户数: ${totalUsers}`);
    console.log(`   已绑定Google账号: ${googleUsers}`);
    console.log(`   未绑定Google账号: ${totalUsers - googleUsers}`);
    console.log(`   绑定率: ${((googleUsers / totalUsers) * 100).toFixed(2)}%`);

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await sequelize.close();
    console.log('\n✅ 数据库连接已关闭');
  }
}

// 执行检查
checkGoogleBinding();
