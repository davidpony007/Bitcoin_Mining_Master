# UserStatus 模块修复说明

## ✅ 已修复的问题

### 1. 用户状态枚举值更新

**原来的枚举值：**
```javascript
'active within 3 days',
'no login within 7 days',
'no login within 30 days',
'inactive'
```

**新的枚举值：**
```javascript
'active within 3 days',  // 3天内活跃
'no login within 7 days', // 7天以上未登录
'normal',                 // 正常状态（默认）
'disabled',               // 已禁用
'deleted'                 // 已删除（软删除）
```

---

### 2. 修复的文件清单

#### ✅ `/backend/src/models/userStatus.js`
- 已手动更新枚举值
- 默认状态改为 `'normal'`

#### ✅ `/backend/src/controllers/userStatusController.js`
- `createUserStatus` - 默认状态改为 `'normal'`
- `updateLastLoginTime` - 排除禁用/删除用户
- `updateUserActiveStatus` - 简化逻辑，只保留两种活跃状态
- **新增功能：**
  - `disableUser` - 禁用用户
  - `enableUser` - 启用用户
  - `deleteUser` - 软删除用户

#### ✅ `/backend/src/utils/userStatusScheduler.js`
- 更新定时任务逻辑
- 排除禁用/删除的用户
- 简化为两种状态切换

#### ✅ `/backend/src/routes/userStatusRoutes.js`
- 新增路由：
  - `PUT /:user_id/disable` - 禁用用户
  - `PUT /:user_id/enable` - 启用用户
  - `DELETE /:user_id` - 删除用户

#### ✅ `/docs/userStatus_api.md`
- 更新用户状态枚举说明

---

### 3. 新增的管理功能

#### 禁用用户
```bash
curl -X PUT http://47.79.232.189/api/userStatus/USER123456/disable \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 启用用户
```bash
curl -X PUT http://47.79.232.189/api/userStatus/USER123456/enable \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 删除用户（软删除）
```bash
curl -X DELETE http://47.79.232.189/api/userStatus/USER123456 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4. 业务逻辑说明

#### 状态流转规则：
```
注册 → normal (默认)
     ↓
3天内登录 → active within 3 days
     ↓
7天未登录 → no login within 7 days
     ↓
管理员操作 → disabled / deleted
```

#### 状态保护：
- `disabled` 状态的用户登录时不会自动改为 `active`
- `deleted` 状态的用户无法通过 `enable` 接口恢复
- 定时任务自动排除 `disabled` 和 `deleted` 用户

---

### 5. 测试建议

```bash
# 1. 创建测试用户状态
curl -X POST http://47.79.232.189/api/userStatus \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "TEST001"}'

# 2. 查看状态
curl http://47.79.232.189/api/userStatus/TEST001 \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. 更新登录时间
curl -X PUT http://47.79.232.189/api/userStatus/TEST001/login \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. 禁用用户
curl -X PUT http://47.79.232.189/api/userStatus/TEST001/disable \
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. 启用用户
curl -X PUT http://47.79.232.189/api/userStatus/TEST001/enable \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🚀 下一步

代码已全部修复完成！现在可以：

1. **重启服务**让修复生效
2. **运行测试**验证功能
3. **查看日志**确认没有错误
