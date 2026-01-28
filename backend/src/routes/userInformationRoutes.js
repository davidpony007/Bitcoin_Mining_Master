// userInformationRoutes.js
// 用户信息相关接口路由，负责用户信息的查询和创建
const express = require('express'); // 引入 express 框架
const router = express.Router(); // 创建路由实例
const userController = require('../controllers/userController'); // 用户控制器，包含业务逻辑

// GET /api/userInformation/
// 查询所有用户信息
router.get('/', userController.getAllUsers);

// POST /api/userInformation/
// 创建新用户信息
router.post('/', userController.createUser);

// PUT /api/userInformation/:user_id/nickname
// 更新用户昵称
router.put('/:user_id/nickname', userController.updateNickname);

// 导出路由模块，供主应用挂载
module.exports = router;
