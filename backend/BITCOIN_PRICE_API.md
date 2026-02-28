# 比特币价格API使用说明

## 功能概述
系统已集成比特币实时价格获取功能，每小时自动更新一次。

## API端点

### 1. 获取当前比特币价格
```
GET /api/bitcoin/price
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "price": 104235.50,
    "formatted": "$104,235.50 USD",
    "lastUpdate": "2026-01-21T13:30:00.000Z",
    "currency": "USD"
  }
}
```

### 2. 手动刷新价格
```
POST /api/bitcoin/refresh
```

**响应示例：**
```json
{
  "success": true,
  "message": "Price updated successfully",
  "data": {
    "price": 104235.50,
    "formatted": "$104,235.50 USD",
    "lastUpdate": "2026-01-21T13:35:00.000Z",
    "currency": "USD"
  }
}
```

## 数据源

系统使用双重数据源确保可靠性：
1. **主要数据源**: Binance API (`api.binance.com`)
   - 优点：速度快，实时性高
   - 端点：`/api/v3/ticker/price?symbol=BTCUSDT`

2. **备用数据源**: CoinGecko API (`api.coingecko.com`)
   - 优点：稳定性高，免费无需API key
   - 端点：`/api/v3/simple/price?ids=bitcoin&vs_currencies=usd`

## 自动更新机制

- **更新频率**: 每1小时自动更新
- **启动时**: 服务启动时立即获取一次价格
- **容错机制**: 
  - 优先使用Binance API
  - 如果Binance失败，自动切换到CoinGecko
  - 如果都失败，使用Redis缓存的价格
  - 最终回退到默认价格$50,000

## Redis缓存

价格数据会缓存到Redis，键名为`bitcoin:price:usd`：
```json
{
  "price": 104235.50,
  "updatedAt": "2026-01-21T13:30:00.000Z"
}
```
- **过期时间**: 2小时
- **用途**: API失败时的备用数据源

## 前端集成示例

### Flutter/Dart
```dart
Future<double> getBitcoinPrice() async {
  final response = await http.get(
    Uri.parse('http://your-api/api/bitcoin/price')
  );
  
  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return data['data']['price'];
  }
  throw Exception('Failed to load price');
}
```

### JavaScript
```javascript
async function getBitcoinPrice() {
  const response = await fetch('/api/bitcoin/price');
  const data = await response.json();
  return data.data.price;
}
```

## 注意事项

1. **网络环境**: 确保服务器能够访问Binance和CoinGecko API
2. **请求限制**: Binance有请求限制（约1200次/分钟），CoinGecko免费版约50次/分钟
3. **更新频率**: 默认每小时更新，可在代码中修改`UPDATE_INTERVAL`常量
4. **手动刷新**: 如需立即更新价格，调用`POST /api/bitcoin/refresh`

## 故障排查

如果价格显示为默认值$50,000：
1. 检查服务器网络连接
2. 查看后端日志中的错误信息
3. 尝试手动刷新：`curl -X POST http://localhost:8888/api/bitcoin/refresh`
4. 检查Redis连接状态

## 配置修改

修改更新频率（在`bitcoinPriceService.js`中）：
```javascript
this.UPDATE_INTERVAL = 30 * 60 * 1000; // 改为30分钟
```
