#!/bin/bash
# iOS应用测试检查脚本

echo "📱 Bitcoin Mining Master - iOS应用测试"
echo "=========================================="
echo ""

# 设备信息
DEVICE_ID="00008101-001958401A30001E"

# 检查应用是否在运行
echo "🔍 检查应用状态..."
xcrun devicectl device info processes --device "$DEVICE_ID" 2>/dev/null | grep -i "Runner\|bitcoin" | head -5

echo ""
echo "📝 获取应用日志（最近30条）..."
echo "按 Ctrl+C 停止日志监控"
echo ""

# 监控应用日志
xcrun devicectl device info logs --device "$DEVICE_ID" --style json 2>&1 | \
  grep -i "Runner\|bitcoin\|flutter\|error\|exception" | \
  tail -30

echo ""
echo "=========================================="
echo "✅ 测试检查完成"
echo ""
echo "📋 后续测试项目："
echo "  1. 测试登录功能（游客登录/Google登录）"
echo "  2. 测试挖矿功能（开始/停止挖矿）"
echo "  3. 测试钱包功能（查看余额/交易记录）"
echo "  4. 测试推荐功能（复制推荐码）"
echo "  5. 测试合约购买"
echo ""
