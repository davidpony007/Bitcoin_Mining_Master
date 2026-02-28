/**
 * 挖矿配置常量
 * 定义基础算力、挖矿速度等核心参数
 */

module.exports = {
  // 基础算力（Gigahash/秒）
  BASE_HASHRATE_GHS: 5.5,

  // 基础挖矿速度（BTC/秒）
  BASE_MINING_SPEED_BTC_PER_SEC: 0.000000000000139,

  // 时间常量
  SECONDS_PER_MINUTE: 60,
  SECONDS_PER_HOUR: 3600,
  SECONDS_PER_DAY: 86400,

  // 算力池槽位配置
  HASHRATE_POOL_TOTAL_SLOTS: 48,
  HASHRATE_POOL_GRID_COLUMNS: 8,
  HASHRATE_POOL_GRID_ROWS: 6,

  // 计算辅助方法
  calculateHourlyEarnings() {
    return this.BASE_MINING_SPEED_BTC_PER_SEC * this.SECONDS_PER_HOUR;
  },

  calculateDailyEarnings() {
    return this.BASE_MINING_SPEED_BTC_PER_SEC * this.SECONDS_PER_DAY;
  },

  // 格式化算力显示
  formatHashrate(hashrate) {
    if (hashrate >= 1000) {
      return `${(hashrate / 1000).toFixed(2)} Th/s`;
    }
    return `${hashrate.toFixed(2)} Gh/s`;
  },

  // 格式化BTC金额
  formatBTC(btc) {
    return btc.toFixed(15);
  }
};
