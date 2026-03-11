#!/bin/bash

# ============================================================
# Bitcoin Mining Master - macOS Flutter SDK 安装脚本
# 适用于中国大陆网络环境，使用 Flutter 官方中国镜像加速下载
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flutter 版本（固定版本以确保与项目依赖兼容，如需升级请同步更新 mobile_client/pubspec.yaml）
# 注意：如果你已安装了更新的版本（如 3.41.4），此脚本不会覆盖它，会直接跳过下载
FLUTTER_VERSION="3.19.6"
FLUTTER_CHANNEL="stable"
INSTALL_DIR="$HOME"
FLUTTER_DIR="$INSTALL_DIR/flutter"

# 中国镜像环境变量（大幅加速下载）
export FLUTTER_STORAGE_BASE_URL="https://storage.flutter-io.cn"
export PUB_HOSTED_URL="https://pub.flutter-io.cn"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║      Bitcoin Mining Master - Flutter SDK 安装工具        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 1. 检查是否已安装 Flutter ──────────────────────────────────
echo -e "${BLUE}[1/5]${NC} 检查 Flutter 安装状态..."
if command -v flutter &>/dev/null; then
    INSTALLED_VERSION=$(flutter --version 2>/dev/null | head -1 | awk '{print $2}')
    echo -e "${GREEN}✅ Flutter 已安装（版本: $INSTALLED_VERSION）${NC}"
    echo ""
    echo -e "${YELLOW}如需重新安装，请先删除现有 Flutter 目录：${NC}"
    echo "  rm -rf $FLUTTER_DIR"
    echo ""
    flutter doctor
    exit 0
fi

if [ -d "$FLUTTER_DIR" ]; then
    echo -e "${YELLOW}⚠️  检测到 $FLUTTER_DIR 目录已存在但未加入 PATH。${NC}"
    echo "   跳过下载，直接配置环境变量..."
    echo ""
    SKIP_DOWNLOAD=true
fi

# ── 2. 检查依赖工具 ────────────────────────────────────────────
echo -e "${BLUE}[2/5]${NC} 检查依赖工具..."

check_tool() {
    if command -v "$1" &>/dev/null; then
        echo -e "  ${GREEN}✅ $1 已安装${NC}"
    else
        echo -e "  ${RED}❌ $1 未安装${NC}"
        MISSING_TOOLS=true
    fi
}

check_tool git
check_tool curl
check_tool unzip

if [ "$MISSING_TOOLS" = true ]; then
    echo ""
    echo -e "${RED}请先安装缺少的工具后重新运行此脚本。${NC}"
    echo "建议使用 Homebrew 安装: brew install git curl unzip"
    exit 1
fi
echo ""

# ── 3. 下载 Flutter SDK ────────────────────────────────────────
if [ "$SKIP_DOWNLOAD" != true ]; then
    echo -e "${BLUE}[3/5]${NC} 使用国内镜像下载 Flutter SDK（速度更快）..."
    echo ""

    # 判断 CPU 架构
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        FLUTTER_ARCHIVE="flutter_macos_arm64_${FLUTTER_VERSION}-${FLUTTER_CHANNEL}.zip"
        echo -e "  检测到 Apple Silicon (M1/M2/M3) 芯片"
    else
        FLUTTER_ARCHIVE="flutter_macos_${FLUTTER_VERSION}-${FLUTTER_CHANNEL}.zip"
        echo -e "  检测到 Intel 芯片"
    fi

    DOWNLOAD_URL="${FLUTTER_STORAGE_BASE_URL}/flutter_infra_release/releases/stable/macos/${FLUTTER_ARCHIVE}"
    TMP_ZIP="/tmp/${FLUTTER_ARCHIVE}"

    echo -e "  下载地址: ${DOWNLOAD_URL}"
    echo -e "  保存路径: ${TMP_ZIP}"
    echo ""
    echo -e "${YELLOW}  ⏳ 开始下载（使用中国镜像，速度通常可达 1-10 MB/s）...${NC}"
    echo ""

    if ! curl -L --progress-bar --retry 3 --retry-delay 5 \
         -o "${TMP_ZIP}" \
         "${DOWNLOAD_URL}"; then
        echo ""
        echo -e "${RED}❌ 下载失败！${NC}"
        echo ""
        echo "请尝试手动下载并解压到 $INSTALL_DIR："
        echo "  1. 浏览器打开: https://flutter.cn/docs/get-started/install/macos"
        echo "  2. 下载后执行: unzip ~/Downloads/flutter_macos*.zip -d $INSTALL_DIR"
        exit 1
    fi

    echo ""
    echo -e "  ${GREEN}✅ 下载完成！${NC}"
    echo ""

    # 解压
    echo -e "${BLUE}[4/5]${NC} 解压 Flutter SDK 到 $INSTALL_DIR ..."
    unzip -q "${TMP_ZIP}" -d "${INSTALL_DIR}"
    rm -f "${TMP_ZIP}"
    echo -e "  ${GREEN}✅ 解压完成！${NC}"
    echo ""
