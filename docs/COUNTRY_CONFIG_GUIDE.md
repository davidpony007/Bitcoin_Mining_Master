# 国家配置系统使用文档

## 📋 概述

国家配置系统允许为不同国家的用户设置不同的挖矿速率倍数，实现地域化运营策略。

---

## 🗄️ 数据库表结构

### country_config 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键ID |
| country_code | VARCHAR(10) | 国家代码（ISO 3166-1 alpha-2）|
| country_name | VARCHAR(100) | 国家名称 |
| mining_speed_multiplier | DECIMAL(5,2) | 挖矿速度倍数 |
| is_active | BOOLEAN | 是否启用 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 预设国家配置

**高速率国家（发达国家）**：
- 美国 (US): 1.50x
- 英国 (GB): 1.45x
- 德国 (DE): 1.45x
- 加拿大 (CA): 1.40x
- 澳大利亚 (AU): 1.40x
- 法国 (FR): 1.40x
- 日本 (JP): 1.35x
- 新加坡 (SG): 1.35x
- 韩国 (KR): 1.30x

**中等速率国家（新兴市场）**：
- 中国 (CN): 1.20x
- 巴西 (BR): 1.20x
- 俄罗斯 (RU): 1.20x
- 印度 (IN): 1.15x
- 马来西亚 (MY): 1.15x
- 墨西哥 (MX): 1.15x
- 土耳其 (TR): 1.10x
- 印度尼西亚 (ID): 1.10x
- 泰国 (TH): 1.10x
- 菲律宾 (PH): 1.05x
- 越南 (VN): 1.05x

**默认速率**：
- 其他国家 (DEFAULT): 1.00x

---

## 🚀 部署步骤

### 1. 运行数据库迁移

```bash
cd "/Users/davidpony/Desktop/Bitcoin Mining Master"
mysql -u root -p bitcoin_mining < scripts/migrate/007_add_country_config_table.sql
```

### 2. 重启后端服务

```bash
cd backend
npm run dev
# 或使用 PM2
pm2 restart ecosystem.config.js
```

### 3. 验证部署

启动日志应显示：
```
✓ Redis 连接成功
✓ 等级配置加载成功
✓ 签到奖励配置加载成功
✓ 国家配置加载成功，共 22 个国家
游戏机制初始化完成！
```

---

## 📡 API 接口

### 公共接口（不需要认证）

#### 1. 获取所有国家列表

```http
GET /api/country/countries
```

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "countryCode": "US",
      "countryName": "United States",
      "miningSpeedMultiplier": 1.50
    },
    {
      "countryCode": "CN",
      "countryName": "China",
      "miningSpeedMultiplier": 1.20
    }
  ],
  "total": 22
}
```

#### 2. 获取指定国家配置

```http
GET /api/country/country/:countryCode
```

**示例**：
```bash
curl http://localhost:8888/api/country/country/US
```

**响应**：
```json
{
  "success": true,
  "data": {
    "countryCode": "US",
    "countryName": "United States",
    "miningSpeedMultiplier": 1.50
  }
}
```

#### 3. 仅获取挖矿倍数

```http
GET /api/country/country/:countryCode/multiplier
```

**示例**：
```bash
curl http://localhost:8888/api/country/country/CN/multiplier
```

**响应**：
```json
{
  "success": true,
  "countryCode": "CN",
  "miningSpeedMultiplier": 1.20
}
```

### 管理员接口（需要认证和管理员权限）

#### 4. 更新国家倍数

```http
PUT /api/admin/country/:countryCode/multiplier
Authorization: Bearer <token>
Content-Type: application/json

{
  "multiplier": 1.60
}
```

**示例**：
```bash
curl -X PUT http://localhost:8888/api/admin/country/US/multiplier \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"multiplier": 1.60}'
```

**响应**：
```json
{
  "success": true,
  "message": "国家配置更新成功",
  "countryCode": "US",
  "newMultiplier": 1.60
}
```

#### 5. 清除所有缓存

```http
POST /api/admin/country/cache/clear
Authorization: Bearer <token>
```

**示例**：
```bash
curl -X POST http://localhost:8888/api/admin/country/cache/clear \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🔧 挖矿速率计算公式

### 最终挖矿速率计算

```
最终速率 = 基础速率 × 等级倍数 × 签到加成倍数 × 国家倍数
```

### 示例计算

**用户信息**：
- 基础速率：0.00000001 BTC/秒
- 等级：LV.5（等级倍数 1.50x）
- 已签到（加成倍数 1.36x）
- 国家：美国（国家倍数 1.50x）

**计算过程**：
```
最终速率 = 0.00000001 × 1.50 × 1.36 × 1.50
         = 0.00000001 × 3.06
         = 0.0000000306 BTC/秒
```

**API 响应示例**：
```json
{
  "baseSpeed": 0.00000001,
  "levelMultiplier": 1.50,
  "dailyBonusMultiplier": 1.36,
  "countryMultiplier": 1.50,
  "finalMultiplier": 3.06,
  "finalSpeed": 0.0000000306,
  "dailyBonusActive": true
}
```

---

## 📱 客户端集成建议

### 注册/登录时上传国家代码

