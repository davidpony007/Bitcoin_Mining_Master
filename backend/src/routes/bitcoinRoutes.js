/**
 * 比特币价格API路由
 */
const express = require('express');
const router = express.Router();
const bitcoinPriceService = require('../services/bitcoinPriceService');

/**
 * GET /api/bitcoin/price
 * 获取当前比特币价格
 */
router.get('/price', async (req, res) => {
  try {
    const priceInfo = bitcoinPriceService.getCurrentPrice();
    
    return res.json({
      success: true,
      data: {
        price: priceInfo.price,
        formatted: priceInfo.formatted,
        lastUpdate: priceInfo.lastUpdate,
        currency: 'USD'
      }
    });
  } catch (error) {
    console.error('获取比特币价格失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get bitcoin price',
      error: error.message
    });
  }
});

/**
 * POST /api/bitcoin/refresh
 * 手动刷新比特币价格（自动从API获取）
 */
router.post('/refresh', async (req, res) => {
  try {
    const price = await bitcoinPriceService.refreshPrice();
    
    return res.json({
      success: true,
      message: 'Price updated successfully',
      data: {
        price: price,
        formatted: `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`,
        lastUpdate: new Date(),
        currency: 'USD'
      }
    });
  } catch (error) {
    console.error('刷新比特币价格失败:', error);
    return res.status(503).json({
      success: false,
      message: 'Failed to refresh bitcoin price',
      error: error.message,
      details: 'ServiceUnavailableError'
    });
  }
});

/**
 * POST /api/bitcoin/set-price
 * 手动设置比特币价格（用于网络受限环境）
 * Body: { price: 105200.50 }
 */
router.post('/set-price', async (req, res) => {
  try {
    const { price } = req.body;
    
    if (!price || typeof price !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Invalid price value. Please provide a number.',
        example: { price: 105200.50 }
      });
    }
    
    const result = bitcoinPriceService.setManualPrice(price);
    
    return res.json({
      success: true,
      message: 'Price set successfully',
      data: result
    });
  } catch (error) {
    console.error('设置比特币价格失败:', error);
    return res.status(400).json({
      success: false,
      message: 'Failed to set bitcoin price',
      error: error.message
    });
  }
});

module.exports = router;
