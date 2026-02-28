// authRoutes.js
// 认证相关接口路由，负责用户登录、设备绑定、Google账号管理等功能
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/device-login
// 设备自动登录/注册接口
// 用户首次打开APP时自动创建账号或登录
router.post('/device-login', authController.deviceLogin);

// POST /api/auth/email-register
// 邮箱注册接口
router.post('/email-register', authController.emailRegister);

// POST /api/auth/email-login
// 邮箱+密码登录接口
router.post('/email-login', authController.emailLogin);

// POST /api/auth/bind-google
// 绑定Google账号
router.post('/bind-google', authController.bindGoogleAccount);

// POST /api/auth/google-login-create
// Google登录或创建用户（如果Google账号已绑定则登录，否则创建新用户）
router.post('/google-login-create', authController.googleLoginOrCreate);

// POST /api/auth/apple-login-create
// Apple登录或创建用户（仅 iOS 设备使用）
// apple_id 为 Apple sub，首次授权后固定；email/name 仅首次提供
router.post('/apple-login-create', authController.appleLoginOrCreate);

// POST /api/auth/bind-apple
// 访客用户在 Settings 页 Sign In With Apple 绑定 Apple ID
router.post('/bind-apple', authController.bindAppleAccount);

// GET /api/auth/apple-binding-status/:userId
// 查询用户的 Apple 绑定状态
router.get('/apple-binding-status/:userId', authController.getAppleBindingStatus);

// POST /api/auth/switch-google
// 通过Google账号切换用户
router.post('/switch-google', authController.switchByGoogleAccount);

// POST /api/auth/unbind-google
// 解绑Google账号
router.post('/unbind-google', authController.unbindGoogleAccount);

// GET /api/auth/google-binding-status/:userId
// 查询用户的Google绑定状态
router.get('/google-binding-status/:userId', authController.getGoogleBindingStatus);

// GET /api/auth/invitation-info
// 查询用户的邀请关系信息
router.get('/invitation-info', authController.getInvitationInfo);

// GET /api/auth/user-status
// 查询用户状态(余额、挖矿统计等)
router.get('/user-status', authController.getUserStatus);

// POST /api/auth/add-referrer
// 后期添加推荐人邀请码
router.post('/add-referrer', authController.addReferrer);

// POST /api/auth/create-ad-contract
// 创建免费广告挖矿合约
router.post('/create-ad-contract', authController.createAdFreeContract);

// POST /api/auth/activate-ad-contract
// 激活免费广告挖矿合约
router.post('/activate-ad-contract', authController.activateAdFreeContract);

// 导出路由模块，供主应用挂载
module.exports = router;
