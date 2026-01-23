/**
 * 生成测试用JWT Token
 */
require('dotenv').config(); // 加载.env文件
const jwt = require('jsonwebtoken');

const userId = 'U2026011910532463989';
const secret = process.env.JWT_SECRET || 'dev_secret_change_me';

console.log('使用的JWT_SECRET:', secret.substring(0, 10) + '...');

const token = jwt.sign(
  { 
    id: userId, 
    user_id: userId 
  },
  secret,
  { expiresIn: '7d' } // 7天有效期
);

console.log('\n生成的测试Token:');
console.log(token);
console.log('\n使用方式:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:8888/api/checkin/status?user_id=${userId}`);
