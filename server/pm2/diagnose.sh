#!/bin/bash

echo "======================================"
echo "   服务器诊断脚本"
echo "======================================"
echo ""

echo "📊 1. 检查端口占用情况..."
echo "-----------------------------------"
netstat -tulpn | grep -E ":(8888|888|3306|6379)" || ss -tulpn | grep -E ":(8888|888|3306|6379)"
echo ""

echo "📦 2. 检查宝塔面板状态..."
echo "-----------------------------------"
if command -v bt &> /dev/null; then
    echo "✅ 宝塔已安装"
    bt default 2>/dev/null || echo "⚠️  需要手动运行: bt default"
else
    echo "❌ 宝塔未安装或命令不可用"
fi
echo ""

echo "🔄 3. 检查 PM2 进程..."
echo "-----------------------------------"
if command -v pm2 &> /dev/null; then
    pm2 list
else
    echo "❌ PM2 未安装"
fi
echo ""

echo "📁 4. 检查项目目录..."
echo "-----------------------------------"
if [ -d "/www/wwwroot/47.79.232.189" ]; then
    ls -la /www/wwwroot/47.79.232.189/
else
    echo "❌ 项目目录不存在"
fi
echo ""

echo "🌐 5. 检查 Nginx 状态..."
echo "-----------------------------------"
systemctl status nginx 2>/dev/null || service nginx status 2>/dev/null || echo "Nginx 状态未知"
echo ""

echo "🔍 6. 检查 8888 端口的进程详情..."
echo "-----------------------------------"
lsof -i :8888 2>/dev/null || echo "无法使用 lsof 命令"
echo ""

echo "======================================"
echo "   诊断完成"
echo "======================================"
