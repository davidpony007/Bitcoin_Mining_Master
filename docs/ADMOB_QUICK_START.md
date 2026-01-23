# 🎯 AdMob快速配置指南

## 立即需要做的3件事

### 1️⃣ 在AdMob后台创建广告单元
```
访问: https://apps.admob.com/
登录账号: maguiremarks70@gmail.com
Publisher ID: pub-1048949483424060

操作步骤:
1. 添加应用 → 选择Android → 应用名称"Bitcoin Mining Master"
2. 记录应用ID (格式: ca-app-pub-1048949483424060~XXXX)
3. 创建广告单元 → 选择"激励广告" → 名称"Reward Video"
4. 复制广告单元ID (格式: ca-app-pub-1048949483424060/YYYY)
```

### 2️⃣ 更新两个文件中的ID

**文件1**: `android/app/src/main/AndroidManifest.xml` (第40行)
```xml
<!-- 把这里的1234567890替换为步骤1中的应用ID后缀 -->
android:value="ca-app-pub-1048949483424060~您的应用ID后缀"
```

**文件2**: `lib/services/admob_service.dart` (第37-39行)
```dart
// 把XXXXXXXXXX替换为步骤1中的广告单元ID后缀
return 'ca-app-pub-1048949483424060/您的广告单元ID后缀';
```

### 3️⃣ 测试广告功能
```bash
# 1. 运行应用
cd android_clent/bitcoin_mining_master
flutter run

# 2. 在应用中点击"每日签到"或"广告激励"
# 3. 观察广告加载状态：
#    - "广告加载中..." → 等待
#    - "广告已准备好" → 点击"开始观看"
#    - 观看完整广告后获得挖矿奖励
```

---

## 📋 当前状态

✅ **代码已完成**:
- AdMob插件已安装 (google_mobile_ads v5.3.1)
- AndroidManifest.xml已配置（需要更新真实ID）
- AdMobService服务类已创建
- 广告页面已更新为真实广告逻辑
- 广告加载状态UI已添加

⏳ **您需要做的**:
1. 在AdMob后台创建广告单元（5分钟）
2. 更新两个文件中的ID（2分钟）
3. 测试广告显示（5分钟）

---

## 🧪 测试模式 vs 生产模式

### 当前使用测试模式
- 代码在debug模式下自动使用Google测试广告
- 测试广告ID: `ca-app-pub-3940256099942544/5224354917`
- **优点**: 可以立即测试，无需等待审核
- **缺点**: 不会产生真实收益

### 切换到生产模式
```bash
# 1. 更新真实广告单元ID（按上述步骤2）
# 2. 构建release版本
flutter build apk --release

# 3. 安装并测试
flutter install
```

**注意**: 真实广告需要24-48小时审核期

---

## 💰 预估收益

**激励视频广告CPM** (每千次展示收益):
- 中国地区: $3-8
- 美国地区: $10-25
- 其他地区: $5-15

**举例**:
- 假设CPM = $5
- 每天1000次广告观看 = $5收益
- 每月30天 = $150收益

---

## ⚠️ 重要提醒

1. **不要在开发时点击自己的真实广告** - 会被封号
2. **使用测试广告ID进行开发测试** - 代码已配置好
3. **真实广告首次需要等待审核** - 24-48小时
4. **确保网络通畅** - 广告加载需要稳定网络

---

## 📞 需要帮助？

查看详细文档: [ADMOB_INTEGRATION_GUIDE.md](./ADMOB_INTEGRATION_GUIDE.md)

---

**下一步**: 访问 https://apps.admob.com/ 创建您的广告单元！🚀