else
    echo -e "${BLUE}[3/5]${NC} 跳过下载（目录已存在）"
    echo -e "${BLUE}[4/5]${NC} 跳过解压"
    echo ""
fi

# ── 4b. 修复 Git HTTP/2 错误（中国网络常见问题）───────────────
# 避免 "curl 16 Error in the HTTP2 framing layer" 导致 flutter fetch --tags 失败
# 注意：以下为全局 git 配置，会影响当前用户的所有 git 仓库操作
echo -e "${BLUE}[4b]${NC} 配置 Git 使用 HTTP/1.1（防止 curl 16 错误）..."
git config --global http.version HTTP/1.1
git config --global http.postBuffer 524288000
echo -e "  ${GREEN}✅ git http.version = HTTP/1.1，http.postBuffer = 500MB${NC}"
echo -e "  ${YELLOW}（注：此为全局配置，影响本机所有 git 仓库）${NC}"
echo ""

# ── 5. 配置环境变量 ────────────────────────────────────────────
echo -e "${BLUE}[5/5]${NC} 配置环境变量..."

FLUTTER_BIN="$FLUTTER_DIR/bin"
FLUTTER_ENV_BLOCK="
# Flutter SDK (Bitcoin Mining Master)
export FLUTTER_STORAGE_BASE_URL=\"https://storage.flutter-io.cn\"
export PUB_HOSTED_URL=\"https://pub.flutter-io.cn\"
export PATH=\"\$PATH:$FLUTTER_BIN\""

# 检测 shell 配置文件
if [ -n "$ZSH_VERSION" ] || [ "$(basename "$SHELL")" = "zsh" ]; then
    SHELL_RC="$HOME/.zshrc"
else
    SHELL_RC="$HOME/.bash_profile"
fi

if grep -qF "$FLUTTER_BIN" "$SHELL_RC" 2>/dev/null; then
    echo -e "  ${YELLOW}⚠️  Flutter PATH 已存在于 $SHELL_RC，跳过写入。${NC}"
else
    echo "$FLUTTER_ENV_BLOCK" >> "$SHELL_RC"
    echo -e "  ${GREEN}✅ 已写入 $SHELL_RC${NC}"
fi

# 使配置在当前会话生效（仅对后续 flutter doctor 调用有效）
export PATH="$PATH:$FLUTTER_BIN"
echo ""

# ── 验证安装 ───────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Flutter SDK 安装成功！${NC}"
echo ""
echo -e "${BLUE}运行环境检查:${NC}"
flutter doctor
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}📌 重要提示：${NC}"
echo "  1. 请重启终端（或执行 source $SHELL_RC）使 PATH 生效"
echo "  2. 在 VS Code 中设置 Flutter SDK 路径为: $FLUTTER_DIR"
echo ""
echo -e "${BLUE}📱 启动 Bitcoin Mining Master 移动端：${NC}"
echo "  cd mobile_client/bitcoin_mining_master"
echo "  flutter pub get"
echo "  flutter run"
echo ""
