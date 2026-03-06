#!/bin/bash

# AdMob配置检查脚本
# 用于验证AdMob集成是否正确配置

echo "🔍 AdMob配置检查工具"
echo "===================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查计数
PASS=0
WARN=0
FAIL=0

# 项目路径
PROJECT_DIR="/Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/mobile_client/bitcoin_mining_master"

echo "📂 项目路径: $PROJECT_DIR"
echo ""

# 1. 检查pubspec.yaml中是否有google_mobile_ads
echo "1️⃣  检查pubspec.yaml..."
if grep -q "google_mobile_ads:" "$PROJECT_DIR/pubspec.yaml"; then
    VERSION=$(grep "google_mobile_ads:" "$PROJECT_DIR/pubspec.yaml" | awk '{print $2}')
    echo -e "${GREEN}✅ google_mobile_ads已添加 (版本: $VERSION)${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ google_mobile_ads未添加${NC}"
    ((FAIL++))
fi
echo ""

# 2. 检查AndroidManifest.xml中的AdMob配置
echo "2️⃣  检查AndroidManifest.xml..."
MANIFEST="$PROJECT_DIR/android/app/src/main/AndroidManifest.xml"
if grep -q "com.google.android.gms.ads.APPLICATION_ID" "$MANIFEST"; then
    APP_ID=$(grep -A 1 "com.google.android.gms.ads.APPLICATION_ID" "$MANIFEST" | grep "android:value" | cut -d'"' -f2)
    if [[ $APP_ID == *"1234567890"* ]]; then
        echo -e "${YELLOW}⚠️  AdMob App ID是测试ID: $APP_ID${NC}"
        echo "   需要替换为真实的AdMob应用ID"
        ((WARN++))
    else
        echo -e "${GREEN}✅ AdMob App ID已配置: $APP_ID${NC}"
        ((PASS++))
    fi
else
    echo -e "${RED}❌ AndroidManifest.xml中未配置AdMob${NC}"
    ((FAIL++))
fi
echo ""

# 3. 检查AdMobService是否存在
echo "3️⃣  检查AdMobService..."
if [ -f "$PROJECT_DIR/lib/services/admob_service.dart" ]; then
    echo -e "${GREEN}✅ AdMobService已创建${NC}"
    ((PASS++))
    
    # 检查生产环境ID是否已更新
    if grep -q "XXXXXXXXXX" "$PROJECT_DIR/lib/services/admob_service.dart"; then
        echo -e "${YELLOW}⚠️  生产环境广告单元ID未更新${NC}"
        echo "   需要替换XXXXXXXXXX为真实的广告单元ID"
        ((WARN++))
    else
        echo -e "${GREEN}✅ 生产环境广告单元ID已更新${NC}"
        ((PASS++))
    fi
else
    echo -e "${RED}❌ AdMobService未创建${NC}"
    ((FAIL++))
fi
echo ""

# 4. 检查main.dart是否初始化AdMob
echo "4️⃣  检查main.dart..."
if grep -q "AdMobService.initialize()" "$PROJECT_DIR/lib/main.dart"; then
    echo -e "${GREEN}✅ main.dart已初始化AdMob${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ main.dart未初始化AdMob${NC}"
    ((FAIL++))
fi
echo ""

# 5. 检查ad_reward_screen.dart是否使用AdMobService
echo "5️⃣  检查ad_reward_screen.dart..."
AD_SCREEN="$PROJECT_DIR/lib/screens/ad_reward_screen.dart"
if grep -q "AdMobService" "$AD_SCREEN"; then
    echo -e "${GREEN}✅ ad_reward_screen已集成AdMobService${NC}"
    ((PASS++))
    
    # 检查是否有广告加载状态
    if grep -q "_isAdReady" "$AD_SCREEN" && grep -q "_isLoadingAd" "$AD_SCREEN"; then
        echo -e "${GREEN}✅ 广告加载状态已实现${NC}"
        ((PASS++))
    else
        echo -e "${YELLOW}⚠️  广告加载状态未完整实现${NC}"
        ((WARN++))
    fi
else
    echo -e "${RED}❌ ad_reward_screen未集成AdMobService${NC}"
    ((FAIL++))
fi
echo ""

# 6. 检查.packages是否存在（是否运行过flutter pub get）
echo "6️⃣  检查依赖安装..."
if [ -f "$PROJECT_DIR/.packages" ] || [ -f "$PROJECT_DIR/.dart_tool/package_config.json" ]; then
    if grep -q "google_mobile_ads" "$PROJECT_DIR/.dart_tool/package_config.json" 2>/dev/null; then
        echo -e "${GREEN}✅ google_mobile_ads依赖已安装${NC}"
        ((PASS++))
    else
        echo -e "${YELLOW}⚠️  需要运行 flutter pub get${NC}"
        ((WARN++))
    fi
else
    echo -e "${YELLOW}⚠️  需要运行 flutter pub get${NC}"
    ((WARN++))
fi
echo ""

# 总结
echo "📊 检查总结"
echo "===================="
echo -e "${GREEN}✅ 通过: $PASS${NC}"
echo -e "${YELLOW}⚠️  警告: $WARN${NC}"
echo -e "${RED}❌ 失败: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ] && [ $WARN -eq 0 ]; then
    echo -e "${GREEN}🎉 所有检查通过！AdMob配置完整！${NC}"
    echo ""
    echo "下一步:"
    echo "1. 在AdMob后台创建广告单元（如果还未创建）"
    echo "2. 运行应用测试: cd '$PROJECT_DIR' && flutter run"
elif [ $FAIL -eq 0 ]; then
    echo -e "${YELLOW}⚠️  基本配置完成，但有警告项需要处理${NC}"
    echo ""
    echo "需要做的事:"
    echo "1. 在AdMob后台创建广告单元"
    echo "2. 更新AndroidManifest.xml中的真实App ID"
    echo "3. 更新admob_service.dart中的真实广告单元ID"
    echo "4. 运行: cd '$PROJECT_DIR' && flutter pub get"
else
    echo -e "${RED}❌ 配置不完整，请先修复失败项${NC}"
    echo ""
    echo "请参考文档: docs/ADMOB_INTEGRATION_GUIDE.md"
fi
echo ""
echo "详细文档:"
echo "- 完整指南: docs/ADMOB_INTEGRATION_GUIDE.md"
echo "- 快速开始: docs/ADMOB_QUICK_START.md"
