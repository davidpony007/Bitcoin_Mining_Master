// 认证接口测试：login
const request = require('supertest');
const express = require('express');
const authRoutes = require('../src/routes/authRoutes');

// 为测试设置 JWT_SECRET（测试环境）
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_ci_only';

describe('认证接口测试', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  it('登录成功应返回 token', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'u', password: 'p' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});
