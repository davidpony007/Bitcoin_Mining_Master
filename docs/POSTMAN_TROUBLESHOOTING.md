# ⚠️ Postman 测试失败解决方案

## 🔴 问题诊断

您遇到的错误：
```
Error: read ECONNREFUSED
Could not send request
channel_setup_fwd_listener_tcpip: cannot listen to port: 8888
```

**根本原因**: 本地 8888 端口已被占用（有一个 Node 进程在使用）

---

## ✅ 解决方案（3选1）

### 方案 A: 使用不同的本地端口 ⭐ 推荐

#### 步骤 1: 建立 SSH 隧道到 9999 端口

在终端运行：
```bash
ssh -N -L 9999:localhost:8888 root@47.79.232.189
```

> 密码: `WHfe2c82a2e5b8e2a3`  
> 保持此窗口打开

#### 步骤 2: 修改 Postman 环境变量

1. 在 Postman 右上角点击环境下拉菜单
2. 编辑 "Bitcoin Mining - Production"
3. 修改 `base_url`:
   ```
   原值: http://localhost:8888
   新值: http://localhost:9999
   ```
4. 保存

#### 步骤 3: 测试连接

在新终端窗口运行：
```bash
curl http://localhost:9999/api/health
```

应该返回：
```json
{"status":"ok","db":"connected","timestamp":...}
```

#### 步骤 4: 在 Postman 中测试

点击 Send 按钮，应该成功了！

---

### 方案 B: 关闭占用 8888 端口的进程

#### 步骤 1: 查看占用端口的进程

```bash
lsof -i :8888
```

输出类似：
```
node    43209 davidpony   19u  IPv6 ... *:ddi-tcp-1 (LISTEN)
```

#### 步骤 2: 停止该进程

```bash
# 方式1: 优雅关闭
kill 43209

# 方式2: 强制关闭（如果方式1无效）
kill -9 43209
```

#### 步骤 3: 验证端口已释放

```bash
lsof -i :8888
# 应该没有输出
```

#### 步骤 4: 建立 SSH 隧道

```bash
ssh -N -L 8888:localhost:8888 root@47.79.232.189
```

#### 步骤 5: 在 Postman 中测试

使用原来的配置 `http://localhost:8888`

---

### 方案 C: 直接连接服务器 IP（需要端口开放）

如果云服务器 8888 端口已对外开放：

#### 步骤 1: 测试直连

```bash
curl http://47.79.232.189:8888/api/health
```

如果成功返回数据，说明可以直连。

#### 步骤 2: 修改 Postman 环境变量

1. 编辑 "Bitcoin Mining - Production" 环境
2. 修改 `base_url`:
   ```
   http://47.79.232.189:8888
   ```
3. 保存

#### 步骤 3: 在 Postman 中测试

直接点击 Send，无需 SSH 隧道

**注意**: 这种方式不安全，建议仅用于测试。

---

## 🎯 推荐的完整步骤（方案A）

### 1️⃣ 在终端建立隧道

```bash
# 新开一个终端窗口
ssh -N -L 9999:localhost:8888 root@47.79.232.189
# 输入密码: WHfe2c82a2e5b8e2a3
# 保持窗口打开
```

### 2️⃣ 验证隧道工作

```bash
# 新开另一个终端窗口
curl http://localhost:9999/api/health
```

应该看到：
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": 1732702800000
}
```

### 3️⃣ 更新 Postman 配置

在 Postman 中：
1. 右上角选择环境管理（齿轮图标旁边）
2. 点击 "Bitcoin Mining - Production"
3. 找到 `base_url` 变量
4. 修改为: `http://localhost:9999`
5. 点击 **Save**

### 4️⃣ 运行测试

1. 确保右上角选择了 "Bitcoin Mining - Production" 环境
2. 点击 "2️⃣ 创建用户 - 动态时间戳"
3. 点击蓝色 **Send** 按钮
4. 应该返回 201 状态码

---

## 🔍 验证步骤

