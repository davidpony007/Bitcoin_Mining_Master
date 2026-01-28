/**
 * 比特币价格服务
 * 使用CoinGecko API获取实时比特币价格
 * 每小时自动更新一次
 */

const https = require('https');
const redisClient = require('../config/redis');

class BitcoinPriceService {
  constructor() {
    // 2026年1月23日的实际比特币价格约为 $104,800 - $105,500 USD
    this.currentPrice = 105200.00; // 更新为当前市场价格
    this.lastUpdate = null;
    this.updateInterval = null;
    this.CACHE_KEY = 'bitcoin:price:usd';
    this.UPDATE_INTERVAL = 60 * 60 * 1000; // 1小时（毫秒）
  }

  /**
   * 手动设置比特币价格（用于网络受限环境）
   */
  setManualPrice(price) {
    if (typeof price !== 'number' || price <= 0) {
      throw new Error('Invalid price value');
    }
    this.currentPrice = price;
    this.lastUpdate = new Date();
    console.log(`💰 手动设置比特币价格: $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`);
    
    // 保存到Redis
    if (redisClient.isReady()) {
      redisClient.set(this.CACHE_KEY, JSON.stringify({
        price: price,
        updatedAt: this.lastUpdate.toISOString(),
        source: 'manual'
      }), {
        EX: 7200
      }).catch(err => console.error('Redis保存失败:', err));
    }
    
    return this.getCurrentPrice();
  }

