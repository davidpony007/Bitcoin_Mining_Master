# 🪙 Bitcoin Mining Master

比特币挖矿大师 - 全栈区块链挖矿游戏项目

---

## 📋 项目简介

Bitcoin Mining Master 是一个完整的区块链挖矿模拟游戏，包含：
- 🎮 挖矿游戏机制
- 👥 用户邀请系统
- 💰 虚拟货币交易
- 📊 数据统计分析
- 🌍 国家挖矿倍率配置

---

## 🏗️ 项目结构

```
Bitcoin Mining Master/
├── backend/                    # 后端 API (Node.js + Express)
│   ├── src/
│   │   ├── config/            # 配置文件 (数据库、Redis)
│   │   ├── controllers/       # 控制器
│   │   ├── middleware/        # 中间件 (认证、限流)
│   │   ├── models/            # 数据模型 (Sequelize)
│   │   ├── routes/            # 路由
│   │   ├── services/          # 业务逻辑
│   │   ├── jobs/              # 定时任务
│   │   └── index.js           # 入口文件
│   ├── migrations/            # 数据库迁移
│   ├── test/                  # 测试文件
│   └── package.json
│
├── web_frontend/              # 前端 Web (React)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
│
├── android_clent/             # Android 客户端 (Kotlin)
│   └── Bitcoin_Mining_Master/
│
├── ios_client/                # iOS 客户端 (Swift)
│
├── server/                    # 服务器配置
│   ├── nginx/                 # Nginx 配置
│   ├── docker/                # Docker 配置
│   └── pm2/                   # PM2 配置
│
├── docs/                      # 文档
│   ├── api.md                 # API 文档
│   └── design.md              # 设计文档
│
└── scripts/                   # 脚本
    ├── backup/                # 备份脚本
    ├── deploy/                # 部署脚本
    └── init/                  # 初始化脚本
```

---

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 16.0.0
- **MySQL**: >= 8.0
- **Redis**: >= 6.0
- **PM2**: >= 5.0 (生产环境)

### 1. 克隆项目

```bash
git clone <你的仓库地址>
cd bitcoin-mining-master
```

### 2. 配置后端

```bash
cd backend

# 复制环境变量模板
cp .env.example .env

# 编辑 .env，填入配置
# DB_HOST=你的数据库地址
# DB_USER=数据库用户名
# DB_PASSWORD=数据库密码
# REDIS_HOST=Redis地址
# REDIS_PASSWORD=Redis密码
nano .env

# 安装依赖
npm install

# 开发模式启动
npm run dev

# 或生产模式
npm start
```

### 3. 配置前端（可选）

```bash
cd web_frontend

# 复制环境变量
cp .env.example .env

# 安装依赖
npm install

# 启动开发服务器
npm start
```

### 4. 运行数据库迁移（首次部署）

```bash
cd backend

# 创建数据库表和初始数据
node migrations/create-country-mining-config.js
# ... 运行其他迁移脚本
```

---

## 🔧 配置说明

### 数据库配置

项目使用 MySQL 数据库，主要表包括：

- `user_information` - 用户信息
- `mining_contract` - 挖矿合约
- `bitcoin_transaction_record` - 比特币交易记录
- `invitation_relationship` - 邀请关系
- `country_mining_config` - 国家挖矿配置 ⭐ 新增

### Redis 配置

Redis 用于：
- 用户会话缓存
- 等级信息缓存
- 签到状态缓存
- 挖矿倍率缓存

**降级模式**: Redis 不可用时自动降级到直接查询数据库

### PM2 配置

生产环境使用 PM2 进行进程管理：

```bash
# 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 重启
pm2 restart bitcoin-backend
```

---

## 📡 API 文档

### 基础地址

```
开发环境: http://localhost:8888
生产环境: http://你的服务器IP:8888
```

### 主要接口

#### 用户认证
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录

#### 挖矿
- `GET /api/mining/contracts` - 获取合约列表
- `POST /api/mining/start` - 开始挖矿

