/**
 * Google Play购买验证服务
 * 使用Google Play Developer API验证购买凭证
 */

let google;
try {
  ({ google } = require('googleapis'));
} catch (e) {
  console.warn('⚠️ [GooglePlay] googleapis 未安装，Android支付验证不可用:', e.message);
}
const path = require('path');
const fs = require('fs');

class GooglePlayVerifyService {
  constructor() {
    this.isInitialized = false;
    this.androidPublisher = null;
    this.init();
  }

  /**
   * 初始化Google API客户端
   */
  init() {
    if (!google) {
      console.warn('⚠️ [GooglePlay] googleapis 未安装，跳过初始化');
      return;
    }
    try {
      // 服务账号密钥文件路径
      const keyFilePath = path.join(__dirname, '../config/google-service-account.json');
      
      // 检查密钥文件是否存在
      if (!fs.existsSync(keyFilePath)) {
        console.error('❌ Google服务账号密钥文件不存在:', keyFilePath);
        console.error('请按照文档配置Google Service Account');
        return;
      }

      // 创建认证客户端
      this.auth = new google.auth.GoogleAuth({
        keyFile: keyFilePath,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });
      
      // 创建Android Publisher API客户端
      this.androidPublisher = google.androidpublisher({
        version: 'v3',
        auth: this.auth,
      });

      this.isInitialized = true;
      console.log('✅ Google Play验证服务初始化成功');
      
    } catch (error) {
      console.error('❌ Google Play验证服务初始化失败:', error);
    }
  }

  /**
   * 验证Google Play购买
   * 
   * @param {string} packageName - 应用包名
   * @param {string} productId - 商品ID
   * @param {string} purchaseToken - 购买token
   * @returns {Object} 验证结果
   */
  async verifyPurchase(packageName, productId, purchaseToken) {
    if (!this.isInitialized) {
      return { 
        success: false, 
        error: 'Google Play验证服务未初始化' 
      };
    }

    try {
      console.log(`🔐 开始验证购买: ${packageName} / ${productId}`);
      
      // 调用Google Play Developer API
      const result = await this.androidPublisher.purchases.products.get({
        packageName: packageName,
        productId: productId,
        token: purchaseToken,
      });

      const purchase = result.data;
      
      console.log('📦 购买信息:', {
        orderId: purchase.orderId,
        purchaseState: purchase.purchaseState,
        purchaseTime: purchase.purchaseTimeMillis,
        acknowledged: purchase.acknowledgementState,
      });
      
      // 验证购买状态
      // purchaseState: 0 = 已购买, 1 = 已取消, 2 = 待处理
      if (purchase.purchaseState === 0) {
        return {
          success: true,
          orderId: purchase.orderId,
          purchaseTime: purchase.purchaseTimeMillis,
          acknowledged: purchase.acknowledgementState === 1,
          consumptionState: purchase.consumptionState, // 0=未消耗, 1=已消耗
        };
      } else if (purchase.purchaseState === 1) {
        return { 
          success: false, 
          error: '订单已取消' 
        };
      } else if (purchase.purchaseState === 2) {
        return { 
          success: false, 
          error: '订单待处理' 
        };
      } else {
        return { 
          success: false, 
          error: '未知购买状态: ' + purchase.purchaseState 
        };
      }
      
    } catch (error) {
      console.error('❌ Google Play验证失败:', error.message);
      
      // 解析常见错误
      if (error.code === 401) {
        return { success: false, error: '服务账号认证失败' };
      } else if (error.code === 404) {
        return { success: false, error: '购买不存在或已过期' };
      } else {
        return { success: false, error: error.message };
      }
    }
  }

