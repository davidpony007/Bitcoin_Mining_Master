#!/bin/bash
# PM2 完全删除脚本 - Bitcoin Mining Master
# 警告：此操作会删除所有 PM2 进程和配置

cd "$(dirname "$0")/../../backend"

echo "⚠️  警告：此操作将完全删除所有 PM2 进程！"
read -p "确认继续？(y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  删除所有进程..."
    pm2 delete all || true
    
    echo "🧹 清理 PM2 配置..."
    pm2 save --force
    
    echo ""
    echo "✅ 清理完成！"
    pm2 list
else
    echo "❌ 操作已取消"
fi
