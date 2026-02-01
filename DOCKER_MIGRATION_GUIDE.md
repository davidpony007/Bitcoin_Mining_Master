# 🚀 Docker完全容器化迁移指南

## 📊 迁移方案对比

### 当前架构（混合模式）

```
☁️ 云端服务器 47.79.232.189:
├── PM2 管理 Node.js 后端 (8888)
├── MySQL 5.7 (systemd管理)
├── Redis 6 (systemd管理)
└── 没有Nginx/Cloudflare只是DNS

🏠 本地Mac:
└── Docker开发环境
```

### 目标架构（完全Docker化）

```
☁️ 云端服务器 47.79.232.189:
├── Docker Compose管理所有服务
│   ├── Nginx容器 (80/443) → 反向代理
│   ├── Backend容器 (8888内部)
│   ├── MySQL容器 (内部3306)
│   └── Redis容器 (内部6379)
└── Cloudflare CDN (可选)

🏠 本地Mac:
└── 同样的Docker Compose（开发配置）
```

---

## ✅ 迁移的优势

### 使用Docker完全容器化后：

1. **环境一致性** ✨
   - 开发、测试、生产环境完全一致
   - "在我机器上能跑"问题彻底解决

2. **部署简化** 🚀
   - 一键部署：`docker-compose up -d`
   - 一键回滚：`docker-compose down && docker-compose up -d`

3. **资源隔离** 🔒
   - 每个服务独立容器
   - 崩溃不会影响其他服务
   - 资源限制和监控更方便

4. **扩展性** 📈
   - 轻松添加新服务（如消息队列、缓存）
   - 水平扩展：多个Backend容器+负载均衡

5. **维护简单** 🛠️
   - 不再需要PM2
   - 不再需要手动管理systemd服务
   - 统一的日志管理

---

## 📋 迁移步骤

### 阶段1️⃣：准备工作（30分钟）

#### 1. 备份现有数据
```bash
# SSH登录服务器
ssh root@47.79.232.189

# 备份MySQL数据
mysqldump -u root -pfe2c82a2e5b8e2a3 bitcoin_mining_master > /root/backup_before_docker.sql

# 备份Redis数据
cp /var/lib/redis/dump.rdb /root/backup_redis.rdb

# 备份.env配置
cp /root/bitcoin-backend/.env /root/backup.env
```

#### 2. 准备生产环境变量
```bash
# 在服务器上创建 .env.production
cat > /root/bitcoin-app/.env.production << 'EOF'
DB_ROOT_PASSWORD=超强密码123abc!@#
DB_USER=bitcoin
DB_PASSWORD=数据库密码456def$%^
REDIS_PASSWORD=Redis密码789ghi&*(
JWT_SECRET=jwt超长密钥至少32位字符串abcdefghijklmnopqrstuvwxyz123456
EOF

chmod 600 /root/bitcoin-app/.env.production
```

#### 3. 安装Docker（如果未安装）
```bash
# 安装Docker和Docker Compose
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 验证安装
docker --version
docker compose version
```

---

### 阶段2️⃣：部署Docker环境（20分钟）

#### 1. 上传代码到服务器
```bash
# 从你的Mac上传
cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master
rsync -avz --exclude 'node_modules' --exclude '.git' \
  . root@47.79.232.189:/root/bitcoin-app/
```

#### 2. 在服务器上构建和启动
```bash
ssh root@47.79.232.189

cd /root/bitcoin-app

# 构建镜像
docker compose -f docker-compose.prod.yml build

# 启动服务（先不停旧服务，双运行测试）
docker compose -f docker-compose.prod.yml up -d

# 查看服务状态
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

#### 3. 导入数据
```bash
# 导入MySQL数据
docker exec -i bitcoin_mysql_prod mysql -u bitcoin -p数据库密码 bitcoin_mining_master < /root/backup_before_docker.sql

