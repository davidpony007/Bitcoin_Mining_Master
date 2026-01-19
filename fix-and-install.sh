#!/bin/bash
# Bitcoin Mining Master - 修复广告奖励 API 问题并重新安装应用

set -e

PROJECT_DIR="/Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/android_clent/bitcoin_mining_master"

echo "🔧 Bitcoin Mining Master - 修复并重新安装应用"
echo "================================================"
echo ""

# 1. 检查设备连接
echo "1️⃣  检查设备连接..."
if ! adb devices | grep -q "device"; then
    echo "   ❌ 未检测到设备"
    echo "   请先启动模拟器或连接真机"
    exit 1
fi
echo "   ✅ 设备已连接"
echo ""

# 2. 设置端口转发
echo "2️⃣  设置端口转发..."
adb reverse tcp:8888 tcp:8888
echo "   ✅ 端口转发: localhost:8888 → 宿主机:8888"
echo ""

# 3. 检查后端服务
echo "3️⃣  检查后端服务状态..."
if curl -s http://localhost:8888/api/health >/dev/null 2>&1; then
    echo "   ✅ 后端服务正常"
else
    echo "   ⚠️  后端服务未响应，尝试启动..."
    cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend
    pm2 restart bitcoin-test || pm2 start src/index.js --name bitcoin-test -i 1
    sleep 3
fi
echo ""

# 4. 编译并安装应用
echo "4️⃣  编译并安装应用..."
cd "$PROJECT_DIR"

echo "   清理旧构建..."
flutter clean > /dev/null 2>&1

echo "   获取依赖..."
flutter pub get > /dev/null 2>&1

echo "   编译应用（这可能需要几分钟）..."
if flutter build apk --debug; then
    echo "   ✅ 编译成功"
    
    echo "   安装到设备..."
    APK_PATH="$PROJECT_DIR/build/app/outputs/flutter-apk/app-debug.apk"
    
    if [ -f "$APK_PATH" ]; then
        adb install -r "$APK_PATH"
        echo "   ✅ 安装完成"
    else
        echo "   ❌ APK 文件不存在"
        exit 1
    fi
else
    echo "   ❌ 编译失败"
    exit 1
fi
echo ""

# 5. 启动应用
echo "5️⃣  启动应用..."
adb shell monkey -p com.example.bitcoin_mining_master -c android.intent.category.LAUNCHER 1
echo "   ✅ 应用已启动"
echo ""

echo "✅ 修复完成！"
echo ""
echo "📝 测试步骤："
echo "  1. 在应用中点击 Daily Check-in"
echo "  2. 观看广告"
echo "  3. 点击 Continue 按钮"
echo "  4. 应该看到绿色成功提示并正常跳转"
echo ""
echo "🐛 如果仍有问题，运行调试脚本查看日志："
echo "  ./debug-client.sh"
echo ""
