#!/bin/bash

# 完整的Google登录测试 - 包含卸载和重装
echo "🧪 ================================================"
echo "📱 完整Google登录测试（包含GAID权限）"
echo "🧪 ================================================"
echo ""

DEVICE="WCO7CAC6T8CA99OB"
PACKAGE="com.cloudminingtool.bitcoin_mining_master"

# 1. 停止应用
echo "🛑 停止应用..."
adb -s $DEVICE shell am force-stop $PACKAGE

# 2. 卸载应用（这将清除所有登录状态）
echo "🗑️  卸载应用（清除所有数据）..."
adb -s $DEVICE uninstall $PACKAGE

# 3. 重新安装
echo "📦 重新安装应用..."
adb -s $DEVICE install -r /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/android_clent/bitcoin_mining_master/build/app/outputs/flutter-apk/app-release.apk

# 4. 清除logcat
echo "🗑️  清除旧日志..."
adb -s $DEVICE logcat -c

# 5. 启动应用
echo "🚀 启动应用..."
adb -s $DEVICE shell am start -n $PACKAGE/$PACKAGE.MainActivity

# 等待应用启动
sleep 2

# 6. 显示说明
echo ""
echo "✅ 应用已全新安装并启动"
echo ""
echo "⏳ 请在手机上执行以下操作:"
echo "   1. 点击 'Sign In With Google (Recommended)'"
echo "   2. 选择Google账号并登录"
echo "   3. 等待10秒"
echo ""
echo "📊 监控日志中 (按Ctrl+C停止)..."
echo "🔍 ================================================"
echo ""

# 7. 监控关键日志
adb -s $DEVICE logcat -s flutter:I | grep --line-buffered -E "步骤|DeviceInfoService|GAID|Country|Android ID|📤.*Data|🔍.*开始收集|✅|❌|⚠️"

