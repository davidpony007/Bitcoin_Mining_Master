#!/bin/bash
# iOS Release模式快速部署脚本
# 用法: ./deploy-ios-release.sh

set -e  # 遇到错误立即退出

echo "🚀 开始构建iOS Release版本..."
echo "================================"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 项目路径
PROJECT_DIR="/Users/davidpony/iCloud Drive (Archive)/Desktop/工程文件夹/Bitcoin_Mining_Master/mobile_client/bitcoin_mining_master"
cd "$PROJECT_DIR"

# 检查设备连接
echo -e "${BLUE}📱 检查设备连接...${NC}"
DEVICE_ID="00008101-001958401A30001E"
flutter devices | grep -q "$DEVICE_ID" || {
    echo -e "${RED}❌ 找不到设备 $DEVICE_ID${NC}"
    echo "请确保iPhone已连接并信任此电脑"
    exit 1
}
echo -e "${GREEN}✓ 设备已连接${NC}"

# 清理旧构建（可选，首次构建或出问题时使用）
if [ "$1" == "--clean" ]; then
    echo -e "${BLUE}🧹 清理旧构建...${NC}"
    flutter clean
    echo -e "${GREEN}✓ 清理完成${NC}"
fi

# 获取依赖
echo -e "${BLUE}📦 获取依赖...${NC}"
flutter pub get
echo -e "${GREEN}✓ 依赖已更新${NC}"

# 构建Release版本
echo -e "${BLUE}🔨 构建Release版本...${NC}"
flutter build ios --release

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 构建成功！${NC}"
else
    echo -e "${RED}❌ 构建失败${NC}"
    exit 1
fi

# 安装到设备
echo -e "${BLUE}📲 安装到iPhone...${NC}"
xcrun devicectl device install app --device "$DEVICE_ID" "$PROJECT_DIR/build/ios/iphoneos/Runner.app"

if [ $? -eq 0 ]; then
    echo ""
    echo "================================"
    echo -e "${GREEN}✅ 部署成功！${NC}"
    echo ""
    echo "📱 应用已安装到iPhone"
    echo "🔐 首次运行需要："
    echo "   设置 → 通用 → VPN与设备管理"
    echo "   → 信任 'Apple Development: davidpony007@gmail.com'"
    echo ""
else
    echo -e "${RED}❌ 安装失败${NC}"
    echo ""
    echo "可能的原因："
    echo "1. 设备未解锁"
    echo "2. 需要信任开发者证书"
    echo "3. 网络连接问题"
    exit 1
fi
