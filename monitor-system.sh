#!/bin/bash
# ================================================================
# 比特币挖矿应用 - 持续监控脚本
# 监控内容：手机应用、后端服务、数据库、Redis、SSH隧道
# 刷新频率：每10秒
# ================================================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 清屏函数
clear_screen() {
    clear
}

# 检查手机连接
check_device() {
    local device_id=$(adb devices | grep -v "List" | grep "device" | awk '{print $1}')
    if [ -z "$device_id" ]; then
        echo -e "${RED}❌ 手机未连接${NC}"
        return 1
    else
        echo -e "${GREEN}✓ 手机已连接: $device_id${NC}"
        return 0
    fi
}

# 检查应用状态
check_app() {
    local app_running=$(adb shell "ps -A | grep bitcoin_mining_master" 2>/dev/null)
    
    if [ -z "$app_running" ]; then
        echo -e "${YELLOW}⚠️  应用未运行${NC}"
        return 1
    else
        # 获取PID和资源使用
        local pid=$(echo "$app_running" | awk '{print $2}')
        local cpu_mem=$(adb shell "top -n 1 -p $pid" 2>/dev/null | tail -1)
        local cpu=$(echo "$cpu_mem" | awk '{print $9}')
        local mem=$(echo "$cpu_mem" | awk '{print $10}')
        
        echo -e "${GREEN}✓ 应用运行中${NC}"
        echo -e "  PID: ${CYAN}$pid${NC}"
        echo -e "  CPU: ${CYAN}${cpu}%${NC}"
        echo -e "  Memory: ${CYAN}${mem}%${NC}"
        return 0
    fi
}

# 检查后端服务
check_backend() {
    local status=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="bitcoin-backend") | .pm2_env.status')
    local cpu=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="bitcoin-backend") | .monit.cpu')
    local memory=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="bitcoin-backend") | .monit.memory')
    
    if [ "$status" = "online" ]; then
        echo -e "${GREEN}✓ 后端服务运行中${NC}"
        echo -e "  CPU: ${CYAN}${cpu}%${NC}"
        echo -e "  Memory: ${CYAN}$((memory / 1024 / 1024))MB${NC}"
        return 0
    else
        echo -e "${RED}❌ 后端服务未运行${NC}"
        return 1
    fi
}

# 检查Redis
check_redis() {
    local redis_ping=$(redis-cli -h 127.0.0.1 -p 16379 -a 3hu8fds3y ping 2>/dev/null)
    
    if [ "$redis_ping" = "PONG" ]; then
        echo -e "${GREEN}✓ Redis运行中${NC}"
        return 0
    else
        echo -e "${RED}❌ Redis未运行${NC}"
        return 1
    fi
}

# 检查SSH隧道
check_ssh_tunnel() {
    local tunnel_pid=$(ps aux | grep "ssh.*3307" | grep -v grep | awk '{print $2}')
    
    if [ -n "$tunnel_pid" ]; then
        echo -e "${GREEN}✓ SSH隧道运行中 (PID: $tunnel_pid)${NC}"
        return 0
    else
        echo -e "${RED}❌ SSH隧道未运行${NC}"
        echo -e "${YELLOW}正在重启SSH隧道...${NC}"
        cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend
        ./setup-ssh-tunnel.sh &
        sleep 2
        return 1
    fi
}

# 检查MySQL连接
check_mysql() {
    local mysql_test=$(mysql -h 127.0.0.1 -P 3307 -u root -pfe2c82a2e5b8e2a3 -e "SELECT 1" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ MySQL连接正常${NC}"
        return 0
    else
        echo -e "${RED}❌ MySQL连接失败${NC}"
        return 1
    fi
}

# 检查API健康状态
check_api_health() {
    local health=$(curl -s http://localhost:8888/api/health 2>/dev/null)
    
    if echo "$health" | grep -q '"status":"ok"'; then
        echo -e "${GREEN}✓ API健康检查通过${NC}"
        return 0
    else
        echo -e "${RED}❌ API健康检查失败${NC}"
        return 1
    fi
}

# 显示最近的后端日志
show_backend_logs() {
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}📋 最近10条后端日志${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    pm2 logs bitcoin-backend --lines 10 --nostream 2>/dev/null | tail -10
}

# 显示应用日志
show_app_logs() {
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}📱 应用最近日志 (过滤关键词)${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    adb logcat -d -t 20 | grep -E "flutter|bitcoin|mining|check-in|签到" | tail -10
}

# 主监控循环
main_loop() {
    while true; do
        clear_screen
        
        # 标题
        echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║     🎯 比特币挖矿应用 - 实时监控面板                        ║${NC}"
        echo -e "${CYAN}║     $(date '+%Y-%m-%d %H:%M:%S')                                    ║${NC}"
        echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
        
        echo ""
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}📱 Android设备状态${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        check_device
        echo ""
        check_app
        
        echo ""
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}🖥️  后端服务状态${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        check_backend
        echo ""
        check_redis
        echo ""
        check_ssh_tunnel
        echo ""
        check_mysql
        echo ""
        check_api_health
        
        # 显示日志
        show_backend_logs
        show_app_logs
        
        echo ""
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${CYAN}⏰ 10秒后刷新... (按 Ctrl+C 退出监控)${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        # 等待10秒
        sleep 10
    done
}

# 启动监控
echo "🚀 正在启动监控系统..."
sleep 1
main_loop
