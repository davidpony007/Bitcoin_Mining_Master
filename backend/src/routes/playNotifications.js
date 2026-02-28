/**
 * Google Play实时开发者通知处理路由
 * 接收并处理来自Google Play的订阅状态变更通知
 * 
 * 配置路径: Google Play Console → 创收 → 货币化设置 → Real-time Developer Notifications
 */

const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const SubscriptionService = require('../services/subscriptionService');
const subscriptionConfig = require('../config/subscriptionConfig');

/**
 * POST /api/play-notifications/webhook
 * Google Play Pub/Sub推送通知到这个endpoint
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('\n========== 收到Google Play通知 ==========');
    
    // 1. 解析Pub/Sub消息
    const pubSubMessage = req.body.message;
    if (!pubSubMessage || !pubSubMessage.data) {
      console.log('⚠️ 无效的Pub/Sub消息');
      return res.status(400).send('Invalid message');
    }

    // 2. Base64解码
    const decodedData = Buffer.from(pubSubMessage.data, 'base64').toString('utf-8');
    const notification = JSON.parse(decodedData);

    console.log('📨 通知数据:', JSON.stringify(notification, null, 2));

    // 3. 处理订阅通知
    if (notification.subscriptionNotification) {
      await handleSubscriptionNotification(notification.subscriptionNotification);
    } else if (notification.oneTimeProductNotification) {
      await handleOneTimeProductNotification(notification.oneTimeProductNotification);
    } else {
      console.log('⚠️ 未知的通知类型');
    }

    // 4. 返回200确认收到
    res.status(200).send('OK');
    console.log('========== 通知处理完成 ==========\n');

  } catch (error) {
    console.error('❌ 处理通知失败:', error);
    // 即使失败也返回200，避免Google重复推送
    res.status(200).send('Error processed');
  }
});

/**
 * 处理订阅通知
 */
async function handleSubscriptionNotification(notification) {
  const { notificationType, subscriptionId, purchaseToken } = notification;
  
  const typeName = subscriptionConfig.NOTIFICATION_TYPES[notificationType] || 'UNKNOWN';
  console.log(`📋 订阅通知类型: ${notificationType} (${typeName})`);
  console.log(`   订阅ID: ${subscriptionId}`);
  console.log(`   购买令牌: ${purchaseToken?.substring(0, 50)}...`);

  // 记录通知到数据库
  await sequelize.query(`
    INSERT INTO subscription_notifications (
      notification_type,
      notification_type_name,
      subscription_id,
      purchase_token,
      raw_data,
      received_at
    ) VALUES (?, ?, ?, ?, ?, NOW())
  `, {
    replacements: [
      notificationType,
      typeName,
      subscriptionId,
      purchaseToken,
      JSON.stringify(notification)
    ]
  });

  // 根据通知类型处理
  switch (notificationType) {
    case 1: // SUBSCRIPTION_RECOVERED
      console.log('✅ 订阅已恢复');
      await SubscriptionService.handleSubscriptionRenewed(subscriptionId, purchaseToken);
      break;

    case 2: // SUBSCRIPTION_RENEWED
      console.log('🔄 订阅已续订');
      await SubscriptionService.handleSubscriptionRenewed(subscriptionId, purchaseToken);
      break;

    case 3: // SUBSCRIPTION_CANCELED
      console.log('❌ 订阅已取消');
      await SubscriptionService.handleSubscriptionCanceled(subscriptionId, purchaseToken);
      break;

    case 4: // SUBSCRIPTION_PURCHASED
      console.log('🎉 新订阅购买（通常在/verify endpoint已处理）');
      break;

    case 7: // SUBSCRIPTION_RESTARTED
      console.log('🔄 订阅已重启');
      await SubscriptionService.handleSubscriptionRenewed(subscriptionId, purchaseToken);
      break;

    case 10: // SUBSCRIPTION_PAUSED
      console.log('⏸️ 订阅已暂停');
      await handleSubscriptionPaused(subscriptionId, purchaseToken);
      break;

    case 12: // SUBSCRIPTION_REVOKED
      console.log('⚠️ 订阅已撤销（退款）');
      await SubscriptionService.handleSubscriptionCanceled(subscriptionId, purchaseToken);
      break;

    case 13: // SUBSCRIPTION_IN_GRACE_PERIOD
      console.log('⏰ 进入宽限期');
      await SubscriptionService.handleGracePeriod(subscriptionId, purchaseToken);
      break;

    case 20: // SUBSCRIPTION_ON_HOLD
      console.log('🔒 账号冻结');
      await SubscriptionService.handleAccountHold(subscriptionId, purchaseToken);
      break;

    default:
      console.log(`⚠️ 未处理的通知类型: ${notificationType}`);
  }

  // 标记通知已处理
  await sequelize.query(`
    UPDATE subscription_notifications
    SET processed = TRUE, processed_at = NOW()
    WHERE subscription_id = ? AND purchase_token = ? AND notification_type = ?
    ORDER BY received_at DESC
    LIMIT 1
  `, {
    replacements: [subscriptionId, purchaseToken, notificationType]
  });
}

