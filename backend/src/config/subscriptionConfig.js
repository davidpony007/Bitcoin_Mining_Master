/**
 * 订阅配置
 * 定义订阅商品信息和相关常量
 */

module.exports = {
  // 订阅商品配置
  SUBSCRIPTION_PRODUCTS: {
    'mining_starter_monthly': {
      price: 4.99,
      period: 'monthly',
      periodDays: 30,
      hashrate: 0.000000000004456,  // 每秒BTC产出
      displayHashrate: '176.3 Gh/s',
      name: 'Starter Mining Plan',
      description: '入门挖矿订阅 - 每月自动续订',
    },
    'mining_standard_monthly': {
      price: 6.99,
      period: 'monthly',
      periodDays: 30,
      hashrate: 0.000000000007723,
      displayHashrate: '305.6 Gh/s',
      name: 'Standard Mining Plan',
      description: '标准挖矿订阅 - 每月自动续订',
    },
    'mining_advanced_monthly': {
      price: 9.99,
      period: 'monthly',
      periodDays: 30,
      hashrate: 0.000000000015447,
      displayHashrate: '611.2 Gh/s',
      name: 'Advanced Mining Plan',
      description: '进阶挖矿订阅 - 每月自动续订',
    },
    'mining_premium_monthly': {
      price: 19.99,
      period: 'monthly',
      periodDays: 30,
      hashrate: 0.000000000033522,
      displayHashrate: '1326.4 Gh/s',
      name: 'Premium Mining Plan',
      description: '高级挖矿订阅 - 每月自动续订',
    },
  },

  // 订阅状态
  SUBSCRIPTION_STATUS: {
    ACTIVE: 'active',                 // 正常活跃
    GRACE_PERIOD: 'grace_period',     // 宽限期
    ACCOUNT_HOLD: 'account_hold',     // 账号冻结
    PAUSED: 'paused',                 // 用户暂停
    EXPIRED: 'expired',               // 已过期
    CANCELED: 'canceled',             // 已取消
  },

  // 宽限期配置（天数）
  GRACE_PERIOD_DAYS: 7,

  // 账号冻结期配置（天数）
  // Google Play要求: 宽限期+冻结期 >= 30天
  ACCOUNT_HOLD_DAYS: 23,

  // Google Play 通知类型
  NOTIFICATION_TYPES: {
    1: 'SUBSCRIPTION_RECOVERED',       // 订阅恢复
    2: 'SUBSCRIPTION_RENEWED',         // 订阅续订
    3: 'SUBSCRIPTION_CANCELED',        // 订阅取消
    4: 'SUBSCRIPTION_PURCHASED',       // 新订阅购买
    5: 'SUBSCRIPTION_ON_HOLD',         // 账号冻结（已弃用，使用20）
    6: 'SUBSCRIPTION_IN_GRACE_PERIOD', // 宽限期（已弃用，使用13）
    7: 'SUBSCRIPTION_RESTARTED',       // 订阅重启
    8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED', // 价格变更确认
    9: 'SUBSCRIPTION_DEFERRED',        // 订阅延期
    10: 'SUBSCRIPTION_PAUSED',         // 订阅暂停
    11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED', // 暂停计划变更
    12: 'SUBSCRIPTION_REVOKED',        // 订阅撤销
    13: 'SUBSCRIPTION_IN_GRACE_PERIOD', // 宽限期
    20: 'SUBSCRIPTION_ON_HOLD',        // 账号冻结
  },

  // 订阅通知类型映射到状态
  NOTIFICATION_TO_STATUS: {
    1: 'active',         // RECOVERED
    2: 'active',         // RENEWED
    3: 'canceled',       // CANCELED
    4: 'active',         // PURCHASED
    7: 'active',         // RESTARTED
    10: 'paused',        // PAUSED
    12: 'canceled',      // REVOKED
    13: 'grace_period',  // IN_GRACE_PERIOD
    20: 'account_hold',  // ON_HOLD
  },

  // 哪些状态下应该继续挖矿
  MINING_ALLOWED_STATUSES: ['active', 'grace_period'],

  // 哪些状态下应该停止挖矿
  MINING_STOPPED_STATUSES: ['account_hold', 'paused', 'expired', 'canceled'],
};
