#!/bin/bash

echo "=== Nginx 端口冲突修复脚本 ==="
echo ""

# 检查 8888 端口占用
echo "1. 检查 8888 端口占用情况："
netstat -tulpn | grep 8888 || ss -tulpn | grep 8888
echo ""

# 检查 PM2 服务
echo "2. 检查 PM2 服务状态："
pm2 list
echo ""

# 检查 Nginx 配置中的 8888 端口
echo "3. 检查 Nginx 配置文件："
grep -r "listen.*8888" /www/server/panel/vhost/nginx/ 2>/dev/null
echo ""

# 提供解决方案
echo "=== 解决方案 ==="
echo ""
echo "选项 1: 停止占用 8888 端口的服务"
echo "  如果是 Node.js: pm2 stop all"
echo "  如果是其他: kill -9 <PID>"
echo ""
echo "选项 2: 修改 Nginx 监听的端口"
echo "  在宝塔面板 -> 网站 -> 修改端口为 80 或 888"
echo ""
echo "选项 3: 修改 Node.js API 的端口"
echo "  编辑 .env 文件，将 PORT=8888 改为其他端口"
echo ""

read -p "是否要停止 PM2 服务以释放 8888 端口？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "停止 PM2 服务..."
    pm2 stop all
    echo ""
    echo "启动 Nginx..."
    systemctl start nginx
    systemctl status nginx | head -10
    echo ""
    echo "重新启动 PM2 服务..."
    cd /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master/backend
    pm2 restart ecosystem.config.js
fi
