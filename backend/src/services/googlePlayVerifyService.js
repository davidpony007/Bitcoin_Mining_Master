/**
 * Google Play购买验证服务
 * 使用Google Play Developer API验证购买凭证
 */

const { google } = require('googleapis');
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
   * 确认购买（防止退款）
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
      console.log(`✅ 确认购买: ${packageName} / ${productId}`);
      
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
