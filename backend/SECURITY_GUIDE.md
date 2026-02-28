# API安全加固方案

## 当前状态分析

### 已实现的安全措施
1. ✅ Docker容器隔离
2. ✅ Nginx反向代理
3. ✅ 防火墙配置（Redis/MySQL端口已关闭）
4. ✅ 数据库连接限制

### 当前风险点
1. ❌ 公开API无认证保护
2. ❌ 无请求频率限制
3. ❌ user_id可被枚举攻击
4. ❌ 无请求来源验证

## 推荐安全方案（分级实施）

### 🟢 基础方案（推荐立即实施）

#### 1. API Key验证
**安全级别**: ⭐⭐⭐
**实施难度**: 低
**性能影响**: 极小

```javascript
// 在所有公开API路由中添加
const apiKeyAuth = require('../middleware/apiKeyAuth');
router.post('/checkin', apiKeyAuth, async (req, res) => {
  // 原有逻辑
});
```

**客户端改动**:
```dart
// Flutter中添加全局header
_dio.options.headers['X-API-Key'] = 'btc_mining_app_2026_secret_key_v1';
```

#### 2. 用户操作防重复
**安全级别**: ⭐⭐⭐⭐
**实施难度**: 低
**已实现**: ✅ 签到功能已有每日一次限制

```javascript
// 示例：签到防重复（已实现）
const lastCheckIn = await getLastCheckIn(userId);
if (isToday(lastCheckIn)) {
  return res.json({ success: false, message: '今日已签到' });
}
```

#### 3. User ID格式验证
```javascript
// 添加user_id格式验证
function validateUserId(userId) {
  // 必须是U开头 + 19位数字
  return /^U\d{19}$/.test(userId);
}
```

### 🟡 进阶方案（可选实施）

#### 4. 请求签名验证
**安全级别**: ⭐⭐⭐⭐⭐
**实施难度**: 中
**性能影响**: 小

客户端生成签名：
```dart
String generateSignature(String userId, String apiKey) {
  final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
  final message = '$timestamp:$userId';
  final hmac = Hmac(sha256, utf8.encode(apiKey));
  final digest = hmac.convert(utf8.encode(message));
  return digest.toString();
}
```

#### 5. IP白名单（生产环境）
```nginx
# 在Nginx中限制只允许移动网络IP段
location /api/ {
  # 允许中国移动/联通/电信IP段
  allow 移动IP段;
  deny all;
}
```

#### 6. 启用限流（谨慎使用）
**注意**: 项目已移除限流以避免误伤共享网络用户

如需启用，可安装express-rate-limit：
```bash
npm install express-rate-limit
```

### 🔴 高级方案（企业级）

#### 7. 设备指纹识别
- 绑定设备唯一标识
- 限制单设备登录

#### 8. 行为分析
- 检测异常请求模式
- 机器学习识别机器人

#### 9. WAF（Web应用防火墙）
- 使用Cloudflare/阿里云WAF
- 自动阻挡DDoS攻击

## 实施建议

### 立即实施（优先级P0）
1. ✅ **添加API Key验证** - 5分钟实施
2. ✅ **User ID格式验证** - 2分钟实施
3. ✅ **日志记录异常请求** - 已有

### 近期实施（优先级P1）
4. **监控告警系统** - 1小时
   - 监控每分钟请求量
   - 检测单用户异常高频操作
   - 积分异常增长告警

5. **数据库层面防护** - 30分钟
   - 添加唯一索引防重复
   - 使用事务确保原子性

### 可选实施（优先级P2）
6. **请求签名** - 如果发现有攻击再实施
7. **限流机制** - 根据实际情况决定

## 当前项目的实际风险评估

### 低风险因素
1. ✅ UUID随机性高，暴力枚举困难
2. ✅ 无真实货币交易
3. ✅ 签到/广告有内置防重复逻辑
4. ✅ Docker隔离保护数据库

### 中风险因素
1. ⚠️ 积分可能被刷（但无法提现）
2. ⚠️ 用户数据可被查询（但无敏感信息）

### 建议
**对于当前项目，实施"基础方案"即可满足安全需求。**

积分系统本质是游戏内虚拟货币，即使被刷也不会造成实际经济损失。
真正需要保护的是：
1. 服务器不被打垮（通过Nginx限制连接数）
2. 数据库不被破坏（通过防火墙+权限控制）
3. 用户体验不受影响（防止批量刷接口影响性能）

## 监控指标

建议监控以下指标来检测攻击：
```bash
# 1. 每分钟请求数
SELECT COUNT(*) FROM logs WHERE timestamp > NOW() - INTERVAL 1 MINUTE;

# 2. 单用户异常高频
SELECT user_id, COUNT(*) as count 
FROM logs 
WHERE timestamp > NOW() - INTERVAL 1 HOUR
GROUP BY user_id 
HAVING count > 1000;

# 3. 积分异常增长
SELECT user_id, points, updated_at 
FROM users 
WHERE points > 10000 
AND updated_at > NOW() - INTERVAL 1 DAY;
```

## 总结

**当前状态**: 适合开发/测试环境，对于模拟挖矿游戏来说，风险可控

**推荐实施**: 
1. 添加API Key验证（5分钟）
2. 添加异常监控（1小时）
3. 其他按需实施

**不推荐**: 
- 过度的安全措施会影响用户体验
- 限流可能误伤正常用户
- JWT认证对APP来说太重
