// 公共路由测试
const request = require('supertest');
const express = require('express');
const publicRoutes = require('../src/routes/publicRoutes');

describe('公共路由测试', () => {
  const app = express();
  app.use('/api/public', publicRoutes);

  it('获取公告信息', async () => {
    const res = await request(app).get('/api/public/announcement');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('announcement');
  });

  it('获取系统状态', async () => {
    const res = await request(app).get('/api/public/status');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status');
  });
});
