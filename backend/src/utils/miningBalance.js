// miningBalance.js
// 职责：
// - 依据用户分组（在线+有效合约 / 离线+有效合约 / 离线+无有效合约）定频率调度挖矿余额计算
// - 使用 Redis 作为实时余额的"计算态与缓存态"存储，保证查询与累积高性能
// - 每 60 秒将 Redis 中的余额持久化到 MySQL
// - 角色：权威账务存储，用于对账、报表与历史
// - 模型：简单地将 Redis 中的余额写回到 UserInformation.bitcoinBalance
// - 一致性：周期内的新增产出暂存于 Redis；如需严格一致性可将交易流水分解为"可重放"的事件日志

const redis = require('./redisClient');
const { UserInformation, MiningContract } = require('../models');
const { Op } = require('sequelize');

// Redis key 设计
const BALANCE_KEY = userId => `user:balance:${userId}`;
const LAST_CALC_KEY = userId => `user:last_calc:${userId}`;

/**
 * 计算单个用户的比特币余额
 */
async function calculateUserBalance(user, contracts) {
  try {
    let balance = Number(await redis.get(BALANCE_KEY(user.id))) || 0;
    const now = Date.now();
    for (const contract of contracts) {
      const lastCalc = Number(await redis.get(LAST_CALC_KEY(user.id))) || contract.startTime;
      const seconds = Math.floor((now - lastCalc) / 1000);
      if (seconds > 0) {
        balance += contract.rate * seconds;
      }
    }
    await redis.set(BALANCE_KEY(user.id), balance);
    await redis.set(LAST_CALC_KEY(user.id), now);
    return balance;
  } catch (error) {
    console.error(`计算用户 ${user.id} 余额失败:`, error.message);
    return 0;
  }
}

/**
 * 获取三类分组用户
 */
async function getUserGroups() {
  try {
    const now = Date.now();
    const onlineActive = await UserInformation.findAll({
      where: { isOnline: true },
      include: [{
        model: MiningContract,
        where: { startTime: { [Op.lt]: now }, endTime: { [Op.gt]: now } },
        required: true
      }]
    });
    const offlineActive = await UserInformation.findAll({
      where: { isOnline: false },
      include: [{
        model: MiningContract,
        where: { startTime: { [Op.lt]: now }, endTime: { [Op.gt]: now } },
        required: true
      }]
    });
    const offlineInactive = await UserInformation.findAll({
      where: { isOnline: false },
      include: [{
        model: MiningContract,
        where: { endTime: { [Op.lt]: now } },
        required: false
      }]
    });
    return { onlineActive, offlineActive, offlineInactive };
  } catch (error) {
    console.error('获取用户分组失败:', error.message);
    return { onlineActive: [], offlineActive: [], offlineInactive: [] };
  }
}

/**
 * 定时任务调度器
 */
function scheduleBalanceCalculation(group, intervalMs, getUsers) {
  setInterval(async () => {
    try {
      const users = await getUsers();
      for (const user of users) {
        const contracts = user.MiningContracts || [];
        await calculateUserBalance(user, contracts);
      }
    } catch (error) {
      console.error(`分组 ${group} 余额计算失败:`, error.message);
    }
  }, intervalMs);
}

/**
 * 启动所有分组的定时调度器
 */
async function startMiningBalanceScheduler() {
  scheduleBalanceCalculation('onlineActive', 5000, async () => (await getUserGroups()).onlineActive);
  scheduleBalanceCalculation('offlineActive', 60000, async () => (await getUserGroups()).offlineActive);
  scheduleBalanceCalculation('offlineInactive', 24 * 60 * 60 * 1000, async () => (await getUserGroups()).offlineInactive);
}

// MySQL持久化
setInterval(async () => {
  try {
    const users = await UserInformation.findAll();
    for (const user of users) {
      const balance = Number(await redis.get(BALANCE_KEY(user.id))) || 0;
      await user.update({ bitcoinBalance: balance });
    }
  } catch (error) {
    console.error('MySQL持久化失败:', error.message);
  }
}, 60000);

module.exports = {
  startMiningBalanceScheduler,
  calculateUserBalance,
  getUserGroups
};
