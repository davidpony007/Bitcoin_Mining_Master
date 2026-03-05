# Bitcoin Mining Master - Web 数据中心

一个现代化的 React + TypeScript 数据管理后台系统，用于管理和分析 Bitcoin Mining Master 应用的用户数据、订单、广告、挖矿等核心业务数据。

## 📋 功能特性

### 核心模块

- **📊 仪表盘**: 核心数据概览，实时监控关键指标
- **👥 用户管理**: 用户列表、详情、统计、行为分析
- **📈 数据分析**: DAU/MAU、留存分析、用户行为漏斗
- **💰 广告数据**: 广告展示、点击、收入统计
- **🛒 订单管理**: 订单列表、详情、统计分析
- **🌍 地域分析**: 国家/地区用户分布、地图可视化
- **📅 签到数据**: 签到统计、趋势、排名
- **⚡ 挖矿数据**: 挖矿统计、算力分析、收益分析
- **🏆 积分系统**: 积分流水、统计、排名
- **📑 报表中心**: 日报/周报/月报、自定义报表、数据导出

### 技术特性

- ✅ TypeScript - 完整类型系统
- ✅ Ant Design - 企业级UI组件
- ✅ ECharts - 强大的图表库
- ✅ Redux Toolkit - 状态管理
- ✅ React Router v6 - 路由管理
- ✅ Axios - HTTP请求
- ✅ Vite - 快速开发构建
- ✅ 响应式设计 - 支持多设备

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
cd web_frontend
npm install
```

### 开发模式

```bash
npm run dev
```

访问: http://localhost:3000

默认登录账号:
- 用户名: admin
- 密码: 任意

### 生产构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录

### 预览构建

```bash
npm run preview
```

## 📁 项目结构

```
web_frontend/
├── public/                      # 静态资源
├── src/
│   ├── assets/                  # 资源文件（图片、样式）
│   ├── components/              # 通用组件
│   │   ├── common/             # 基础组件
│   │   ├── layout/             # 布局组件
│   │   └── charts/             # 图表组件
│   ├── pages/                   # 页面组件
│   │   ├── Dashboard/          # 仪表盘
│   │   ├── Users/              # 用户管理
│   │   ├── Analytics/          # 数据分析
│   │   ├── Ads/                # 广告数据
│   │   ├── Orders/             # 订单管理
│   │   ├── Geography/          # 地域分析
│   │   ├── CheckIn/            # 签到数据
│   │   ├── Mining/             # 挖矿数据
│   │   ├── Points/             # 积分系统
│   │   ├── Reports/            # 报表中心
│   │   ├── Settings/           # 系统设置
│   │   └── Login/              # 登录页
│   ├── services/                # API服务层
│   │   ├── api/                # API接口
│   │   └── websocket/          # WebSocket
│   ├── store/                   # Redux状态管理
│   ├── hooks/                   # 自定义Hooks
│   ├── utils/                   # 工具函数
│   ├── types/                   # TypeScript类型
│   ├── router/                  # 路由配置
│   ├── config/                  # 配置文件
│   ├── App.tsx                  # 应用根组件
│   └── main.tsx                 # 应用入口
├── .env.development             # 开发环境配置
├── .env.production              # 生产环境配置
├── package.json                 # 依赖配置
├── tsconfig.json                # TypeScript配置
└── vite.config.ts               # Vite配置
```

## 🔧 配置说明

### 环境变量

**开发环境** (`.env.development`)
```
VITE_APP_TITLE=Bitcoin Mining Master - Admin Dashboard
VITE_API_BASE_URL=http://localhost:8888/api
VITE_WS_URL=ws://localhost:8888
```

**生产环境** (`.env.production`)
```
VITE_APP_TITLE=Bitcoin Mining Master - Admin Dashboard
VITE_API_BASE_URL=/api
VITE_WS_URL=wss://your-domain.com
```

### API代理配置

开发环境下，Vite会自动代理 `/api` 请求到后端服务器（`vite.config.ts`）:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8888',
      changeOrigin: true,
    },
  },
}
```

## 🎨 主要页面

### 1. 仪表盘 (Dashboard)
- 核心指标卡片（总用户数、今日活跃、总收入、今日订单）
- 最近7日数据趋势表格
- 实时数据更新

### 2. 用户管理 (Users)
- 用户列表（支持搜索、筛选、分页）
- 用户详情查看
- 数据导出功能

### 3. 其他页面
各个功能模块的页面框架已搭建完成，具体功能待开发。

## 🛠️ 技术栈详解

### 核心依赖

| 依赖 | 版本 | 说明 |
|------|------|------|
| React | ^18.2.0 | UI框架 |
| TypeScript | ^5.2.2 | 类型系统 |
| Ant Design | ^5.12.0 | UI组件库 |
| React Router | ^6.20.0 | 路由管理 |
| Redux Toolkit | ^1.9.7 | 状态管理 |
| Axios | ^1.6.0 | HTTP客户端 |
| ECharts | ^5.4.3 | 图表库 |
| Vite | ^5.0.0 | 构建工具 |

### 开发依赖

- ESLint - 代码检查
- Prettier - 代码格式化
- TypeScript - 类型检查

## 📝 开发规范

### 命名规范

- **组件**: PascalCase (如 `UserList.tsx`)
- **函数**: camelCase (如 `formatDate`)
- **常量**: UPPER_SNAKE_CASE (如 `API_BASE_URL`)
- **CSS类**: kebab-case (如 `.user-list-item`)

### 代码规范

```bash
# 代码检查
npm run lint

# 代码格式化
npm run format
```

### Git提交规范

- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具变动

示例:
```bash
git commit -m "feat: 添加用户列表导出功能"
git commit -m "fix: 修复仪表盘数据加载问题"
```

## 🚢 部署指南

### Docker部署

```bash
# 构建镜像
docker build -t bitcoin-mining-web .

# 运行容器
docker run -d -p 80:80 bitcoin-mining-web
```

### Nginx部署

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/html;
    index index.html;
    
    # SPA路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API代理
    location /api {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 📚 API接口文档

### 用户相关

- `GET /api/users/list` - 获取用户列表
- `GET /api/users/:id` - 获取用户详情
- `GET /api/users/stats` - 获取用户统计
- `GET /api/users/export` - 导出用户数据

### 数据分析

- `GET /api/analytics/dau` - 获取DAU数据
- `GET /api/analytics/mau` - 获取MAU数据
- `GET /api/analytics/retention` - 获取留存数据
- `GET /api/analytics/behavior` - 获取用户行为数据

### 广告数据

- `GET /api/ads/list` - 获取广告列表
- `GET /api/ads/stats` - 获取广告统计
- `GET /api/ads/revenue` - 获取广告收入
- `GET /api/ads/:id/performance` - 获取广告表现

## 🤝 贡献指南

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: 添加某个功能'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 📄 许可证

MIT License

## 📮 联系方式

如有问题或建议，请联系开发团队。

---

**注意**: 当前版本为初始框架，各功能模块的详细实现正在开发中。
