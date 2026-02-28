// jobQueue.js
// 职责：初始化 Bull 队列，用于处理异步/耗时任务（如批量结算、对账、通知等）
// - 使用 Redis 作为消息中间件
// - 暴露队列实例给生产者/消费者使用
//
// 生产建议：
// - 设置队列级别的默认重试、延迟、去重策略
// - 在多实例环境中监控队列积压与失败率，必要时扩容 worker 并优化任务粒度

// 引入 Bull 队列
const Queue = require('bull');

// 允许通过环境变量配置 Redis 连接，便于生产环境部署
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : 0;

// 队列名称常量，避免硬编码
const MINING_QUEUE_NAME = 'mining';

// 创建挖矿队列实例 - 使用增强的Redis配置
const miningQueue = new Queue(MINING_QUEUE_NAME, {
  redis: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    db: REDIS_DB,
    // 增强连接稳定性的配置
    connectTimeout: 15000,        // 连接超时15秒
    keepAlive: 30000,             // TCP Keep-Alive 30秒
    family: 4,                    // 强制使用 IPv4
    retryStrategy: (times) => {
      // 与 redisClient.js 保持一致的重试策略
      if (times > 20) {
        console.error('[Bull Redis] 重试次数超过20次，停止重连');
        return null;
      }
      const delay = Math.min(times * 100, 5000);
      console.log(`[Bull Redis] 第${times}次重试，延迟${delay}ms`);
      return delay;
    },
    enableReadyCheck: true,
    maxRetriesPerRequest: 3
  },
  // Bull 队列级别配置
  defaultJobOptions: {
    attempts: 3,                  // 失败后重试3次
    backoff: {
      type: 'exponential',        // 指数退避
      delay: 2000                 // 初始延迟2秒
    },
    removeOnComplete: 100,        // 只保留最近100个成功任务
    removeOnFail: 200             // 只保留最近200个失败任务
  },
  settings: {
    lockDuration: 30000,          // 任务锁定时间30秒
    stalledInterval: 30000,       // 每30秒检查一次卡住的任务
    maxStalledCount: 2            // 最多标记为卡住2次后放弃
  }
});

// 常见事件监听，便于排查生产问题
miningQueue.on('error', (err) => {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp}: [Bull] ❌ Queue error:`, err.message);
});

miningQueue.on('stalled', (job) => {
  const timestamp = new Date().toISOString();
  console.warn(`${timestamp}: [Bull] ⚠️  Job stalled: ${job.id}`);
});

miningQueue.on('active', (job) => {
  console.log(`[Bull] 📝 Job ${job.id} started processing`);
});

miningQueue.on('completed', (job) => {
  console.log(`[Bull] ✅ Job ${job.id} completed`);
});

miningQueue.on('failed', (job, err) => {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp}: [Bull] ❌ Job ${job.id} failed:`, err.message);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[Bull] 收到 SIGTERM，正在关闭队列...');
  await miningQueue.close();
});

process.on('SIGINT', async () => {
  console.log('[Bull] 收到 SIGINT，正在关闭队列...');
  await miningQueue.close();
});

module.exports = miningQueue;
module.exports.MINING_QUEUE_NAME = MINING_QUEUE_NAME;
