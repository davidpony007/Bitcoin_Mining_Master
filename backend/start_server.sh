#!/bin/bash
# 一键启动后端服务器的脚本

cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend

echo "清理旧进程..."
lsof -ti:8888 | xargs kill -9 2>/dev/null
sleep 2

echo "启动后端服务器..."
node src/index.js
