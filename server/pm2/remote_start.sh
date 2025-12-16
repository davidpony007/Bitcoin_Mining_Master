#!/bin/bash
# 远程启动 Node 服务脚本
# 使用说明：bash remote_start.sh

echo "============================================"
echo "    Bitcoin Mining Master 远程启动向导"
echo "============================================"
echo ""
echo "由于 SSH 需要密码认证，请按照以下步骤操作："
echo ""
echo "步骤 1：打开新的终端窗口"
echo "步骤 2：SSH 登录到云服务器"
echo "        ssh root@47.79.232.189"
echo ""
echo "步骤 3：进入项目目录"
echo "        cd /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master"
echo ""
echo "步骤 4：查看当前 PM2 状态"
echo "        pm2 list"
echo ""
echo "步骤 5：重启所有服务"
echo "        pm2 restart all"
echo ""
echo "步骤 6：查看启动日志（等待 3-5 秒）"
echo "        pm2 logs bmm-api --lines 20 --nostream"
echo ""
echo "步骤 7：验证服务健康"
echo "        curl http://127.0.0.1:8888/api/health"
echo ""
echo "============================================"
echo ""
echo "📋 一键复制命令（可选）："
echo "============================================"
cat << 'EOF'

ssh root@47.79.232.189 << 'REMOTE'
cd /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master
echo "📊 当前 PM2 状态："
pm2 list
echo ""
echo "🔄 重启服务..."
pm2 restart all
sleep 3
echo ""
echo "📝 查看日志："
pm2 logs bmm-api --lines 20 --nostream
echo ""
echo "✅ 健康检查："
curl -s http://127.0.0.1:8888/api/health | python -m json.tool || curl -s http://127.0.0.1:8888/api/health
echo ""
echo "📊 最终状态："
pm2 status
REMOTE

EOF
echo ""
echo "============================================"
echo "💡 提示："
echo "   - 如果看到 'online' 状态，说明服务启动成功"
echo "   - 如果健康检查返回 {\"status\":\"ok\"...}，说明一切正常"
echo "   - 如果有错误，请查看日志：pm2 logs bmm-api --err"
echo "============================================"
