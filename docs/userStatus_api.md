# User Status API 文档

## 基础信息

- **Base URL**: `/api/userStatus`
- **认证方式**: JWT Token (Authorization: Bearer {token})

---

## API 列表

### 1. 获取用户状态信息

**GET** `/api/userStatus/:user_id`

获取指定用户的状态信息，包括余额、邀请返利等。

**请求参数：**
- Path: `user_id` (string) - 用户ID

**响应示例：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "USER123456",
    "bitcoin_accumulated_amount": "0.001234567890123456",
    "current_bitcoin_balance": "0.000987654321098765",
    "total_invitation_rebate": "0.000100000000000000",
    "total_withdrawal_amount": "0.000200000000000000",
    "last_login_time": "2025-11-23T10:30:00.000Z",
    "user_status": "active within 3 days",
    "userInfo": {
      "user_id": "USER123456",
      "email": "user@example.com",
      "country": "US",
      "user_creation_time": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

### 2. 创建用户状态记录

**POST** `/api/userStatus`

为新注册用户创建状态记录（通常在注册时自动调用）。

**请求体：**
```json
{
  "user_id": "USER123456",
  "bitcoin_accumulated_amount": 0,
  "current_bitcoin_balance": 0,
  "total_invitation_rebate": 0,
  "total_withdrawal_amount": 0
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "用户状态创建成功",
  "data": {
    "id": 1,
    "user_id": "USER123456",
    "bitcoin_accumulated_amount": "0",
    "current_bitcoin_balance": "0",
    "total_invitation_rebate": "0",
    "total_withdrawal_amount": "0",
    "last_login_time": "2025-11-23T10:30:00.000Z",
    "user_status": "active within 3 days"
  }
}
```

---

### 3. 更新比特币余额

**PUT** `/api/userStatus/:user_id/balance`

增加或减少用户的比特币余额。

**请求参数：**
- Path: `user_id` (string) - 用户ID

**请求体：**
```json
{
  "amount": "0.00001",
  "type": "add"  // 或 "subtract"
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "余额更新成功",
  "data": {
    "user_id": "USER123456",
    "previous_balance": 0.001,
    "amount": 0.00001,
    "new_balance": 0.00101
  }
}
```

---

### 4. 更新最后登录时间

**PUT** `/api/userStatus/:user_id/login`

更新用户最后登录时间，并自动设置为活跃状态。

**请求参数：**
- Path: `user_id` (string) - 用户ID

**响应示例：**
```json
{
  "success": true,
  "message": "登录时间更新成功",
  "data": {
    "user_id": "USER123456",
    "last_login_time": "2025-11-23T10:30:00.000Z"
  }
}
```

---

### 5. 更新所有用户活跃状态

**POST** `/api/userStatus/update-active-status`

批量更新所有用户的活跃状态（通常由定时任务调用）。

**响应示例：**
```json
{
  "success": true,
  "message": "用户活跃状态更新完成"
}
```

---

### 6. 获取用户统计信息

**GET** `/api/userStatus/:user_id/statistics`

获取用户的统计信息，包括提现比例等。

**请求参数：**
- Path: `user_id` (string) - 用户ID

**响应示例：**
```json
{
  "success": true,
  "data": {
    "user_id": "USER123456",
    "bitcoin_accumulated_amount": 0.001234567890123456,
    "current_bitcoin_balance": 0.000987654321098765,
    "total_invitation_rebate": 0.0001,
    "total_withdrawal_amount": 0.0002,
    "withdrawn_percentage": "16.20",
    "user_status": "active within 3 days",
    "last_login_time": "2025-11-23T10:30:00.000Z"
  }
}
```

---

## 用户状态枚举

- `active within 3 days` - 3天内活跃
- `no login within 7 days` - 7天以上未登录
- `normal` - 正常状态（默认）
- `disabled` - 已禁用
- `deleted` - 已删除（软删除）

---

## 错误响应

```json
{
  "success": false,
  "message": "错误信息描述"
}
```

**常见错误码：**
- 400 Bad Request - 请求参数错误
- 401 Unauthorized - 未授权（token无效或过期）
- 404 Not Found - 用户不存在
- 500 Internal Server Error - 服务器内部错误
