/**
 * 检查数据库表结构
 */

require('dotenv').config();
const UserInformation = require('./src/models/userInformation');

async function checkDatabase() {
  try {
    console.log('===== 检查数据库 =====\n');

    // 获取一个用户示例
    const user = await UserInformation.findOne();
    
    if (user) {
      console.log('✅ 找到用户:', user.user_id);
      console.log('\n用户数据字段:');
      console.log(Object.keys(user.dataValues).sort());
      console.log('\n用户完整数据:');
      console.log(JSON.stringify(user.dataValues, null, 2));
    } else {
      console.log('❌ 数据库中没有用户');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

checkDatabase();
