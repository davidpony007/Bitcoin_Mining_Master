// adminRoutes.js
// 管理员相关接口路由，负责后台统计和管理操作
const express = require('express'); // 引入 express 框架
const router = express.Router(); // 创建路由实例
const authenticateToken = require('../middleware/auth'); // JWT 认证中间件
const { requireAdmin } = require('../middleware/role'); // 管理员权限校验中间件
const CountryMiningService = require('../services/countryMiningService'); // 国家挖矿配置服务

// GET /api/admin/stats
// 获取后台统计信息（需管理员权限）
router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
  res.json({ users: 100, miningNodes: 10, revenue: 12345 }); // 示例数据，实际应从数据库获取
});

// POST /api/admin/action
// 管理员操作接口（需管理员权限）
router.post('/action', authenticateToken, requireAdmin, (req, res) => {
  // 实际管理员操作逻辑应在此实现
  res.json({ message: 'Admin action executed' });
});

/**
 * @route   PUT /api/admin/country/:countryCode/multiplier
 * @desc    更新国家挖矿速率倍数（管理员）
 * @access  Admin
 * @param   {string} countryCode - 国家代码
 * @body    {number} multiplier - 新的挖矿速率倍数
 */
router.put('/country/:countryCode/multiplier', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { multiplier } = req.body;

    if (!multiplier || multiplier <= 0) {
      return res.status(400).json({
        success: false,
        message: '倍数必须大于0'
      });
    }

    const result = await CountryMiningService.updateMultiplier(countryCode, multiplier);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('更新国家配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/country/cache/clear
 * @desc    清除所有国家配置缓存（管理员）
 * @access  Admin
 */
router.post('/country/cache/clear', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await CountryMiningService.clearAllCache();
    res.json({
      success: true,
      message: '缓存清除成功'
    });
  } catch (error) {
    console.error('清除缓存失败:', error);
    res.status(500).json({
      success: false,
      message: '清除缓存失败',
      error: error.message
    });
  }
});

// 导出路由模块，供主应用挂载
module.exports = router;
