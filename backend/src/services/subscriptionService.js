/**
 * 订阅服务（RTDN Webhook 专用）
 * 处理来自 Google Play 实时开发者通知（RTDN）的订阅状态变更
 *
 * 数据表：mining_contracts（实际合约表）
 * 注意：此前代码错误地查询了 paid_contracts 表（不存在），已修正。
 */

const sequelize = require('../config/database');
const config = require('../config/subscriptionConfig');
const googlePlayVerifyService = require('./googlePlayVerifyService');

class SubscriptionService {
  /**
   * 将 Android subscriptionId（如 p04.99）映射到后端 product_id（如 p0499）
   * @private
   */
  async _resolveBackendProductId(subscriptionId) {
    try {
      const [[row]] = await sequelize.query(
        `SELECT product_id FROM paid_products_list_config WHERE android_product_id = ? LIMIT 1`,
        { replacements: [subscriptionId] }
      );
      return row?.product_id || null;
    } catch (e) {
      console.error('[SubscriptionService] _resolveBackendProductId error:', e.message);
      return null;
    }
  }

  /**
   * 通过 Google Play Developer API 验证 token 并获取用户 ID
   * @private
   * @returns {{ userId: string|null, expiryTimeMillis: string|null }}
   */
  async _resolveUserFromToken(subscriptionId, purchaseToken) {
    const packageName = process.env.ANDROID_PACKAGE_NAME;
    if (!packageName || !googlePlayVerifyService.isInitialized) {
      return { userId: null, expiryTimeMillis: null };
    }
    try {
      const result = await googlePlayVerifyService.verifySubscription(packageName, subscriptionId, purchaseToken);
      return {
        userId: result?.obfuscatedExternalAccountId || null,
        expiryTimeMillis: result?.expiryTimeMillis || null,
      };
    } catch (e) {
      console.warn('[SubscriptionService] verifySubscription error:', e.message);
      return { userId: null, expiryTimeMillis: null };
    }
  }

  /**
   * 查找 mining_contracts 记录
   * 先用 userId + productId 精确匹配，回退到 original_transaction_id = purchaseToken
   * @private
   */
  async _findContract(userId, backendProductId, purchaseToken) {
    // 优先：用户 + 产品 + 平台 + 未取消
    if (userId && backendProductId) {
      const [[mc]] = await sequelize.query(
        `SELECT * FROM mining_contracts
         WHERE user_id = ? AND product_id = ? AND platform = 'android' AND is_cancelled = 0
         ORDER BY id DESC LIMIT 1`,
        { replacements: [userId, backendProductId] }
      );
      if (mc) return mc;
    }
    // 回退：按当前 purchaseToken 查找（仅首次购买时 token 与存储一致）
    if (purchaseToken) {
      const [[mc]] = await sequelize.query(
        `SELECT * FROM mining_contracts WHERE original_transaction_id = ? LIMIT 1`,
        { replacements: [purchaseToken] }
      );
      if (mc) return mc;
    }
    return null;
  }

  /**
   * 处理订阅续订（RTDN type 1/2/7）
   */
  async handleSubscriptionRenewed(subscriptionId, purchaseToken) {
    try {
      console.log(`🔄 [RTDN] 续订通知: subscriptionId=${subscriptionId} token=${purchaseToken?.substring(0, 30)}…`);

      const backendProductId = await this._resolveBackendProductId(subscriptionId);
      if (!backendProductId) {
        console.log(`⚠️ [RTDN] 续订：未找到 product 映射 subscriptionId=${subscriptionId}`);
        return { success: false, error: 'product mapping not found' };
      }

      const { userId, expiryTimeMillis } = await this._resolveUserFromToken(subscriptionId, purchaseToken);

      const contract = await this._findContract(userId, backendProductId, purchaseToken);
      if (!contract) {
        console.log(`⚠️ [RTDN] 续订：未找到 mining_contracts. userId=${userId} product=${backendProductId} token=${purchaseToken?.substring(0, 30)}`);
        return { success: false, error: 'contract not found' };
      }

      // 计算新到期时间（优先使用 Google Play API 返回的精确时间）
      let newExpiry;
      if (expiryTimeMillis) {
        newExpiry = new Date(parseInt(expiryTimeMillis, 10));
      } else {
        newExpiry = new Date(contract.contract_end_time);
        newExpiry.setMonth(newExpiry.getMonth() + 1);
      }

      await sequelize.query(
        `UPDATE mining_contracts
         SET contract_end_time = ?, original_transaction_id = ?, is_renewal = 1
         WHERE id = ?`,
        { replacements: [newExpiry, purchaseToken, contract.id] }
      );

      console.log(`✅ [RTDN] 续订成功: user=${contract.user_id} product=${backendProductId} newExpiry=${newExpiry.toISOString()}`);
      return { success: true };

    } catch (error) {
      console.error('❌ [RTDN] 处理续订失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理订阅取消 / 撤销（RTDN type 3/12）
   */
  async handleSubscriptionCanceled(subscriptionId, purchaseToken) {
    try {
      console.log(`❌ [RTDN] 取消通知: subscriptionId=${subscriptionId} token=${purchaseToken?.substring(0, 30)}…`);

      const backendProductId = await this._resolveBackendProductId(subscriptionId);

      // 已取消的订阅 token 在 Play API 侧可能验证失败，忽略错误
      const { userId } = await this._resolveUserFromToken(subscriptionId, purchaseToken).catch(() => ({ userId: null }));

      const contract = await this._findContract(userId, backendProductId, purchaseToken);
      if (!contract) {
        console.log(`⚠️ [RTDN] 取消：未找到 mining_contracts. userId=${userId} product=${backendProductId} token=${purchaseToken?.substring(0, 30)}`);
        return { success: false, error: 'contract not found' };
      }

      await sequelize.query(
        `UPDATE mining_contracts SET is_cancelled = 1 WHERE id = ? AND is_cancelled = 0`,
        { replacements: [contract.id] }
      );

      console.log(`✅ [RTDN] 取消成功: user=${contract.user_id} product=${contract.product_id} contractId=${contract.id}`);
      return { success: true };

    } catch (error) {
      console.error('❌ [RTDN] 处理取消失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理宽限期（RTDN type 13）
   * 宽限期内用户仍可使用服务，mining_contracts 保持活跃，仅记录日志
   */
  async handleGracePeriod(subscriptionId, purchaseToken) {
    try {
      console.log(`⚠️ [RTDN] 宽限期通知: subscriptionId=${subscriptionId} — 合约继续有效`);
      // mining_contracts 中没有宽限期字段；不修改合约，让用户在宽限期内正常使用
      return { success: true };
    } catch (error) {
      console.error('❌ [RTDN] 处理宽限期失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理账号冻结（RTDN type 20）
   * 账号冻结意味着扣费持续失败，但通常在 30 天后自动取消（届时发送 type 3 通知）。
   * mining_contracts 没有冻结状态字段；此处仅记录日志，等待 type 3 取消通知到来。
   */
  async handleAccountHold(subscriptionId, purchaseToken) {
    try {
      console.log(`🔒 [RTDN] 账号冻结通知: subscriptionId=${subscriptionId} — 等待取消通知`);
      // 不修改合约；当账号进入冻结后 Google 会再发 type 3 CANCELED，届时取消合约
      return { success: true };
    } catch (error) {
      console.error('❌ [RTDN] 处理账号冻结失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查订阅是否允许挖矿（保持向后兼容）
   */
  canMine(subscriptionStatus) {
    return config.MINING_ALLOWED_STATUSES?.includes(subscriptionStatus) ?? true;
  }
}

module.exports = new SubscriptionService();

