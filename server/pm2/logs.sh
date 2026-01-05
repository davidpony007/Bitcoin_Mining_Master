#!/bin/bash
# PM2 日志查看脚本 - Bitcoin Mining Master

# 使用方式：
#   ./logs.sh           # 查看所有日志
#   ./logs.sh api       # 查看 API 日志
#   ./logs.sh worker    # 查看 Worker 日志
#   ./logs.sh scheduler # 查看调度器日志

cd "$(dirname "$0")/../../backend"

case "$1" in
  api)
    pm2 logs bmm-api --lines 100
    ;;
  worker)
    pm2 logs bmm-worker --lines 100
    ;;
  scheduler)
    pm2 logs bmm-scheduler --lines 100
    ;;
  *)
    pm2 logs --lines 50
    ;;
esac
