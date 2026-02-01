# 🐳 Docker开发部署指南

## 📋 目录结构

```
Bitcoin_Mining_Master/
├── docker-compose.yml          # 开发环境配置
├── docker-compose.prod.yml     # 生产环境配置
├── .env.example                # 环境变量示例
├── backend/
│   ├── Dockerfile              # 生产环境镜像
│   ├── Dockerfile.dev          # 开发环境镜像
│   └── package.json
└── README_DOCKER.md            # 本文档
```

---

## 🚀 开发环境快速启动

### 1️⃣ 安装 Docker Desktop

**Mac:**
```bash
brew install --cask docker
# 或从官网下载: https://www.docker.com/products/docker-desktop
```

### 2️⃣ 启动开发环境

```bash
# 进入项目目录
cd Bitcoin_Mining_Master

# 复制环境变量文件
cp .env.example backend/.env

# 启动所有服务（首次启动会自动构建镜像）
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 查看所有服务状态
docker-compose ps
```

### 3️⃣ 访问服务

- **后端API**: http://localhost:8888/api/health
- **MySQL**: localhost:3306
  - 用户: `bitcoin`
  - 密码: `bitcoin_dev_123`
  - 数据库: `bitcoin_mining_master`
- **Redis**: localhost:6379
  - 密码: `dev_redis_123`

### 4️⃣ 开发流程

```bash
# 修改代码后自动热重载（无需重启）
# Docker会监听 backend/ 目录的文件变化

# 重启某个服务
docker-compose restart backend

# 停止所有服务
docker-compose down

# 停止并删除数据卷（清空数据库）
docker-compose down -v

# 重新构建镜像
docker-compose build --no-cache
```

### 5️⃣ 数据库管理

```bash
# 进入MySQL容器
docker exec -it bitcoin_mysql_dev mysql -u bitcoin -pbitcoin_dev_123 bitcoin_mining_master

# 导入SQL文件
docker exec -i bitcoin_mysql_dev mysql -u bitcoin -pbitcoin_dev_123 bitcoin_mining_master < backup.sql

# 导出数据库
docker exec bitcoin_mysql_dev mysqldump -u bitcoin -pbitcoin_dev_123 bitcoin_mining_master > backup.sql

# 查看Redis数据
docker exec -it bitcoin_redis_dev redis-cli -a dev_redis_123
```

---

## 🏭 生产环境部署

### 1️⃣ 准备生产环境变量

```bash
# 在服务器上创建 .env.production
cat > .env.production << 'EOF'
NODE_ENV=production
DB_ROOT_PASSWORD=你的超强密码123
DB_USER=bitcoin
DB_PASSWORD=你的数据库密码456
REDIS_PASSWORD=你的Redis密码789
JWT_SECRET=你的JWT密钥超长字符串
EOF
```

### 2️⃣ 上传代码到服务器

```bash
# 从Mac上传
rsync -avz --exclude 'node_modules' \
  Bitcoin_Mining_Master/ \
  root@47.79.232.189:/root/bitcoin-app/

# 或使用Git
ssh root@47.79.232.189
cd /root
git clone <your-repo-url> bitcoin-app
cd bitcoin-app
```

### 3️⃣ 部署生产环境

```bash
# SSH登录服务器
ssh root@47.79.232.189

# 安装Docker（如果未安装）
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 安装Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 启动生产环境
cd /root/bitcoin-app
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

### 4️⃣ 生产环境管理

```bash
# 更新代码后重新部署
git pull
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 备份数据库
docker exec bitcoin_mysql_prod mysqldump -u bitcoin -p'密码' bitcoin_mining_master > backup_$(date +%Y%m%d).sql

# 查看资源占用
docker stats

# 清理旧镜像
docker system prune -a
```

---

## 📊 迁移现有数据

### 从现有服务器迁移到Docker

```bash
# 1. 导出现有数据
ssh root@47.79.232.189
mysqldump -u root -pfe2c82a2e5b8e2a3 bitcoin_mining_master > /tmp/backup.sql

# 2. 停止旧服务
pm2 stop bitcoin-backend
systemctl stop mysql
systemctl stop redis

# 3. 启动Docker环境
docker-compose -f docker-compose.prod.yml up -d

# 4. 导入数据
docker exec -i bitcoin_mysql_prod mysql -u bitcoin -p'密码' bitcoin_mining_master < /tmp/backup.sql

# 5. 验证服务
curl http://localhost:8888/api/health
```

---

## 🔧 常见问题

### Q1: 端口冲突
```bash
# 查看端口占用
lsof -i :3306
lsof -i :8888

# 停止冲突服务
pm2 stop all
systemctl stop mysql
```

### Q2: 容器无法启动
```bash
# 查看详细日志
docker-compose logs backend

# 检查网络
docker network ls
docker network inspect bitcoin_network

# 重建容器
docker-compose down
docker-compose up -d --force-recreate
```

### Q3: 数据持久化
开发环境数据存储在Docker卷中：
```bash
# 查看卷
docker volume ls

# 备份卷
docker run --rm -v bitcoin_mining_master_mysql_data:/data -v $(pwd):/backup alpine tar czf /backup/mysql_backup.tar.gz /data
```

---

## ✅ 推荐工作流程

### 开发阶段（在Mac上）

1. 启动Docker开发环境
2. 使用Sequel Ace连接本地MySQL（localhost:3306）
3. 修改代码自动热重载
4. 提交代码到Git

### 部署阶段（在服务器上）

1. Git拉取最新代码
2. Docker Compose构建新镜像
3. 滚动更新服务（零停机）
4. 监控日志和性能

---

## 🎯 与当前方案对比

| 项目 | 当前方案 | Docker方案 |
|------|---------|-----------|
| 开发环境 | 云端运行 | 本地Docker |
| 数据库 | 云端MySQL | 本地/容器化 |
| 调试速度 | 网络延迟 | 毫秒级 |
| 数据隔离 | ❌ 共享生产数据 | ✅ 开发/生产分离 |
| 环境一致性 | ⚠️ 手动维护 | ✅ Docker保证 |
| 部署复杂度 | 中等 | 简单（一键部署） |
| 可扩展性 | 有限 | 易于水平扩展 |

---

## 📚 下一步

1. ✅ 安装Docker Desktop
2. ✅ 启动本地开发环境
3. ✅ 测试所有API功能
4. ✅ 迁移生产环境到Docker
5. ✅ 配置CI/CD自动化部署

有问题随时询问！🚀