  /**
   * 从币安国际 API 获取比特币价格（使用 IP 地址避免 DNS 问题）
   */
  async fetchPriceFromBinanceGlobal() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'data.binance.com',
        port: 443,
        path: '/api/v3/ticker/price?symbol=BTCUSDT',
        method: 'GET',
        headers: {
          'User-Agent': 'Bitcoin-Mining-Master/1.0',
          'Host': 'data.binance.com'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.price) {
              resolve(parseFloat(json.price));
            } else {
              reject(new Error('Invalid response format'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(15000, () => {
        req.abort();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * 从欧易(OKX) API获取比特币价格（国内可访问）
   */
  async fetchPriceFromOKX() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'www.okx.com',
        port: 443,
        path: '/api/v5/market/ticker?instId=BTC-USDT',
        method: 'GET',
        headers: {
          'User-Agent': 'Bitcoin-Mining-Master/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.data && json.data[0] && json.data[0].last) {
              resolve(parseFloat(json.data[0].last));
            } else {
              reject(new Error('Invalid response format'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(15000, () => {
        req.abort();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * 从火币(Huobi) API获取比特币价格（备用方案）
   */
  async fetchPriceFromHuobi() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.huobi.pro',
        port: 443,
        path: '/market/detail/merged?symbol=btcusdt',
        method: 'GET',
        headers: {
          'User-Agent': 'Bitcoin-Mining-Master/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.tick && json.tick.close) {
              resolve(parseFloat(json.tick.close));
            } else {
              reject(new Error('Invalid response format'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(15000, () => {
        req.abort();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * 从Binance API获取比特币价格（海外用户）
   */
  async fetchPriceFromBinance() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.binance.com',
        port: 443,
        path: '/api/v3/ticker/price?symbol=BTCUSDT',
        method: 'GET',
        headers: {
          'User-Agent': 'Bitcoin-Mining-Master/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.price) {
              resolve(parseFloat(json.price));
            } else {
              reject(new Error('Invalid response format'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(20000, () => {
        req.abort();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * 从CoinGecko API获取比特币价格
   */
  async fetchPriceFromAPI() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.coingecko.com',
        port: 443,
        path: '/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        method: 'GET',
        headers: {
          'User-Agent': 'Bitcoin-Mining-Master/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.bitcoin && json.bitcoin.usd) {
              resolve(json.bitcoin.usd);
            } else {
              reject(new Error('Invalid response format'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(20000, () => {
        req.abort();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * 更新比特币价格（多API源，优先使用国内可访问的API）
   */
  async updatePrice() {
    try {
      console.log('🔄 开始更新比特币价格...');
      
      let price;
      const apis = [
        { name: 'Binance Global', fn: () => this.fetchPriceFromBinanceGlobal() },
        { name: 'OKX', fn: () => this.fetchPriceFromOKX() },
        { name: 'Huobi', fn: () => this.fetchPriceFromHuobi() },
        { name: 'Binance', fn: () => this.fetchPriceFromBinance() },
        { name: 'CoinGecko', fn: () => this.fetchPriceFromAPI() }
      ];

      // 依次尝试各个API源（每个API重试2次）
      for (const api of apis) {
        for (let retry = 0; retry < 2; retry++) {
          try {
            console.log(`📡 尝试从 ${api.name} 获取价格...${retry > 0 ? `(重试 ${retry}/1)` : ''}`);
            price = await api.fn();
            console.log(`✅ 成功从 ${api.name} 获取价格: $${price.toFixed(2)}`);
            break;
          } catch (error) {
            console.log(`⚠️ ${api.name} API失败: ${error.message}`);
            if (retry === 0) {
              // 第一次失败，等待2秒后重试
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        // 如果获取到价格，跳出外层循环
        if (price) break;
        
        // 尝试下一个API前等待2秒，避免请求过快
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 如果所有API都失败，使用缓存或默认价格
      if (!price) {
        console.log('⚠️ 所有价格源都不可用，尝试使用缓存或默认价格...');
        
        // 尝试从Redis获取缓存
        if (redisClient.isReady()) {
          const cached = await redisClient.get(this.CACHE_KEY);
          if (cached) {
            const data = JSON.parse(cached);
            price = data.price;
            console.log(`📦 使用缓存的比特币价格: $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`);
            console.log(`📅 缓存时间: ${data.updatedAt}`);
            return price;
          }
        }
        
        // 如果连缓存都没有，使用默认价格
        price = this.currentPrice;
        console.log(`💰 使用默认比特币价格: $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`);
        console.log(`ℹ️ 提示: 可以使用 setManualPrice() 方法手动设置价格`);
        return price;
      }
      
      this.currentPrice = price;
      this.lastUpdate = new Date();
      
      // 保存到Redis缓存
      if (redisClient.isReady()) {
        await redisClient.set(this.CACHE_KEY, JSON.stringify({
          price: price,
          updatedAt: this.lastUpdate.toISOString()
        }), {
          EX: 7200 // 2小时过期
        });
      }
      
      console.log(`✅ 比特币价格已更新: $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`);
      console.log(`📅 更新时间: ${this.lastUpdate.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
      
      return price;
    } catch (error) {
      console.error('❌ 更新比特币价格失败:', error.message);
      
      // 如果API失败，尝试从Redis获取缓存
      if (redisClient.isReady()) {
        const cached = await redisClient.get(this.CACHE_KEY);
        if (cached) {
          const data = JSON.parse(cached);
          this.currentPrice = data.price;
          this.lastUpdate = new Date(data.updatedAt);
          console.log(`📦 使用缓存的比特币价格: $${this.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`);
        }
      }
      
      throw error;
    }
  }

  /**
   * 启动定时更新任务（每小时更新一次）
   */
  startAutoUpdate() {
    // 立即更新一次
    this.updatePrice().catch(err => {
      console.error('初始价格更新失败，使用默认价格:', err.message);
    });

    // 设置定时任务：每小时更新
    this.updateInterval = setInterval(() => {
      this.updatePrice().catch(err => {
        console.error('定时更新失败:', err.message);
      });
    }, this.UPDATE_INTERVAL);

    console.log('🚀 比特币价格自动更新任务已启动（每小时更新一次）');
  }

  /**
   * 停止定时更新任务
   */
  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('⏹️ 比特币价格自动更新任务已停止');
    }
  }

  /**
   * 获取当前价格
   */
  getCurrentPrice() {
    return {
      price: this.currentPrice,
      lastUpdate: this.lastUpdate,
      formatted: `$${this.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
    };
  }

  /**
   * 手动刷新价格（用于API调用）
   */
  async refreshPrice() {
    return await this.updatePrice();
  }
}

// 创建单例实例
const bitcoinPriceService = new BitcoinPriceService();

module.exports = bitcoinPriceService;
