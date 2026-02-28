# 🚀 Google Play Billing 快速开始指南

## ✅ 你需要完成的步骤

### 1️⃣ 安装Flutter依赖

```bash
cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/mobile_client/bitcoin_mining_master
flutter pub get
```

### 2️⃣ 配置Android权限

编辑 `android/app/src/main/AndroidManifest.xml`，添加：

```xml
<uses-permission android:name="com.android.vending.BILLING" />
```

### 3️⃣ 创建Google Play Console应用

1. 访问 https://play.google.com/console
2. 创建应用 "Bitcoin Mining Master"
3. 在 **创收 → 应用内商品** 创建4个商品：
   - `p0499` - $4.99
   - `p0699` - $6.99  
   - `p0999` - $9.99
   - `p1999` - $19.99

### 4️⃣ 配置Google Service Account

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建服务账号并下载JSON密钥
3. 在Google Play Console授权该服务账号
4. 上传密钥到服务器：

```bash
scp google-service-account.json root@47.79.232.189:/root/bitcoin-docker/backend/src/config/
```

### 5️⃣ 创建数据库表

```bash
ssh root@47.79.232.189
docker exec -i bitcoin_mysql_prod mysql -uroot -pBitcoin_MySQL_Root_2026!Secure bitcoin_mining_master < /root/bitcoin-docker/backend/src/database/migrations/create_payment_transactions.sql
```

### 6️⃣ 安装后端依赖

```bash
ssh root@47.79.232.189
cd /root/bitcoin-docker/backend
docker exec bitcoin_backend_prod npm install googleapis
```

### 7️⃣ 注册路由

编辑 `backend/src/app.js`，添加：

```javascript
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);
```

### 8️⃣ 重启后端服务

```bash
ssh root@47.79.232.189 "docker restart bitcoin_backend_prod"
```

### 9️⃣ 测试购买流程

#### 本地测试

```bash
# 构建Release APK（必须，Debug版本无法测试IAP）
flutter build apk --release

# 安装到手机
adb install build/app/outputs/flutter-apk/app-release.apk

# 在手机上登录测试账号进行购买测试
```

#### 添加测试账号

1. Google Play Console → 设置 → 许可测试
2. 添加测试Gmail账号
3. 测试账号购买不会真实扣费

### 🔟 上传到内部测试轨道

**重要**: 商品只有在APK上传到测试轨道后才会加载！

```bash
# 构建AAB（推荐）
flutter build appbundle --release

# 上传到Google Play Console的内部测试轨道
# 然后在手机上加入测试，从Play Store安装
```

---

## 📝 修改包名（如果需要）

当前包名可能需要修改为你的实际包名：

1. 编辑 `android/app/build.gradle`:
```gradle
defaultConfig {
    applicationId "com.bitcoinmining.master"  // 修改这里
}
```

2. 编辑 `backend/src/routes/payment.js`:
```javascript
const PACKAGE_NAME = 'com.bitcoinmining.master';  // 与上面一致
```

---

## 🧪 测试检查清单

- [ ] Flutter依赖已安装
- [ ] Android权限已添加
- [ ] Google Play Console商品已创建
- [ ] Service Account已配置并授权
- [ ] 数据库表已创建
- [ ] 后端路由已注册
- [ ] 后端服务已重启
- [ ] Release APK已构建
- [ ] 测试账号已添加
- [ ] APK已上传到测试轨道
- [ ] 商品列表可以加载
- [ ] 购买流程可以完成

---

## ⚠️ 常见问题

### 商品列表为空？
➜ 确保APK已上传到测试轨道，商品状态为"有效"

### 购买时提示"商品不可用"？
➜ 必须使用Release版本，且包名与Console一致

### 后端验证失败？
➜ 检查Service Account密钥文件路径和权限

---

## 📞 需要帮助？

查看完整文档：`GOOGLE_PLAY_BILLING_SETUP.md`

或者直接问我！😊
