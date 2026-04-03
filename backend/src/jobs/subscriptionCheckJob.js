/**
 * 订阅状态检查定时任务
 * 定期检查宽限期和冻结期是否到期
 * 
 * 使用node-cron每小时执行一次
 */

const cron = require('node-cron');
const SubscriptionService = require('../services/subscriptionService');

class SubscriptionCheckJob {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * 启动定时任务
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ 订阅检查任务已在运行');
      return;
    }

    console.log('⏰ 启动订阅状态检查定时任务');
    console.log('   频率: 每小时一次');

    // 每小时的第0分钟执行
    this.cronJob = cron.schedule('0 * * * *', async () => {
      await this.runCheck();
    });

    this.isRunning = true;

    // 立即执行一次
    this.runCheck();
  }

  /**
   * 停止定时任务
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ 订阅检查任务未运行');
      return;
    }

    console.log('⏸️ 停止订阅状态检查任务');
    if (this.cronJob) {
      this.cronJob.stop();
    }
    this.isRunning = false;
  }

  /**
   * 执行检查
   */
  async runCheck() {
    try {
      console.log('\n========== 订阅状态检查 ==========');
      console.log(`时间: ${new Date().toLocaleString()}`);

      // 1. 检查宽限期是否过期
      console.log('\n📋 检查宽限期过期...');
      const gracePeriodResult = await SubscriptionService.checkGracePeriodExpiry();
      console.log(`   处理了 ${gracePeriodResult.checked} 个宽限期过期的订阅`);

      // 2. 检查冻结期是否过期
      console.log('\n📋 检查冻结期过期...');
      const accountHoldResult = await SubscriptionService.checkAccountHoldExpiry();
      console.log(`   处理了 ${accountHoldResult.checked} 个冻结期过期的订阅`);

      console.log('\n========== 检查完成 ==========\n');

    } catch (error) {
      console.error('❌ 订阅状态检查失败:', error);
    }
  }

  /**
   * 获取任务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.cronJob ? this.cronJob.nextDate() : null,
    };
  }
}

// 导出单例
const instance = new SubscriptionCheckJob();
module.exports = instance;
