/**
 * 付费合约路由
 * 处理付费挖矿合约的创建、查询和管理
 */

const express = require('express');
const router = express.Router();
const PaidContractService = require('../services/paidContractService');

/**
 * POST /api/paid-contracts/create
 * 创建付费合约（支付完成后调用）
 * 请求体: { user_id: "用户ID", product_id: "p0499", order_id: "订单ID" }
 */
router.post('/create', async (req, res) => {
  try {
    const { user_id, product_id, order_id } = req.body;

    if (!user_id || !product_id) {
      return res.status(400).json({
        success: false,
        message: '用户ID和产品ID不能为空'
      });
    }

    const result = await PaidContractService.createPaidContract(
      user_id.trim(), 
      product_id, 
      order_id
    );
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (err) {
    console.error('❌ 创建付费合约失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

/**
 * GET /api/paid-contracts/list/:userId
 * 获取用户的付费合约列表
 * 查询参数: ?status=mining (可选，筛选状态)
 */
router.get('/list/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    const result = await PaidContractService.getUserContracts(userId.trim(), status);
    res.json(result);

  } catch (err) {
    console.error('❌ 获取付费合约列表失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

/**
 * GET /api/paid-contracts/tiers
 * 获取所有付费合约档位配置
 */
router.get('/tiers', async (req, res) => {
  try {
    const result = PaidContractService.getContractTiers();
    res.json(result);

  } catch (err) {
    console.error('❌ 获取合约档位配置失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

module.exports = router;
