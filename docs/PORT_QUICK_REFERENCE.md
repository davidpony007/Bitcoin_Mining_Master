# 🔌 端口配置快速参考

## 📊 端口总览表

| 端口 | 服务 | 状态 | 安全级别 | 建议 |
|------|------|------|----------|------|
| 80 | HTTP | ✅ 开启 | 🟡 中等 | 重定向到443 |
| 443 | HTTPS | ✅ 开启 | 🟢 安全 | 推荐使用 |
| 22 | SSH | ✅ 开启 | 🔴 高危 | 限制IP访问 |
| 8888 | Node.js API | ✅ 开启 | 🟡 中等 | 用Nginx代理 |
| 3306 | MySQL | ⚠️ 开启 | 🔴 极危 | **立即关闭外网** |
| 6379 | Redis | ⚠️ 开启 | 🔴 高危 | **立即关闭外网** |
| 8880 | PhpMyAdmin | ⚠️ 开启 | 🔴 高危 | 建议关闭 |
| 3000 | 开发服务器 | ❓ | 🟡 中等 | 生产环境关闭 |
| 2012 | 未知 | ❓ | ❓ | 排查用途 |

---

## 🚨 紧急安全建议

### 1. 立即关闭MySQL外网访问 (3306)
```bash
ssh root@47.79.232.189
vim /etc/mysql/my.cnf
# 添加: bind-address = 127.0.0.1
systemctl restart mysql
```

### 2. 立即关闭Redis外网访问 (6379)
```bash
vim /etc/redis/redis.conf
# 修改: bind 127.0.0.1
systemctl restart redis
```

### 3. 限制SSH访问 (22)
在阿里云安全组只允许您的IP访问22端口

---

## 🎯 项目端口映射

```
外网用户
   ↓
[80/443] Nginx ← Web前端
   ↓
[8888] Node.js ← API服务
   ↓
[3306] MySQL ← 数据存储
[6379] Redis ← 缓存
```

---

## 💡 使用SSH隧道替代直接访问

```bash
# MySQL
ssh -L 3306:localhost:3306 root@47.79.232.189

# Redis  
ssh -L 6379:localhost:6379 root@47.79.232.189

# PhpMyAdmin
ssh -L 8880:localhost:8880 root@47.79.232.189
```

---

**查看完整文档**: `/docs/PORT_CONFIGURATION_GUIDE.md`
