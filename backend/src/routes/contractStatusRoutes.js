/**
 * 合约状态路由 - 检查用户是否有活跃合约
 */
const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { Op } = require('sequelize');

/**
 * GET /api/contract-status/has-active/:userId
 * 检查用户是否有任何活跃的挖矿合约
 */
router.get('/has-active/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const now = new Date();

    // 检查免费合约（ad, daily sign-in, invitation）
    const [freeResults] = await sequelize.query(
      `SELECT COUNT(*) as count 
       FROM free_contract_records 
       WHERE user_id = ? 
       AND free_contract_end_time > ?`,
      {
        replacements: [userId, now],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // 检查付费合约
    const [paidResults] = await sequelize.query(
      `SELECT COUNT(*) as count 
       FROM mining_contracts 
       WHERE user_id = ? 
       AND contract_end_time > ?`,
      {
        replacements: [userId, now],
        type: sequelize.QueryTypes.SELECT
      }
    );

    const freeCount = freeResults?.count || 0;
    const paidCount = paidResults?.count || 0;
    const hasActiveContract = (freeCount > 0) || (paidCount > 0);

    return res.json({
      success: true,
      data: {
        hasActiveContract,
        freeContractCount: freeCount,
        paidContractCount: paidCount,
        totalActiveContracts: freeCount + paidCount
      }
    });

  } catch (error) {
    console.error('检查活跃合约失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check active contracts',
      error: error.message
    });
  }
});

/**
 * GET /api/contract-status/my-contracts/:userId
 * 获取用户的合约详情（用于My Contract页面显示）
 * 返回: Daily Check-in和Free Ad Reward合约的状态和剩余时间
 */
