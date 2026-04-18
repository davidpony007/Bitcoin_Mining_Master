/**
 * Mining Pool路由 - 管理用户的挖矿能量电池
 * 每个电池可以为Free Ad Reward合约增加1小时挖矿时间
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/database_native'); // 使用原生MySQL连接池
const { Op } = require('sequelize');
const PointsService = require('../services/pointsService'); // 📌 导入积分服务
const MiningConfigService = require('../services/miningConfigService'); // 基础挖矿速率配置
const authenticateToken = require('../middleware/auth'); // JWT 鉴权中间件

/**
 * POST /api/mining-pool/use-battery
 * 使用一个电池为Free Ad Reward合约增加1小时挖矿时间
 * 
 * 请求体:
 * {
 *   "user_id": "U2026011910532521846",
 *   "battery_count": 1  // 使用的电池数量，默认1
 * }
 */
router.post('/use-battery', authenticateToken, async (req, res) => {
  let connection;
  
  try {
    const { user_id, battery_count = 1 } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // JWT 用户身份校验
    const jwtUserId = req.user?.userId || req.user?.user_id;
    if (jwtUserId && String(jwtUserId) !== String(user_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (battery_count < 1 || battery_count > 24) {
      return res.status(400).json({
        success: false,
        message: 'Battery count must be between 1 and 24'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 查找用户当前活跃的Ad Free Contract
      const [contracts] = await connection.query(
        `SELECT id, free_contract_end_time 
         FROM free_contract_records 
         WHERE user_id = ? 
         AND free_contract_type = 'Free Ad Reward'
         AND free_contract_end_time > NOW()
         ORDER BY free_contract_creation_time DESC
         LIMIT 1`,
        [user_id]
      );

      if (contracts.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'No active Ad Free Contract found. Please create one first.'
        });
      }

      const contract = contracts[0];
      const contractId = contract.id;

      // 2. 计算新的结束时间（增加电池数量对应的小时数）
      const hoursToAdd = battery_count; // 每个电池1小时

      // 3. 更新合约结束时间
      await connection.query(
        `UPDATE free_contract_records 
         SET free_contract_end_time = DATE_ADD(free_contract_end_time, INTERVAL ? HOUR)
         WHERE id = ?`,
        [hoursToAdd, contractId]
      );
      
      // 查询更新后的结束时间
      const [updated] = await connection.query(
        'SELECT free_contract_end_time FROM free_contract_records WHERE id = ?',
        [contractId]
      );
      const newEndTime = new Date(updated[0].free_contract_end_time);

      await connection.commit();
      connection.release();

      // 5. 计算新的剩余时间（秒）
      const now = new Date();
      const remainingSeconds = Math.max(0, Math.floor((newEndTime - now) / 1000));

      return res.json({
        success: true,
        message: `Successfully added ${hoursToAdd} hour(s) to your Ad Free Contract`,
        data: {
          contract_id: contractId,
          battery_used: battery_count,
          hours_added: hoursToAdd,
          new_end_time: newEndTime,
          remaining_seconds: remainingSeconds,
          remaining_hours: Math.floor(remainingSeconds / 3600)
        }
      });

    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    if (connection) connection.release();
    console.error('使用电池增加挖矿时间失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to use battery',
      error: error.message
    });
  }
});

/**
 * GET /api/mining-pool/battery-count/:userId
 * 获取用户当前拥有的电池数量
 * 
 * 注意：这是一个占位API，实际电池数量应该从游戏积分系统或其他系统获取
 * 现在暂时返回固定数量用于测试
 */
router.get('/battery-count/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // JWT 用户身份校验
    const jwtUserId = req.user?.userId || req.user?.user_id;
    if (jwtUserId && String(jwtUserId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // 从积分系统查询用户真实电池数量（user_information.user_points）
    const pointsData = await PointsService.getUserPoints(userId);

    return res.json({
      success: true,
      data: {
        user_id: userId,
        battery_count: pointsData.availablePoints,
      }
    });

  } catch (error) {
    console.error('获取电池数量失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get battery count',
      error: error.message
    });
  }
});

/**
 * POST /api/mining-pool/extend-contract
 * 延长Free Ad Reward合约时间（使用电池）
 * 如果没有活跃合约，会创建一个新的2小时合约
 * 
 * 请求体:
 * {
 *   "user_id": "U2026011910532521846",
 *   "hours": 2  // 要增加的小时数（等于电池数量）
 * }
 */
router.post('/extend-contract', authenticateToken, async (req, res) => {
  let connection;
  
  try {
    const { user_id, hours = 1 } = req.body;
    const deviceCountry = req.body.device_country || null; // 方案B：Flutter设备locale国家

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // JWT 用户身份校验
    const jwtUserId = req.user?.userId || req.user?.user_id;
    if (jwtUserId && String(jwtUserId) !== String(user_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (hours < 1 || hours > 24) {
      return res.status(400).json({
        success: false,
        message: 'Hours must be between 1 and 24'
      });
    }

    // 🌍 只在用户尚无国家记录时才写入（防止VPN覆盖正确值）
    try {
      const requestIp = req.headers['x-forwarded-for']?.split(',')[0].trim()
                     || req.headers['x-real-ip']
                     || req.ip
                     || '未知';

      const [userRows] = await pool.query(
        'SELECT country_code, country_multiplier FROM user_information WHERE user_id = ?',
        [user_id]
      );

      if (userRows.length > 0 && (!userRows[0].country_code || userRows[0].country_code.trim() === '')) {
        // 用户尚无国家记录，尝试首次写入
        const clientCountryUpper = deviceCountry ? deviceCountry.trim().toUpperCase() : null;
        let targetCountry = clientCountryUpper;

        if (!targetCountry && requestIp && requestIp !== '未知') {
          const geoip = require('geoip-lite');
          const geo = geoip.lookup(requestIp);
          if (geo && geo.country) targetCountry = geo.country.toUpperCase();
        }

        if (targetCountry) {
          const [configRows] = await pool.query(
            'SELECT mining_multiplier, country_name_cn FROM country_mining_config WHERE country_code = ? AND is_active = 1 LIMIT 1',
            [targetCountry]
          );
          const newMultiplier = configRows.length > 0 ? parseFloat(configRows[0].mining_multiplier) : 1.00;
          const newCountryNameCn = configRows.length > 0 ? configRows[0].country_name_cn : null;
          const source = clientCountryUpper ? 'device-locale' : 'ip-geoip';
          console.log(`🌍 [广告-首次] 用户 ${user_id}: [${source}]首次写入国家=${targetCountry}(${newMultiplier}x)`);
          const updateSql = newCountryNameCn
            ? 'UPDATE user_information SET country_code = ?, country_multiplier = ?, country_name_cn = ? WHERE user_id = ?'
            : 'UPDATE user_information SET country_code = ?, country_multiplier = ? WHERE user_id = ?';
          const updateParams = newCountryNameCn
            ? [targetCountry, newMultiplier, newCountryNameCn, user_id]
            : [targetCountry, newMultiplier, user_id];
          await pool.query(updateSql, updateParams);
        }
      } else if (userRows.length > 0) {
        console.log(`🌍 [广告] 用户 ${user_id}: 已有国家记录(${userRows[0].country_code})，跳过覆盖`);
      }
    } catch (countryErr) {
      console.warn(`⚠️ [广告] 国家检测失败，保留原存储值: ${countryErr.message}`);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 查找用户当前活跃的Ad Free Contract
      const [contracts] = await connection.query(
        `SELECT id, free_contract_end_time 
         FROM free_contract_records 
         WHERE user_id = ? 
         AND free_contract_type = 'Free Ad Reward'
         AND free_contract_end_time > NOW()
         ORDER BY free_contract_creation_time DESC
         LIMIT 1`,
        [user_id]
      );

      let contractId;
      let newEndTime;
      let isNewContract = false;
      
      // 📌 检查是否已达到48小时上限（48个电池槽）
      const MAX_HOURS = 48;
      const MAX_SECONDS = MAX_HOURS * 3600;

      if (contracts.length === 0) {
        // 没有活跃合约，创建新的合约（用户请求的小时数）
        const totalHours = Math.min(hours, MAX_HOURS);
        const BASE_HASHRATE = await MiningConfigService.getBaseHashrate();
        const [result] = await connection.query(
          `INSERT INTO free_contract_records 
           (user_id, free_contract_type, base_hashrate, hashrate, mining_status, free_contract_creation_time, 
            free_contract_end_time)
           VALUES (?, 'Free Ad Reward', ?, ?, 'mining', NOW(), DATE_ADD(NOW(), INTERVAL ? HOUR))`,
          [user_id, BASE_HASHRATE, BASE_HASHRATE, totalHours]
        );
        
        contractId = result.insertId;
        isNewContract = true;
        
        // 查询新创建的合约的结束时间
        const [newContract] = await connection.query(
          'SELECT free_contract_end_time FROM free_contract_records WHERE id = ?',
          [contractId]
        );
        newEndTime = new Date(newContract[0].free_contract_end_time);
      } else {
        // 已有活跃合约，检查剩余时间
        contractId = contracts[0].id;
        const currentEndTime = new Date(contracts[0].free_contract_end_time);
        const now = new Date();
        const remainingSeconds = Math.floor((currentEndTime - now) / 1000);
        
        // 📌 检查是否已达到48小时上限
        if (remainingSeconds >= MAX_SECONDS) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: 'The mining pool is full. Maximum 48 hours allowed.',
            data: {
              currentHours: Math.floor(remainingSeconds / 3600),
              maxHours: MAX_HOURS,
              remainingSeconds: remainingSeconds
            }
          });
        }
        
        // 计算可以增加的小时数（不超过48小时上限）
        const maxAdditionalSeconds = MAX_SECONDS - remainingSeconds;
        const maxAdditionalHours = Math.floor(maxAdditionalSeconds / 3600);
        const actualHours = Math.min(hours, maxAdditionalHours);
        
        if (actualHours <= 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: 'The mining pool is full. Maximum 48 hours allowed.',
            data: {
              currentHours: Math.floor(remainingSeconds / 3600),
              maxHours: MAX_HOURS
            }
          });
        }

        await connection.query(
          `UPDATE free_contract_records 
           SET free_contract_end_time = DATE_ADD(free_contract_end_time, INTERVAL ? HOUR)
           WHERE id = ?`,
          [actualHours, contractId]
        );
        
        // 查询更新后的结束时间
        const [updated] = await connection.query(
          'SELECT free_contract_end_time FROM free_contract_records WHERE id = ?',
          [contractId]
        );
        newEndTime = new Date(updated[0].free_contract_end_time);
      }

      await connection.commit();
      connection.release();
      connection = null; // 标记连接已释放

      // 注意：积分奖励、广告观看记录、邀请人奖励统一由客户端调用 /api/ad/watch 处理
      // 本接口只负责合约延长，防止双重发放积分

      const now = new Date();
      const remainingSeconds = Math.max(0, Math.floor((newEndTime - now) / 1000));

      return res.json({
        success: true,
        message: isNewContract 
          ? `Created new Ad Free Contract with ${hours} hour(s)`
          : `Extended Ad Free Contract by ${hours} hour(s)`,
        data: {
          contract_id: contractId,
          is_new_contract: isNewContract,
          hours_added: hours,
          new_end_time: newEndTime,
          remaining_seconds: remainingSeconds,
          remaining_hours: Math.floor(remainingSeconds / 3600)
        }
      });

    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }
      throw error;
    }

  } catch (error) {
    if (connection) connection.release();
    console.error('延长合约时间失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to extend contract',
      error: error.message
    });
  }
});

module.exports = router;
