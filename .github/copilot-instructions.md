# GitHub Copilot 编程助手配置
#
# 此文件为 GitHub Copilot Coding Agent 提供项目上下文。
# 完整的上下文信息可以让 Agent 自主完成任务，减少需要用户确认的工具调用。

## 项目概览

**Bitcoin Mining Master** 是一个比特币挖矿模拟平台，包含以下子系统：

- `backend/` — Node.js + Express + MySQL 后端 API 服务
- `web_frontend/` — React + TypeScript + Ant Design 管理后台
- `mobile_client/bitcoin_mining_master/` — Flutter 移动端 App (iOS / Android)
- `scripts/` — macOS / Linux 运维和安装脚本
- `docs/` — 项目文档

---

## 目录结构

```
Bitcoin_Mining_Master/
├── .github/
│   ├── copilot-instructions.md     ← 本文件
│   └── copilot/
│       └── setup-steps.yml         ← Agent 环境配置
├── backend/
│   └── src/
│       ├── config/                 # 数据库、Redis 连接配置
│       ├── controllers/            # 业务控制器
│       ├── middleware/             # JWT 鉴权、日志、限流
│       ├── models/                 # Sequelize 数据模型
│       ├── routes/                 # Express 路由
│       ├── services/               # 业务服务层
│       ├── jobs/                   # 定时任务
│       ├── queue/                  # 消息队列
│       ├── utils/                  # 工具函数
│       └── index.js                # 服务入口
├── web_frontend/
│   └── src/
│       ├── pages/                  # 页面组件
│       ├── components/             # 公共组件
│       ├── services/               # API 调用层
│       └── utils/                  # 工具函数
├── mobile_client/bitcoin_mining_master/
│   ├── lib/                        # Flutter Dart 源码
│   ├── android/                    # Android 原生配置
│   ├── ios/                        # iOS 原生配置
│   └── pubspec.yaml                # Flutter 依赖声明
├── scripts/
│   ├── macos/                      # macOS 安装 / 配置脚本
│   └── linux/                      # Linux 安装 / 配置脚本
└── docs/                           # 项目文档
```

---

## 数据库模型（MySQL + Sequelize）

| 模型文件 | 表名 | 说明 |
|---------|------|------|
| `userInformation.js` | `user_information` | 用户基本信息 |
| `userStatus.js` | `user_status` | 用户在线状态 |
| `userLog.js` | `user_log` | 操作日志 |
| `miningContract.js` | `mining_contract` | 挖矿合约 |
| `freeContractRecord.js` | `free_contract_record` | 免费合约记录 |
| `paidProductList.js` | `paid_product_list` | 付费商品 |
| `userOrder.js` | `user_order` | 用户订单 |
| `withdrawalRecord.js` | `withdrawal_record` | 提现记录 |
| `bitcoinTransactionRecord.js` | `bitcoin_transaction_record` | BTC 交易记录 |
| `countryMiningConfig.js` | `country_mining_config` | 国家挖矿倍率配置 |
| `invitationRelationship.js` | `invitation_relationship` | 邀请关系链 |
| `invitationRebate.js` | `invitation_rebate` | 邀请返佣记录 |

---

## 技术栈

### 后端 (backend/)
- **运行时**: Node.js 18+
- **框架**: Express 4
- **ORM**: Sequelize 6 + MySQL 8
- **缓存**: Redis 7
- **鉴权**: JWT (jsonwebtoken)
- **部署**: Docker + docker-compose

### 前端 (web_frontend/)
- **框架**: React 18 + TypeScript
- **UI**: Ant Design 5
- **路由**: React Router 6
- **状态**: React Context / useState
- **HTTP**: axios

### 移动端 (mobile_client/)
- **框架**: Flutter 3.x (Dart 3.x)
- **状态管理**: Provider + GetX
- **HTTP**: Dio
- **路由**: GoRouter
- **镜像加速**: flutter-io.cn（中国大陆）

---

## 编码规范

### 后端
- 使用 CommonJS (`require` / `module.exports`)
- 路由文件命名：`{entity}Routes.js`
- 服务文件命名：`{entity}Service.js`
- 控制器文件命名：`{entity}Controller.js`（或内联在路由中）
- 错误统一用 `res.status(code).json({ success: false, message: '...' })` 返回
- 成功统一用 `res.json({ success: true, data: ... })` 返回

### 前端
- 使用 TypeScript，组件用函数式写法 + Hooks
- 页面文件放在 `src/pages/{PageName}/index.tsx`
- API 调用统一在 `src/services/` 下封装
- 样式优先使用 Ant Design 内置，再用 CSS Modules

### 移动端
- Dart 文件命名：snake_case
- Widget 命名：PascalCase
- 网络请求统一通过 Dio 封装，服务类放 `lib/services/`

---

## 环境变量

后端关键环境变量（参见 `docker-compose.yml`）：
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`
- `JWT_SECRET`
- `PORT`（默认 3001）

移动端关键环境变量（参见 `mobile_client/bitcoin_mining_master/.env`）：
- `FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn`
- `PUB_HOSTED_URL=https://pub.flutter-io.cn`

---

## 常用命令

```bash
# 后端
cd backend && npm install
docker-compose up -d          # 启动全部服务
docker-compose logs -f backend

# 前端
cd web_frontend && npm install && npm start

# 移动端
cd mobile_client/bitcoin_mining_master
export PUB_HOSTED_URL=https://pub.flutter-io.cn
flutter pub get
flutter run

# 修复 git HTTP/2 错误（中国大陆网络）
bash scripts/macos/fix-git-http2.sh
```
