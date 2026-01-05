// UserStatus Routes
// 用户状态相关的 API 路由
const express = require('express');
const router = express.Router();
const userStatusController = require('../controllers/userStatusController');
const { authenticateToken } = require('../middleware/auth');

// 获取用户状态信息
router.get('/:user_id', authenticateToken, userStatusController.getUserStatus);

// 创建用户状态记录（通常在注册时自动调用）
router.post('/', authenticateToken, userStatusController.createUserStatus);

// 更新用户比特币余额
router.put('/:user_id/balance', authenticateToken, userStatusController.updateBitcoinBalance);

// 更新最后登录时间
router.put('/:user_id/login', authenticateToken, userStatusController.updateLastLoginTime);

// 更新用户活跃状态（定时任务）
router.post('/update-active-status', authenticateToken, userStatusController.updateUserActiveStatus);

// 获取用户统计信息
router.get('/:user_id/statistics', authenticateToken, userStatusController.getUserStatistics);

// 管理员功能：禁用/启用/删除用户
router.put('/:user_id/disable', authenticateToken, userStatusController.disableUser);
router.put('/:user_id/enable', authenticateToken, userStatusController.enableUser);
router.delete('/:user_id', authenticateToken, userStatusController.deleteUser);

module.exports = router;
