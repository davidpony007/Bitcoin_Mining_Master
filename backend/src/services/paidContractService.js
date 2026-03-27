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
const PaidProductService = require('./paidProductService');

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
   * @param {string|null} orderId - 关联订单ID（= payment_gateway_id / transaction_id）
   * @param {Date|null} expiresDate - iOS 订阅到期时间（Apple 收据提供），null 时按自然月计算
   * @param {'ios'|'android'|'system'} platform - 支付来源平台
   * @param {string|null} originalTxId - iOS originalTransactionId 或 Android 初始 purchase_token
   */
  static async createPaidContract(
    userId,
    productId,
    orderId = null,
    expiresDate = null,
    platform = 'system',
    originalTxId = null
  ) {
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

      // 2. 验证产品档位（从 DB 读取）
      const tier = await PaidProductService.getProductInfo(productId);
      if (!tier) {
        return {
          success: false,
          message: `无效的产品档位: ${productId}`
        };
      }
      const tierHashrate = parseFloat(tier.hashrate_raw);
      const tierMonths = tier.duration_months || 1; // 自然月数

      // 3. 计算合约时间
      // 注：同一 transaction_id 的去重已在 paymentController 最上层处理（payment_gateway_id UNIQUE），此处无需重复拦截，
      // 不同产品档位（如同时持有 $4.99 和 $6.99）或订阅升级场景均可正常创建新合约。
      const now = new Date();
      // iOS 自动续期订阅：使用 Apple 提供的到期时间；
      // 安卓/其他：按自然月计算（如 3月8日 → 4月8日，不是固定30天）
      let endTime;
      if (expiresDate instanceof Date && !isNaN(expiresDate)) {
        endTime = expiresDate;
      } else {
        endTime = new Date(now);
        endTime.setMonth(endTime.getMonth() + tierMonths);
      }
      // 实际时长（自然月长度可能是28/29/30/31天，取实际差值）
      const actualSeconds = Math.round((endTime - now) / 1000);
      const actualHours = Math.round(actualSeconds / 3600);
      const durationTime = `${actualHours}:00:00`; // 格式: TIME HH:MM:SS

      // 4. 判断是否为续订：查询该用户同档位的历史合约（无论是否过期、取消）
      const prevContract = await MiningContract.findOne({
        where: { user_id: userId, product_id: productId, contract_type: 'paid contract' },
        order: [['id', 'DESC']],
        attributes: ['id'],
      });
      const isRenewal = prevContract ? 1 : 0;
      const previousContractId = prevContract ? prevContract.id : null;

      // 5. 创建付费合约（固定收益，不受国家/等级系数影响）
      const contract = await MiningContract.create({
        user_id: userId,
        contract_type: 'paid contract',
        product_id: productId,
        platform,
        contract_creation_time: now,
        contract_end_time: endTime,
        contract_duration: durationTime,
        base_hashrate: tierHashrate,
        hashrate: tierHashrate,
        is_cancelled: 0,
        original_transaction_id: originalTxId || null,
        order_id: orderId || null,
        is_renewal: isRenewal,
        previous_contract_id: previousContractId,
      });

      // 5. 计算预期收益（不含任何倍数）
      const expectedRevenue = tierHashrate * actualSeconds;

      console.log(`✅ 创建付费合约成功:`, {
        userId,
        productId,
        tier: tier.product_name,
        price: `$${tier.product_price}`,
        duration: `${tierMonths}个月`,
        hashrate: tierHashrate,
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
          tier: tier.product_name,
          price: parseFloat(tier.product_price),
          duration: tierMonths,
          durationMonths: tierMonths,
          durationDays: Math.round(actualSeconds / 86400),
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

      // 提前加载产品列表（带缓存，只查一次 DB）
      const products = await PaidProductService.getActiveProducts();

      return {
        success: true,
        contracts: contracts.map(contract => {
          const now = new Date();
          const endTime = new Date(contract.contract_end_time);
          const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));

          // 查找对应的档位信息（通过 hashrate 匹配 DB 中的 hashrate_raw）
          let tierInfo = null;
          for (const p of products) {
            if (Math.abs(parseFloat(p.hashrate_raw) - parseFloat(contract.hashrate)) < 1e-15) {
              tierInfo = { id: p.product_id, name: p.product_name, price: parseFloat(p.product_price), duration: p.duration_months || 1, durationDays: p.duration_days, displayHashrate: p.hashrate, description: p.description };
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
   * 获取合约档位配置列表（从 DB 读取）
   */
  static async getContractTiers() {
    const products = await PaidProductService.getActiveProducts();
    return {
      success: true,
      tiers: products.map(p => ({
        id: p.product_id,
        name: p.product_name,
        displayName: p.display_name,
        price: parseFloat(p.product_price),
        duration: p.duration_months || 1,
        durationMonths: p.duration_months || 1,
        durationDays: p.duration_days,
        hashrate: parseFloat(p.hashrate_raw),
        displayHashrate: p.hashrate,
        description: p.description,
        expectedDailyRevenue: parseFloat(p.hashrate_raw) * 86400,
        // 预期总收益用平均月天数估算（30.4375 = 365.25/12）
        expectedTotalRevenue: parseFloat(p.hashrate_raw) * (p.duration_months || 1) * 30.4375 * 86400
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
