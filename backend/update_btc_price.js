#!/usr/bin/env node
/**
 * 手动更新比特币价格工具
 * 用于网络受限环境下手动设置比特币价格
 */

const http = require('http');

const price = process.argv[2] ? parseFloat(process.argv[2]) : 105200.00;

if (isNaN(price) || price <= 0) {
  console.error('❌ 错误：请提供有效的价格数值');
  console.log('用法: node update_btc_price.js <价格>');
  console.log('示例: node update_btc_price.js 105200.50');
  process.exit(1);
}

const data = JSON.stringify({ price });

const options = {
  hostname: 'localhost',
  port: 8888,
  path: '/api/bitcoin/set-price',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(responseData);
      if (result.success) {
        console.log('✅ 比特币价格更新成功！');
        console.log(`💰 新价格: ${result.data.formatted}`);
        console.log(`📅 更新时间: ${new Date(result.data.lastUpdate).toLocaleString('zh-CN')}`);
      } else {
        console.error('❌ 更新失败:', result.message);
      }
    } catch (error) {
      console.error('❌ 解析响应失败:', error.message);
      console.log('原始响应:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
  console.log('提示: 请确保后端服务正在运行 (node src/index.js)');
});

req.write(data);
req.end();
