/**
 * 付费合约服务
 * 负责付费挖矿合约的创建、管理和配置
 * 特点：
 * 1. 单独的挖矿队列（不与免费合约混合）
 * 2. 不使用国家系数（只使用购买时确定的算力值）
 * 3. 根据付费档位计算每秒比特币产出
 * 4. 支持一次性购买和订阅模式
 */

const MiningContract = require('../models/miningContract');
const UserOrder = require('../models/userOrder');
const UserInformation = require('../models/userInformation');
const db = require('../config/database');
const subscriptionConfig = require('../config/subscriptionConfig');

class PaidContractService {
  /**
   * 付费合约档位配置
   * 根据价格档位计算每秒BTC产出（不受国家系数影响）
   * 算力值（前端显示）和实际每秒挖矿BTC数严格对应
   */
  static CONTRACT_TIERS = {
    'p0499': {  // $4.99
      price: 4.99,
      name: 'contract_4.99',
      duration: 30,  // 30天
      hashrate: 0.000000000004456,  // 实际每秒挖矿BTC数
      displayHashrate: '176.3Gh/s',  // 前端显示的算力值
      description: '入门合约 - 30天挖矿'
    },
    'p0699': {  // $6.99
      price: 6.99,
      name: 'contract_6.99',
      duration: 30,
      hashrate: 0.000000000007723,  // 实际每秒挖矿BTC数
      displayHashrate: '305.6Gh/s',  // 前端显示的算力值
      description: '标准合约 - 30天挖矿'
    },
    'p0999': {  // $9.99
      price: 9.99,
      name: 'contract_9.99',
      duration: 30,  // 30天
      hashrate: 0.000000000015447,  // 实际每秒挖矿BTC数
      displayHashrate: '611.2Gh/s',  // 前端显示的算力值
      description: '进阶合约 - 30天挖矿'
    },
    'p1999': {  // $19.99
      price: 19.99,
      name: 'contract_19.99',
      duration: 30,  // 30天
      hashrate: 0.000000000033522,  // 实际每秒挖矿BTC数
      displayHashrate: '1326.4Gh/s',  // 前端显示的算力值
      description: '高级合约 - 30天挖矿'
    }
  };

  /**
   * 创建付费合约
   * 当用户完成支付后调用，创建挖矿合约
   * 
   * @param {string} userId - 用户ID
   * @param {string} productId - 产品ID (p0499, p0699, etc.)
   * @param {string} orderId - 订单ID（可选，用于关联订单）
   */
  static async createPaidContract(userId, productId, orderId = null) {
    try {
      // 1. 验证用户存在
      const user = await UserInformation.findOne({
        where: { user_id: userId }
      });

      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      // 2. 验证产品档位
      const tier = this.CONTRACT_TIERS[productId];
      if (!tier) {
        return {
          success: false,
          message: `无效的产品档位: ${productId}`
        };
      }

      // 3. 计算合约时间
      const now = new Date();
      const endTime = new Date(now.getTime() + tier.duration * 24 * 60 * 60 * 1000);
      const durationTime = `${tier.duration * 24}:00:00`; // 格式: HH:MM:SS

      // 4. 创建付费合约（固定收益，不受国家/等级系数影响）
      const contract = await MiningContract.create({
        user_id: userId,
        contract_type: 'paid contract',
        contract_creation_time: now,
        contract_end_time: endTime,
        contract_duration: durationTime,
        base_hashrate: tier.hashrate,  // 新字段：付费合约的固定速率
        hashrate: tier.hashrate  // 兼容字段：固定算力
      });

      // 5. 计算预期收益（不含任何倍数）
      const durationSeconds = tier.duration * 24 * 60 * 60;
      const expectedRevenue = tier.hashrate * durationSeconds;

      console.log(`✅ 创建付费合约成功:`, {
        userId,
        productId,
        tier: tier.name,
        price: `$${tier.price}`,
        duration: `${tier.duration}天`,
        hashrate: tier.hashrate,
        expectedRevenue,
        startTime: now,
        endTime
      });

      return {
        success: true,
        message: '付费合约创建成功',
        contract: {
          id: contract.id,
          type: 'paid contract',
          tier: tier.name,
          price: tier.price,
          duration: tier.duration,
          durationDays: tier.duration,
          startTime: contract.contract_creation_time,
          endTime: contract.contract_end_time,
          hashrate: contract.hashrate,
          expectedRevenue,
          description: tier.description
        },
        orderId
      };

    } catch (err) {
      console.error('❌ 创建付费合约失败:', err);
      throw err;
    }
  }

