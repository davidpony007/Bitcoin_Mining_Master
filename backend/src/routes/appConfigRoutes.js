/**
 * App版本配置路由
 * GET /api/app/config?platform=android|ios
 * 公开接口，无需认证，用于客户端启动时检查版本更新
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database_native');

/**
 * 比较版本号大小
 * @returns {number} 1: v1 > v2, -1: v1 < v2, 0: 相等
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * @route   GET /api/app/config
 * @desc    获取App版本配置，客户端据此判断是否需要更新
 * @access  Public
 * @query   platform - 'android' | 'ios'（必填）
 * @query   current_version - 当前版本号，如 '1.0.1'（可选，传入则返回是否需要更新）
 */
router.get('/config', async (req, res) => {
  try {
    const { platform, current_version } = req.query;

    if (!platform || !['android', 'ios'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: "参数 platform 必须为 'android' 或 'ios'"
      });
    }

    // 查询对应平台配置，优先精确匹配，回退到 'all'
    const [rows] = await pool.query(
      `SELECT * FROM app_config
       WHERE platform = ? OR platform = 'all'
       ORDER BY FIELD(platform, ?, 'all') ASC
       LIMIT 1`,
      [platform, platform]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到版本配置'
      });
    }

    const config = rows[0];
    const response = {
      success: true,
      data: {
        latest_version: config.latest_version,
        min_version:    config.min_version,
        build_number:   config.build_number,
        update_message: config.update_message,
        force_update:   Boolean(config.force_update),
        store_url:      config.store_url,
        updated_at:     config.updated_at,
      }
    };

    // 如果客户端传入了当前版本号，附加版本比较结果
    if (current_version) {
      const hasUpdate      = compareVersions(config.latest_version, current_version) > 0;
      const belowMinVersion = compareVersions(current_version, config.min_version) < 0;
      response.data.has_update        = hasUpdate;
      response.data.force_update      = belowMinVersion || Boolean(config.force_update);
      response.data.current_version   = current_version;
    }

    res.json(response);
  } catch (error) {
    console.error('[AppConfig] 获取版本配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取版本配置失败',
      error: error.message
    });
  }
});

module.exports = router;
