#!/bin/bash

# Bitcoin Mining Master - 开发环境快速启动脚本
# 用法：./dev-start.sh

set -e

echo "🚀 Bitcoin Mining Master - 开发环境启动"
echo "========================================"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 检查后端是否运行
echo -e "\n${YELLOW}[1/5]${NC} 检查后端服务..."
cd backend
if pm2 describe bitcoin-backend > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 后端已运行"
    pm2 status bitcoin-backend
else
    echo -e "${YELLOW}启动后端服务...${NC}"
    pm2 start src/index.js --name bitcoin-backend
    sleep 3
    echo -e "${GREEN}✓${NC} 后端启动成功"
fi

# 2. 测试后端API
echo -e "\n${YELLOW}[2/5]${NC} 测试后端API..."
if curl -s http://localhost:8888/api/bitcoin/price | grep -q "success"; then
    echo -e "${GREEN}✓${NC} 后端API响应正常"
else
    echo -e "${RED}✗${NC} 后端API无响应，请检查日志：pm2 logs bitcoin-backend"
    exit 1
fi

# 3. 检查ADB设备连接
echo -e "\n${YELLOW}[3/5]${NC} 检查手机连接..."
cd ..
if adb devices | grep -q "device$"; then
    DEVICE=$(adb devices | grep "device$" | awk '{print $1}')
    echo -e "${GREEN}✓${NC} 手机已连接: $DEVICE"
else
    echo -e "${RED}✗${NC} 未检测到手机，请："
    echo "  1. 通过USB连接手机"
    echo "  2. 手机开启开发者模式和USB调试"
    echo "  3. 授权电脑的USB调试请求"
    exit 1
fi

# 4. 设置ADB端口转发
echo -e "\n${YELLOW}[4/5]${NC} 设置ADB端口转发..."
adb reverse tcp:8888 tcp:8888
if adb reverse --list | grep -q "tcp:8888"; then
    echo -e "${GREEN}✓${NC} 端口转发设置成功: tcp:8888 → tcp:8888"
else
    echo -e "${RED}✗${NC} 端口转发设置失败"
    exit 1
fi

# 5. 构建并安装APP
echo -e "\n${YELLOW}[5/5]${NC} 构建并安装APP..."
cd android_clent/bitcoin_mining_master

echo "  → 正在构建APK..."
flutter build apk --release 2>&1 | grep -E "Built|Error" || true

if [ -f "build/app/outputs/flutter-apk/app-release.apk" ]; then
    echo -e "${GREEN}✓${NC} APK构建成功"
    
    echo "  → 正在安装到手机..."
    adb install -r build/app/outputs/flutter-apk/app-release.apk
    
    echo "  → 启动应用..."
    adb shell am force-stop com.cloudminingtool.bitcoin_mining_master
    sleep 1
    adb shell monkey -p com.cloudminingtool.bitcoin_mining_master 1
    
    echo -e "${GREEN}✓${NC} APP安装并启动成功"
else
    echo -e "${RED}✗${NC} APK构建失败"
    exit 1
fi

# 完成
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ 开发环境启动完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📱 应用已在手机上运行"
echo "🔍 查看日志："
echo "   • 后端日志: pm2 logs bitcoin-backend"
echo "   • 手机日志: adb logcat -s 'flutter:I'"
echo ""
echo "🛠️  调试命令："
echo "   • 重启APP: adb shell am force-stop com.cloudminingtool.bitcoin_mining_master && adb shell monkey -p com.cloudminingtool.bitcoin_mining_master 1"
echo "   • 查看端口转发: adb reverse --list"
echo "   • 测试API: curl http://localhost:8888/api/bitcoin/price"
echo ""