  /**
   * 验证Google Play订阅（适用于订阅类商品）
   * 使用 purchases.subscriptions.get API
   *
   * @param {string} packageName - 应用包名（如 com.example.app）
   * @param {string} subscriptionId - 订阅商品ID（如 p04.99）
   * @param {string} purchaseToken - 购买token
   */
  async verifySubscription(packageName, subscriptionId, purchaseToken) {
    if (!this.isInitialized) {
      return { success: false, error: 'Google Play验证服务未初始化' };
    }

    try {
      console.log(`🔐 验证订阅: ${packageName} / ${subscriptionId}`);

      const result = await this.androidPublisher.purchases.subscriptions.get({
        packageName,
        subscriptionId,
        token: purchaseToken,
      });

      const sub = result.data;
      console.log('📦 订阅信息:', {
        orderId: sub.orderId,
        paymentState: sub.paymentState,
        expiryTimeMillis: sub.expiryTimeMillis,
        autoRenewing: sub.autoRenewing,
      });

      // paymentState: 0=等待支付, 1=已付款, 2=免费试用
      if (sub.paymentState === 1 || sub.paymentState === 2) {
        const expiryMs = parseInt(sub.expiryTimeMillis || '0', 10);
        if (expiryMs > 0 && expiryMs < Date.now()) {
          return { success: false, error: '订阅已过期' };
        }
        return {
          success: true,
          orderId: sub.orderId,
          expiryTimeMillis: sub.expiryTimeMillis,
          autoRenewing: sub.autoRenewing,
          priceAmountMicros: sub.priceAmountMicros || '0',
          // RTDN webhook 用此字段关联用户（需客户端购买时设置 applicationUserName = userId）
          obfuscatedExternalAccountId: sub.obfuscatedExternalAccountId || null,
          // 非空表示此 token 是对旧 token 的替换（升级/切换档位），不应创建新合约
          linkedPurchaseToken: sub.linkedPurchaseToken || null,
        };
      }

      return { success: false, error: `订阅状态异常: paymentState=${sub.paymentState}` };

    } catch (error) {
      console.error('❌ Google Play订阅验证失败:', error.message);
      if (error.code === 401) return { success: false, error: '服务账号认证失败' };
      if (error.code === 404) return { success: false, error: '订阅不存在或已过期' };
      return { success: false, error: error.message };
    }
  }

