/**
 * 订阅服务
 * 处理订阅的创建、更新、状态管理
 */

const sequelize = require('../config/database');
const config = require('../config/subscriptionConfig');
const googlePlayVerifyService = require('./googlePlayVerifyService');

class SubscriptionService {
  /**
   * 创建或更新订阅
   * @param {string} userId - 用户ID
   * @param {string} productId - 订阅商品ID
   * @param {string} subscriptionId - Google订阅ID
   * @param {string} purchaseToken - 购买令牌
   * @returns {Promise<Object>}
   */
  async createOrUpdateSubscription(userId, productId, subscriptionId, purchaseToken) {
    try {
      console.log(`📝 创建/更新订阅: 用户=${userId}, 商品=${productId}`);

      // 获取订阅商品配置
      const productConfig = config.SUBSCRIPTION_PRODUCTS[productId];
      if (!productConfig) {
        throw new Error(`未知的订阅商品: ${productId}`);
      }

      // 计算下次扣费日期（30天后）
      const nextBillingDate = new Date();
      nextBillingDate.setDate(nextBillingDate.getDate() + productConfig.periodDays);

      // 检查是否已存在该订阅
      const [[existing]] = await sequelize.query(`
        SELECT * FROM paid_contracts 
        WHERE subscription_id = ? AND user_id = ?
        LIMIT 1
      `, {
        replacements: [subscriptionId, userId]
      });

      let contractId;

      if (existing) {
        // 更新现有订阅
        console.log(`   更新现有订阅: ${existing.id}`);
        
        await sequelize.query(`
          UPDATE paid_contracts SET
            subscription_status = 'active',
            next_billing_date = ?,
            auto_renewing = TRUE,
            grace_period_start = NULL,
            account_hold_start = NULL,
            updated_at = NOW()
          WHERE id = ?
        `, {
          replacements: [nextBillingDate, existing.id]
        });

        contractId = existing.id;

        // 记录状态变更
        if (existing.subscription_status !== 'active') {
          await this.recordStatusChange(
            subscriptionId,
            userId,
            existing.subscription_status,
            'active',
            '订阅续订/恢复'
          );
        }

      } else {
        // 创建新订阅
        console.log(`   创建新订阅合约`);
        
        const [result] = await sequelize.query(`
          INSERT INTO paid_contracts (
            user_id,
            contract_type,
            contract_creation_time,
            contract_end_time,
            hashrate,
            base_hashrate,
            status,
            revenue_btc,
            total_revenue,
            is_subscription,
            subscription_id,
            subscription_status,
            next_billing_date,
            auto_renewing
          ) VALUES (?, ?, NOW(), NULL, ?, ?, 'active', 0, 0, TRUE, ?, 'active', ?, TRUE)
        `, {
          replacements: [
            userId,
            productId,
            productConfig.hashrate,
            productConfig.hashrate,
            subscriptionId,
            nextBillingDate
          ]
        });

        contractId = result.insertId || result;

        // 记录状态变更
        await this.recordStatusChange(
          subscriptionId,
          userId,
          null,
          'active',
          '新订阅创建'
        );
      }

      // 返回合约信息
      const [[contract]] = await sequelize.query(`
        SELECT * FROM paid_contracts WHERE id = ?
      `, {
        replacements: [contractId]
      });

      console.log(`✅ 订阅处理完成: 合约ID=${contractId}`);

      return {
        success: true,
        contract: contract,
        isNew: !existing,
      };

    } catch (error) {
      console.error('❌ 创建/更新订阅失败:', error);
      throw error;
    }
  }

