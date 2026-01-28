# AdMob广告变现接入完整指南

## 📋 当前集成状态

✅ **已完成**:
1. google_mobile_ads 插件已安装 (v5.3.1)
2. AndroidManifest.xml 已配置AdMob元数据
3. AdMobService 服务类已创建
4. main.dart 已初始化AdMob SDK
5. ad_reward_screen.dart 已更新为真实广告逻辑
6. 广告加载状态UI已添加

⏳ **待完成**:
1. 在AdMob后台创建真实的广告单元ID
2. 更新代码中的真实广告单元ID
3. 测试真实广告加载和显示
4. 提交应用审核

---

## 🎯 第一步：在AdMob后台创建广告单元

### 1.1 登录AdMob控制台
- 访问: https://apps.admob.com/
- 使用您的账号登录: `maguiremarks70@gmail.com`
- Publisher ID: `pub-1048949483424060`

### 1.2 创建应用（如果还未创建）
1. 点击 **"应用"** → **"添加应用"**
2. 选择 **"Android"** 平台
3. 应用信息:
   - 应用名称: `Bitcoin Mining Master`
   - 包名: `com.bitcoinmining.app` (从AndroidManifest.xml获取)
4. 点击 **"添加应用"**
5. **记录下应用ID** (格式: ca-app-pub-XXXXX~YYYYYY)

### 1.3 创建激励视频广告单元
1. 进入刚创建的应用 → 点击 **"广告单元"**
2. 点击 **"开始使用"** → 选择 **"激励广告"**
3. 广告单元设置:
   - 广告单元名称: `Reward Video - Mining Extension`
   - 奖励金额: `Mining Time`
   - 奖励数量: `2 hours`
4. 点击 **"创建广告单元"**
5. **重要：复制广告单元ID** (格式: ca-app-pub-XXXXX/YYYYYY)

### 1.4 为iOS创建广告单元（如果需要iOS版本）
重复上述步骤，选择iOS平台

---

## 🔧 第二步：更新代码中的广告单元ID

### 2.1 更新AdMob应用ID

**文件**: `android/app/src/main/AndroidManifest.xml`

找到第38-41行：
```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-1048949483424060~1234567890"/>
```

**替换为您的真实应用ID**:
```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-1048949483424060~您的真实应用ID后缀"/>
```

### 2.2 更新激励视频广告单元ID

**文件**: `lib/services/admob_service.dart`

找到第34-44行的生产环境ID：
```dart
// 生产环境ID - 需要在AdMob后台创建后替换
if (Platform.isAndroid) {
  return 'ca-app-pub-1048949483424060/XXXXXXXXXX'; // 替换为真实的Android激励视频广告单元ID
} else if (Platform.isIOS) {
  return 'ca-app-pub-1048949483424060/YYYYYYYYYY'; // 替换为真实的iOS激励视频广告单元ID
}
```

**替换为**:
```dart
// 生产环境ID
if (Platform.isAndroid) {
  return 'ca-app-pub-1048949483424060/您从AdMob后台复制的Android广告单元ID';
} else if (Platform.isIOS) {
  return 'ca-app-pub-1048949483424060/您从AdMob后台复制的iOS广告单元ID';
}
```

---

## 🧪 第三步：测试广告功能

### 3.1 使用测试广告ID（当前配置）
代码默认在debug模式下使用Google的测试广告ID：
- Android测试ID: `ca-app-pub-3940256099942544/5224354917`
- iOS测试ID: `ca-app-pub-3940256099942544/1712485313`

### 3.2 测试流程
1. **运行应用**:
   ```bash
   cd android_clent/bitcoin_mining_master
   flutter run
   ```

2. **进入广告页面**:
   - 点击首页的"每日签到"或"广告激励"按钮

3. **观察广告加载状态**:
   - 🔄 "广告加载中..." - 广告正在加载
   - ✅ "广告已准备好" - 可以观看广告
   - ⚠️ "广告加载失败" - 需要检查网络或配置

4. **点击"开始观看"按钮**:
   - 应该弹出真实的Google测试广告
   - 观看完整广告后获得奖励

5. **验证奖励发放**:
   - 检查是否成功激活了挖矿合约
   - 返回首页查看算力是否增加

