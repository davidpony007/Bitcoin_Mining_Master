# Bitcoin Mining Master - 开发和部署指南

## 📱 网络配置说明

### 理解 localhost 的概念

#### 1️⃣ **电脑的 localhost**
- 地址：`http://localhost:8888` 或 `http://127.0.0.1:8888`
- 含义：电脑**自己**的本地地址
- 访问范围：只有这台电脑能访问
- 后端运行在：电脑的 8888 端口

#### 2️⃣ **手机的 localhost**  
- 地址：`http://localhost:8888`
- 含义：手机**自己**的本地地址
- 默认情况：手机的 localhost 指向手机本身，**无法访问电脑**
- 问题：如果APP直接访问 localhost，会连接失败！

#### 3️⃣ **解决方案：ADB端口转发**
```bash
adb reverse tcp:8888 tcp:8888
```
- 作用：让手机访问 `localhost:8888` 时，实际访问**电脑的** localhost:8888
- 原理：建立手机→电脑的端口映射通道
- 优点：代码无需修改，手机和电脑使用相同URL

---

## 🛠️ 测试环境设置（本地开发）

### 方案A：ADB端口转发（推荐）✅

**前提条件：**
- 手机通过USB连接到电脑
- 已安装ADB工具
- 手机开启开发者模式和USB调试

**步骤：**

1. **启动后端服务**
```bash
cd backend
pm2 start src/index.js --name bitcoin-backend
# 或者
npm start
```

2. **设置ADB端口转发**
```bash
adb reverse tcp:8888 tcp:8888
```

3. **验证端口转发**
```bash
adb reverse --list
# 应该看到：tcp:8888 tcp:8888
```

4. **安装并运行APP**
```bash
cd android_clent/bitcoin_mining_master
flutter build apk --release
adb install -r build/app/outputs/flutter-apk/app-release.apk
adb shell monkey -p com.cloudminingtool.bitcoin_mining_master 1
```

**代码配置：**
```dart
// lib/constants/app_constants.dart
static const String _developmentUrl = 'http://localhost:8888/api';
```

**优点：**
- 无需查找IP地址
- 代码简洁统一
- 自动处理端口映射

**缺点：**
- 必须USB连接
- 每次手机重连需重新执行 `adb reverse`

---

### 方案B：WiFi局域网IP（备选）

**前提条件：**
- 手机和电脑连接同一WiFi网络
- 电脑防火墙允许8888端口访问

**步骤：**

1. **查看电脑IP地址**

Mac/Linux:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# 例如：192.168.1.100
```

Windows:
```bash
ipconfig
# 查找 IPv4 地址
```

2. **修改代码配置**
```dart
// lib/constants/app_constants.dart
static const String _developmentWifiUrl = 'http://192.168.1.100:8888/api';

// 在 baseUrl getter 中使用
return _developmentWifiUrl;
```

3. **启动后端并允许外部访问**
```bash
cd backend
pm2 start src/index.js --name bitcoin-backend
```

4. **测试连接**
```bash
# 在手机浏览器访问
http://192.168.1.100:8888/api/bitcoin/price
```

**优点：**
- 无需USB连接
- 支持无线调试
- 多设备同时测试

**缺点：**
- IP地址可能变化
- 需要修改代码
- 防火墙可能阻止

---

## 🚀 生产环境部署

### 1. 准备云服务器

**推荐平台：**
- 阿里云 ECS
- 腾讯云 CVM  
- AWS EC2
- DigitalOcean

**配置要求：**
- CPU: 2核以上
- 内存: 4GB以上
- 系统: Ubuntu 20.04 LTS
- 网络: 公网IP + 域名

### 2. 部署后端

**安装依赖：**
```bash
# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装PM2
sudo npm install -g pm2

# 安装MySQL
sudo apt-get install mysql-server

# 安装Redis
sudo apt-get install redis-server
```

**上传代码：**
```bash
# 使用git
git clone your-repository.git
cd backend
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写生产环境配置
```

**启动服务：**
```bash
pm2 start src/index.js --name bitcoin-backend
pm2 startup  # 设置开机自启
pm2 save
```

### 3. 配置域名和HTTPS

**购买域名：**
- 阿里云、腾讯云、Godaddy等

**DNS解析：**
```
A记录: api.yourdomain.com -> 服务器公网IP
```

**安装Nginx：**
```bash
sudo apt-get install nginx
```

**配置SSL证书（Let's Encrypt）：**
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

**Nginx配置示例：**
```nginx
# /etc/nginx/sites-available/bitcoin-api
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 4. 更新APP配置

**修改生产环境URL：**
```dart
// lib/constants/app_constants.dart
static const String _productionUrl = 'https://api.yourdomain.com/api';
```

**构建正式版APK：**
```bash
cd android_clent/bitcoin_mining_master
flutter build apk --release
```

**生成的APK位置：**
```
build/app/outputs/flutter-apk/app-release.apk
```

---

## 🔍 调试技巧

### 查看后端日志
```bash
# PM2日志
pm2 logs bitcoin-backend

# 实时日志
pm2 logs bitcoin-backend --lines 100
```

### 查看手机日志
```bash
# 清空旧日志
adb logcat -c

# 实时查看Flutter日志
adb logcat -s "flutter:I"

# 查看网络错误
adb logcat | grep -E "DioException|Network|连接"
```

### 测试API连接
```bash
# 测试本地
curl http://localhost:8888/api/bitcoin/price

# 测试生产
curl https://api.yourdomain.com/api/bitcoin/price
```

### 检查端口转发
```bash
# 查看端口转发列表
adb reverse --list

# 查看后端监听状态
netstat -an | grep 8888 | grep LISTEN
```

---

## 📋 快速命令参考

### 开发环境启动流程
```bash
# 1. 启动后端
cd backend && pm2 start src/index.js --name bitcoin-backend

# 2. 设置端口转发
adb reverse tcp:8888 tcp:8888

# 3. 构建并安装APP
cd android_clent/bitcoin_mining_master
flutter build apk --release
adb install -r build/app/outputs/flutter-apk/app-release.apk

# 4. 启动APP
adb shell monkey -p com.cloudminingtool.bitcoin_mining_master 1
```

### 生产环境发布流程
```bash
# 1. 更新代码
git pull origin main

# 2. 安装依赖
cd backend && npm install

# 3. 重启服务
pm2 restart bitcoin-backend

# 4. 查看状态
pm2 status
pm2 logs bitcoin-backend --lines 50
```

---

## ❓ 常见问题

### Q1: 手机显示"Network Connection Error"
**A:** 检查以下项目：
1. 后端是否运行：`pm2 status`
2. 端口转发是否设置：`adb reverse --list`
3. 手机是否USB连接
4. 查看日志：`adb logcat -s "flutter:I"`

### Q2: adb reverse 后仍然无法连接
**A:** 
1. 重新插拔USB线
2. 重新执行：`adb reverse tcp:8888 tcp:8888`
3. 检查手机USB调试权限
4. 尝试：`adb kill-server && adb start-server`

### Q3: 生产环境如何切换
**A:** 
```dart
// 修改 lib/constants/app_constants.dart
static const String _productionUrl = 'https://your-domain.com/api';
```
然后重新构建：`flutter build apk --release`

### Q4: 如何查看真实的请求URL
**A:** 
查看后端日志：
```bash
pm2 logs bitcoin-backend | grep "GET\|POST"
```

---

## 📞 技术支持

如有问题，请查看：
1. 后端日志：`pm2 logs bitcoin-backend`
2. 手机日志：`adb logcat`
3. 网络状态：`adb reverse --list`

---

**最后更新：2026年1月28日**
