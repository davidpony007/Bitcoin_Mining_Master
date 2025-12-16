#!/bin/bash
# PM2 启动脚本 - Bitcoin Mining Master

set -e  # 遇到错误立即退出

echo "🚀 启动 Bitcoin Mining Master 服务..."

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 未安装，正在安装..."
    npm install -g pm2
fi

# 切换到项目根目录
cd "$(dirname "$0")/../../backend"

# 确保日志目录存在
mkdir -p logs/pm2

# 加载环境变量（如果存在）
if [ -f .env ]; then
    echo "📝 加载 .env 环境变量..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# 启动 PM2 应用
echo "▶️  启动应用..."
pm2 start ../server/pm2/ecosystem.config.js --env production

# 保存 PM2 配置（系统重启后自动恢复）
pm2 save

# 设置开机自启动（首次运行）
if ! pm2 startup | grep -q "already"; then
    echo "🔧 配置开机自启动..."
    pm2 startup
    echo "⚠️  请执行上方输出的 sudo 命令以完成配置"
fi

# 显示运行状态
echo ""
echo "✅ 启动完成！"
pm2 list
echo ""
echo "📊 查看日志："
echo "  pm2 logs bmm-api      # API 日志"
echo "  pm2 logs bmm-worker   # Worker 日志"
echo "  pm2 logs bmm-scheduler # 调度器日志"
echo ""
echo "🖥️  查看监控："
echo "  pm2 monit             # 实时监控"
echo "  pm2 status            # 状态列表"
