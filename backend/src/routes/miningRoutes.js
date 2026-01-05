// miningRoutes.js
// 挖矿相关接口路由，负责处理挖矿状态查询和任务提交
const express = require('express'); // 引入 express 框架
const router = express.Router(); // 创建路由实例
const miningQueue = require('../queue/jobQueue'); // 挖矿任务队列模块

// GET /api/mining/status
// 查询当前挖矿状态（如算力、是否正在挖矿等）
router.get('/status', (req, res) => {
  res.json({ mining: true, hashRate: 123.45 }); // 示例返回，实际应从业务层获取
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
