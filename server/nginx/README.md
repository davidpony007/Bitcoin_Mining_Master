# Nginx + Docker 部署指南

## 架构说明
- **Nginx**：反向代理、负载均衡、限流、SSL 终结
- **Backend 实例 × 2**：Node.js API 服务（端口 8888、8889）
- **Worker**：异步任务处理（Bull Queue）
- **Redis**：实时余额缓存、队列、会话
- **MySQL**：持久化存储

---

## 快速开始

### 1. 配置环境变量
```bash
cd server/docker
cp .env.example .env
# 编辑 .env 填写密码和密钥
```

### 2. 准备 SSL 证书（生产必需）
```bash
# 方式一：Let's Encrypt（推荐）
sudo certbot certonly --webroot -w /var/www/certbot -d your-domain.com

# 方式二：自签名（测试）
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/privkey.pem -out ssl/fullchain.pem
```

### 3. 构建前端
```bash
cd ../../web_frontend
npm install
npm run build
```

### 4. 启动服务
```bash
cd ../server/docker
docker-compose up -d
```

### 5. 查看日志
```bash
docker-compose logs -f
```

---

## Nginx 配置说明

### 限流策略
- **API 接口**：60 次/分钟，突发 10 次
- **登录接口**：5 次/分钟，突发 2 次
- **并发连接**：单 IP 最多 10 个

### 负载均衡
- 算法：`least_conn`（最少连接数）
- 后端实例：8888、8889 端口
- 健康检查：3 次失败后摘除 30 秒

### 静态资源
- 前端构建产物：缓存 1 天
- 图片/字体：缓存 30 天
- Gzip 压缩：开启

---

## 扩容指南

### 增加后端实例
1. 编辑 `docker-compose.yml` 添加 `backend-3`
2. 编辑 `nginx.conf` 在 `upstream backend_nodes` 添加 `server 127.0.0.1:8890`
3. 重启：`docker-compose up -d --scale backend=3`

### 监控与告警
- Nginx 日志：`server/docker/logs/nginx/`
- 后端日志：`docker-compose logs backend-1`
- 健康检查：`curl https://your-domain.com/api/health`

---

## 故障排查

### 502 Bad Gateway
- 检查后端是否启动：`docker-compose ps`
- 查看后端日志：`docker-compose logs backend-1`

### 429 Too Many Requests
- 正常限流行为，可在 `nginx.conf` 调整 `rate` 和 `burst`

### SSL 证书错误
- 确认证书路径正确
- 测试环境可使用自签名证书

---

## 生产优化建议

1. **数据库连接池**：Sequelize `pool` 设置为 `{ max: 10, min: 2 }`
2. **Redis 持久化**：已启用 AOF
3. **日志轮转**：配置 logrotate
4. **监控**：接入 Prometheus + Grafana
5. **备份**：定时备份 MySQL 和 Redis

---

## 安全检查清单
- [ ] 修改所有默认密码
- [ ] 启用 HTTPS（Let's Encrypt）
- [ ] 配置防火墙（只开放 80/443）
- [ ] 定期更新依赖（`npm audit fix`）
- [ ] 启用 fail2ban（防暴力破解）
