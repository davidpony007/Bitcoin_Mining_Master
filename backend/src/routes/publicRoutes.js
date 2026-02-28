// publicRoutes.js
// 公共信息相关接口路由，负责公告和系统状态查询
const express = require('express'); // 引入 express 框架
const router = express.Router(); // 创建路由实例

// GET /api/public/announcement
// 获取平台公告信息
router.get('/announcement', (req, res) => {
  res.json({ announcement: '欢迎使用比特币挖矿平台！' }); // 示例公告
});

// GET /api/public/status
// 获取系统运行状态（如运行时间等）
router.get('/status', (req, res) => {
  res.json({ status: 'running', uptime: process.uptime() }); // 返回系统状态和运行时间
});

// 导出路由模块，供主应用挂载
module.exports = router;
