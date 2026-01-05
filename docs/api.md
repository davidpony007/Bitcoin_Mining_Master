# API 文档

## 认证相关接口

### 用户登录
- URL: `/api/auth/login`
- 方法: POST
- 请求体: `{ "username": "string", "password": "string" }`
- 返回: `{ message: "Login successful", token: "JWT_TOKEN" }`

### 用户登出
- URL: `/api/auth/logout`
- 方法: POST
- 请求头: `Authorization: Bearer <token>`
- 返回: `{ message: "Logout successful" }`

---

## 用户相关接口

### 获取所有用户（需认证）
- URL: `/api/users/`
- 方法: GET
- 请求头: `Authorization: Bearer <token>`
- 返回: `[ { id: 1, username: "alice" }, ... ]`

### 用户注册
- URL: `/api/users/register`
- 方法: POST
- 请求体: `{ "username": "string", "password": "string" }`
- 返回: `{ message: "User registered", username: "string" }`

---

## 挖矿相关接口

### 获取挖矿状态
- URL: `/api/mining/status`
- 方法: GET
- 返回: `{ mining: true, hashRate: 123.45 }`

### 开始挖矿
- URL: `/api/mining/start`
- 方法: POST
- 返回: `{ message: "Mining started" }`

---

## 管理员相关接口（需认证）

### 获取后台统计信息
- URL: `/api/admin/stats`
- 方法: GET
- 请求头: `Authorization: Bearer <token>`
- 返回: `{ users: 100, miningNodes: 10, revenue: 12345 }`

### 管理员操作
- URL: `/api/admin/action`
- 方法: POST
- 请求头: `Authorization: Bearer <token>`
- 返回: `{ message: "Admin action executed" }`

---

## 公共信息接口

### 获取公告
- URL: `/api/public/announcement`
- 方法: GET
- 返回: `{ announcement: "欢迎使用比特币挖矿平台！" }`

### 获取系统状态
- URL: `/api/public/status`
- 方法: GET
- 返回: `{ status: "running", uptime: 123.45 }`

---

## 健康检查接口

### 健康检查
- URL: `/api/health`
- 方法: GET
- 返回: `{ status: "ok", timestamp: 1234567890 }`
