// user.test.js
// 用户接口单元测试文件，使用 supertest 模拟 HTTP 请求，验证注册接口功能
const request = require('supertest'); // supertest 用于模拟 HTTP 请求
const express = require('express'); // 引入 express 框架
const userRoutes = require('../src/routes/userRoutes'); // 用户路由模块

describe('用户接口测试', () => {
  // 创建一个独立的 Express 应用用于测试
  const app = express();
  app.use(express.json()); // 支持 JSON 请求体
  app.use('/api/users', userRoutes); // 挂载用户路由

  // 测试用例：注册新用户
  it('注册新用户', async () => {
    // 发送 POST 请求到注册接口，模拟用户注册
    const res = await request(app)
      .post('/api/users/register')
      .send({ username: 'testuser', password: 'testpass' });
    // 断言返回状态码为 201（创建成功）
    expect(res.statusCode).toBe(201);
    // 断言返回体包含 message 字段
    expect(res.body).toHaveProperty('message');
  });
});
