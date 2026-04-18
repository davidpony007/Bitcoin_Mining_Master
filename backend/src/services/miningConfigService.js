/**
 * 挖矿基础速率配置服务
 * 从 Redis 缓存 / MySQL 读取全局基础挖矿速率，供所有合约服务使用。
 * 管理员在后台修改基础速率后，会自动清除此缓存并同步存量合约。
 */

const pool = require('../config/database_native');
const redisClient = require('../config/redis');

const CACHE_KEY = 'system:base_hashrate';
const CACHE_TTL  = 300;              // Redis 缓存 5 分钟
const FALLBACK   = 0.000000000000139; // DB 不可用时的降级默认值

const MiningConfigService = {
  /**
   * 获取当前全局基础挖矿速率（BTC/s）
   * 优先读 Redis，没有则查 MySQL 并回写 Redis。
   */
  async getBaseHashrate() {
    // 1. 尝试 Redis 缓存
    try {
      const cached = await redisClient.get(CACHE_KEY);
      if (cached !== null) {
        const v = parseFloat(cached);
        if (!isNaN(v) && v > 0) return v;
      }
    } catch (_) {}

    // 2. 查询 MySQL
    try {
      const conn = await pool.getConnection();
      try {
        const [[row]] = await conn.query(
          `SELECT config_value FROM system_config WHERE config_key = 'base_mining_hashrate' LIMIT 1`
        );
        if (row) {
          const v = parseFloat(row.config_value);
          if (!isNaN(v) && v > 0) {
            await redisClient.set(CACHE_KEY, v.toFixed(18), CACHE_TTL);
            return v;
          }
        }
      } finally {
        conn.release();
      }
    } catch (_) {}

    return FALLBACK;
  },

  /** 管理员修改基础速率后调用，清除 Redis 缓存 */
  async clearBaseHashrateCache() {
    try {
      await redisClient.del(CACHE_KEY);
    } catch (_) {}
  }
};

module.exports = MiningConfigService;
