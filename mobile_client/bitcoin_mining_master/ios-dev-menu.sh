#!/bin/bash
# Bitcoin Mining Master - iOS开发快速操作手册

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 项目路径
PROJECT_ROOT="/Users/davidpony/iCloud Drive (Archive)/Desktop/工程文件夹/Bitcoin_Mining_Master"
MOBILE_CLIENT="$PROJECT_ROOT/mobile_client/bitcoin_mining_master"
BACKEND="$PROJECT_ROOT/backend"

# 设备ID
IPHONE_ID="00008101-001958401A30001E"
SIMULATOR_ID="778C78E0-171C-4BA0-9F53-A1AD5E1ED992"

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Bitcoin Mining Master - iOS开发快速操作     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# 显示菜单
show_menu() {
    echo -e "${YELLOW}请选择操作：${NC}"
    echo ""
    echo -e "  ${GREEN}1${NC}. 运行应用到iPhone（Release模式）"
    echo -e "  ${GREEN}2${NC}. 运行应用到iPhone（Debug模式）"
    echo -e "  ${GREEN}3${NC}. 运行应用到模拟器"
    echo -e "  ${GREEN}4${NC}. 快速部署（使用脚本）"
    echo -e "  ${GREEN}5${NC}. 清理并重新构建"
    echo ""
    echo -e "  ${BLUE}6${NC}. 查看设备列表"
    echo -e "  ${BLUE}7${NC}. 查看应用日志"
    echo -e "  ${BLUE}8${NC}. 测试后端API"
    echo -e "  ${BLUE}9${NC}. 查看后端日志"
    echo ""
    echo -e "  ${YELLOW}10${NC}. 重装CocoaPods依赖"
    echo -e "  ${YELLOW}11${NC}. 更新Flutter依赖"
    echo ""
    echo -e "  ${RED}0${NC}. 退出"
    echo ""
    echo -n "请输入选项: "
}

# 运行iPhone Release
run_iphone_release() {
    echo -e "${BLUE}🚀 启动应用到iPhone（Release模式）...${NC}"
    cd "$MOBILE_CLIENT"
    flutter run -d $IPHONE_ID --release
}

# 运行iPhone Debug
run_iphone_debug() {
    echo -e "${BLUE}🚀 启动应用到iPhone（Debug模式）...${NC}"
    cd "$MOBILE_CLIENT"
    flutter run -d $IPHONE_ID
}

# 运行模拟器
run_simulator() {
    echo -e "${BLUE}🚀 启动应用到模拟器...${NC}"
    cd "$MOBILE_CLIENT"
    flutter run -d $SIMULATOR_ID
}

# 快速部署
quick_deploy() {
    echo -e "${BLUE}⚡ 使用快速部署脚本...${NC}"
    cd "$MOBILE_CLIENT"
    ./deploy-ios-release.sh
}

# 清理重构建
clean_rebuild() {
    echo -e "${YELLOW}🧹 清理项目...${NC}"
    cd "$MOBILE_CLIENT"
    flutter clean
    echo -e "${BLUE}📦 获取依赖...${NC}"
    flutter pub get
    echo -e "${BLUE}🔧 重装CocoaPods...${NC}"
    cd ios
    rm -rf Pods Podfile.lock
    pod install
    cd ..
    echo -e "${GREEN}✓ 清理完成，现在可以运行应用${NC}"
}

# 查看设备
list_devices() {
    echo -e "${BLUE}📱 可用设备：${NC}"
    flutter devices
}

# 查看应用日志
view_logs() {
    echo -e "${BLUE}📝 应用日志（最近50行）：${NC}"
    echo ""
    if [ -f /tmp/flutter_ios_run.log ]; then
        tail -50 /tmp/flutter_ios_run.log
    else
        echo "日志文件不存在，请先运行应用"
    fi
}

# 测试后端API
test_api() {
    echo -e "${BLUE}🔍 测试后端API...${NC}"
    echo ""
    
    # 测试健康检查
    echo -e "${YELLOW}1. 健康检查端点${NC}"
    curl -s http://47.79.232.189/api/health | jq . 2>/dev/null || curl -s http://47.79.232.189/api/health
    echo ""
    
    # 测试设备登录（示例）
    echo -e "${YELLOW}2. 设备登录端点测试${NC}"
    curl -s -X POST http://47.79.232.189/api/auth/device-login \
      -H "Content-Type: application/json" \
      -d '{"deviceId":"test-device-123"}' | jq . 2>/dev/null || echo "需要安装jq: brew install jq"
    echo ""
}

# 查看后端日志
view_backend_logs() {
    echo -e "${BLUE}📋 后端日志（最近30行）：${NC}"
    cd "$BACKEND"
    pm2 logs bitcoin-backend --lines 30 --nostream
}

# 重装CocoaPods
reinstall_pods() {
    echo -e "${BLUE}🔧 重装CocoaPods依赖...${NC}"
    cd "$MOBILE_CLIENT/ios"
    rm -rf Pods Podfile.lock
    pod install
    echo -e "${GREEN}✓ CocoaPods依赖已重装${NC}"
}

# 更新Flutter依赖
update_flutter_deps() {
    echo -e "${BLUE}📦 更新Flutter依赖...${NC}"
    cd "$MOBILE_CLIENT"
    flutter pub get
    flutter pub upgrade
    echo -e "${GREEN}✓ Flutter依赖已更新${NC}"
}

# 主循环
while true; do
    show_menu
    read choice
    echo ""
    
    case $choice in
        1) run_iphone_release ;;
        2) run_iphone_debug ;;
        3) run_simulator ;;
        4) quick_deploy ;;
        5) clean_rebuild ;;
        6) list_devices ;;
        7) view_logs ;;
        8) test_api ;;
        9) view_backend_logs ;;
        10) reinstall_pods ;;
        11) update_flutter_deps ;;
        0) 
            echo -e "${GREEN}👋 再见！${NC}"
            exit 0 
            ;;
        *)
            echo -e "${RED}❌ 无效选项，请重新选择${NC}"
            ;;
    esac
    
    echo ""
    echo -e "${YELLOW}按Enter继续...${NC}"
    read
    clear
done
