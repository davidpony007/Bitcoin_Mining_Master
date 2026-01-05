# 🚀 Postman 测试 - 快速修复指南

## ✅ 问题已诊断

- ❌ **问题**: 本地 8888 端口被本地 PM2 占用
- ✅ **已解决**: 本地 PM2 已停止
- ⏳ **待完成**: 建立 SSH 隧道

---

## 📋 现在请按以下步骤操作

### 步骤 1: 建立 SSH 隧道

**在当前 VS Code 终端中运行**:

```bash
ssh -N -L 8888:localhost:8888 root@47.79.232.189
```

**然后输入密码**: `WHfe2c82a2e5b8e2a3`

> **⚠️ 重要**: 
> - 运行后终端会**卡住不动**，这是**正常的**！
> - 不要关闭这个终端窗口
> - 隧道会在后台持续工作

---

### 步骤 2: 验证隧道是否工作

**新开一个终端窗口** (Terminal → New Terminal)，运行:

```bash
curl http://localhost:8888/api/health
```

**预期输出**:
```json
{"status":"ok","db":"connected","timestamp":1732702800000}
```

如果看到这个输出，说明隧道成功！✅

---

### 步骤 3: 在 Postman 中测试

1. 确保 SSH 隧道窗口保持打开
2. 打开 Postman
3. 右上角选择环境: **"Bitcoin Mining - Production"**
4. 确认 `base_url` 是 `http://localhost:8888`
5. 点击 **"2️⃣ 创建用户 - 动态时间戳"**
6. 点击蓝色 **Send** 按钮

**预期结果**:
- 状态码: `201 Created`
- 响应包含 `"success": true`
- 返回新创建的用户数据

---

### 步骤 4: 验证用户已创建

**在 MySQL 中查询**:

```bash
ssh root@47.79.232.189
# 输入密码后运行:
mysql -u bitcoin_mining_master -pFzFbWmwMptnN3ABE -e "
USE bitcoin_mining_master;
SELECT id, user_id, email, country, user_creation_time 
FROM user_information 
ORDER BY user_creation_time DESC 
LIMIT 5;
"
```

应该能看到刚才创建的用户！

---

## 🔧 一键测试脚本

### 方式 1: 直接在服务器上创建用户（不需要隧道）

```bash
ssh root@47.79.232.189 << 'EOF'
TIMESTAMP=$(date +%s%3N)
echo "创建用户 ID: U${TIMESTAMP}"
echo ""
curl -X POST http://127.0.0.1:8888/api/users \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"U${TIMESTAMP}\",
    \"email\": \"test${TIMESTAMP}@example.com\",
    \"register_ip\": \"127.0.0.1\",
    \"country\": \"CN\"
  }" | python -m json.tool 2>/dev/null

echo ""
echo "验证用户已创建:"
mysql -u bitcoin_mining_master -pFzFbWmwMptnN3ABE -e "
USE bitcoin_mining_master;
SELECT id, user_id, email, country 
FROM user_information 
WHERE user_id = 'U${TIMESTAMP}';
" 2>/dev/null
EOF
```

---

## 📊 命令速查

| 命令 | 用途 |
|------|------|
| `ssh -N -L 8888:localhost:8888 root@47.79.232.189` | 建立隧道 |
| `curl http://localhost:8888/api/health` | 测试隧道 |
| `lsof -i :8888` | 检查端口 |
| `pm2 list` | 查看 PM2 状态 |
| `pm2 stop all` | 停止所有 PM2 进程 |

---

## 🎯 Postman 测试数据示例

### 测试 1: 完整用户信息
```json
{
  "user_id": "U1732702800001",
  "invitation_code": "INV0000000001",
  "email": "alice.wang@example.com",
  "android_id": "abc123def456789012345678901234",
  "gaid": "12345678-1234-5678-1234-123456789abc",
  "register_ip": "47.79.232.189",
  "country": "CN"
}
```

### 测试 2: 最小信息（只有必填字段）
```json
{
  "user_id": "U1732702800002"
}
```

### 测试 3: 常用信息
```json
{
  "user_id": "U1732702800003",
  "email": "test@example.com",
  "register_ip": "47.79.232.189",
  "country": "CN"
}
```

---

## ⚠️ 常见问题

### Q1: SSH 隧道输入密码后立即断开

**解决**: 检查密码是否正确: `WHfe2c82a2e5b8e2a3`

### Q2: Postman 仍然显示 ECONNREFUSED

**排查**:
```bash
# 1. 检查隧道是否建立
lsof -i :8888

# 2. 测试隧道连接
curl http://localhost:8888/api/health

# 3. 如果失败，重新建立隧道
```

### Q3: 密码正确但连接失败

**可能原因**: 
- 服务器防火墙阻止
- SSH 端口转发被禁用
- 网络问题

**替代方案**: 使用方式 1 的脚本直接在服务器上创建用户

---

## 📚 完整文档

- [详细故障排查](./POSTMAN_TROUBLESHOOTING.md)
- [完整配置指南](./POSTMAN_COMPLETE_GUIDE.md)
- [Postman 使用说明](./postman/README.md)

---

**开始时间**: 2025-11-27  
**服务器**: 47.79.232.189  
**密码**: WHfe2c82a2e5b8e2a3  
**API 端口**: 8888