  /**
   * 确认一次性购买（防止退款）
   * Google要求在3天内确认购买，否则会自动退款
   * 
   * @param {string} packageName - 应用包名
   * @param {string} productId - 商品ID
   * @param {string} purchaseToken - 购买token
   */
  async acknowledgePurchase(packageName, productId, purchaseToken) {
    if (!this.isInitialized) {
      return { 
        success: false, 
        error: 'Google Play验证服务未初始化' 
      };
    }

    try {
      console.log(`✅ 确认一次性购买: ${packageName} / ${productId}`);
      
      await this.androidPublisher.purchases.products.acknowledge({
        packageName: packageName,
        productId: productId,
        token: purchaseToken,
      });
      
      console.log('✅ 购买已确认');
      return { success: true };
      
    } catch (error) {
      console.error('❌ 确认购买失败:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 确认订阅购买（防止 Google Play 3天内自动退款取消订阅）
   * 订阅必须用 purchases.subscriptions.acknowledge，与一次性购买不同
   * 
   * @param {string} packageName - 应用包名（如 com.cloudminingtool.bitcoin_mining_app）
   * @param {string} subscriptionId - 订阅商品ID（如 p04.99）
   * @param {string} purchaseToken - 购买token
   */
  async acknowledgeSubscription(packageName, subscriptionId, purchaseToken) {
    if (!this.isInitialized) {
      return { success: false, error: 'Google Play验证服务未初始化' };
    }

    try {
      console.log(`✅ 确认订阅: ${packageName} / ${subscriptionId}`);

      await this.androidPublisher.purchases.subscriptions.acknowledge({
        packageName,
        subscriptionId,
        token: purchaseToken,
      });

      console.log('✅ 订阅已确认（prevent 3-day auto-refund）');
      return { success: true };
    } catch (error) {
      // 如果已确认（ALREADY_ACKNOWLEDGED），不视为错误
      if (error.message && error.message.includes('acknowledgedState')) {
        console.log('ℹ️ 订阅已处于已确认状态，跳过');
        return { success: true };
      }
      console.error('❌ 确认订阅失败:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取订阅详情（V2 API）
   * 使用 purchases.subscriptionsv2.get，返回 obfuscatedExternalAccountId（userId）
   * 专供 RTDN webhook 使用：通过 purchaseToken 反查用户
   *
   * @param {string} packageName - 应用包名
   * @param {string} purchaseToken - 购买 token
   * @returns {Object} subscriptionsv2 原始响应 data
   */
  async getSubscriptionV2Details(packageName, purchaseToken) {
    if (!this.isInitialized) {
      throw new Error('Google Play 验证服务未初始化');
    }
    const result = await this.androidPublisher.purchases.subscriptionsv2.get({
      packageName,
      token: purchaseToken,
    });
    return result.data;
  }

  /**
   * 获取已撤销（退款/欺诈）的购买列表 — Voided Purchases API
   * 用于批量发现已退款的 Android 订单
   *
   * @param {number} startTimeMs  - 查询起始时间（毫秒时间戳），null 时取 API 默认（过去 30 天）
   * @param {number} maxResults   - 最多返回条数，最大 1000
   * @returns {{ success: boolean, purchases?: Array, error?: string }}
   */
  async getVoidedPurchases(startTimeMs = null, maxResults = 500) {
    if (!this.isInitialized) {
      return { success: false, error: 'Google Play验证服务未初始化' };
    }
    const packageName = process.env.ANDROID_PACKAGE_NAME || 'com.cloudminingtool.bitcoin_mining_app';
    if (!packageName) {
      return { success: false, error: '未配置 ANDROID_PACKAGE_NAME' };
    }
    try {
      const params = { packageName, maxResults };
      if (startTimeMs) params.startTime = String(startTimeMs);

      const result = await this.androidPublisher.purchases.voidedpurchases.list(params);
      const purchases = result.data.voidedPurchases || [];
      console.log(`📦 Voided Purchases: 查到 ${purchases.length} 条已撤销购买`);
      return { success: true, purchases };
    } catch (error) {
      console.error('❌ Voided Purchases 查询失败:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查单条 Android 订阅的取消状态
   * 仅返回核心字段，不做状态更新
   *
   * @param {string} subscriptionId  - Google Play 订阅产品 ID（如 p04.99）
   * @param {string} purchaseToken   - 购买 token（user_orders.payment_network_id）
   * @returns {{ autoRenewing: boolean, cancelReason: number|null,
   *             expiryTimeMillis: string|null, paymentState: number|null,
   *             notFound?: boolean } | null}  null = API 调用失败
   */
  async checkSubscriptionCancelled(subscriptionId, purchaseToken) {
    const packageName = process.env.ANDROID_PACKAGE_NAME || 'com.cloudminingtool.bitcoin_mining_app';
    if (!packageName || !this.isInitialized) return null;
    try {
      const result = await this.androidPublisher.purchases.subscriptions.get({
        packageName,
        subscriptionId,
        token: purchaseToken,
      });
      const sub = result.data;
      return {
        autoRenewing:       sub.autoRenewing,
        cancelReason:       sub.cancelReason      ?? null,  // 0=user,1=billing,2=system
        expiryTimeMillis:   sub.expiryTimeMillis  ?? null,
        paymentState:       sub.paymentState      ?? null,
        priceAmountMicros:  sub.priceAmountMicros ?? null,
      };
    } catch (error) {
      if (error.code === 404) return { notFound: true };
      console.error(`❌ 订阅状态查询失败 [${subscriptionId}/${purchaseToken?.substring(0, 20)}]:`, error.message);
      return null;
    }
  }

  /**
   * 消耗购买（用于消耗型商品）
   * 消耗后用户可以再次购买同一商品
   * 
   * @param {string} packageName - 应用包名
   * @param {string} productId - 商品ID
   * @param {string} purchaseToken - 购买token
   */
  async consumePurchase(packageName, productId, purchaseToken) {
    if (!this.isInitialized) {
      return { 
        success: false, 
        error: 'Google Play验证服务未初始化' 
      };
    }

    try {
      console.log(`🔄 消耗购买: ${packageName} / ${productId}`);
      
      await this.androidPublisher.purchases.products.consume({
        packageName: packageName,
        productId: productId,
        token: purchaseToken,
      });
      
      console.log('✅ 购买已消耗');
      return { success: true };
      
    } catch (error) {
      console.error('❌ 消耗购买失败:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// 导出单例
module.exports = new GooglePlayVerifyService();
