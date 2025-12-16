// PM2 生态配置文件 - Bitcoin Mining Master
// 用于管理 Node.js 后端多实例、Worker 进程、日志和监控

module.exports = {
  apps: [
    // API 服务器（集群模式，自动利用多核 CPU）
    {
      name: 'bmm-api',                        // 应用名称
      script: './src/index.js',               // 入口文件
      instances: 2,                           // 实例数量（可设为 'max' 自动匹配 CPU 核心数）
      exec_mode: 'cluster',                   // 集群模式（负载均衡）
      env: {                                  // 环境变量
        NODE_ENV: 'production',
        PORT: 8888
      },
      env_development: {                      // 开发环境变量
        NODE_ENV: 'development',
        PORT: 8888
      },
      error_file: './logs/pm2/api-error.log', // 错误日志路径
      out_file: './logs/pm2/api-out.log',     // 输出日志路径
      log_date_format: 'YYYY-MM-DD HH:mm:ss', // 日志时间格式
      merge_logs: true,                       // 合并多实例日志
      max_memory_restart: '500M',             // 内存超限自动重启
      min_uptime: '10s',                      // 最小运行时间（避免频繁重启）
      max_restarts: 10,                       // 最大重启次数
      autorestart: true,                      // 异常退出自动重启
      watch: false,                           // 生产环境不建议开启文件监听
      ignore_watch: ['node_modules', 'logs'], // 忽略监听的文件夹
      instance_var: 'INSTANCE_ID',            // 实例 ID 环境变量
      kill_timeout: 5000,                     // 强制杀死进程前的等待时间（毫秒）
      wait_ready: true,                       // 等待应用发送 ready 信号
      listen_timeout: 10000,                  // 等待监听端口的超时时间
      shutdown_with_message: true             // 支持优雅关闭
    },

    // Worker 进程（处理异步任务、队列消费）
    {
      name: 'bmm-worker',
      script: './src/queue/worker.js',
      instances: 1,                           // Worker 通常单实例（避免重复消费）
      exec_mode: 'fork',                      // fork 模式
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      },
      error_file: './logs/pm2/worker-error.log',
      out_file: './logs/pm2/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '300M',
      autorestart: true,
      watch: false,
      kill_timeout: 30000                     // Worker 可能有长任务，给更长关闭时间
    },

    // 挖矿余额调度器（独立进程，避免与 API 竞争资源）
    {
      name: 'bmm-scheduler',
      script: './src/utils/miningBalance.js',
      instances: 1,                           // 调度器必须单实例（避免重复计算）
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      },
      error_file: './logs/pm2/scheduler-error.log',
      out_file: './logs/pm2/scheduler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '200M',
      autorestart: true,
      cron_restart: '0 4 * * *',              // 每天凌晨 4 点重启（清理内存）
      watch: false
    }
  ],

  // 部署配置（可选，用于自动化部署）
  deploy: {
    production: {
      user: 'deploy',                         // SSH 用户名
      host: '47.79.232.189',                  // 服务器 IP
      ref: 'origin/main',                     // Git 分支
      repo: 'git@github.com:your-repo/bitcoin-mining-master.git', // 仓库地址
      path: '/var/www/bitcoin-mining-master', // 部署路径
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production', // 部署后命令
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