### 检查 SSH 隧道状态

```bash
# 检查 9999 端口是否被 ssh 占用
lsof -i :9999

# 应该看到类似输出：
# ssh     98115 davidpony    3u  IPv6 ...  TCP localhost:9999 (LISTEN)
```

### 检查服务器 API 健康

```bash
# 通过隧道访问
curl http://localhost:9999/api/health

# 或通过 SSH 直接访问服务器
ssh root@47.79.232.189 "curl -s http://127.0.0.1:8888/api/health"
```

---

## 📊 测试用例 JSON（使用 9999 端口）

如果想直接修改 Postman Collection JSON，可以替换：

### 创建新环境变量文件

```json
{
  "id": "bmm-env-production-9999",
  "name": "Bitcoin Mining - Production (Port 9999)",
  "values": [
    {
      "key": "base_url",
      "value": "http://localhost:9999",
      "type": "default",
      "enabled": true
    },
    {
      "key": "server_ip",
      "value": "47.79.232.189",
      "type": "default",
      "enabled": true
    }
  ]
}
```

保存为 `Bitcoin_Mining_Production_9999.postman_environment.json`，然后导入 Postman。

---

## 🐛 常见问题

### Q1: SSH 隧道断开

**症状**: Postman 请求突然失败

**解决**: 
```bash
# 重新建立隧道
ssh -N -L 9999:localhost:8888 root@47.79.232.189
```

### Q2: 密码输入后立即断开

**症状**: 输入密码后连接立即关闭

**原因**: 可能是服务器 SSH 配置问题

**解决**: 
```bash
# 添加详细日志查看原因
ssh -v -N -L 9999:localhost:8888 root@47.79.232.189
```

### Q3: curl 测试失败

**症状**: `curl: (7) Failed to connect to localhost port 9999`

**原因**: SSH 隧道未成功建立

**解决**: 
```bash
# 检查隧道进程
ps aux | grep "ssh -N -L"

# 如果没有输出，重新建立隧道
ssh -N -L 9999:localhost:8888 root@47.79.232.189
```

---

## 💡 快速测试脚本

创建文件 `test_postman_connection.sh`:

```bash
#!/bin/bash

echo "🔍 检查端口占用情况..."
echo "8888 端口:"
lsof -i :8888 | grep LISTEN || echo "  ✅ 未被占用"
echo ""
echo "9999 端口:"
lsof -i :9999 | grep LISTEN || echo "  ✅ 未被占用"
echo ""

echo "🔗 测试 SSH 隧道连接..."
echo "测试 localhost:9999..."
curl -s -m 5 http://localhost:9999/api/health | python3 -m json.tool 2>/dev/null && echo "✅ 连接成功！" || echo "❌ 连接失败"
echo ""

echo "🌐 测试直连服务器..."
curl -s -m 5 http://47.79.232.189:8888/api/health | python3 -m json.tool 2>/dev/null && echo "✅ 直连成功！" || echo "❌ 直连失败（正常，端口可能未开放）"
echo ""

echo "📊 建议:"
if lsof -i :9999 | grep -q LISTEN; then
    echo "  ✅ SSH 隧道已建立在 9999 端口"
    echo "  ➡️  在 Postman 中使用: http://localhost:9999"
else
    echo "  ⚠️  SSH 隧道未建立"
    echo "  ➡️  请运行: ssh -N -L 9999:localhost:8888 root@47.79.232.189"
fi
```

使用方法：
```bash
chmod +x test_postman_connection.sh
./test_postman_connection.sh
```

---

## 📚 相关文档

- [Postman 完整配置指南](./POSTMAN_COMPLETE_GUIDE.md)
- [Postman 快速开始](./POSTMAN_SETUP_SUMMARY.md)
- [Postman 使用说明](./postman/README.md)

---

**更新时间**: 2025-11-27  
**问题**: 本地 8888 端口被占用  
**解决方案**: 使用 9999 端口建立 SSH 隧道
