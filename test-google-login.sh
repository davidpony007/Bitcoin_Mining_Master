#!/bin/bash

# 测试Google登录的GAID和Country获取
echo "🧪 ================================================"
echo "📱 Google登录 - GAID和Country测试"
echo "🧪 ================================================"
echo ""

DEVICE="WCO7CAC6T8CA99OB"

# 清除旧日志
echo "🗑️  清除旧日志..."
adb -s $DEVICE logcat -c

# 启动应用
echo "🚀 启动应用..."
adb -s $DEVICE shell am start -n com.cloudminingtool.bitcoin_mining_master/com.cloudminingtool.bitcoin_mining_master.MainActivity

# 等待用户操作
echo ""
echo "⏳ 请在手机上执行以下操作:"
echo "   1. 点击 'Sign In With Google (Recommended)'"
echo "   2. 选择Google账号并登录"
echo ""
echo "📊 监控日志中 (按Ctrl+C停止)..."
echo "🔍 ================================================"
echo ""

# 监控关键日志
adb -s $DEVICE logcat -s flutter:I | grep --line-buffered -E "步骤|DeviceInfoService|GAID|Country|API.*Data|📱|✅|❌|⚠️|🔍"

