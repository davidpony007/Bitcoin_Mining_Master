/**
 * 付费合约挖矿收益计算队列（支持订阅模式）
 * 
 * 特点:
 * 1. 只处理付费合约，不处理免费合约
 * 2. 订阅模式：检查订阅状态，只有active和grace_period状态才挖矿
 * 3. 一次性购买：检查合约是否过期
 * 4. 每秒执行一次，累加BTC收益
 */

const sequelize = require('../config/database');
const PaidContractService = require('./paidContractService');
const subscriptionConfig = require('../config/subscriptionConfig');

class PaidContractMiningQueue {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * 启动挖矿队列
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ 付费合约挖矿队列已在运行');
      return;
    }

    console.log('🚀 启动付费合约挖矿队列（支持订阅模式）');
    this.isRunning = true;

    // 每秒执行一次
    this.intervalId = setInterval(async () => {
      await this.processMiningRewards();
    }, 1000);
  }

  /**
   * 停止挖矿队列
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ 付费合约挖矿队列未运行');
      return;
    }

    console.log('⏸️ 停止付费合约挖矿队列');
    clearInterval(this.intervalId);
    this.isRunning = false;
  }

  /**
   * 处理挖矿奖励
   */
  async processMiningRewards() {
    try {
      const now = new Date();

      // 查询所有付费合约
      const [contracts] = await sequelize.query(`
        SELECT 
          id,
          user_id,
          hashrate,
          base_hashrate,
          revenue_btc,
          total_revenue,
          contract_end_time,
          status,
          is_subscription,
          subscription_id,
          subscription_status,
          next_billing_date
        FROM paid_contracts
        WHERE status = 'active'
      `);

      if (contracts.length === 0) {
        return;
      }

      // 分批处理
      const batchSize = 100;
      for (let i = 0; i < contracts.length; i += batchSize) {
        const batch = contracts.slice(i, i + batchSize);
        await this.processBatch(batch, now);
      }

    } catch (error) {
      console.error('❌ 付费合约挖矿队列处理失败:', error);
    }
  }

  /**
   * 处理一批合约
   */
  async processBatch(contracts, now) {
    const updates = [];

    for (const contract of contracts) {
      // 检查是否可以挖矿
      if (!this.canMine(contract, now)) {
        continue;
      }

      // 计算本秒收益（使用base_hashrate，不受国家系数影响）
      const btcPerSecond = parseFloat(contract.base_hashrate || contract.hashrate);
      const newRevenueBtc = parseFloat(contract.revenue_btc || 0) + btcPerSecond;
      const newTotalRevenue = parseFloat(contract.total_revenue || 0) + btcPerSecond;

      updates.push({
        id: contract.id,
        revenue_btc: newRevenueBtc,
        total_revenue: newTotalRevenue,
      });
    }

    // 批量更新数据库
    if (updates.length > 0) {
      await this.batchUpdate(updates);
    }
  }

  /**
   * 检查合约是否可以挖矿
   */
  canMine(contract, now) {
    // 检查合约状态
    if (contract.status !== 'active') {
      return false;
    }

    // 一次性购买合约
    if (!contract.is_subscription) {
      // 检查是否过期
      const endTime = new Date(contract.contract_end_time);
      return now < endTime;
    }

    // 订阅模式合约
    const subscriptionStatus = contract.subscription_status;
    
    // 只有在 active 和 grace_period 状态下才挖矿
    // account_hold, paused, canceled, expired 状态停止挖矿
    return subscriptionConfig.MINING_ALLOWED_STATUSES.includes(subscriptionStatus);
  }

  /**
   * 批量更新数据库
   */
  async batchUpdate(updates) {
    try {
      // 使用事务批量更新
      await sequelize.transaction(async (t) => {
        for (const update of updates) {
          await sequelize.query(`
            UPDATE paid_contracts 
            SET 
              revenue_btc = ?,
              total_revenue = ?,
              updated_at = NOW()
            WHERE id = ?
          `, {
            replacements: [update.revenue_btc, update.total_revenue, update.id],
            transaction: t
          });
        }
      });

      // 定期输出统计（每100次更新输出一次）
      if (Math.random() < 0.01) {
        console.log(`💰 付费合约挖矿: 本次更新 ${updates.length} 个合约`);
      }

    } catch (error) {
      console.error('❌ 批量更新失败:', error);
    }
  }

  /**
   * 获取挖矿统计
   */
  async getStatistics() {
    try {
      // 总合约数
      const [[totalResult]] = await sequelize.query(`
        SELECT COUNT(*) as count FROM paid_contracts
      `);

      // 一次性购买合约统计
      const [[oneTimeResult]] = await sequelize.query(`
        SELECT 
          COUNT(*) as count,
          SUM(CASE WHEN NOW() < contract_end_time AND status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN NOW() >= contract_end_time THEN 1 ELSE 0 END) as expired
        FROM paid_contracts
        WHERE is_subscription = FALSE OR is_subscription IS NULL
      `);

      // 订阅合约统计
      const [[subscriptionResult]] = await sequelize.query(`
        SELECT 
          COUNT(*) as count,
          SUM(CASE WHEN subscription_status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN subscription_status = 'grace_period' THEN 1 ELSE 0 END) as grace_period,
          SUM(CASE WHEN subscription_status = 'account_hold' THEN 1 ELSE 0 END) as account_hold,
          SUM(CASE WHEN subscription_status = 'canceled' THEN 1 ELSE 0 END) as canceled,
          SUM(CASE WHEN subscription_status = 'expired' THEN 1 ELSE 0 END) as expired
        FROM paid_contracts
        WHERE is_subscription = TRUE
      `);

      // 正在挖矿的合约数
      const [miningContracts] = await sequelize.query(`
        SELECT 
          COUNT(*) as count
        FROM paid_contracts
        WHERE status = 'active'
        AND (
          (is_subscription = FALSE AND NOW() < contract_end_time)
          OR
          (is_subscription = TRUE AND subscription_status IN ('active', 'grace_period'))
        )
      `);

      return {
        total: totalResult.count,
        oneTime: {
          total: oneTimeResult.count || 0,
          active: oneTimeResult.active || 0,
          expired: oneTimeResult.expired || 0,
        },
        subscription: {
          total: subscriptionResult.count || 0,
          active: subscriptionResult.active || 0,
          gracePeriod: subscriptionResult.grace_period || 0,
          accountHold: subscriptionResult.account_hold || 0,
          canceled: subscriptionResult.canceled || 0,
          expired: subscriptionResult.expired || 0,
        },
        currentlyMining: miningContracts[0]?.count || 0,
      };

    } catch (error) {
      console.error('获取统计失败:', error);
      return null;
    }
  }
}

// 导出单例
const instance = new PaidContractMiningQueue();
module.exports = instance;
