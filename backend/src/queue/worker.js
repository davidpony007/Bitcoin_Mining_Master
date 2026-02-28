// worker.js
// 职责：消费 Bull 队列中的任务，执行业务逻辑
// - 可设置并发（如 miningQueue.process(5, handler)）
// - 在 handler 中执行耗时操作，并返回结果供生产者/监控方使用

// 引入队列
const miningQueue = require('./jobQueue');

// 处理挖矿任务的 worker；可以配置并发，如 miningQueue.process(5, handler)
miningQueue.process(async (job) => {
  // 这里可以执行耗时的挖矿逻辑
  console.log('处理挖矿任务:', job.data);
  // 模拟耗时操作
  await new Promise(resolve => setTimeout(resolve, 5000));
  return { result: '挖矿完成', detail: job.data };
});

// 监听任务完成事件
miningQueue.on('completed', (job, result) => {
  console.log(`任务${job.id}已完成:`, result);
});

// 监听任务失败事件
miningQueue.on('failed', (job, err) => {
  console.error(`任务${job?.id}失败:`, err?.message || err);
  // 可选：在此实现重试/告警逻辑，如 job.retry() 或通知运维
});