/**
 * 处理一次性商品通知
 */
async function handleOneTimeProductNotification(notification) {
  const { notificationType, sku, purchaseToken } = notification;
  
  console.log(`💵 一次性商品通知类型: ${notificationType}`);
  console.log(`   SKU: ${sku}`);
  console.log(`   购买令牌: ${purchaseToken?.substring(0, 50)}...`);

  // 记录到数据库
  await sequelize.query(`
    INSERT INTO subscription_notifications (
      notification_type,
      notification_type_name,
      purchase_token,
      raw_data,
      received_at
    ) VALUES (?, ?, ?, ?, NOW())
  `, {
    replacements: [
      notificationType,
      'ONE_TIME_PRODUCT',
      purchaseToken,
      JSON.stringify(notification)
    ]
  });

  // 一次性商品通常在/verify endpoint已处理，这里只记录
  console.log('✅ 一次性商品通知已记录');
}

/**
 * 处理订阅暂停
 */
async function handleSubscriptionPaused(subscriptionId, purchaseToken) {
  try {
    const [[contract]] = await sequelize.query(`
      SELECT * FROM paid_contracts 
      WHERE subscription_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, {
      replacements: [subscriptionId]
    });

    if (!contract) {
      console.log(`⚠️ 未找到订阅: ${subscriptionId}`);
      return;
    }

    await sequelize.query(`
      UPDATE paid_contracts SET
        subscription_status = 'paused',
        auto_renewing = FALSE,
        updated_at = NOW()
      WHERE id = ?
    `, {
      replacements: [contract.id]
    });

    await SubscriptionService.recordStatusChange(
      subscriptionId,
      contract.user_id,
      contract.subscription_status,
      'paused',
      '用户暂停订阅'
    );

    console.log(`⏸️ 订阅已暂停: ${subscriptionId}`);

  } catch (error) {
    console.error('处理订阅暂停失败:', error);
  }
}

/**
 * GET /api/play-notifications/test
 * 测试endpoint（开发用）
 */
router.get('/test', async (req, res) => {
  res.json({
    status: 'ok',
    message: 'Google Play通知处理服务正常运行',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/play-notifications/stats
 * 获取通知统计
 */
router.get('/stats', async (req, res) => {
  try {
    // 最近24小时的通知
    const [recentNotifications] = await sequelize.query(`
      SELECT 
        notification_type,
        notification_type_name,
        COUNT(*) as count,
        SUM(CASE WHEN processed THEN 1 ELSE 0 END) as processed_count
      FROM subscription_notifications
      WHERE received_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY notification_type, notification_type_name
      ORDER BY count DESC
    `);

    // 未处理的通知
    const [unprocessed] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM subscription_notifications
      WHERE processed = FALSE
    `);

    res.json({
      success: true,
      recent24Hours: recentNotifications,
      unprocessedCount: unprocessed[0]?.count || 0,
    });

  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