# 验证数据
docker exec bitcoin_mysql_prod mysql -u bitcoin -p数据库密码 -e "SELECT COUNT(*) FROM bitcoin_mining_master.user_information;"
```

---

### 阶段3️⃣：切换流量（10分钟）

#### 1. 测试Docker环境
```bash
# 测试健康检查
curl http://localhost/health

# 测试API
curl http://localhost/api/health

# 应该返回: {"status":"ok","db":"connected"}
```

#### 2. 修改Nginx端口映射（双运行模式）
```bash
# Docker Nginx现在运行在80端口
# 旧的PM2后端运行在8888端口

# 测试Docker API（通过Nginx）
curl http://47.79.232.189/api/health

# 测试旧API（直接访问）
curl http://47.79.232.189:8888/api/health
```

#### 3. 更新Flutter应用配置
修改 `lib/core/constants/app_constants.dart`:
```dart
// 从旧配置
static const String _productionUrl = 'http://47.79.232.189:8888/api';

// 改为新配置（通过Nginx，去掉8888端口）
static const String _productionUrl = 'http://47.79.232.189/api';
```

重新打包APK并发布更新。

---

### 阶段4️⃣：停止旧服务（5分钟）

**重要：确保新环境运行稳定至少24小时后再执行！**

```bash
ssh root@47.79.232.189

# 停止PM2服务
pm2 stop bitcoin-backend
pm2 delete bitcoin-backend
pm2 save

# 停止旧的MySQL和Redis
systemctl stop mysql
systemctl stop redis
systemctl disable mysql
systemctl disable redis

# 验证Docker服务正常
docker compose -f /root/bitcoin-app/docker-compose.prod.yml ps
```

---

## 🎯 关于PM2、Nginx、Cloudflare的说明

### PM2 进程管理器

**在Docker环境中不需要PM2！**

原因：
- ✅ Docker自己管理容器生命周期（restart: always）
- ✅ Docker Compose管理多个服务
- ✅ 开发环境用nodemon热重载
- ✅ 生产环境直接`node src/index.js`

**对比：**
```bash
# 旧方式（PM2）
pm2 start src/index.js --name bitcoin-backend
pm2 restart bitcoin-backend
pm2 logs bitcoin-backend

# 新方式（Docker）
docker compose restart backend
docker compose logs -f backend
```

---

### Nginx 反向代理

**已包含在Docker Compose中！**

配置文件：`nginx/nginx.conf`

功能：
- ✅ 反向代理：隐藏后端真实端口
- ✅ 负载均衡：支持多个Backend容器
- ✅ SSL终止：HTTPS证书配置
- ✅ Gzip压缩：减少流量
- ✅ 静态文件：未来可托管前端页面

**端口映射：**
```
外部80端口 → Nginx容器80端口 → Backend容器8888端口
```

**启用HTTPS：**
```bash
# 1. 获取SSL证书（Let's Encrypt）
docker run -it --rm \
  -v /root/bitcoin-app/nginx/ssl:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d your-domain.com

# 2. 修改nginx/nginx.conf，取消HTTPS server注释
# 3. 重启Nginx
docker compose -f docker-compose.prod.yml restart nginx
```

---

### Cloudflare CDN服务

**Cloudflare不需要迁移，它是外部服务！**

Cloudflare的作用：
- 🌐 **DNS管理**：域名解析到你的服务器IP
- 🚀 **CDN加速**：全球节点缓存，加速访问
- 🔒 **DDoS防护**：免费基础防护
- 🔐 **SSL证书**：免费的HTTPS证书
- 📊 **流量分析**：访问统计

**配置步骤：**

1. **添加域名到Cloudflare**
   - 登录 cloudflare.com
   - 添加站点（例如：btcmining.com）
   - 修改域名DNS服务器为Cloudflare提供的NS

2. **添加DNS记录**
   ```
   类型: A
   名称: @ 或 api
   内容: 47.79.232.189
   代理状态: ✅ 已代理（橙色云朵）
   ```

3. **SSL/TLS设置**
   - SSL/TLS模式：完全（严格）或 灵活
   - 始终使用HTTPS：开启
   - 最小TLS版本：TLS 1.2

4. **防火墙规则**（可选）
   - 阻止恶意IP
   - 国家访问限制
   - 速率限制

**使用Cloudflare后的架构：**
```
用户手机 📱
    ↓
