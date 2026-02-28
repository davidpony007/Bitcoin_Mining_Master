#!/bin/bash
# iPhone连接状态检查脚本

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       📱 iPhone连接状态详细检查              ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# 1. Flutter设备检测
echo "🔍 1. Flutter设备检测"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
flutter devices 2>&1

echo ""
echo ""

# 2. Xcode设备检测
echo "🔍 2. Xcode设备检测"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
xcrun devicectl list devices 2>&1

echo ""
echo ""

# 3. USB连接检测
echo "🔍 3. USB物理连接检测"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if system_profiler SPUSBDataType 2>/dev/null | grep -q "iPhone"; then
    echo "✅ 检测到USB连接的iPhone"
    system_profiler SPUSBDataType 2>/dev/null | grep -A 15 "iPhone:"
else
    echo "⚠️  USB系统报告中未检测到iPhone"
    echo "   （可能使用WiFi连接或系统报告延迟）"
fi

echo ""
echo ""

# 4. 连接类型判断
echo "📊 4. 连接状态总结"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FLUTTER_OUTPUT=$(flutter devices 2>&1)

if echo "$FLUTTER_OUTPUT" | grep -q "00008101-001958401A30001E"; then
    echo "✅ Flutter已识别设备: 00008101-001958401A30001E"
    
    if echo "$FLUTTER_OUTPUT" | grep -q "wireless"; then
        echo "📡 连接方式: 无线（WiFi）"
        echo "💡 提示: 如需切换到USB连接，请："
        echo "   1. 用数据线连接iPhone和Mac"
        echo "   2. 在iPhone上点击「信任此电脑」"
        echo "   3. 在Xcode中禁用WiFi调试"
    else
        echo "🔌 连接方式: 数据线（USB）"
        echo "✅ 状态: 已通过数据线成功连接！"
    fi
    
    if echo "$FLUTTER_OUTPUT" | grep -q "iOS 26.3"; then
        echo "📱 系统版本: iOS 26.3"
    fi
else
    echo "❌ Flutter未检测到目标设备"
    echo "请检查："
    echo "  1. iPhone是否已解锁"
    echo "  2. 是否已点击「信任此电脑」"
    echo "  3. 数据线是否连接牢固"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║             检查完成                          ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
