#!/bin/bash

echo "📋 获取Android调试证书指纹..."
echo ""

# 获取证书信息
KEYSTORE_PATH="$HOME/.android/debug.keystore"

if [ ! -f "$KEYSTORE_PATH" ]; then
    echo "❌ 未找到debug.keystore文件"
    echo "位置: $KEYSTORE_PATH"
    exit 1
fi

echo "✅ 找到keystore文件"
echo ""

# 获取SHA-1指纹（Google OAuth要求）
echo "🔑 SHA-1 证书指纹（复制这个填入Google Console）："
SHA1_HEX=$(keytool -exportcert -alias androiddebugkey -keystore "$KEYSTORE_PATH" -storepass android -keypass android 2>/dev/null | openssl sha1 | sed 's/SHA1(stdin)= //')
SHA1_FORMATTED=$(echo "$SHA1_HEX" | sed 's/../&:/g;s/:$//' | tr '[:lower:]' '[:upper:]')
echo "$SHA1_FORMATTED"

echo ""
echo "📦 应用包名："
echo "com.cloudminingtool.bitcoin_mining_master"
echo ""

echo "💡 使用说明："
echo "1. 复制上面的 SHA-1 指纹（带冒号的格式）"
echo "2. 在Google Cloud Console粘贴到 'SHA-1 证书指纹' 字段"
echo "3. 确保包名也填写正确"
echo "4. 点击创建按钮"
echo ""

echo "📌 完整信息："
echo "   应用类型: Android"
echo "   名称: Bitcoin Mining Master - Android"
echo "   包名: com.cloudminingtool.bitcoin_mining_master"
echo "   SHA-1: $SHA1_FORMATTED"

