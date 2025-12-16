#!/bin/bash

# 🔧 Android 登录问题快速诊断脚本

echo "======================================"
echo "🔍 Android APP 登录问题诊断"
echo "======================================"
echo ""

# 1. 检查后端服务状态
echo "📊 1. 检查后端服务..."
cd "/Users/davidpony/Desktop/Bitcoin Mining Master/backend"
pm2 list | grep bitcoin-backend
echo ""

# 2. 测试后端 API
echo "🌐 2. 测试后端 API (localhost)..."
curl -s -X POST http://localhost:8888/api/auth/device-login \
  -H "Content-Type: application/json" \
  -d '{
    "android_id": "diagnostic_test_001",
    "country": "US",
    "device_model": "Diagnostic Device",
    "gaid": "diagnostic_gaid_001"
  }' | python3 -m json.tool
echo ""

# 3. 测试 10.0.2.2 地址 (模拟器视角)
echo "🔌 3. 测试 10.0.2.2:8888 连接..."
nc -zv 10.0.2.2 8888 2>&1 || echo "⚠️  10.0.2.2:8888 无法连接"
echo ""

# 4. 获取本机 IP 地址
echo "💻 4. 本机 IP 地址:"
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}'
echo ""

# 5. 检查后端监听地址
echo "🎧 5. 检查后端监听配置..."
grep -n "app.listen" "/Users/davidpony/Desktop/Bitcoin Mining Master/backend/src/index.js"
echo ""

# 6. 检查防火墙状态
echo "🛡️  6. 检查 macOS 防火墙..."
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
echo ""

# 7. 检查 8888 端口占用
echo "🔍 7. 检查 8888 端口..."
lsof -i :8888 | head -5
echo ""

echo "======================================"
echo "✅ 诊断完成！"
echo "======================================"
echo ""
echo "📝 根据以上信息:"
echo "1. 如果后端 API 测试成功 → 网络连接问题"
echo "2. 如果 10.0.2.2 无法连接 → 使用本机 IP 代替"
echo "3. 如果监听地址是 127.0.0.1 → 改为 0.0.0.0"
echo ""
echo "💡 建议操作:"
echo "1. 复制上面显示的本机 IP"
echo "2. 修改 ApiClient.kt:"
echo "   private const val BASE_URL_DEV = \"http://YOUR_IP:8888/\""
echo "3. 重新运行 APP"
echo ""
