# Bitcoin Mining Master API - Postman 测试指南

## 文件说明

本目录包含完整的 Postman 测试集合和环境配置：

- `Bitcoin_Mining_Master_API_Tests.postman_collection.json` - API 测试集合
- `Bitcoin_Mining_Master_Local.postman_environment.json` - 本地环境配置
- `Bitcoin_Mining_Master_Production.postman_environment.json` - 生产环境配置

## 导入步骤

### 1. 导入集合

1. 打开 Postman
2. 点击左上角 "Import" 按钮
3. 选择 `Bitcoin_Mining_Master_API_Tests.postman_collection.json`
4. 点击 "Import" 确认

### 2. 导入环境

1. 点击右上角齿轮图标（Manage Environments）
2. 点击 "Import" 按钮
3. 选择 `Bitcoin_Mining_Master_Local.postman_environment.json`
4. 选择 `Bitcoin_Mining_Master_Production.postman_environment.json`
5. 点击 "Import" 确认

### 3. 选择环境

在 Postman 右上角下拉菜单中选择：
- **Local** - 本地开发环境 (http://localhost:8888)
- **Production** - 生产服务器 (http://47.79.232.189:8888)

## 测试用例说明

### 1. Health Check（健康检查）
- **GET** `/api/health` - 检查服务器和数据库连接状态
- 无需认证
- 预期返回：`{ status: "ok", db: "connected" }`

### 2. Public APIs（公共接口）
- **GET** `/api/public/announcement` - 获取平台公告
- **GET** `/api/public/status` - 获取系统运行状态
- 无需认证

### 3. Authentication（认证）
- **POST** `/api/auth/login` - 用户登录
  - 请求体：`{ "username": "testuser", "password": "testpass123" }`
  - 返回 JWT Token，自动保存到环境变量
- **POST** `/api/auth/logout` - 用户登出

### 4. User Management（用户管理）
- **POST** `/api/users/register` - 注册新用户
  - 无需认证
  - 请求体：`{ "username": "newuser", "password": "newpass123", "email": "..." }`
- **GET** `/api/users` - 获取用户列表
  - **需要认证**（使用 Bearer Token）
  - 先执行登录获取 Token
- **GET** `/api/users` (未认证) - 测试认证失败场景
  - 预期返回 401/403

### 5. Rate Limiting Test（限流测试）
- **GET** `/api/public/status` (快速连续请求)
  - 测试限流机制
  - 超过限制后返回 429 Too Many Requests

### 6. Error Handling（错误处理）
- **GET** `/api/nonexistent` - 测试 404 错误
- **POST** `/api/auth/login` (空请求体) - 测试 400 错误

## 自动化测试

每个请求都包含自动化测试脚本，会自动验证：
- HTTP 状态码
- 响应体格式
- 数据完整性
- Token 自动保存

### 查看测试结果

1. 运行请求后，点击 "Test Results" 标签
2. 查看通过/失败的测试用例
3. 绿色勾号表示测试通过，红色叉号表示失败

## 运行整个集合

### 方式 1：手动运行
1. 点击集合名称右侧的 "..." 按钮
2. 选择 "Run collection"
3. 选择要运行的请求
4. 点击 "Run Bitcoin Mining Master API Tests"

### 方式 2：使用 Newman（命令行）

```bash
# 安装 Newman
npm install -g newman

# 运行本地环境测试
newman run Bitcoin_Mining_Master_API_Tests.postman_collection.json \
  -e Bitcoin_Mining_Master_Local.postman_environment.json

# 运行生产环境测试
newman run Bitcoin_Mining_Master_API_Tests.postman_collection.json \
  -e Bitcoin_Mining_Master_Production.postman_environment.json

# 生成 HTML 报告
newman run Bitcoin_Mining_Master_API_Tests.postman_collection.json \
  -e Bitcoin_Mining_Master_Local.postman_environment.json \
  -r html --reporter-html-export report.html
```

## 环境变量说明

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `base_url` | API 服务器地址 | `http://localhost:8888` |
| `token` | JWT 认证 Token | 自动从登录接口获取 |

## 测试流程建议

推荐按以下顺序执行测试：

1. **Health Check** - 确认服务正常
2. **Public APIs** - 测试无需认证的接口
3. **Authentication** - 登录获取 Token
4. **User Management** - 测试用户相关功能
5. **Rate Limiting** - 测试限流机制
6. **Error Handling** - 测试错误场景

## 注意事项

1. **Token 有效期**：默认 2 小时，过期后需重新登录
2. **限流规则**：根据 IP 限制，过多请求会触发 429 错误
3. **数据库连接**：确保 MySQL 和 Redis 服务正常运行
4. **端口占用**：确保 8888 端口未被其他程序占用

## 常见问题

### Q: 请求返回 ECONNREFUSED？
A: 检查 Node 服务是否启动：`pm2 status`

### Q: 认证失败？
A: 先执行登录请求获取 Token，确保 Token 已保存到环境变量

### Q: 数据库错误？
A: 检查 MySQL 和 Redis 连接状态：`GET /api/health`

### Q: 限流测试一直返回 200？
A: 需要在短时间内连续发送多次请求才会触发限流

## 扩展测试

你可以根据实际业务需求添加更多测试用例：

1. 挖矿相关接口测试
2. 用户信息管理测试
3. 管理员功能测试
4. 合约管理测试
5. 提现记录测试

只需在集合中添加新的文件夹和请求即可。

## 技术支持

如有问题，请检查：
1. PM2 服务状态：`pm2 status`
2. 服务日志：`pm2 logs`
3. 健康检查：`curl http://localhost:8888/api/health`
