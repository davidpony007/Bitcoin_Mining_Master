// pm2 进程管理配置文件
// 详细说明：
// - name: 应用名称
// - script: 启动脚本路径
// - instances: 启动实例数（max为CPU核数）
// - exec_mode: cluster为集群模式
// - env: 环境变量
// - watch: 是否监控文件变动自动重启
// - max_memory_restart: 内存超限自动重启
// - error_file/out_file: 日志文件路径
// - log_date_format: 日志时间格式
module.exports = {
  apps: [
    {
      name: 'bitcoin-backend',
      script: './backend/src/index.js',
      instances: 2,        // 减少实例数，提高稳定性
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      },
      env_file: './backend/.env',  // 指定环境变量文件
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
