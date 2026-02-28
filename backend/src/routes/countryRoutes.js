/**
 * 公共路由 - 国家配置相关接口
 * 提供国家列表和挖矿倍数查询
 */

const express = require('express');
const router = express.Router();
const CountryMiningService = require('../services/countryMiningService');

/**
 * @route   GET /api/public/countries
 * @desc    获取所有可用国家列表及挖矿倍数
 * @access  Public
 * 
 * @returns {
 *   success: true,
 *   data: [
 *     {
 *       countryCode: "US",
 *       countryName: "United States",
 *       miningSpeedMultiplier: 1.50
 *     },
 *     ...
 *   ]
 * }
 */
router.get('/countries', async (req, res) => {
  try {
    const countries = await CountryMiningService.getAllConfigs({ activeOnly: true });

    res.json({
      success: true,
      data: countries,
      total: countries.length
    });
  } catch (error) {
    console.error('获取国家列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取国家列表失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/public/country/:countryCode
 * @desc    获取指定国家的配置信息
 * @access  Public
 * @param   {string} countryCode - 国家代码（如：US, CN）
 * 
 * @returns {
 *   success: true,
 *   data: {
 *     countryCode: "US",
 *     countryName: "United States",
 *     miningSpeedMultiplier: 1.50
 *   }
 * }
 */
router.get('/country/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;

    if (!countryCode) {
      return res.status(400).json({
        success: false,
        message: '请提供国家代码'
      });
    }

    const config = await CountryMiningService.getCountryDetail(countryCode);

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('获取国家配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取国家配置失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/public/country/:countryCode/multiplier
 * @desc    仅获取国家的挖矿速率倍数
 * @access  Public
 * @param   {string} countryCode - 国家代码
 * 
 * @returns {
 *   success: true,
 *   countryCode: "US",
 *   miningSpeedMultiplier: 1.50
 * }
 */
router.get('/country/:countryCode/multiplier', async (req, res) => {
  try {
    const { countryCode } = req.params;

    const multiplier = await CountryMiningService.getMiningMultiplier(countryCode);

    res.json({
      success: true,
      countryCode: countryCode.toUpperCase(),
      miningSpeedMultiplier: multiplier
    });
  } catch (error) {
    console.error('获取挖矿倍数失败:', error);
    res.status(500).json({
      success: false,
      message: '获取挖矿倍数失败',
      error: error.message
    });
  }
});

module.exports = router;