```javascript
// Android 客户端示例
const registerData = {
  android_id: "device123",
  country: getDeviceCountryCode(), // 获取设备国家代码
  // ... 其他字段
};

fetch('http://api.example.com/api/auth/device-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(registerData)
});
```

### 显示国家倍数信息

```javascript
// 获取用户挖矿速率详情
fetch(`http://api.example.com/api/level/mining-speed?user_id=${userId}`)
  .then(res => res.json())
  .then(data => {
    console.log('等级倍数:', data.levelMultiplier);
    console.log('签到倍数:', data.dailyBonusMultiplier);
    console.log('国家倍数:', data.countryMultiplier);
    console.log('总倍数:', data.finalMultiplier);
  });
```

### UI 展示建议

在挖矿界面显示速率倍数组成：

```
🏅 等级加成: 1.50x (LV.5 专家矿工)
✅ 签到加成: 1.36x (剩余 1小时30分)
🌍 国家加成: 1.50x (美国)
━━━━━━━━━━━━━━━━━━━━
总倍数: 3.06x
```

---

## 🧪 测试用例

### 测试1：获取所有国家

```bash
curl http://localhost:8888/api/country/countries
```

**预期结果**：返回 22 个国家配置

### 测试2：查询不存在的国家

```bash
curl http://localhost:8888/api/country/country/XX
```

**预期结果**：返回默认配置（1.00x）

### 测试3：更新国家倍数

```bash
# 1. 更新中国倍数为 1.25x
curl -X PUT http://localhost:8888/api/admin/country/CN/multiplier \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"multiplier": 1.25}'

# 2. 验证更新
curl http://localhost:8888/api/country/country/CN
```

**预期结果**：中国倍数变为 1.25x

### 测试4：挖矿速率计算

```bash
# 创建测试用户（国家：US）
curl -X POST http://localhost:8888/api/auth/device-login \
  -H "Content-Type: application/json" \
  -d '{
    "android_id": "test_device_001",
    "country": "US"
  }'

# 查询挖矿速率
curl http://localhost:8888/api/level/mining-speed?user_id=USER_ID
```

**预期结果**：countryMultiplier 为 1.50

---

## 🛠️ 数据库管理

### 添加新国家

```sql
INSERT INTO country_config (country_code, country_name, mining_speed_multiplier, is_active)
VALUES ('IT', 'Italy', 1.40, TRUE);
```

### 更新国家倍数

```sql
UPDATE country_config
SET mining_speed_multiplier = 1.35
WHERE country_code = 'JP';
```

### 禁用某个国家

```sql
UPDATE country_config
SET is_active = FALSE
WHERE country_code = 'XX';
```

### 查看所有国家配置

```sql
SELECT 
  country_code,
  country_name,
  mining_speed_multiplier,
  is_active
FROM country_config
ORDER BY mining_speed_multiplier DESC;
```

---

## 🔍 Redis 缓存管理

### 缓存键格式

```
country:config:{COUNTRY_CODE}
```

**示例**：
- `country:config:US` → "1.50"
- `country:config:CN` → "1.20"
- `country:config:DEFAULT` → "1.00"

### 缓存过期时间

24小时（86400秒）

### 手动清除缓存

**方式1：通过 API（推荐）**
```bash
curl -X POST http://localhost:8888/api/admin/country/cache/clear \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**方式2：通过 Redis CLI**
```bash
redis-cli
> KEYS country:config:*
> DEL country:config:US
> DEL country:config:CN
# 或删除所有
> FLUSHDB
```

---

## ⚠️ 注意事项

1. **国家代码规范**：
   - 使用 ISO 3166-1 alpha-2 标准（2位大写字母）
   - 如：US, CN, GB, JP

2. **默认值处理**：
   - 如果用户未提供国家或国家不在配置中，使用 DEFAULT（1.00x）

3. **缓存一致性**：
   - 更新数据库后会自动清除对应缓存
   - 批量更新后建议手动清除所有缓存

4. **倍数范围建议**：
   - 最小值：0.50x
   - 最大值：2.00x
   - 避免过大差异影响公平性

5. **性能考虑**：
   - 所有查询优先使用 Redis 缓存
   - 缓存未命中才查询数据库
   - 定期监控缓存命中率

---

## 📊 监控指标

建议监控以下指标：

1. **国家分布**：
   ```sql
   SELECT country, COUNT(*) as users
   FROM user_information
   GROUP BY country
   ORDER BY users DESC
   LIMIT 10;
   ```

2. **平均倍数**：
   ```sql
   SELECT AVG(c.mining_speed_multiplier) as avg_multiplier
   FROM user_information u
   JOIN country_config c ON u.country = c.country_code;
   ```

3. **缓存命中率**：
   - 通过日志统计 "从 Redis 获取" vs "从数据库查询" 的比例

---

## 🔄 更新日志

**v1.0** - 2024-12-15
- ✅ 创建国家配置表
- ✅ 添加 22 个预设国家
- ✅ 集成到挖矿速率计算
- ✅ Redis 缓存支持
- ✅ 公共 API 和管理员 API

---

**文档版本**：v1.0  
**最后更新**：2024-12-15  
**维护者**：Bitcoin Mining Master 开发团队
