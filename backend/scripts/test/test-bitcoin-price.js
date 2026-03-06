/**
 * 测试比特币价格获取
 */
const bitcoinPriceService = require('../src/services/bitcoinPriceService');

async function test() {
  try {
    console.log('🧪 测试比特币价格获取...\n');
    
    // 测试Binance API
    console.log('1. 测试Binance API...');
    try {
      const binancePrice = await bitcoinPriceService.fetchPriceFromBinance();
      console.log(`✅ Binance价格: $${binancePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD\n`);
    } catch (error) {
      console.log(`❌ Binance API失败: ${error.message}\n`);
    }
    
    // 测试CoinGecko API
    console.log('2. 测试CoinGecko API...');
    try {
      const coingeckoPrice = await bitcoinPriceService.fetchPriceFromAPI();
      console.log(`✅ CoinGecko价格: $${coingeckoPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD\n`);
    } catch (error) {
      console.log(`❌ CoinGecko API失败: ${error.message}\n`);
    }
    
    // 测试更新价格（会自动尝试两个API）
    console.log('3. 测试自动更新...');
    await bitcoinPriceService.updatePrice();
    
    // 获取当前价格信息
    console.log('\n4. 获取当前价格信息...');
    const priceInfo = bitcoinPriceService.getCurrentPrice();
    console.log(`   价格: ${priceInfo.formatted}`);
    console.log(`   更新时间: ${priceInfo.lastUpdate}\n`);
    
    console.log('✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    process.exit(0);
  }
}

test();
