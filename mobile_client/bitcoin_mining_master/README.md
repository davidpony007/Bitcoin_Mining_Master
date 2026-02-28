# Bitcoin Mining Master - Flutter 转换项目

## 项目概述

这是一个将 Kotlin/Android Studio 项目转换为 Flutter/Dart 的项目。该应用是一个比特币挖矿模拟游戏，包含挖矿、钱包、推荐和合约功能。

## 技术栈

### 原项目 (Kotlin)
- **语言**: Kotlin
- **架构**: MVVM (Model-View-ViewModel)
- **UI**: Android XML Layouts, BottomNavigationView
- **网络**: Retrofit / OkHttp
- **状态管理**: LiveData, ViewModel
- **异步**: Kotlin Coroutines

### 新项目 (Flutter)
- **语言**: Dart
- **框架**: Flutter 3.38.5
- **状态管理**: Provider
- **网络**: Dio
- **路由**: Go Router
- **本地存储**: SharedPreferences
- **UI组件**: Material Design

## 项目结构

```
lib/
├── main.dart                    # 应用入口
├── constants/
│   └── app_constants.dart       # 常量定义（API、颜色等）
├── models/
│   └── user_model.dart          # 数据模型
├── services/
│   ├── api_service.dart         # API 服务
│   ├── storage_service.dart     # 本地存储服务
│   └── user_repository.dart     # 用户数据仓库
├── providers/
│   └── user_provider.dart       # 用户状态管理
├── screens/
│   ├── home_screen.dart         # 主屏幕（底部导航）
│   ├── dashboard_screen.dart    # 挖矿仪表盘
│   ├── wallet_screen.dart       # 钱包
│   ├── referral_screen.dart     # 推荐
│   └── contracts_screen.dart    # 合约
└── widgets/                     # 自定义组件（待扩展）
```

## 核心功能

### 1. 挖矿仪表盘 (Dashboard)
- ✅ 显示当前比特币余额
- ✅ 呼吸动画的挖矿按钮
- ✅ 电池槽位显示
- ✅ 算力和收益统计
- 对应 Kotlin 文件: `DashboardFragment.kt`

### 2. 钱包 (Wallet)
- ✅ 余额显示（BTC + USD）
- ✅ 提现功能
- ✅ 交易记录列表
- ✅ 下拉刷新
- 对应 Kotlin 文件: `WalletFragment.kt`

### 3. 推荐 (Referral)
- ✅ 推荐码显示
- ✅ 复制推荐码功能
- ✅ 推荐奖励说明
- ✅ 推荐统计
- 对应 Kotlin 文件: `ReferralFragment.kt`

### 4. 合约 (Contracts)
- ✅ 当前合约状态
- ✅ 可购买合约列表
- ✅ 合约详情（算力、期限、收益）
- 对应 Kotlin 文件: `ContractsFragment.kt`

## API 接口

### 基础配置
- **Base URL**: `http://your-api-server.com/api`
- **超时时间**: 30秒

### 接口列表

1. **生成用户ID**
   - `POST /user/generate-user-id`
   - 返回: `{ "success": true, "userId": "xxx" }`

2. **获取余额**
   - `GET /user/bitcoin-balance/{userId}`
   - 返回: `{ "success": true, "balance": "0.00000000" }`

3. **提现**
   - `POST /user/withdraw`
   - 参数: `{ "userId": "xxx", "amount": "0.001", "address": "xxx" }`

4. **交易记录**
   - `GET /user/transactions/{userId}`
   - 返回: 交易记录列表

## 状态管理

项目使用 Provider 进行状态管理，主要的 Provider 包括：

### UserProvider
- 管理用户ID、余额、交易记录
- 提供加载状态和错误信息
- 方法：
  - `initializeUser()`: 初始化用户数据
  - `fetchBitcoinBalance()`: 获取余额
  - `fetchTransactions()`: 获取交易记录
  - `withdrawBitcoin()`: 提现

## 数据持久化

使用 SharedPreferences 存储：
- 用户ID (`userId`)
- 比特币余额 (`bitcoinBalance`)
- 首次启动标记 (`isFirstLaunch`)

## 依赖包

```yaml
dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.2
  provider: ^6.1.5           # 状态管理
  dio: ^5.9.0                # HTTP 客户端
  get: ^4.7.3                # 路由和工具
  shared_preferences: ^2.5.4 # 本地存储
  go_router: ^13.2.5         # 路由管理
  flutter_spinkit: ^5.2.2    # 加载动画
  fluttertoast: ^8.2.14      # Toast 提示
  json_annotation: ^4.9.0    # JSON 序列化

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^6.0.0
  build_runner: ^2.10.4
  json_serializable: ^6.11.3
```

## 与原 Kotlin 项目的对应关系

| Kotlin 组件 | Flutter 组件 | 说明 |
|------------|-------------|------|
| MainActivity | home_screen.dart | 主界面和导航 |
| Fragment | Screen Widget | 页面组件 |
| ViewModel | Provider | 状态管理 |
| Repository | Repository类 | 数据仓库 |
| LiveData | ChangeNotifier | 响应式数据 |
| Retrofit | Dio | HTTP 客户端 |
| SharedPreferences | SharedPreferences | 本地存储 |
| Coroutines | async/await | 异步编程 |

## 运行项目

### 前置要求
- Flutter SDK 3.x 或更高版本
- Dart SDK 3.x 或更高版本
- iOS 模拟器 或 Android 模拟器/真机

### 运行步骤

1. **安装依赖**
   ```bash
   cd mobile_client/bitcoin_mining_master
   flutter pub get
   ```

2. **检查环境**
   ```bash
   flutter doctor
   ```

3. **运行项目**
   ```bash
   # iOS 模拟器
   flutter run -d ios
   
   # Android 模拟器/真机
   flutter run -d android
   
   # 选择设备运行
   flutter run
   ```

4. **构建发布版本**
   ```bash
   # Android APK
   flutter build apk --release
   
   # iOS IPA
   flutter build ios --release
   ```

## 待完成功能

- [ ] 实际的挖矿逻辑实现
- [ ] 电池槽位功能
- [ ] 合约购买功能
- [ ] 分享功能
- [ ] 充值和转账功能
- [ ] 用户设置页面
- [ ] 完整的错误处理
- [ ] 单元测试和集成测试
- [ ] 深色模式支持
- [ ] 多语言支持

## 注意事项

1. **API 地址配置**
   - 需要在 `lib/constants/app_constants.dart` 中修改 `baseUrl` 为实际的服务器地址

2. **安全性**
   - 在生产环境中应使用 HTTPS
   - 实现适当的身份验证机制
   - 加密敏感数据

3. **性能优化**
   - 考虑实现图片缓存
   - 优化列表渲染性能
   - 实现分页加载

4. **测试**
   - 建议编写单元测试和集成测试
   - 在多种设备上测试UI适配

## 开发者信息

- **项目名称**: Bitcoin Mining Master
- **原始平台**: Android (Kotlin)
- **目标平台**: iOS & Android (Flutter)
- **转换日期**: 2024

## 相关文档

- [Flutter 官方文档](https://flutter.dev/docs)
- [Dart 语言指南](https://dart.dev/guides)
- [Provider 状态管理](https://pub.dev/packages/provider)
- [Dio HTTP 客户端](https://pub.dev/packages/dio)

## 许可证

请根据项目实际情况添加许可证信息。
