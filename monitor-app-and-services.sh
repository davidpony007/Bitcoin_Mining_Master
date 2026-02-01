#!/bin/bash

# 应用和服务监控脚本
# 实时监控应用状态、服务状态和日志

PACKAGE_NAME="com.cloudminingtool.bitcoin_mining_master"
LOG_FILE="logs/monitor-$(date +%Y%m%d-%H%M%S).log"
CHECK_INTERVAL=10  # 检查间隔（秒）

# 创建日志目录
mkdir -p logs

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 清屏并显示标题
clear_and_header() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     Bitcoin Mining Master - 实时监控面板                       ║${NC}"
    echo -e "${BLUE}║     $(date '+%Y-%m-%d %H:%M:%S')                                     ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# 检查手机连接
check_device() {
    DEVICE=$(adb devices | grep -w "device" | head -n 1 | awk '{print $1}')
    if [ -z "$DEVICE" ]; then
        echo -e "${RED}❌ 未检测到Android设备${NC}"
        return 1
    else
        echo -e "${GREEN}✅ 设备已连接: $DEVICE${NC}"
        return 0
    fi
}

# 检查应用是否安装
check_app_installed() {
    if adb shell pm list packages | grep -q "$PACKAGE_NAME"; then
        echo -e "${GREEN}✅ 应用已安装${NC}"
        APP_VERSION=$(adb shell dumpsys package "$PACKAGE_NAME" | grep versionName | head -n 1 | awk '{print $1}')
        echo -e "   版本: ${BLUE}$APP_VERSION${NC}"
        return 0
    else
        echo -e "${RED}❌ 应用未安装${NC}"
        return 1
    fi
}

# 检查应用是否运行
check_app_running() {
    if adb shell pidof "$PACKAGE_NAME" > /dev/null 2>&1; then
        PID=$(adb shell pidof "$PACKAGE_NAME")
        echo -e "${GREEN}✅ 应用运行中 (PID: $PID)${NC}"
        
        # 获取CPU和内存使用
        STATS=$(adb shell top -n 1 -p "$PID" 2>/dev/null | tail -n 1)
        if [ ! -z "$STATS" ]; then
            CPU=$(echo "$STATS" | awk '{print $9}')
            MEM=$(echo "$STATS" | awk '{print $10}')
            echo -e "   CPU: ${BLUE}${CPU}%${NC}, 内存: ${BLUE}${MEM}%${NC}"
        fi
        return 0
    else
        echo -e "${YELLOW}⚠️  应用未运行${NC}"
        return 1
    fi
}

# 检查后端服务
check_backend_services() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🖥️  后端服务状态${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # PM2状态
    if pm2 list | grep -q "bitcoin-backend"; then
        PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="bitcoin-backend") | .pm2_env.status' 2>/dev/null || echo "unknown")
        if [ "$PM2_STATUS" = "online" ]; then
            echo -e "${GREEN}✅ Node服务 (PM2): $PM2_STATUS${NC}"
        else
            echo -e "${RED}❌ Node服务 (PM2): $PM2_STATUS${NC}"
        fi
    else
        echo -e "${RED}❌ Node服务未运行${NC}"
    fi
    
    # Redis状态
    if redis-cli -h 127.0.0.1 -p 16379 -a "3hu8fds3y" ping 2>/dev/null | grep -q "PONG"; then
        echo -e "${GREEN}✅ Redis: 连接正常${NC}"
    else
        echo -e "${RED}❌ Redis: 连接失败${NC}"
    fi
    
    # SSH隧道状态
    if ps aux | grep "ssh.*3307.*47.79.232.189" | grep -v grep > /dev/null; then
        SSH_PID=$(ps aux | grep "ssh.*3307.*47.79.232.189" | grep -v grep | awk '{print $2}')
        echo -e "${GREEN}✅ SSH隧道: 运行中 (PID: $SSH_PID)${NC}"
    else
        echo -e "${RED}❌ SSH隧道: 未运行${NC}"
    fi
    
    # API健康检查
    API_RESPONSE=$(curl -s http://localhost:8888/api/health -m 3 2>/dev/null)
    if echo "$API_RESPONSE" | grep -q "\"status\":\"ok\""; then
        echo -e "${GREEN}✅ API健康: 正常${NC}"
    else
        echo -e "${RED}❌ API健康: 异常${NC}"
    fi
    
    # Nginx状态
    if ps aux | grep -E "[n]ginx" > /dev/null; then
        echo -e "${GREEN}✅ Nginx: 运行中${NC}"
    else
        echo -e "${YELLOW}⚠️  Nginx: 未运行${NC}"
    fi
    
    # Cloudflare状态
    if ps aux | grep -E "[c]loudflared" > /dev/null; then
        echo -e "${GREEN}✅ Cloudflare: 运行中${NC}"
    else
        echo -e "${YELLOW}⚠️  Cloudflare: 未运行${NC}"
    fi
}

# 显示最新应用日志
show_app_logs() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📱 应用日志 (最近10条)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    adb logcat -d -s flutter:V | tail -n 10 | while IFS= read -r line; do
        if echo "$line" | grep -qi "error"; then
            echo -e "${RED}$line${NC}"
        elif echo "$line" | grep -qi "warning"; then
            echo -e "${YELLOW}$line${NC}"
        else
            echo "$line"
        fi
    done
}

# 显示后端最新日志
show_backend_logs() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🖥️  后端日志 (最近5条)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    pm2 logs bitcoin-backend --lines 5 --nostream 2>/dev/null | tail -n 5
}

# 自动修复函数
auto_fix() {
    echo -e "\n${YELLOW}🔧 尝试自动修复...${NC}"
    
    # 检查SSH隧道
    if ! ps aux | grep "ssh.*3307.*47.79.232.189" | grep -v grep > /dev/null; then
        log "SSH隧道断开，尝试重新建立..."
        cd backend && bash setup-ssh-tunnel.sh && cd ..
    fi
    
    # 检查PM2服务
    PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="bitcoin-backend") | .pm2_env.status' 2>/dev/null || echo "unknown")
    if [ "$PM2_STATUS" != "online" ]; then
        log "后端服务异常，尝试重启..."
        pm2 restart bitcoin-backend
    fi
}

# 主监控循环
main() {
    log "=== 监控启动 ==="
    echo -e "${GREEN}监控已启动，日志保存到: $LOG_FILE${NC}"
    echo -e "${YELLOW}按 Ctrl+C 停止监控${NC}"
    echo ""
    sleep 2
    
    while true; do
        clear_and_header
        
        # 检查设备
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}📱 Android设备${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        if check_device; then
            check_app_installed
            check_app_running
        fi
        
        # 检查后端服务
        check_backend_services
        
        # 显示日志
        if check_device && adb shell pm list packages | grep -q "$PACKAGE_NAME"; then
            show_app_logs
        fi
        show_backend_logs
        
        echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "⏱️  下次刷新: ${CHECK_INTERVAL}秒后 | ${YELLOW}按 Ctrl+C 停止${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        # 检查是否需要自动修复
        if ! ps aux | grep "ssh.*3307.*47.79.232.189" | grep -v grep > /dev/null; then
            log "检测到SSH隧道断开"
            auto_fix
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# 捕获退出信号
trap 'echo -e "\n${YELLOW}监控已停止${NC}"; log "=== 监控停止 ==="; exit 0' INT TERM

# 启动监控
main
