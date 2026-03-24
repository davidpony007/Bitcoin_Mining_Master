'use strict';

/**
 * paidProductService.js
 * 付费产品配置服务 — 从 paid_products_list_config 表读取，带内存缓存
 * 作为 PRODUCT_MAP / PRODUCT_INFO 等硬编码数据的统一替代
 */

const PaidProduct = require('../models/paidProductList');

// 内存缓存（60 秒有效期）
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 60 * 1000; // 60s

class PaidProductService {
  /**
   * 获取所有激活产品列表（带缓存）
   * @returns {Promise<Array>}
   */
  static async getActiveProducts() {
    const now = Date.now();
    if (_cache && now - _cacheAt < CACHE_TTL) return _cache;

    const rows = await PaidProduct.findAll({
      where: { is_active: 1 },
      order: [['sort_order', 'ASC']]
    });
    _cache = rows.map(r => r.toJSON());
    _cacheAt = now;
    return _cache;
  }

  /**
   * 通过 store_product_id（iOS/Android 商品ID）找到内部 product_id
   * @param {string} storeProductId  e.g. "appstore04.99" | "p04.99"
   * @returns {Promise<string|null>} e.g. "p0499"
   */
  static async resolveProductId(storeProductId) {
    const products = await this.getActiveProducts();
    for (const p of products) {
      if (p.ios_product_id === storeProductId || p.android_product_id === storeProductId) {
        return p.product_id;
      }
    }
    // 兼容直接传内部 product_id 的情况
    const direct = products.find(p => p.product_id === storeProductId);
    return direct ? direct.product_id : null;
  }

  /**
   * 通过内部 product_id 获取产品元信息
   * @param {string} productId  e.g. "p0499"
   * @returns {Promise<Object|null>}
   */
  static async getProductInfo(productId) {
    const products = await this.getActiveProducts();
    return products.find(p => p.product_id === productId) || null;
  }

  /**
   * 返回供前端展示的产品列表（脱敏）
   * 不暴露 hashrate_raw 等内部字段
   */
  static async getPublicProductList() {
    const products = await this.getActiveProducts();
    return products.map(p => ({
      product_id: p.product_id,
      display_name: p.display_name,
      product_name: p.product_name,
      product_price: p.product_price,
      hashrate: p.hashrate,
      description: p.description,
      duration_days: p.duration_days,
      duration_months: p.duration_months || 1,
      product_contract_duration: p.product_contract_duration,
      ios_product_id: p.ios_product_id,
      android_product_id: p.android_product_id,
      sort_order: p.sort_order
    }));
  }

  /** 手动清除缓存（后台管理修改配置后调用） */
  static clearCache() {
    _cache = null;
    _cacheAt = 0;
  }
}

module.exports = PaidProductService;
