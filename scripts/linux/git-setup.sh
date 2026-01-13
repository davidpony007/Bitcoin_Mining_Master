#!/bin/bash

# ==========================================
# Bitcoin Mining Master - Git 快速配置脚本
# ==========================================

echo "🚀 Bitcoin Mining Master - Git 仓库初始化"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否已经是 Git 仓库
if [ -d ".git" ]; then
    echo -e "${YELLOW}⚠️  警告: 此目录已经是一个 Git 仓库${NC}"
    echo ""
    read -p "是否要重新初始化？(y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "取消操作"
        exit 1
    fi
    rm -rf .git
fi

# 步骤 1: 初始化 Git
echo -e "${BLUE}📦 步骤 1/5: 初始化 Git 仓库${NC}"
git init
echo -e "${GREEN}✅ Git 仓库初始化成功${NC}"
echo ""

# 步骤 2: 检查 .gitignore
echo -e "${BLUE}📝 步骤 2/5: 检查 .gitignore 文件${NC}"
if [ -f ".gitignore" ]; then
    echo -e "${GREEN}✅ .gitignore 文件已存在${NC}"
else
    echo -e "${RED}❌ .gitignore 文件不存在，请先创建！${NC}"
    exit 1
fi
echo ""

# 步骤 3: 添加文件
echo -e "${BLUE}📂 步骤 3/5: 添加文件到 Git${NC}"
git add .
echo -e "${GREEN}✅ 文件添加成功${NC}"
echo ""

# 步骤 4: 提交
echo -e "${BLUE}💾 步骤 4/5: 创建初始提交${NC}"
git commit -m "Initial commit: Bitcoin Mining Master 项目

包含内容:
- 后端 API (Node.js + Express)
- 前端 Web (React)
- Android 客户端
- iOS 客户端
- 数据库迁移脚本
- PM2 配置
- Nginx 配置
- 文档

初始化时间: $(date '+%Y-%m-%d %H:%M:%S')
"
echo -e "${GREEN}✅ 初始提交创建成功${NC}"
echo ""

# 步骤 5: 配置远程仓库
echo -e "${BLUE}🌐 步骤 5/5: 配置远程仓库${NC}"
echo ""
echo "请选择 Git 托管平台:"
echo "1) GitHub"
echo "2) GitLab"
echo "3) Gitee (码云)"
echo "4) 跳过（稍后手动配置）"
echo ""
read -p "请输入选项 (1-4): " -n 1 -r platform
echo ""

case $platform in
    1)
        echo ""
        echo -e "${YELLOW}📋 GitHub 配置步骤:${NC}"
        echo "1. 访问 https://github.com/new"
        echo "2. 创建新仓库 (建议使用私有仓库)"
        echo "3. 仓库名称建议: bitcoin-mining-master"
        echo "4. 不要勾选 'Initialize with README'"
        echo ""
        read -p "请输入你的 GitHub 用户名: " username
        read -p "请输入仓库名称 [bitcoin-mining-master]: " repo
        repo=${repo:-bitcoin-mining-master}
        
        git remote add origin "https://github.com/$username/$repo.git"
        git branch -M main
        
        echo ""
        echo -e "${GREEN}✅ 远程仓库配置成功${NC}"
        echo ""
        echo -e "${YELLOW}📤 推送代码到 GitHub:${NC}"
        echo "git push -u origin main"
        echo ""
        read -p "是否现在推送？(y/N): " -n 1 -r push
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git push -u origin main
            echo -e "${GREEN}✅ 代码推送成功！${NC}"
        fi
        ;;
    2)
        echo ""
        echo -e "${YELLOW}📋 GitLab 配置步骤:${NC}"
        echo "1. 访问 https://gitlab.com/projects/new"
        echo "2. 创建新项目"
        echo "3. 选择 'Create blank project'"
        echo ""
        read -p "请输入你的 GitLab 用户名: " username
        read -p "请输入仓库名称 [bitcoin-mining-master]: " repo
        repo=${repo:-bitcoin-mining-master}
        
        git remote add origin "https://gitlab.com/$username/$repo.git"
        git branch -M main
        
        echo ""
        echo -e "${GREEN}✅ 远程仓库配置成功${NC}"
        echo ""
        echo "推送代码: git push -u origin main"
        ;;
    3)
        echo ""
        echo -e "${YELLOW}📋 Gitee 配置步骤:${NC}"
        echo "1. 访问 https://gitee.com/projects/new"
        echo "2. 创建新仓库"
        echo ""
        read -p "请输入你的 Gitee 用户名: " username
        read -p "请输入仓库名称 [bitcoin-mining-master]: " repo
        repo=${repo:-bitcoin-mining-master}
        
        git remote add origin "https://gitee.com/$username/$repo.git"
        git branch -M main
        
        echo ""
        echo -e "${GREEN}✅ 远程仓库配置成功${NC}"
        echo ""
        echo "推送代码: git push -u origin main"
        ;;
    4)
        echo ""
        echo -e "${YELLOW}⏭️  跳过远程仓库配置${NC}"
        echo ""
        echo "稍后可以手动配置:"
        echo "git remote add origin <你的仓库地址>"
        echo "git push -u origin main"
        ;;
    *)
        echo ""
        echo -e "${RED}❌ 无效的选项${NC}"
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Git 仓库配置完成！${NC}"
echo ""
echo -e "${YELLOW}📋 下一步操作:${NC}"
echo ""
echo "在另一台电脑上克隆项目:"
echo "  git clone <你的仓库地址>"
echo ""
echo "配置环境变量:"
echo "  cd backend"
echo "  cp .env.example .env"
echo "  # 编辑 .env 文件，填入数据库和 Redis 配置"
echo ""
echo "安装依赖:"
echo "  npm install"
echo ""
echo "启动项目:"
echo "  npm start"
echo ""
echo -e "${BLUE}💡 提示: 查看 '多电脑同步开发指南.md' 了解更多详情${NC}"
echo ""
