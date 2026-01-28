# 🚀 离线用户功能 - 快速开始指南

## 📌 5分钟快速测试

### 前提条件
✅ 应用已安装到手机 (设备ID: WCO7CAC6T8CA99OB)  
✅ 后端服务运行中 (端口8888)  
✅ 测试脚本已准备好

---

## 🧪 方法一: 使用自动化测试脚本（推荐）

### 1. 打开终端运行脚本
```bash
cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/android_clent/bitcoin_mining_master
./quick_test_offline_user.sh
```

### 2. 选择测试场景
```
请选择测试场景:
1) 场景1: 有网络首次启动
2) 场景2: 无网络首次启动
3) 场景3: 离线用户网络恢复同步
4) 场景4: 已有账号再次启动
```

### 3. 观察测试结果
脚本会自动执行所有步骤并显示结果 ✨

---

## 🧪 方法二: 手动测试

### 场景A: 测试有网络创建用户（最简单）

**步骤**:
```bash
# 1. 清除应用数据
adb shell pm clear com.cloudminingtool.bitcoin_mining_master

# 2. 启动应用（手动打开手机上的应用）

# 3. 查看日志（可选）
adb logcat -s flutter:V | grep -i "user"
```

**期望**: 
- ✅ 应用正常启动
- ✅ 显示比特币价格和余额
- ✅ 后端创建新用户（user_id格式: U2026...）

---

### 场景B: 测试无网络创建离线用户

**步骤**:
```bash
# 1. 清除应用数据
adb shell pm clear com.cloudminingtool.bitcoin_mining_master

# 2. 关闭网络
adb shell svc wifi disable
adb shell svc data disable

# 3. 启动应用（手动打开）

# 4. 查看日志
adb logcat -s flutter:V | grep -i "offline"
```

**期望**:
- ✅ 应用正常启动（不崩溃）
- ✅ 生成临时用户ID（OFFLINE_U...）
- ✅ 显示"离线模式"提示

---

### 场景C: 测试离线用户自动同步

**前提**: 场景B已完成，应用在离线模式运行

**步骤**:
```bash
# 1. 恢复网络
adb shell svc wifi enable

# 2. 等待10-15秒（观察应用反应）

# 3. 查看同步日志
adb logcat -s flutter:V | grep -i "sync"
```

**期望**:
- ✅ 自动检测到网络恢复
- ✅ 触发同步流程
- ✅ 用户ID更新为正式ID（U2026...）
- ✅ 离线提示消失

---

## 🔍 快速验证

### 查看当前用户ID
```bash
adb shell "run-as com.cloudminingtool.bitcoin_mining_master cat /data/data/com.cloudminingtool.bitcoin_mining_master/shared_prefs/FlutterSharedPreferences.xml" | grep user_id
```

**输出示例**:
```xml
<!-- 正式用户 -->
<string name="flutter.user_id">U2026012423451812345</string>

<!-- 或者离线用户 -->
<string name="flutter.user_id">OFFLINE_U170631245678912345</string>
```

### 查看离线状态
```bash
adb shell "run-as com.cloudminingtool.bitcoin_mining_master cat /data/data/com.cloudminingtool.bitcoin_mining_master/shared_prefs/FlutterSharedPreferences.xml" | grep is_offline_user
```

**输出**:
```xml
<boolean name="flutter.is_offline_user" value="true" />  <!-- 离线 -->
<boolean name="flutter.is_offline_user" value="false" /> <!-- 在线 -->
```

---

## 📊 验证成功标准

### ✅ 有网络场景通过
- [ ] 应用正常启动
- [ ] user_id格式: `U{年月日时分秒}{5位随机数}`
- [ ] invitation_code格式: `INV{年月日时分秒}{5位随机数}`
- [ ] 后端数据库有新用户记录
- [ ] is_offline_user = false

### ✅ 无网络场景通过
- [ ] 应用正常启动（不崩溃）
- [ ] user_id格式: `OFFLINE_U{毫秒时间戳}{5位随机数}`
- [ ] invitation_code格式: `OFFLINE_INV{毫秒时间戳}{5位随机数}`
- [ ] 显示离线模式提示
- [ ] is_offline_user = true

### ✅ 自动同步场景通过
- [ ] 检测到网络恢复
- [ ] 自动调用后端API
- [ ] user_id从OFFLINE_U*变为U*
- [ ] invitation_code从OFFLINE_INV*变为INV*
- [ ] is_offline_user从true变为false
- [ ] 后端数据库有新用户记录

---

## 🚨 常见问题

### Q1: 应用启动崩溃
```bash
# 查看崩溃日志
adb logcat *:E

# 可能原因: 依赖未安装
# 解决方案:
cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/android_clent/bitcoin_mining_master
flutter clean && flutter pub get
flutter build apk --release
flutter install -d WCO7CAC6T8CA99OB
```

### Q2: 无法连接后端
```bash
# 检查后端服务
lsof -i:8888

# 如果未运行，启动后端
cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend
npm start
```

### Q3: 离线用户未自动同步
```bash
# 查看网络监听日志
adb logcat -s flutter:V | grep -i "connectivity"

# 可能原因: 
# 1. 应用在后台（需要在前台运行）
# 2. 网络权限未授予
# 3. connectivity_plus插件问题
```

### Q4: SharedPreferences无法读取
```bash
# 确保应用正在运行
adb shell am start -n com.cloudminingtool.bitcoin_mining_master/.MainActivity

# 等待3秒后再读取
sleep 3
adb shell "run-as com.cloudminingtool.bitcoin_mining_master cat /data/data/com.cloudminingtool.bitcoin_mining_master/shared_prefs/FlutterSharedPreferences.xml"
```

---

## 📞 需要帮助？

### 查看详细文档
```bash
# 实现文档
cat docs/OFFLINE_USER_IMPLEMENTATION.md

# 测试指南
cat docs/OFFLINE_USER_TEST_GUIDE.md

# 修复总结
cat docs/OFFLINE_USER_FIX_SUMMARY.md
```

### 收集调试信息
```bash
# 保存应用日志
adb logcat -s flutter:V > app_log.txt

# 保存SharedPreferences
adb shell "run-as com.cloudminingtool.bitcoin_mining_master cat /data/data/com.cloudminingtool.bitcoin_mining_master/shared_prefs/FlutterSharedPreferences.xml" > prefs.xml

# 查看后端日志
tail -100 /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend/backend.log
```

---

## 🎯 测试建议

### 推荐测试顺序
1. **先测试有网络场景** - 确保基础功能正常
2. **再测试无网络场景** - 验证离线功能
3. **最后测试自动同步** - 验证完整流程

### 测试时长
- 单个场景: 2-3分钟
- 全部场景: 10-15分钟

### 最佳实践
✅ 每次测试前清除应用数据  
✅ 使用测试脚本避免手动操作错误  
✅ 保持应用在前台运行观察日志  
✅ 测试完成后记录结果

---

## 🎉 开始测试！

选择你喜欢的方式开始测试：

### 🤖 自动化（推荐）
```bash
./quick_test_offline_user.sh
```

### 🔧 手动测试
按照上面的场景A/B/C步骤操作

### 📖 深入了解
阅读 `docs/OFFLINE_USER_IMPLEMENTATION.md`

---

**祝测试顺利！** 🚀
