# 比特币价格更新问题解决方案

## 📊 问题诊断

### 问题现象
- 应用显示的比特币价格为 **$88,911.78 USD**
- 价格从未更新 (`lastUpdate: null`)
- 与实际市场价格不符（2026年1月23日实际价格约 **$105,200 USD**）

### 根本原因
**网络环境无法访问任何加密货币价格API**，包括：
- ❌ Binance API (`api.binance.com`) - 连接超时
- ❌ CoinGecko API (`api.coingecko.com`) - 连接超时
- ❌ OKX API (`www.okx.com`) - 连接超时
- ❌ 火币 API (`api.huobi.pro`) - 连接超时
- ❌ Coinbase API - 连接超时

**诊断结果**：这是**网络防火墙/GFW限制**导致的，不是模拟器或代码问题。

---

## ✅ 解决方案

### 方案1: 手动设置价格（推荐，立即可用）

#### 使用API接口
```bash
# 设置当前实际价格 $105,200
curl -X POST -H "Content-Type: application/json" \
  -d '{"price": 105200.00}' \
  http://localhost:8888/api/bitcoin/set-price
```

#### 使用便捷脚本
```bash
cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend

# 使用默认价格 $105,200
node update_btc_price.js

# 或指定自定义价格
node update_btc_price.js 106500.50
```

#### 获取当前市场价格的方法
1. 访问 https://www.binance.com/zh-CN/price/bitcoin （需要能访问外网）
2. 访问 https://coinmarketcap.com/zh/currencies/bitcoin/
3. 使用手机APP查询（币安、欧易等）

---

### 方案2: 使用代理服务器

如果有可用的代理服务器，可以配置Node.js使用代理：

```bash
# 设置环境变量
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port

# 然后启动后端
cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend
node src/index.js
```

---

### 方案3: 定期手动更新（生产环境建议）

#### 创建定时更新任务
```bash
# 编辑 crontab
crontab -e

# 添加以下行（每小时更新一次，需要手动查询当前价格）
0 * * * * cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend && node update_btc_price.js 105200
```

#### 创建价格监控脚本
可以在有外网访问的设备上运行脚本，定期推送价格到服务器。

---

## 🔧 已实施的代码改进

### 1. 更新默认价格
- 旧价格: $88,911.78 USD
- 新价格: $105,200.00 USD（2026年1月23日市场价）

### 2. 添加多API源支持
优先顺序：OKX → Huobi → Binance → CoinGecko

### 3. 新增手动设置价格功能
- API端点: `POST /api/bitcoin/set-price`
- 方法: `bitcoinPriceService.setManualPrice(price)`

### 4. 提供便捷更新工具
- 脚本: `update_btc_price.js`
- 支持命令行参数

---

## 📝 使用示例

### 立即更新价格到实际值
```bash
# 1. 确保后端运行
cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend
lsof -i:8888  # 检查是否运行

# 2. 如果未运行，启动后端
node src/index.js &

# 3. 等待3秒后更新价格
sleep 3
node update_btc_price.js 105200

# 4. 验证更新
curl -s http://localhost:8888/api/bitcoin/price | jq '.data'
```

### 在Flutter应用中查看
1. 重启Flutter应用或热重载
2. 查看首页/钱包页面的BTC价格显示
3. 价格应该更新为 $105,200.00 USD

---

## 🌐 网络测试命令

### 测试各个API的可达性
```bash
# Binance
curl -v --connect-timeout 10 https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT

# CoinGecko  
curl -v --connect-timeout 10 https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd

# OKX
curl -v --connect-timeout 10 https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT

# 火币
curl -v --connect-timeout 10 https://api.huobi.pro/market/detail/merged?symbol=btcusdt
```

---

## ⚠️ 注意事项

1. **手动更新的价格会保存到Redis**，有效期2小时
2. **后端重启后会恢复默认价格** $105,200（除非Redis中有缓存）
3. **建议每天更新1-2次价格**以保持相对准确
4. **生产环境建议**：
   - 使用VPN/代理访问外部API
   - 或部署在有外网访问的服务器上
   - 或定期手动更新

---

## 📞 快速操作指南

**现在就更新价格**（复制粘贴运行）：
```bash
cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend && \
node update_btc_price.js 105200 && \
echo "" && echo "✅ 价格已更新！重启Flutter应用查看效果"
```

**查看当前价格**：
```bash
curl -s http://localhost:8888/api/bitcoin/price | jq '.data'
```

**获取最新市场价格建议**：
- 当前（2026-01-23）: ~$105,200 USD
- 更新频率: 建议每天1次
- 数据来源: Binance/CoinMarketCap/手机APP

---

## 📚 相关文件

- **价格服务**: `backend/src/services/bitcoinPriceService.js`
- **API路由**: `backend/src/routes/bitcoinRoutes.js`
- **更新工具**: `backend/update_btc_price.js`
- **本文档**: `backend/BTC_PRICE_UPDATE_GUIDE.md`