  /**
   * 获取用户的付费合约列表
   */
  static async getUserContracts(userId, status = null) {
    try {
      const where = {
        user_id: userId,
        contract_type: 'paid contract'
      };

      const contracts = await MiningContract.findAll({
        where,
        order: [['contract_creation_time', 'DESC']]
      });

      return {
        success: true,
        contracts: contracts.map(contract => {
          const now = new Date();
          const endTime = new Date(contract.contract_end_time);
          const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));

          // 查找对应的档位信息
          let tierInfo = null;
          for (const [key, tier] of Object.entries(this.CONTRACT_TIERS)) {
            if (Math.abs(tier.hashrate - parseFloat(contract.hashrate)) < 0.000000000000001) {
              tierInfo = { id: key, ...tier };
              break;
            }
          }

          return {
            id: contract.id,
            type: 'paid contract',
            tier: tierInfo,
            startTime: contract.contract_creation_time,
            endTime: contract.contract_end_time,
            hashrate: contract.hashrate,
            remainingSeconds,
            remainingFormatted: this.formatDuration(remainingSeconds)
          };
        })
      };

    } catch (err) {
      console.error('❌ 获取付费合约列表失败:', err);
      throw err;
    }
  }

  /**
   * 获取合约档位配置列表
   */
  static getContractTiers() {
    return {
      success: true,
      tiers: Object.entries(this.CONTRACT_TIERS).map(([id, tier]) => ({
        id,
        name: tier.name,
        price: tier.price,
        price: tier.price,
        duration: tier.duration,
        hashrate: tier.hashrate,
        displayHashrate: tier.displayHashrate,
        description: tier.description,
        expectedDailyRevenue: tier.hashrate * 86400,  // 24小时
        expectedTotalRevenue: tier.hashrate * tier.duration * 86400
      }))
    };
  }

  /**
   * 格式化时长显示
   */
  static formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}天${hours}小时`;
    } else if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  }

  /**
   * 检查合约是否可以挖矿
   * 对于订阅模式，需要检查订阅状态
   * @param {Object} contract - 合约对象
   * @returns {boolean}
   */
  static canContractMine(contract) {
    // 一次性购买合约
    if (!contract.is_subscription) {
      const now = new Date();
      const endTime = new Date(contract.contract_end_time);
      return now < endTime && contract.status === 'active';
    }

    // 订阅模式合约
    const status = contract.subscription_status;
    return subscriptionConfig.MINING_ALLOWED_STATUSES.includes(status);
  }

  /**
   * 获取合约状态描述
   * @param {Object} contract - 合约对象
   * @returns {Object}
   */
  static getContractStatusInfo(contract) {
    if (!contract.is_subscription) {
      // 一次性购买合约
      const now = new Date();
      const endTime = new Date(contract.contract_end_time);
      const isExpired = now >= endTime;

      return {
        type: 'one_time',
        status: isExpired ? 'expired' : 'active',
        canMine: !isExpired && contract.status === 'active',
        statusText: isExpired ? '已过期' : '正常',
        endTime: contract.contract_end_time,
      };
    }

    // 订阅模式合约
    const status = contract.subscription_status;
    const canMine = this.canContractMine(contract);

    let statusText = '未知';
    switch (status) {
      case 'active':
        statusText = '正常订阅中';
        break;
      case 'grace_period':
        statusText = '宽限期（继续挖矿）';
        break;
      case 'account_hold':
        statusText = '账号冻结（暂停挖矿）';
        break;
      case 'paused':
        statusText = '用户已暂停';
        break;
      case 'canceled':
        statusText = '已取消';
        break;
      case 'expired':
        statusText = '已过期';
        break;
    }

    return {
      type: 'subscription',
      status: status,
      canMine: canMine,
      statusText: statusText,
      nextBillingDate: contract.next_billing_date,
      autoRenewing: contract.auto_renewing,
    };
  }

  /**
   * 获取用户所有有效合约（包括订阅）
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  static async getActiveContracts(userId) {
    try {
      const where = {
        user_id: userId,
        contract_type: 'paid contract'
      };

      const contracts = await MiningContract.findAll({
        where,
        order: [['contract_creation_time', 'DESC']]
      });

      const activeContracts = contracts.filter(contract => {
        return this.canContractMine(contract);
      });

      return {
        success: true,
        contracts: activeContracts.map(contract => ({
          id: contract.id,
          type: contract.is_subscription ? 'subscription' : 'one_time',
          hashrate: contract.hashrate,
          statusInfo: this.getContractStatusInfo(contract),
          subscriptionId: contract.subscription_id,
        }))
      };

    } catch (error) {
      console.error('获取有效合约失败:', error);
      throw error;
    }
  }
}

module.exports = PaidContractService;
