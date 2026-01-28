/**
 * 实时余额路由
 * 提供用户实时余额查询API
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database_native');
const redisClient = require('../config/redis');
const RealtimeBalanceService = require('../services/realtimeBalanceService');

/**
 * GET /api/balance/realtime/:userId
 * 获取用户实时余额和挖矿速率
 * 
 * 返回：
 * - balance: 当前实时余额（包含未持久化的挖矿收益）
 * - balanceInDb: 数据库中的余额（上次持久化的值）
 * - speedPerSecond: 当前每秒挖矿速率
 * - lastUpdateTime: 上次余额更新时间
 * - minedSinceLastUpdate: 自上次更新以来挖到的BTC
 * - nextSyncIn: 距离下次同步的秒数
 */
router.get('/realtime/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }
    
    // 1. 从Redis获取缓存的挖矿速率（缓存1分钟）
    let speedPerSecond = await redisClient.getMiningSpeed(userId);
    
    if (speedPerSecond === null || speedPerSecond === undefined) {
      // 缓存未命中，重新计算并缓存
      speedPerSecond = await RealtimeBalanceService.calculateUserPerSecondRevenue(userId);
      await redisClient.setMiningSpeed(userId, speedPerSecond, 60); // 缓存60秒
    }
    
    // 2. 从MySQL获取最后一次持久化的余额和时间
    const [userStatus] = await pool.query(
      `SELECT 
        current_bitcoin_balance, 
        bitcoin_accumulated_amount,
        last_balance_update_time 
      FROM user_status 
      WHERE user_id = ?`,
      [userId]
    );
    
    if (userStatus.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 3. 计算从上次更新到现在的挖矿收益
    const lastUpdateTime = new Date(userStatus[0].last_balance_update_time || Date.now());
    const now = new Date();
    // 确保elapsedSeconds为正数,防止时间错误导致负值
    const elapsedSeconds = Math.max(0, Math.floor((now - lastUpdateTime) / 1000));
    const minedSinceLastUpdate = speedPerSecond * elapsedSeconds;
    
    // 4. 计算当前实时余额
    const balanceInDb = parseFloat(userStatus[0].current_bitcoin_balance) || 0;
    const currentBalance = Math.max(0, balanceInDb + minedSinceLastUpdate); // 确保余额不为负
    
    // 5. 计算距离下次同步的时间（2小时 = 7200秒）
    const twoHours = 2 * 60 * 60;
    const nextSyncIn = Math.max(0, twoHours - elapsedSeconds);
    
    res.json({
      success: true,
      data: {
        balance: currentBalance,                         // 当前实时余额
        balanceInDb: balanceInDb,                       // 数据库余额
        accumulatedAmount: parseFloat(userStatus[0].bitcoin_accumulated_amount) || 0, // 累计挖矿总量
        speedPerSecond: speedPerSecond,                 // 每秒挖矿速率
        lastUpdateTime: lastUpdateTime.toISOString(),   // 上次更新时间
        elapsedSeconds: elapsedSeconds,                 // 已过时间（秒）
        minedSinceLastUpdate: minedSinceLastUpdate,     // 自上次更新以来挖到的BTC
        nextSyncIn: nextSyncIn,                         // 距离下次同步的秒数
        nextSyncTime: new Date(now.getTime() + nextSyncIn * 1000).toISOString() // 下次同步时间
      }
    });
    
  } catch (err) {
    console.error('❌ 获取实时余额失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

/**
 * GET /api/balance/mining-speed/:userId
 * 仅获取挖矿速率（轻量级接口）
 */
router.get('/mining-speed/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }
    
    // 从Redis获取或计算挖矿速率
    let speedPerSecond = await redisClient.getMiningSpeed(userId);
    
    if (speedPerSecond === null || speedPerSecond === undefined) {
      speedPerSecond = await RealtimeBalanceService.calculateUserPerSecondRevenue(userId);
      await redisClient.setMiningSpeed(userId, speedPerSecond, 60);
    }
    
    res.json({
      success: true,
      data: {
        speedPerSecond: speedPerSecond,
        speedPerHour: speedPerSecond * 3600,
        speedPerDay: speedPerSecond * 86400,
        cachedUntil: new Date(Date.now() + 60000).toISOString()
      }
    });
    
  } catch (err) {
    console.error('❌ 获取挖矿速率失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

/**
 * POST /api/balance/clear-cache/:userId
 * 清除用户挖矿速率缓存（合约变更时调用）
 */
router.post('/clear-cache/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }
    
    await redisClient.deleteMiningSpeed(userId);
    
    res.json({
      success: true,
      message: '缓存已清除'
    });
    
  } catch (err) {
    console.error('❌ 清除缓存失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

module.exports = router;
