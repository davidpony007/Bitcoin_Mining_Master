#!/bin/bash

echo "=========================================="
echo "   Bitcoin Mining Master 服务检查"
echo "=========================================="
echo ""

echo "1️⃣  检查 PM2 服务状态："
pm2 list
echo ""

echo "2️⃣  检查 8888 端口（Node.js API）："
netstat -tulpn | grep 8888 || ss -tulpn | grep 8888
echo ""

echo "3️⃣  检查 80 端口（Nginx）："
netstat -tulpn | grep :80 || ss -tulpn | grep :80
echo ""

echo "4️⃣  测试 Node.js API 直接访问："
curl -s http://127.0.0.1:8888/api/health && echo "✅ API 直接访问成功" || echo "❌ API 无响应"
echo ""

echo "5️⃣  测试通过 Nginx 反向代理访问："
curl -s http://127.0.0.1/api/health && echo "✅ Nginx 代理成功" || echo "❌ Nginx 代理失败"
echo ""

echo "6️⃣  Nginx 服务状态："
systemctl status nginx | head -5
echo ""

echo "=========================================="
echo "   诊断建议"
echo "=========================================="
echo ""
echo "如果 PM2 服务未运行："
echo "  cd /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master/backend"
echo "  pm2 restart ecosystem.config.js"
echo ""
echo "如果 Nginx 未运行："
echo "  systemctl start nginx"
echo ""
echo "如果端口冲突："
echo "  先停止 PM2: pm2 stop all"
echo "  启动 Nginx: systemctl start nginx"
echo "  再启动 PM2: pm2 restart ecosystem.config.js"
