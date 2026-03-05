# API 连接配置说明

## 当前配置

### 后端服务
- **端口**: 8888
- **数据库**: MySQL (端口 3307，通过SSH隧道)
- **缓存**: Redis (端口 16379，通过SSH隧道)
- **JWT认证**: 已配置

### 前端配置
- **开发端口**: 3000
- **API代理**: `/api` → `http://localhost:8888`
- **WebSocket**: `ws://localhost:8888`

## 环境变量配置

### 开发环境 (.env.development)
```env
VITE_API_BASE_URL=http://localhost:8888/api
VITE_WS_URL=ws://localhost:8888
```

### 生产环境 (.env.production)
```env
VITE_API_BASE_URL=https://api.yourdomain.com/api
VITE_WS_URL=wss://api.yourdomain.com
```

### 本地覆盖 (.env.local)
如需覆盖默认配置，创建 `.env.local` 文件（此文件不会提交到Git）

## API 代理配置

在 `vite.config.ts` 中已配置代理：

```typescript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:8888',
      changeOrigin: true,
    },
  },
}
```

**优点**：
- 开发时无需CORS配置
- 自动转发 `/api/*` 请求到后端
- 支持Cookie和认证头

## API 请求示例

### 使用封装的request服务

```typescript
import request from '@/services/api/request';

// GET 请求
const users = await request.get('/users');

// POST 请求
const result = await request.post('/login', {
  username: 'admin',
  password: '123456'
});

// 带token的请求（自动处理）
const profile = await request.get('/user/profile');
```

### 直接使用Axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});
```

## 后端API路由

根据后端服务，主要API端点：

### 用户相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/users` - 获取用户列表
- `GET /api/users/:id` - 获取用户详情
- `PUT /api/users/:id` - 更新用户信息
- `DELETE /api/users/:id` - 删除用户

### 挖矿相关
- `GET /api/mining/stats` - 挖矿统计
- `GET /api/mining/contracts` - 合约列表
- `POST /api/mining/contracts` - 创建合约
- `GET /api/mining/hashrate` - 算力数据

### 积分相关
- `GET /api/points/balance` - 积分余额
- `POST /api/points/add` - 添加积分
- `GET /api/points/history` - 积分历史

### 签到相关
- `POST /api/checkin` - 用户签到
- `GET /api/checkin/status` - 签到状态
- `GET /api/checkin/history` - 签到历史

### 广告相关
- `GET /api/ads` - 广告列表
- `POST /api/ads/watch` - 观看广告
- `GET /api/ads/stats` - 广告统计

## 启动服务

### 1. 启动后端服务

```bash
cd backend
npm run dev
# 或
pm2 start ecosystem.config.js
```

### 2. 启动前端开发服务器

```bash
cd web_frontend
npm run dev
```

### 3. 访问应用

- 前端地址: http://localhost:3000
- 后端API: http://localhost:8888/api
- API文档: http://localhost:8888/api-docs (如已配置)

## 调试技巧

### 1. 查看网络请求
打开浏览器开发者工具 → Network 标签页

### 2. 查看API响应
```typescript
// 在 request.ts 中已配置响应拦截器
// 所有API错误会自动显示在控制台
```

### 3. 检查后端服务状态

```bash
# 查看后端进程
pm2 status

# 查看后端日志
pm2 logs

# 测试API连接
curl http://localhost:8888/api/health
```

### 4. CORS问题

如遇到CORS错误，检查后端 `.env` 配置：

```env
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

确保包含前端开发服务器地址。

## 生产部署

### 1. 构建前端

```bash
cd web_frontend
npm run build
```

生成的文件在 `dist/` 目录

### 2. 配置Nginx

```nginx
server {
  listen 80;
  server_name yourdomain.com;
  
  # 前端静态文件
  root /path/to/web_frontend/dist;
  index index.html;
  
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
  
  # WebSocket代理
  location /ws {
    proxy_pass http://localhost:8888;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
  }
}
```

### 3. 配置HTTPS

```bash
# 使用 Let's Encrypt 获取免费SSL证书
certbot --nginx -d yourdomain.com
```

更新前端环境变量：
```env
VITE_API_BASE_URL=https://yourdomain.com/api
VITE_WS_URL=wss://yourdomain.com/ws
```

## 常见问题

### Q1: API请求401未授权
**解决**: 检查token是否正确存储，登录接口是否返回token

### Q2: 网络请求失败
**解决**: 
1. 检查后端服务是否启动
2. 检查端口是否正确
3. 查看浏览器控制台错误信息

### Q3: WebSocket连接失败
**解决**: 检查后端WebSocket配置，确认端口和协议正确

### Q4: 代理不生效
**解决**: 重启Vite开发服务器（修改vite.config.ts后需重启）

## 监控和日志

### 前端日志
- 浏览器控制台：Network、Console标签页
- Redux DevTools：查看状态变化

### 后端日志
```bash
# PM2日志
pm2 logs backend

# 实时日志
tail -f logs/app.log
```

## 更新记录

- 2026-01-29: 初始配置，连接真实后端API (localhost:8888)