Cloudflare CDN 🌐
    ↓
Nginx容器 (47.79.232.189:80/443)
    ↓
Backend容器 (内部:8888)
    ↓
MySQL + Redis 容器
```

---

## 🎛️ Docker vs 传统方式对比

| 特性 | 传统方式 | Docker方式 |
|------|---------|-----------|
| **进程管理** | PM2 | Docker自动重启 |
| **服务启动** | `pm2 start`, `systemctl start` | `docker compose up -d` |
| **日志查看** | `pm2 logs`, `/var/log/` | `docker compose logs -f` |
| **配置更新** | 修改多个配置文件 | 修改docker-compose.yml |
| **依赖管理** | 手动安装Node/MySQL/Redis | Docker镜像包含所有依赖 |
| **环境隔离** | 全局安装，可能冲突 | 每个服务独立容器 |
| **资源限制** | 手动配置cgroups | Docker简单配置 |
| **备份恢复** | 手动脚本 | 数据卷快照 |
| **扩展部署** | 复杂配置 | 修改replicas即可 |

---

## 📊 资源配置建议

### 服务器配置要求

**最低配置（当前架构）：**
- CPU: 2核
- 内存: 2GB
- 磁盘: 40GB

**推荐配置（Docker + Nginx + 留有余量）：**
- CPU: 4核
- 内存: 4GB
- 磁盘: 60GB SSD

### Docker容器资源限制

在`docker-compose.prod.yml`中添加：
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '1'
          memory: 512M
```

---

## 🔧 常见问题

### Q1: 迁移后性能会下降吗？
**A:** 不会。Docker的开销很小（< 5%），Nginx反向代理还能提升性能。

### Q2: 如何回滚到旧环境？
**A:**
```bash
docker compose -f docker-compose.prod.yml down
pm2 start bitcoin-backend
systemctl start mysql redis
```

### Q3: 如何查看容器占用的资源？
**A:**
```bash
docker stats
```

### Q4: 数据会丢失吗？
**A:** 不会，Docker卷持久化数据。即使删除容器，数据仍在。

### Q5: 能同时运行旧环境和Docker环境吗？
**A:** 可以！让Docker Nginx用80端口，旧后端继续用8888端口，逐步迁移。

---

## 📅 迁移时间线建议

### 保守方案（推荐）

1. **第1天**：本地测试Docker环境完整性
2. **第2天**：服务器部署Docker，与旧环境并行运行
3. **第3-5天**：少量测试用户切换到Docker环境
4. **第6-7天**：监控稳定性，调优配置
5. **第8天**：发布新版APK，全量切换
6. **第9天**：停止旧服务

### 激进方案（不推荐新手）

1. **周五晚**：部署Docker环境
2. **周六凌晨**：切换流量，停止旧服务
3. **周六白天**：监控和修复问题

---

## ✅ 迁移检查清单

### 迁移前
- [ ] 已完整备份MySQL数据
- [ ] 已完整备份Redis数据
- [ ] 已备份所有配置文件
- [ ] 已测试本地Docker环境
- [ ] 已准备回滚方案

### 迁移中
- [ ] Docker镜像构建成功
- [ ] 所有容器正常启动
- [ ] 健康检查通过
- [ ] 数据导入成功
- [ ] API测试通过

### 迁移后
- [ ] 运行24小时无异常
- [ ] 日志无错误
- [ ] 性能监控正常
- [ ] 用户反馈正常
- [ ] 旧服务已停止

---

## 🎉 完成迁移后的管理

### 日常操作
```bash
# 查看服务状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f backend

# 重启服务
docker compose -f docker-compose.prod.yml restart backend

# 更新代码
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# 备份数据库
docker exec bitcoin_mysql_prod mysqldump -u bitcoin -p密码 bitcoin_mining_master > backup.sql
```

---

需要帮助随时问我！🚀
