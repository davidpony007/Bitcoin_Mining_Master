#!/bin/bash

# Docker服务持续监控脚本
# 每30秒检查一次服务状态

SERVER="root@47.79.232.189"
DOCKER_DIR="/root/bitcoin-docker"
LOG_FILE="/tmp/docker-monitor.log"

echo "🔍 Bitcoin Mining Master - Docker服务监控"
echo "服务器: $SERVER"
echo "监控间隔: 30秒"
echo "日志文件: $LOG_FILE"
echo "按 Ctrl+C 停止监控"
echo "=========================================="
echo ""

# 清空日志
> $LOG_FILE

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$TIMESTAMP] 检查服务状态..." | tee -a $LOG_FILE
    
    # 获取容器状态
    CONTAINER_STATUS=$(ssh $SERVER "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep bitcoin" 2>&1)
    
    if [ $? -eq 0 ]; then
        echo "✅ Docker容器状态:" | tee -a $LOG_FILE
        echo "$CONTAINER_STATUS" | tee -a $LOG_FILE
        echo "" | tee -a $LOG_FILE
        
        # 检查API健康
        API_HEALTH=$(ssh $SERVER "curl -s -m 5 http://localhost/api/health" 2>&1)
        
        if echo "$API_HEALTH" | grep -q "\"status\":\"ok\""; then
            echo "✅ API健康检查: 正常" | tee -a $LOG_FILE
            echo "响应: $API_HEALTH" | tee -a $LOG_FILE
        else
            echo "❌ API健康检查: 失败" | tee -a $LOG_FILE
            echo "响应: $API_HEALTH" | tee -a $LOG_FILE
            
            # API失败时，尝试重启backend
            echo "🔄 尝试重启backend容器..." | tee -a $LOG_FILE
            ssh $SERVER "cd $DOCKER_DIR && docker compose -f docker-compose.prod.yml restart backend" | tee -a $LOG_FILE
        fi
        
        # 检查服务器资源
        echo "" | tee -a $LOG_FILE
        echo "📊 服务器资源使用:" | tee -a $LOG_FILE
        ssh $SERVER "free -h | head -2; df -h / | tail -1; uptime" | tee -a $LOG_FILE
        
    else
        echo "❌ Docker连接失败或容器未运行" | tee -a $LOG_FILE
        echo "$CONTAINER_STATUS" | tee -a $LOG_FILE
        
        # 尝试启动容器
        echo "🔄 尝试启动所有容器..." | tee -a $LOG_FILE
        ssh $SERVER "cd $DOCKER_DIR && docker compose -f docker-compose.prod.yml up -d" | tee -a $LOG_FILE
    fi
    
    echo "=========================================="
    echo ""
    
    # 等待30秒
    sleep 30
done
