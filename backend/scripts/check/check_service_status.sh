#!/bin/bash

echo "================================"
echo "   本地Node服务最终状态检查"
echo "================================"
echo ""

echo "【1】PM2进程状态:"
pm2 list

echo ""
echo "【2】8888端口监听:"
lsof -i :8888 || echo "端口未监听"

echo ""
echo "【3】最新日志(最后5行):"
pm2 logs bmm-api --lines 5 --nostream

echo ""
echo "【4】API健康检查:"
curl -s http://localhost:8888/api/health -m 3 || echo "API无响应"

echo ""
echo ""
echo "【5】查询用户列表:"
curl -s "http://localhost:8888/api/userInformation?page=1&pageSize=3" -m 3 | head -c 200 || echo "API无响应"

echo ""
echo ""
echo "【6】创建测试用户:"
curl -X POST http://localhost:8888/api/userInformation \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"USER$(date +%s)\",
    \"invitation_code\": \"INV12345678\",
    \"email\": \"test$(date +%s)@example.com\",
    \"android_id\": \"android_$(date +%s)\",
    \"gaid\": \"gaid_$(date +%s)\",
    \"register_ip\": \"192.168.1.100\",
    \"country\": \"US\"
  }" \
  -m 3

echo ""
echo ""
echo "================================"
echo "检查完成"
echo "================================"
