// miningRoutes.js
// 挖矿相关接口路由，负责处理挖矿状态查询和任务提交
const express = require('express'); // 引入 express 框架
const router = express.Router(); // 创建路由实例
const miningQueue = require('../queue/jobQueue'); // 挖矿任务队列模块
const authenticate = require('../middleware/auth'); // 认证中间件
const LevelService = require('../services/levelService'); // 等级服务
const miningConfig = require('../config/mining'); // 挖矿配置

// GET /api/mining/status
// 查询当前挖矿状态（如算力、是否正在挖矿等）
router.get('/status', (req, res) => {
  res.json({ mining: true, hashRate: 123.45 }); // 示例返回，实际应从业务层获取
});

// GET /api/mining/hashrate
// 获取用户算力信息（基础算力 5.5 Gh/s + 倍数加成）
router.get('/hashrate', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    // 获取挖矿速度信息（包含倍数）
    const speedInfo = await LevelService.calculateMiningSpeed(user_id);

    // 计算显示算力（受等级和签到倍数影响）
    const displayHashrate = miningConfig.BASE_HASHRATE_GHS * speedInfo.finalMultiplier;

    res.json({
      success: true,
      data: {
        baseHashrate: miningConfig.BASE_HASHRATE_GHS, // 基础算力 5.5 Gh/s
        displayHashrate: parseFloat(displayHashrate.toFixed(2)), // 显示算力
        btcPerSecond: speedInfo.finalSpeed, // 每秒产出（不含国家倍数）
        btcPerSecondWithCountry: speedInfo.finalSpeedWithCountry, // 每秒产出（含国家倍数）
        btcPerHour: speedInfo.finalSpeed * miningConfig.SECONDS_PER_HOUR,
        btcPerDay: speedInfo.finalSpeed * miningConfig.SECONDS_PER_DAY,
        multipliers: {
          level: speedInfo.levelMultiplier,
          dailyBonus: speedInfo.dailyBonusMultiplier,
          country: speedInfo.countryMultiplier,
          total: speedInfo.finalMultiplier
        },
        isMining: true,
        dailyBonusActive: speedInfo.dailyBonusActive
      }
    });
  } catch (error) {
    console.error('❌ 获取算力信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取算力信息失败',
      error: error.message
    });
  }
});

// POST /api/mining/start
// 提交新的挖矿任务，加入异步队列
router.post('/start', async (req, res) => {
  // 将挖矿任务加入队列，支持用户信息和参数
  const job = await miningQueue.add({ user: req.user ? req.user.username : 'guest', params: req.body });
  res.json({ message: 'Mining task queued', jobId: job.id }); // 返回任务已入队
});

// 导出路由模块，供主应用挂载
module.exports = router;