#### 国家配置 ⭐ 新增
- `GET /api/country-mining` - 获取所有国家配置
- `GET /api/country-mining/multiplier/:code` - 获取指定国家倍率
- `PUT /api/country-mining/:code` - 更新倍率（管理员）

详细 API 文档请查看: [docs/api.md](docs/api.md)

---

## 🌍 国家挖矿倍率

项目支持根据用户所在国家设置不同的挖矿倍率：

| 国家 | 倍率 |
|------|------|
| 🇺🇸 美国 (US) | 26x |
| 🇦🇺 澳大利亚 (AU) | 26x |
| 🇨🇦 加拿大 (CA) | 26x |
| 🇬🇧 英国 (UK) | 18x |
| 🇩🇪 德国 (DE) | 18x |
| 🇫🇷 法国 (FR) | 18x |
| 🇳🇿 新西兰 (NZ) | 18x |
| 🇰🇷 韩国 (KR) | 18x |
| 🇨🇭 瑞士 (CH) | 18x |
| 其他国家 | 1x (默认) |

---

## 🧪 测试

```bash
cd backend

# 运行测试
npm test

# 测试国家挖矿功能
node test-country-mining.js
```

---

## 📦 部署

### 使用 PM2 (推荐)

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start ecosystem.config.js

# 保存配置
pm2 save

# 设置开机自启
pm2 startup
```

### 使用 Docker

```bash
# 构建镜像
docker build -t bitcoin-mining-master .

# 运行容器
docker run -d -p 8888:8888 bitcoin-mining-master
```

---

## 📚 重要文档

- 📖 [多电脑同步开发指南](多电脑同步开发指南.md) - 如何在多台电脑上开发
- 📖 [国家挖矿配置部署文档](backend/COUNTRY_MINING_DEPLOYMENT.md) - 国家挖矿功能说明
- 📖 [API 文档](docs/api.md) - 完整的 API 接口文档
- 📖 [设计文档](docs/design.md) - 系统设计说明

---

## 🔒 安全提示

⚠️ **重要**: 以下文件包含敏感信息，请勿上传到公开仓库：

- `backend/.env` - 包含数据库密码、Redis密码、JWT密钥
- `web_frontend/.env` - 包含 API 密钥
- `*.key`, `*.pem` - 证书和密钥文件

这些文件已在 `.gitignore` 中排除。

---

## 🤝 贡献指南

### 提交代码

```bash
# 1. 创建新分支
git checkout -b feature/你的功能名称

# 2. 提交更改
git add .
git commit -m "描述你的更改"

# 3. 推送到远程
git push origin feature/你的功能名称

# 4. 创建 Pull Request
```

### Commit 规范

- `feat: 新功能`
- `fix: 修复bug`
- `docs: 文档更新`
- `style: 代码格式调整`
- `refactor: 重构`
- `test: 测试相关`
- `chore: 构建/工具链相关`

---

## 📊 技术栈

### 后端
- **框架**: Express.js
- **数据库**: MySQL + Sequelize ORM
- **缓存**: Redis + ioredis
- **认证**: JWT
- **日志**: Winston
- **队列**: Bull
- **定时任务**: node-cron

### 前端
- **框架**: React
- **状态管理**: Redux
- **路由**: React Router
- **UI库**: Ant Design / Material-UI

### 移动端
- **Android**: Kotlin + Jetpack
- **iOS**: Swift + SwiftUI

### 运维
- **进程管理**: PM2
- **反向代理**: Nginx
- **容器化**: Docker
- **版本控制**: Git

---

## 📝 更新日志

### v1.0.0 (2025-12-16)
- ✅ 初始版本发布
- ✅ 用户认证系统
- ✅ 挖矿核心功能
- ✅ 邀请系统
- ✅ 国家挖矿倍率配置
- ✅ Redis 缓存优化
- ✅ PM2 集群部署

---

## 📞 联系方式

- **项目维护**: [你的名字]
- **邮箱**: [你的邮箱]
- **问题反馈**: [GitHub Issues]

---

## 📄 许可证

MIT License

---

**最后更新**: 2025-12-16