router.get('/my-contracts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('[CONTRACT STATUS] Getting contracts for user:', userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const now = new Date();

    // 将BTC/s算力转换为Gh/s显示值的辅助函数（兼容老记录）
    // 基础算力：0.000000000000139 BTC/s = 5.5 Gh/s
    const btcToGhs = (btcPerSecond) => {
      if (!btcPerSecond || btcPerSecond === 0) return '0Gh/s';
      const ghs = (btcPerSecond / 0.000000000000139) * 5.5;
      return ghs.toFixed(1) + 'Gh/s';
    };

    const formatRemaining = (seconds) => {
      const safeSeconds = Math.max(0, Number(seconds || 0));
      const days = Math.floor(safeSeconds / 86400);
      const hours = Math.floor((safeSeconds % 86400) / 3600);
      const minutes = Math.floor((safeSeconds % 3600) / 60);
      const remainSeconds = safeSeconds % 60;

      if (days > 0) {
        return `${days}d ${hours.toString().padStart(2, '0')}h ${minutes
          .toString()
          .padStart(2, '0')}m`;
      }

      return `${hours.toString().padStart(2, '0')}h ${minutes
        .toString()
        .padStart(2, '0')}m ${remainSeconds.toString().padStart(2, '0')}s`;
    };

    const formatEndedAt = (dateValue) => {
      if (!dateValue) return '';
      const endedAt = new Date(dateValue);
      if (Number.isNaN(endedAt.getTime())) return '';
      return endedAt.toISOString().replace('T', ' ').slice(0, 16);
    };

    // 查询Daily Check-in合约（7.5Gh/s）
    const dailyCheckInContract = await sequelize.query(
      `SELECT 
        id,
        free_contract_type,
        hashrate,
        free_contract_creation_time,
        free_contract_end_time,
        TIMESTAMPDIFF(SECOND, NOW(), free_contract_end_time) as remaining_seconds
       FROM free_contract_records 
       WHERE user_id = ? 
       AND free_contract_type = 'Daily Check-in Reward'
       AND free_contract_end_time > NOW()
       ORDER BY free_contract_creation_time DESC
       LIMIT 1`,
      {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // 查询Free Ad Reward合约（5.5Gh/s）
    const adRewardContract = await sequelize.query(
      `SELECT 
        id,
        free_contract_type,
        hashrate,
        free_contract_creation_time,
        free_contract_end_time,
        TIMESTAMPDIFF(SECOND, NOW(), free_contract_end_time) as remaining_seconds
       FROM free_contract_records 
       WHERE user_id = ? 
       AND free_contract_type = 'Free Ad Reward'
       AND free_contract_end_time > NOW()
       ORDER BY free_contract_creation_time DESC
       LIMIT 1`,
      {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // 查询Invite Friend Reward合约（推荐人获得的邀请奖励）
    const inviteFriendContract = await sequelize.query(
      `SELECT 
        id,
        free_contract_type,
        hashrate,
        free_contract_creation_time,
        free_contract_end_time,
        TIMESTAMPDIFF(SECOND, NOW(), free_contract_end_time) as remaining_seconds,
        CASE 
          WHEN free_contract_end_time > NOW() THEN 1
          ELSE 0
        END as is_active
       FROM free_contract_records 
       WHERE user_id = ? 
       AND free_contract_type = 'Invite Friend Reward'
       ORDER BY free_contract_creation_time DESC
       LIMIT 1`,
      {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // 查询Bind Referrer Reward合约（被推荐人获得的绑定奖励，存储在 mining_contracts）
    // 为兴容旧数据，同时查询 free_contract_records 历史记录
    let bindReferrerContract = await sequelize.query(
      `SELECT 
        id,
        contract_type,
        hashrate,
        contract_creation_time,
        contract_end_time,
        TIMESTAMPDIFF(SECOND, NOW(), contract_end_time) as remaining_seconds,
        CASE 
          WHEN contract_end_time > NOW() THEN 1
          ELSE 0
        END as is_active
       FROM mining_contracts 
       WHERE user_id = ? 
       AND contract_type = 'Bind Referrer Reward'
       ORDER BY contract_creation_time DESC
       LIMIT 1`,
      {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // 如果 mining_contracts 中没有，回退到 free_contract_records 历史记录
    if (bindReferrerContract.length === 0) {
      const legacyBind = await sequelize.query(
        `SELECT 
          id,
          free_contract_type AS contract_type,
          hashrate,
          free_contract_creation_time AS contract_creation_time,
          free_contract_end_time AS contract_end_time,
          TIMESTAMPDIFF(SECOND, NOW(), free_contract_end_time) as remaining_seconds,
          CASE 
            WHEN free_contract_end_time > NOW() THEN 1
            ELSE 0
          END as is_active
         FROM free_contract_records 
         WHERE user_id = ? 
         AND free_contract_type = 'Bind Referrer Reward'
         ORDER BY free_contract_creation_time DESC
         LIMIT 1`,
        {
          replacements: [userId],
          type: sequelize.QueryTypes.SELECT
        }
      );
      bindReferrerContract = legacyBind;
    }

    // 查询付费合约：JOIN paid_products_list_config 直接取展示字段，无需硬编码 hashrate 匹配
    const paidContracts = await sequelize.query(
      `SELECT
        c.id,
        c.hashrate,
        c.product_id,
        c.platform,
        c.order_id,
        c.original_transaction_id,
        c.contract_creation_time,
        c.contract_end_time,
        c.is_cancelled,
        p.display_name     AS p_display_name,
        p.product_price    AS p_product_price,
        p.hashrate         AS p_hashrate_display,
        TIMESTAMPDIFF(SECOND, NOW(), c.contract_end_time) AS remaining_seconds,
        CASE
          WHEN c.is_cancelled = 1 THEN 0
          WHEN c.contract_end_time > NOW() THEN 1
          ELSE 0
        END AS is_active
       FROM mining_contracts c
       LEFT JOIN paid_products_list_config p ON c.product_id = p.product_id
       WHERE c.user_id = ?
       AND c.contract_type = 'paid contract'
       ORDER BY c.contract_creation_time DESC`,
      {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    console.log('[CONTRACT STATUS] Query results:', {
      dailyCheckIn: dailyCheckInContract.length,
      adReward: adRewardContract.length,
      inviteFriend: inviteFriendContract.length,
      bindReferrer: bindReferrerContract.length,
      paidContracts: paidContracts.length
    });

    const mappedPaidContracts = paidContracts.map((contract) => {
      const remainingSeconds = Math.max(0, Number(contract.remaining_seconds || 0));
      const isCancelled = contract.is_cancelled === 1;
      const isActive = contract.is_active === 1;

      // 优先使用 JOIN 获取的产品展示信息；旧数据（product_id 为 NULL）回退到 btcToGhs 计算
      const planName     = contract.p_display_name   || 'Paid Contract';
      const displayHashrate = contract.p_hashrate_display || btcToGhs(Number(contract.hashrate || 0));
      const priceLabel   = contract.p_product_price
        ? `$${contract.p_product_price} / Monthly`
        : '';

      // status 三态：active(挖矿中) / cancelled(已取消) / expired(自然到期)
      const status = isCancelled ? 'cancelled' : (isActive ? 'active' : 'expired');
      const statusText = isCancelled ? 'Not Active' : (isActive ? 'Mining' : 'Expired');

      return {
        contractId: contract.id,
        productId: contract.product_id || 'custom',
        platform: contract.platform || 'system',
        orderId: contract.order_id || null,
        planName,
        displayHashrate,
        priceLabel,
        createdAt: contract.contract_creation_time,
        endTime: contract.contract_end_time,
        remainingSeconds,
        remainingFormatted: formatRemaining(remainingSeconds),
        endedAtText: formatEndedAt(contract.contract_end_time),
        status,
        statusText
      };
    });

    return res.json({
      success: true,
      data: {
        dailyCheckIn: {
          isActive: dailyCheckInContract.length > 0,
          hashrate: '7.5Gh/s',
          remainingSeconds: dailyCheckInContract[0]?.remaining_seconds || 0,
          endTime: dailyCheckInContract[0]?.free_contract_end_time || null,
          contractId: dailyCheckInContract[0]?.id || null
        },
        adReward: {
          isActive: adRewardContract.length > 0,
          hashrate: '5.5Gh/s',
          remainingSeconds: adRewardContract[0]?.remaining_seconds || 0,
          endTime: adRewardContract[0]?.free_contract_end_time || null,
          contractId: adRewardContract[0]?.id || null
        },
        inviteFriendReward: {
          exists: inviteFriendContract.length > 0,
          isActive: inviteFriendContract[0]?.is_active === 1,
          hashrate: inviteFriendContract.length > 0 ? btcToGhs(inviteFriendContract[0]?.hashrate) : '0Gh/s',
          remainingSeconds: inviteFriendContract[0]?.is_active === 1 ? (inviteFriendContract[0]?.remaining_seconds || 0) : 0,
          endTime: inviteFriendContract[0]?.free_contract_end_time || null,
          contractId: inviteFriendContract[0]?.id || null
        },
        bindReferrerReward: {
          exists: bindReferrerContract.length > 0,
          isActive: bindReferrerContract[0]?.is_active === 1,
          hashrate: bindReferrerContract.length > 0 ? btcToGhs(bindReferrerContract[0]?.hashrate) : '0Gh/s',
          remainingSeconds: bindReferrerContract[0]?.is_active === 1 ? (bindReferrerContract[0]?.remaining_seconds || 0) : 0,
          endTime: bindReferrerContract[0]?.contract_end_time || null,
          contractId: bindReferrerContract[0]?.id || null
        },
        paidContracts: {
          active: mappedPaidContracts.filter((contract) => contract.status === 'active'),
          cancelled: mappedPaidContracts.filter((contract) => contract.status === 'cancelled'),
          expired: mappedPaidContracts.filter((contract) => contract.status === 'expired')
        }
      }
    });

  } catch (error) {
    console.error('获取用户合约详情失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user contracts',
      error: error.message
    });
  }
});

module.exports = router;
