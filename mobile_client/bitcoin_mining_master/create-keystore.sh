#!/bin/bash
# 创建Android Release签名密钥

KEYSTORE_PATH="/Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/mobile_client/bitcoin_mining_master/android/app-release-key.jks"
ALIAS="bitcoin-mining-master"
PASSWORD="BitcoinMining2026"

# 删除旧密钥
rm -f "$KEYSTORE_PATH"

# 创建新密钥（非交互式）
keytool -genkeypair \
  -v \
  -keystore "$KEYSTORE_PATH" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$PASSWORD" \
  -keypass "$PASSWORD" \
  -dname "CN=Bitcoin Mining Master, OU=Development, O=CloudMiningTool, L=Beijing, ST=Beijing, C=CN" \
  -noprompt

echo "✅ 签名密钥创建成功："
echo "   路径: $KEYSTORE_PATH"
echo "   别名: $ALIAS"
echo "   密码: $PASSWORD"
