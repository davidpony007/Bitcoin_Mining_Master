#!/bin/bash
# 设置adb端口转发，让模拟器可以访问宿主机的localhost:8888

echo "🔄 设置adb端口转发..."
adb reverse tcp:8888 tcp:8888

if [ $? -eq 0 ]; then
    echo "✅ 端口转发设置成功！"
    echo ""
    echo "📋 当前转发规则："
    adb reverse --list
    echo ""
    echo "💡 现在模拟器可以通过 http://localhost:8888 访问后端服务"
else
    echo "❌ 端口转发设置失败，请检查："
    echo "   1. 模拟器是否已启动"
    echo "   2. adb是否正常工作"
    echo ""
    echo "检查设备连接："
    adb devices
fi