  /**
   * 处理订阅续订
   */
  async handleSubscriptionRenewed(subscriptionId, purchaseToken) {
    try {
      console.log(`🔄 处理订阅续订: ${subscriptionId}`);

      // 查找订阅合约
      const [[contract]] = await sequelize.query(`
        SELECT * FROM paid_contracts 
        WHERE subscription_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `, {
        replacements: [subscriptionId]
      });

      if (!contract) {
        console.log(`⚠️ 未找到订阅合约: ${subscriptionId}`);
        return { success: false, error: '订阅不存在' };
      }

      // 更新下次扣费日期
      const nextBillingDate = new Date();
      nextBillingDate.setDate(nextBillingDate.getDate() + 30);

      await sequelize.query(`
        UPDATE paid_contracts SET
          subscription_status = 'active',
          next_billing_date = ?,
          grace_period_start = NULL,
          account_hold_start = NULL,
          auto_renewing = TRUE,
          updated_at = NOW()
        WHERE id = ?
      `, {
        replacements: [nextBillingDate, contract.id]
      });

      // 记录续订交易
      await sequelize.query(`
        INSERT INTO payment_transactions (
          user_id,
          platform,
          product_id,
          purchase_token,
          subscription_id,
          transaction_type,
          is_subscription,
          status,
          created_at
        ) VALUES (?, 'android', ?, ?, ?, 'renewal', TRUE, 'completed', NOW())
      `, {
        replacements: [
          contract.user_id,
          contract.contract_type,
          purchaseToken,
          subscriptionId
        ]
      });

      // 记录状态变更
      if (contract.subscription_status !== 'active') {
        await this.recordStatusChange(
          subscriptionId,
          contract.user_id,
          contract.subscription_status,
          'active',
          '订阅自动续订'
        );
      }

      console.log(`✅ 订阅续订成功`);
      return { success: true };

    } catch (error) {
      console.error('❌ 处理续订失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理宽限期
   */
  async handleGracePeriod(subscriptionId, purchaseToken) {
    try {
      console.log(`⚠️ 进入宽限期: ${subscriptionId}`);

      const [[contract]] = await sequelize.query(`
        SELECT * FROM paid_contracts 
        WHERE subscription_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `, {
        replacements: [subscriptionId]
      });

      if (!contract) {
        return { success: false, error: '订阅不存在' };
      }

      await sequelize.query(`
        UPDATE paid_contracts SET
          subscription_status = 'grace_period',
          grace_period_start = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `, {
        replacements: [contract.id]
      });

      await this.recordStatusChange(
        subscriptionId,
        contract.user_id,
        contract.subscription_status,
        'grace_period',
        '扣费失败，进入宽限期'
      );

      console.log(`📧 TODO: 发送催费通知给用户: ${contract.user_id}`);

      return { success: true };

    } catch (error) {
      console.error('❌ 处理宽限期失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理账号冻结
   */
  async handleAccountHold(subscriptionId, purchaseToken) {
    try {
      console.log(`🔒 账号冻结: ${subscriptionId}`);

      const [[contract]] = await sequelize.query(`
        SELECT * FROM paid_contracts 
        WHERE subscription_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `, {
        replacements: [subscriptionId]
      });

      if (!contract) {
        return { success: false, error: '订阅不存在' };
      }

      await sequelize.query(`
        UPDATE paid_contracts SET
          subscription_status = 'account_hold',
          account_hold_start = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `, {
        replacements: [contract.id]
      });

      await this.recordStatusChange(
        subscriptionId,
        contract.user_id,
        contract.subscription_status,
        'account_hold',
        '宽限期结束，账号冻结'
      );

      console.log(`⛔ 订阅已冻结，停止挖矿`);

      return { success: true };

    } catch (error) {
      console.error('❌ 处理账号冻结失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理订阅取消
   */
  async handleSubscriptionCanceled(subscriptionId, purchaseToken) {
    try {
      console.log(`❌ 订阅取消: ${subscriptionId}`);

      const [[contract]] = await sequelize.query(`
        SELECT * FROM paid_contracts 
        WHERE subscription_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `, {
        replacements: [subscriptionId]
      });

      if (!contract) {
        return { success: false, error: '订阅不存在' };
      }

      await sequelize.query(`
        UPDATE paid_contracts SET
          subscription_status = 'canceled',
          auto_renewing = FALSE,
          contract_end_time = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `, {
        replacements: [contract.id]
      });

      // 同步更新 mining_contracts（当前实际使用的合约表），仅取消该档位的合约
      // ⚠️ 必须按 product_id 过滤，避免同时持有多个档位时误取消其他档位
      await sequelize.query(`
        UPDATE mining_contracts
        SET is_cancelled = 1, contract_end_time = NOW()
        WHERE user_id = ? AND product_id = ? AND contract_type = 'paid contract' AND is_cancelled = 0
      `, {
        replacements: [contract.user_id, contract.product_id]
      });
      console.log(`⛔ [Android] mining_contracts 已标记取消，user_id=${contract.user_id} product_id=${contract.product_id}`);

      await this.recordStatusChange(
        subscriptionId,
        contract.user_id,
        contract.subscription_status,
        'canceled',
        '用户取消订阅'
      );

      // 记录取消交易
      await sequelize.query(`
        INSERT INTO payment_transactions (
          user_id,
          platform,
          product_id,
          purchase_token,
          subscription_id,
          transaction_type,
          is_subscription,
          status,
          created_at
        ) VALUES (?, 'android', ?, ?, ?, 'cancellation', TRUE, 'completed', NOW())
      `, {
        replacements: [
          contract.user_id,
          contract.contract_type,
          purchaseToken,
          subscriptionId
        ]
      });

      console.log(`⛔ 订阅已取消，停止挖矿`);

      return { success: true };

    } catch (error) {
      console.error('❌ 处理订阅取消失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 记录订阅状态变更
   */
  async recordStatusChange(subscriptionId, userId, oldStatus, newStatus, reason) {
    try {
      await sequelize.query(`
        INSERT INTO subscription_status_history (
          subscription_id,
          user_id,
          old_status,
          new_status,
          reason,
          changed_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
      `, {
        replacements: [subscriptionId, userId, oldStatus, newStatus, reason]
      });
    } catch (error) {
      console.error('记录状态变更失败:', error);
    }
  }

  /**
   * 检查宽限期是否过期
   */
  async checkGracePeriodExpiry() {
    try {
      const gracePeriodDays = config.GRACE_PERIOD_DAYS;
      
      const [contracts] = await sequelize.query(`
        SELECT * FROM paid_contracts
        WHERE subscription_status = 'grace_period'
        AND grace_period_start IS NOT NULL
        AND DATEDIFF(NOW(), grace_period_start) >= ?
      `, {
        replacements: [gracePeriodDays]
      });

      for (const contract of contracts) {
        console.log(`⏰ 宽限期已过: ${contract.subscription_id}`);
        await this.handleAccountHold(contract.subscription_id, null);
      }

      return { checked: contracts.length };
    } catch (error) {
      console.error('检查宽限期失败:', error);
      throw error;
    }
  }

  /**
   * 检查冻结期是否过期
   */
  async checkAccountHoldExpiry() {
    try {
      const holdDays = config.ACCOUNT_HOLD_DAYS;
      
      const [contracts] = await sequelize.query(`
        SELECT * FROM paid_contracts
        WHERE subscription_status = 'account_hold'
        AND account_hold_start IS NOT NULL
        AND DATEDIFF(NOW(), account_hold_start) >= ?
      `, {
        replacements: [holdDays]
      });

      for (const contract of contracts) {
        console.log(`⏰ 冻结期已过，订阅过期: ${contract.subscription_id}`);
        
        await sequelize.query(`
          UPDATE paid_contracts SET
            subscription_status = 'expired',
            contract_end_time = NOW(),
            updated_at = NOW()
          WHERE id = ?
        `, {
          replacements: [contract.id]
        });

        await this.recordStatusChange(
          contract.subscription_id,
          contract.user_id,
          'account_hold',
          'expired',
          '冻结期结束，订阅过期'
        );
      }

      return { checked: contracts.length };
    } catch (error) {
      console.error('检查冻结期失败:', error);
      throw error;
    }
  }

  /**
   * 检查订阅是否允许挖矿
   */
  canMine(subscriptionStatus) {
    return config.MINING_ALLOWED_STATUSES.includes(subscriptionStatus);
  }
}

module.exports = new SubscriptionService();
