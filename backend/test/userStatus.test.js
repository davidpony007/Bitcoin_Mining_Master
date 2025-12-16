// UserStatus 测试文件
// 使用 Jest 测试框架测试用户状态相关功能

const request = require('supertest');
const app = require('../src/index');
const { UserStatus, UserInformation } = require('../src/models');
const sequelize = require('../src/config/database');

describe('UserStatus API Tests', () => {
  let testUserId = 'TEST_USER_' + Date.now();
  let authToken;

  // 测试前准备
  beforeAll(async () => {
    await sequelize.sync({ force: true }); // 清空测试数据库
    
    // 创建测试用户
    await UserInformation.create({
      user_id: testUserId,
      invitation_code: 'TEST123',
      email: 'test@example.com',
      country: 'US'
    });
    
    // 这里应该获取真实的 auth token
    // authToken = await getTestAuthToken();
  });

  // 测试后清理
  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/userStatus', () => {
    it('应该成功创建用户状态记录', async () => {
      const response = await request(app)
        .post('/api/userStatus')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          user_id: testUserId,
          bitcoin_accumulated_amount: 0,
          current_bitcoin_balance: 0,
          total_invitation_rebate: 0,
          total_withdrawal_amount: 0
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user_id).toBe(testUserId);
    });

    it('不应该重复创建用户状态记录', async () => {
      const response = await request(app)
        .post('/api/userStatus')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          user_id: testUserId
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/userStatus/:user_id', () => {
    it('应该成功获取用户状态信息', async () => {
      const response = await request(app)
        .get(`/api/userStatus/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user_id).toBe(testUserId);
    });

    it('获取不存在的用户应返回404', async () => {
      const response = await request(app)
        .get('/api/userStatus/NONEXISTENT_USER')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/userStatus/:user_id/balance', () => {
    it('应该成功增加余额', async () => {
      const response = await request(app)
        .put(`/api/userStatus/${testUserId}/balance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '0.00001',
          type: 'add'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(parseFloat(response.body.data.new_balance)).toBeGreaterThan(0);
    });

    it('余额不足时不应该成功减少', async () => {
      const response = await request(app)
        .put(`/api/userStatus/${testUserId}/balance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '1000',
          type: 'subtract'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('余额不足');
    });
  });

  describe('PUT /api/userStatus/:user_id/login', () => {
    it('应该成功更新登录时间', async () => {
      const response = await request(app)
        .put(`/api/userStatus/${testUserId}/login`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.last_login_time).toBeDefined();
    });
  });

  describe('GET /api/userStatus/:user_id/statistics', () => {
    it('应该成功获取统计信息', async () => {
      const response = await request(app)
        .get(`/api/userStatus/${testUserId}/statistics`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('bitcoin_accumulated_amount');
      expect(response.body.data).toHaveProperty('withdrawn_percentage');
    });
  });
});
