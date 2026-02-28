/**
 * 国家挖矿配置路由
 * 
 * API 端点:
 * - GET    /api/country-mining                    获取所有国家配置
 * - GET    /api/country-mining/multiplier/:code   获取指定国家的倍率
 * - GET    /api/country-mining/stats              获取统计信息
 * - POST   /api/country-mining                    添加新国家配置 (管理员)
 * - PUT    /api/country-mining/:code              更新国家倍率 (管理员)
 * - PUT    /api/country-mining/:code/status       启用/禁用国家 (管理员)
 * - PUT    /api/country-mining/batch              批量更新 (管理员)
 */

const express = require('express');
const router = express.Router();
const CountryMiningService = require('../services/countryMiningService');
const authenticateToken = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

/**
 * GET /api/country-mining
 * 获取所有国家挖矿配置
 * 
 * Query 参数:
 * - active_only: 是否只返回启用的配置 (true/false)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const activeOnly = req.query.active_only === 'true';

    const configs = await CountryMiningService.getAllConfigs({ activeOnly });

    res.json({
      success: true,
      data: configs,
      total: configs.length
    });

  } catch (error) {
    console.error('❌ 获取国家配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置失败',
      error: error.message
    });
  }
});

/**
 * GET /api/country-mining/multiplier/:code
 * 获取指定国家的挖矿倍率
 * 
 * 路径参数:
 * - code: 国家代码 (2位字母)
 */
router.get('/multiplier/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;

    const multiplier = await CountryMiningService.getMiningMultiplier(code);

    res.json({
      success: true,
      data: {
        countryCode: code.toUpperCase(),
        miningMultiplier: multiplier
      }
    });

  } catch (error) {
    console.error('❌ 获取国家倍率失败:', error);
    res.status(500).json({
      success: false,
      message: '获取倍率失败',
      error: error.message
    });
  }
});

/**
 * GET /api/country-mining/stats
 * 获取挖矿倍率统计信息
 */
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await CountryMiningService.getStatistics();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ 获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败',
      error: error.message
    });
  }
});

/**
 * POST /api/country-mining
 * 添加新的国家配置
 * 
 * 请求体:
 * {
 *   "countryCode": "JP",
 *   "countryName": "Japan",
 *   "countryNameCn": "日本",
 *   "miningMultiplier": 20
 * }
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { countryCode, countryName, countryNameCn, miningMultiplier } = req.body;

    // 验证必填字段
    if (!countryCode || !countryName || !countryNameCn) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段'
      });
    }

    const result = await CountryMiningService.addCountry({
      countryCode,
      countryName,
      countryNameCn,
      miningMultiplier: miningMultiplier || 1.00
    });

    res.status(201).json({
      success: true,
      message: result.message,
      data: result
    });

  } catch (error) {
    console.error('❌ 添加国家配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * PUT /api/country-mining/:code
 * 更新指定国家的挖矿倍率
 * 
 * 路径参数:
 * - code: 国家代码
 * 
 * 请求体:
 * {
 *   "multiplier": 25
 * }
 */
router.put('/:code', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { code } = req.params;
    const { multiplier } = req.body;

    if (!multiplier || isNaN(multiplier)) {
      return res.status(400).json({
        success: false,
        message: '无效的倍率值'
      });
    }

    const result = await CountryMiningService.updateMultiplier(code, parseFloat(multiplier));

    res.json({
      success: true,
      message: result.message,
      data: result
    });

  } catch (error) {
    console.error('❌ 更新国家倍率失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * PUT /api/country-mining/:code/status
 * 启用或禁用国家配置
 * 
 * 请求体:
 * {
 *   "isActive": true
 * }
 */
router.put('/:code/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { code } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive 必须是布尔值'
      });
    }

    const result = await CountryMiningService.setActiveStatus(code, isActive);

    res.json({
      success: true,
      message: result.message,
      data: result
    });

  } catch (error) {
    console.error('❌ 设置国家状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * PUT /api/country-mining/batch
 * 批量更新多个国家的倍率
 * 
 * 请求体:
 * {
 *   "updates": [
 *     { "countryCode": "US", "multiplier": 30 },
 *     { "countryCode": "UK", "multiplier": 22 }
 *   ]
 * }
 */
router.put('/batch', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '无效的更新列表'
      });
    }

    const result = await CountryMiningService.batchUpdateMultipliers(updates);

    res.json({
      success: true,
      message: `成功: ${result.success}, 失败: ${result.failed}`,
      data: result
    });

  } catch (error) {
    console.error('❌ 批量更新失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
