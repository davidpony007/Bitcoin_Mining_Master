#!/bin/bash

# ============================================================
# Bitcoin Mining Master - Git HTTP/2 错误修复脚本
#
# 修复错误：
#   error: RPC failed; curl 16 Error in the HTTP2 framing layer
#   fatal: expected flush after ref listing
#
# 适用场景：中国大陆网络环境下 git fetch/push/clone 报 curl 16 错误
# 原因：GitHub 使用 HTTP/2，而部分网络代理/防火墙不兼容 HTTP/2 帧格式
# 修复：强制 Git 使用 HTTP/1.1，并扩大传输缓冲区
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         Git HTTP/2 错误修复工具（中国网络环境）           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${YELLOW}修复目标错误：${NC}"
echo "  error: RPC failed; curl 16 Error in the HTTP2 framing layer"
echo "  fatal: expected flush after ref listing"
echo ""

# ── 1. 强制 Git 使用 HTTP/1.1 ─────────────────────────────────
echo -e "${BLUE}[1/3]${NC} 设置 git http.version = HTTP/1.1 ..."
git config --global http.version HTTP/1.1
echo -e "  ${GREEN}✅ 已禁用 HTTP/2，使用 HTTP/1.1${NC}"

# ── 2. 扩大 Git 传输缓冲区（防止大仓库传输中断）──────────────
echo -e "${BLUE}[2/3]${NC} 设置 git http.postBuffer = 524288000（500 MB）..."
git config --global http.postBuffer 524288000
echo -e "  ${GREEN}✅ 已扩大传输缓冲区${NC}"

# ── 3. 验证配置 ────────────────────────────────────────────────
echo -e "${BLUE}[3/3]${NC} 验证 git 全局配置..."
HTTP_VER=$(git config --global http.version 2>/dev/null || echo "未设置")
POST_BUF=$(git config --global http.postBuffer 2>/dev/null || echo "未设置")
echo -e "  http.version    = ${GREEN}${HTTP_VER}${NC}"
echo -e "  http.postBuffer = ${GREEN}${POST_BUF}${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 修复完成！${NC}"
echo ""
echo -e "${YELLOW}📌 下一步操作：${NC}"
echo ""
echo "  验证 git 配置已生效（git 相关操作不再报 HTTP/2 错误）："
echo "    git ls-remote https://github.com/flutter/flutter.git HEAD"
echo ""
echo "  若 Flutter 工具的 'flutter pub get' 或 'flutter upgrade' 报同类错误，"
echo "  此修复同样适用（Flutter 内部使用 git 管理 SDK 版本）。"
echo ""
echo "  若需恢复 git 默认设置："
echo "    git config --global --unset http.version"
echo "    git config --global --unset http.postBuffer"
echo ""
echo "  若仍出现网络问题，可尝试关闭系统代理后重试："
echo "    export no_proxy=\"*\""
echo ""
echo -e "${BLUE}📱 继续开发 Bitcoin Mining Master：${NC}"
echo "  cd mobile_client/bitcoin_mining_master"
echo "  flutter pub get"
echo "  flutter run"
echo ""
