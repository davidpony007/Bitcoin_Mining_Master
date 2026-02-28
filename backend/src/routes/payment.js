/**
 * 支付验证路由
 * 处理Android和iOS的应用内购买验证
 * 支持一次性购买和订阅模式
 */

const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const googlePlayVerifyService = require('../services/googlePlayVerifyService');
const PaidContractService = require('../services/paidContractService');
const SubscriptionService = require('../services/subscriptionService');
const subscriptionConfig = require('../config/subscriptionConfig');
const authenticateToken = require('../middleware/authenticateToken');

// 应用包名（需要与Android项目中的applicationId一致）
const PACKAGE_NAME = 'com.cloudminingtool.bitcoin_mining_master'; // 使用你的实际包名

/**
 * POST /api/payment/verify
 * 验证购买并发放合约
 * 支持一次性购买和订阅两种模式
 */
router.post('/verify', authenticateToken, async (req, res) => {
  const { platform, productId, purchaseToken, orderId, isSubscription } = req.body;
  const userId = req.userId;

  try {
    console.log(`\n========== 开始验证购买 ==========`);
    console.log(`用户: ${userId}`);
    console.log(`平台: ${platform}`);
    console.log(`商品: ${productId}`);
    console.log(`订单: ${orderId}`);
    console.log(`类型: ${isSubscription ? '订阅' : '一次性购买'}`);

    // 参数验证
    if (!platform || !productId || !purchaseToken) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必需参数' 
      });
    }

    // 目前只支持Android
    if (platform !== 'android') {
      return res.status(400).json({ 
        success: false, 
        message: '暂不支持该平台' 
      });
    }

    // 检查是否为订阅商品
    const isSubscriptionProduct = subscriptionConfig.SUBSCRIPTION_PRODUCTS.hasOwnProperty(productId);

    // 1. 调用Google Play API验证购买
    console.log('🔐 步骤1: 验证购买凭证...');
    const verification = await googlePlayVerifyService.verifyPurchase(
      PACKAGE_NAME,
      productId,
      purchaseToken,
      isSubscriptionProduct
    );

    if (!verification.success) {
      console.log('❌ 验证失败:', verification.error);
      return res.status(400).json({
        success: false,
        message: '购买验证失败: ' + verification.error,
      });
    }

    console.log('✅ 验证成功');

    // 2. 检查订单是否已处理（防止重复发放）
    console.log('🔍 步骤2: 检查订单是否已处理...');
    const [existingOrders] = await sequelize.query(`
      SELECT * FROM payment_transactions 
      WHERE order_id = ? AND user_id = ?
    `, {
      replacements: [verification.orderId, userId],
    });

    if (existingOrders.length > 0) {
      console.log('⚠️ 订单已处理，避免重复发放');
      return res.status(400).json({
        success: false,
        message: '订单已处理，请勿重复提交',
      });
    }

    let contractResult;

    if (isSubscriptionProduct) {
      // ============ 订阅模式处理 ============
      console.log('📋 这是订阅购买');

      // 3. 记录交易
      console.log('💾 步骤3: 记录订阅交易...');
      await sequelize.query(`
        INSERT INTO payment_transactions 
        (user_id, platform, product_id, order_id, purchase_token, subscription_id, is_subscription, transaction_type, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, TRUE, 'purchase', 'completed', NOW())
      `, {
        replacements: [
          userId,
          'android',
          productId,
          verification.orderId,
          purchaseToken,
          verification.subscriptionId || purchaseToken, // 使用subscriptionId或purchaseToken
        ],
      });

      // 4. 创建或更新订阅合约
      console.log('🎁 步骤4: 创建/更新订阅合约...');
      contractResult = await SubscriptionService.createOrUpdateSubscription(
        userId,
        productId,
        verification.subscriptionId || purchaseToken,
        purchaseToken
      );

    } else {
      // ============ 一次性购买处理 ============
      console.log('💵 这是一次性购买');

      // 3. 记录交易
      console.log('💾 步骤3: 记录交易...');
      await sequelize.query(`
        INSERT INTO payment_transactions 
        (user_id, platform, product_id, order_id, purchase_token, is_subscription, status, created_at)
        VALUES (?, ?, ?, ?, ?, FALSE, 'completed', NOW())
      `, {
        replacements: [
          userId,
          'android',
          productId,
          verification.orderId,
          purchaseToken,
        ],
      });

      // 4. 发放付费合约（一次性）
      console.log('🎁 步骤4: 发放付费合约...');
      contractResult = await PaidContractService.createContract(userId, productId);
    }

    if (!contractResult.success) {
      console.log('❌ 合约发放失败:', contractResult.message);
      return res.status(500).json({
        success: false,
        message: '合约发放失败: ' + contractResult.message,
      });
    }

    // 5. 确认购买（告知Google已处理，防止退款）
    console.log('✅ 步骤5: 确认购买...');
    if (!verification.acknowledged) {
      await googlePlayVerifyService.acknowledgePurchase(
        PACKAGE_NAME,
        productId,
        purchaseToken,
        isSubscriptionProduct
      );
    }

    // 6. 如果是一次性购买，消耗购买（允许再次购买）
    if (!isSubscriptionProduct) {
      console.log('🔄 步骤6: 消耗购买...');
      await googlePlayVerifyService.consumePurchase(
        PACKAGE_NAME,
        productId,
        purchaseToken
      );
    }

    console.log('========== 购买验证完成 ==========\n');

    // 返回成功响应
    res.json({
      success: true,
      message: isSubscriptionProduct ? '订阅成功，合约已激活' : '购买成功，合约已激活',
      isSubscription: isSubscriptionProduct,
      contract: {
        id: contractResult.contract.id,
        productId: productId,
        startTime: contractResult.contract.contract_creation_time,
        endTime: contractResult.contract.contract_end_time,
        hashrate: contractResult.contract.hashrate,
        subscriptionStatus: contractResult.contract.subscription_status,
        nextBillingDate: contractResult.contract.next_billing_date,
      },
    });

  } catch (error) {
    console.error('❌ 购买验证异常:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误: ' + error.message,
    });
  }
});

/**
 * GET /api/payment/products
 * 获取商品列表（可选，用于服务端控制价格）
 */
router.get('/products', async (req, res) => {
  try {
    const products = [
      {
        id: 'p0499',
        name: '入门合约',
        price: 4.99,
        currency: 'USD',
        hashrate: '176.3 Gh/s',
        duration: 30,
      },
      {
        id: 'p0699',
        name: '标准合约',
        price: 6.99,
        currency: 'USD',
        hashrate: '305.6 Gh/s',
        duration: 30,
      },
      {
        id: 'p0999',
        name: '进阶合约',
        price: 9.99,
        currency: 'USD',
        hashrate: '611.2 Gh/s',
        duration: 30,
      },
      {
        id: 'p1999',
        name: '高级合约',
        price: 19.99,
        currency: 'USD',
        hashrate: '1326.4 Gh/s',
        duration: 30,
      },
    ];

    res.json({
      success: true,
      products: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/payment/history
 * 获取用户购买历史
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const [transactions] = await sequelize.query(`
      SELECT 
        id,
        product_id,
        order_id,
        status,
        created_at
      FROM payment_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, {
      replacements: [userId],
    });

    res.json({
      success: true,
      transactions: transactions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