### 3.3 测试广告的特点
- 测试广告不会产生真实收益
- 可以反复观看测试广告
- 不需要AdMob审核

---

## 🚀 第四步：发布到生产环境

### 4.1 切换到生产广告ID
1. 确保已完成第二步（更新真实广告单元ID）
2. 构建Release版本:
   ```bash
   flutter build apk --release
   ```

### 4.2 重要注意事项
⚠️ **切换到真实广告ID后**:
- 首次请求可能需要几小时才能显示广告
- AdMob需要审核您（这是正常的的应用（通常24-48小时）
- 在审核通过前，广告可能加载失败）

### 4.3 AdMob政策要求
- ✅ 不要在开发时点击自己的真实广告
- ✅ 不要鼓励用户点击广告
- ✅ 广告必须是用户主动触发（我们的实现符合要求）
- ✅ 激励视频观看完整后才发放奖励（我们的实现符合要求）

---

## 📊 第五步：监控广告收益

### 5.1 查看收益报告
1. 登录AdMob: https://apps.admob.com/
2. 点击 **"报告"**
3. 选择日期范围查看:
   - 广告请求次数
   - 广告填充率
   - 展示次数
   - 预估收益

### 5.2 优化广告收益
- **提高填充率**: 确保网络稳定，优化广告加载时机
- **增加展示次数**: 优化用户体验，提高广告观看率
- **合理频次**: 不要过度请求广告（我们当前限制为观看完一次后才能再次观看）

---

## 🐛 常见问题排查

### Q1: 广告一直显示"加载中"
**可能原因**:
- 网络问题 - 检查网络连接
- 广告单元ID错误 - 检查是否正确复制
- AdMob账户未激活 - 检查AdMob后台状态

**解决方法**:
```bash
# 检查日志
flutter run --verbose
# 查看是否有AdMob相关错误
```

### Q2: 广告加载失败
**可能原因**:
- 应用还在AdMob审核中（正常）
- 当前地区没有广告填充（正常）
- 请求频率过高（我们已限制）

**解决方法**:
- 等待AdMob审核通过
- 使用VPN测试不同地区
- 检查AdMob后台是否有警告

### Q3: 测试广告可以，真实广告不行
**可能原因**:
- 真实广告需要审核（24-48小时）
- 应用还未发布到应用商店

**解决方法**:
- 耐心等待审核
- 确保应用符合AdMob政策
- 检查AdMob后台审核状态

---

## 📝 代码实现说明

### 广告加载流程
```
App启动 → AdMobService.initialize()
         ↓
用户进入广告页面 → _loadAd()
         ↓
广告加载成功 → _isAdReady = true → 按钮启用
         ↓
用户点击"观看广告" → showRewardedAd()
         ↓
用户观看完整广告 → earnedReward = true
         ↓
调用后端API → _completeAdReward()
         ↓
发放挖矿奖励 → 返回首页
```

### 关键文件
1. **lib/services/admob_service.dart** - AdMob服务类
2. **lib/screens/ad_reward_screen.dart** - 广告页面
3. **android/app/src/main/AndroidManifest.xml** - Android配置
4. **lib/main.dart** - SDK初始化

---

## ✅ 检查清单

在发布生产版本前，请确认：

- [ ] 已在AdMob后台创建应用
- [ ] 已创建激励视频广告单元
- [ ] 已更新AndroidManifest.xml中的应用ID
- [ ] 已更新admob_service.dart中的广告单元ID
- [ ] 已用测试广告ID测试功能正常
- [ ] 已理解AdMob政策要求
- [ ] 已准备好等待24-48小时审核期

---

## 📞 获取帮助

**AdMob帮助中心**: https://support.google.com/admob/

**常见AdMob政策**:
- 无效流量: https://support.google.com/admob/answer/6201362
- 激励广告政策: https://support.google.com/admob/answer/9341964

**Flutter AdMob插件文档**: https://pub.dev/packages/google_mobile_ads

---

## 🎉 完成！

当您完成以上所有步骤后，您的应用就已经成功接入AdMob广告变现平台了！

用户每观看一次完整的激励视频广告，您都会获得广告收益（通常$0.01-$0.10每次展示，具体取决于地区和广告商）。

祝您的应用获得成功！💰
