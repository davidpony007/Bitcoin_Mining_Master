# 🔧 如何同步 Gradle 项目

## 方法 1: 通过菜单栏 ⭐ (推荐)

1. 点击顶部菜单: **File**
2. 选择: **Sync Project with Gradle Files**

快捷键:
- **macOS**: 没有默认快捷键
- **Windows/Linux**: 没有默认快捷键

---

## 方法 2: 通过工具栏图标

在 Android Studio 顶部工具栏找到:

🐘 **大象图标** (Gradle 图标) → 点击它旁边的 **"Sync Project with Gradle Files"** 按钮

通常在工具栏右侧,靠近搜索图标的位置。

---

## 方法 3: 通过 Gradle 面板

1. 点击右侧边栏的 **Gradle** 标签 (或 View → Tool Windows → Gradle)
2. 在 Gradle 面板顶部有一个 **刷新图标** 🔄
3. 点击刷新图标即可同步

---

## 方法 4: 通过 Build 菜单

1. 点击顶部菜单: **Build**
2. 选择: **Make Project** (这会自动触发 Gradle Sync)

快捷键:
- **macOS**: `Cmd + F9`
- **Windows/Linux**: `Ctrl + F9`

---

## ✅ 同步成功的标志

同步完成后,您会看到:

**底部状态栏显示**:
```
Build: Gradle sync finished in 15s
```

或:
```
Gradle build finished in 15s
```

如果没有错误,就表示同步成功! ✅

---

## ⚠️ 如果遇到同步错误

### 常见错误 1: "Plugin [id: 'xxx'] was not found"

**解决**:
1. 检查网络连接 (需要下载依赖)
2. 等待几分钟重试
3. File → Invalidate Caches → Invalidate and Restart

### 常见错误 2: "Failed to resolve: com.google.android.gms:xxx"

**解决**:
1. 打开 `build.gradle.kts` (Project 级别)
2. 确认有 Google 仓库:
```kotlin
repositories {
    google()
    mavenCentral()
}
```

### 常见错误 3: "Minimum supported Gradle version is x.x"

**解决**:
1. 打开 `gradle/wrapper/gradle-wrapper.properties`
2. 更新 Gradle 版本:
```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.2-bin.zip
```

---

## 🚀 同步后的下一步

1. **编译项目**: Build → Make Project (`Cmd + F9` / `Ctrl + F9`)
2. **运行项目**: 点击绿色三角按钮 ▶️ (`Ctrl + R` / `Shift + F10`)
3. **查看日志**: 底部 Logcat 面板

---

## 💡 小技巧

**自动同步设置**:
1. Android Studio → Settings (macOS: Preferences)
2. Build, Execution, Deployment → Gradle
3. 勾选: ☑️ "Sync project before building"

这样每次构建前会自动同步! 😊
