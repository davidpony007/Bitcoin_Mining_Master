// userRoutes.js
// 用户相关接口路由，负责用户注册、查询等功能
const express = require('express'); // 引入 express 框架
const router = express.Router(); // 创建路由实例
const authenticateToken = require('../middleware/auth'); // JWT 认证中间件
const userController = require('../controllers/userController'); // 用户控制器，包含业务逻辑
const sequelize = require('../config/database'); // 数据库连接
const { QueryTypes } = require('sequelize'); // Sequelize 查询类型

// GET /api/users/
// 查询所有用户（需要 JWT 认证）
// 注意：这是示例代码，实际应该调用 userController 从数据库查询
router.get('/', authenticateToken, (req, res) => {
  res.json([
    { id: 1, username: 'alice' },
    { id: 2, username: 'bob' }
  ]); // 示例数据，实际应从数据库获取
});

// POST /api/users/
// 创建新用户（业务逻辑由 userController 实现）
// 这个接口已经完整实现了用户创建功能，包括密码处理
router.post('/', userController.createUser);

// GET /api/user/bitcoin-balance
// 获取用户比特币余额
router.get('/bitcoin-balance', async (req, res) => {
  try {
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId parameter'
      });
    }

    // 查询用户状态表获取比特币余额
    const [userStatus] = await sequelize.query(
      `SELECT current_bitcoin_balance, bitcoin_accumulated_amount 
       FROM user_status 
       WHERE user_id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT
      }
    );

    if (!userStatus) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        currentBalance: parseFloat(userStatus.current_bitcoin_balance) || 0,
        accumulatedAmount: parseFloat(userStatus.bitcoin_accumulated_amount) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching bitcoin balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bitcoin balance'
    });
  }
});

// 导出路由模块,供主应用挂载
module.exports = router;
