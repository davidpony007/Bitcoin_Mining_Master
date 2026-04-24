// adminRoutes.js
// 管理员相关接口路由，负责后台统计和管理操作
const express = require('express'); // 引入 express 框架
const router = express.Router(); // 创建路由实例
const authenticateToken = require('../middleware/auth'); // JWT 认证中间件
const { requireAdmin } = require('../middleware/role'); // 管理员权限校验中间件
const CountryMiningService = require('../services/countryMiningService'); // 国家挖矿配置服务
const MiningConfigService = require('../services/miningConfigService'); // 基础挖矿速率配置服务
const pool = require('../config/database_native');
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const PointsService = require('../services/pointsService');
const AdPointsService = require('../services/adPointsService');
const jwt = require('jsonwebtoken');
const bitcoinPriceService = require('../services/bitcoinPriceService');

// ─── Admin Login ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/login
 * 管理员登录，返回含 role:admin 的 JWT
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2026';
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const secret = process.env.JWT_SECRET || 'default_secret';
  const token = jwt.sign({ user_id: 'admin', role: 'admin' }, secret, { expiresIn: '7d' });
  return res.json({ success: true, token, user: { id: 'admin', username: ADMIN_USERNAME, role: 'admin' } });
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/dashboard/stats
 * 仪表盘统计概览：总用户数、今日活跃、总收入、今日订单
 */
router.get('/dashboard/stats', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const [[totalUsersRow]] = await conn.query('SELECT COUNT(*) AS cnt FROM user_information');
    const [[todayActiveRow]] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM user_status WHERE DATE(last_login_time) = ?", [today]
    );
    const [[yesterdayActiveRow]] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM user_status WHERE DATE(last_login_time) = ?", [yesterday]
    );
    const [[firstSubRevRow]] = await conn.query(
      "SELECT COALESCE(ROUND(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))) * 0.75, 2), 0) AS val FROM user_orders WHERE order_status NOT IN ('renewing', 'refund successful', 'error')"
    );
    const [[renewalRevRow]] = await conn.query(
      "SELECT COALESCE(ROUND(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))) * 0.75, 2), 0) AS val FROM user_orders WHERE order_status = 'renewing'"
    );
    const [[todayOrdersRow]] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM user_orders WHERE DATE(order_creation_time) = ?", [today]
    );
    const [[newUsersRow]] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM user_information WHERE DATE(user_creation_time) = ?", [today]
    );
    const [[newUsersYestRow]] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM user_information WHERE DATE(user_creation_time) = ?", [yesterday]
    );

    const totalUsers = totalUsersRow.cnt;
    const todayActive = todayActiveRow.cnt;
    const yesterdayActive = yesterdayActiveRow.cnt;
    const totalRevenue = parseFloat(firstSubRevRow.val) + parseFloat(renewalRevRow.val);
    const todayOrders = todayOrdersRow.cnt;
    const newUsersToday = newUsersRow.cnt;
    const newUsersYest = newUsersYestRow.cnt;

    res.json({
      success: true,
      data: {
        totalUsers,
        todayActive,
        activeGrowth: yesterdayActive > 0 ? ((todayActive - yesterdayActive) / yesterdayActive * 100).toFixed(1) : '0',
        totalRevenue,
        todayOrders,
        newUsersToday,
        newUsersGrowth: newUsersYest > 0 ? ((newUsersToday - newUsersYest) / newUsersYest * 100).toFixed(1) : '0',
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/dashboard/trend?days=7
 * 仪表盘趋势：最近 N 天新增用户、活跃用户、订单数、收入
 */
router.get('/dashboard/trend', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90);
    const [newUsers] = await conn.query(
      `SELECT DATE(user_creation_time) AS d, COUNT(*) AS cnt
       FROM user_information
       WHERE user_creation_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(user_creation_time) ORDER BY d`, [days]
    );
    const [dau] = await conn.query(
      `SELECT DATE(last_login_time) AS d, COUNT(*) AS cnt
       FROM user_status
       WHERE last_login_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(last_login_time) ORDER BY d`, [days]
    );
    const [orders] = await conn.query(
      `SELECT DATE(order_creation_time) AS d, COUNT(*) AS cnt,
              COALESCE(ROUND(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))) * 0.75, 2), 0) AS revenue
       FROM user_orders
       WHERE order_creation_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         AND order_status NOT IN ('refund successful', 'error')
       GROUP BY DATE(order_creation_time) ORDER BY d`, [days]
    );

    // 合并为按日期索引的 map
    const map = {};
    const toKey = d => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
    newUsers.forEach(r => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].newUsers = r.cnt; });
    dau.forEach(r => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].dau = r.cnt; });
    orders.forEach(r => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].orders = r.cnt; map[k].revenue = parseFloat(r.revenue); });

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      result.push({ date: d, newUsers: map[d]?.newUsers || 0, dau: map[d]?.dau || 0, orders: map[d]?.orders || 0, revenue: map[d]?.revenue || 0 });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Dashboard trend error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users/list?page=1&limit=20&search=&status=
 * 分页用户列表，联合 user_status 表
 */
router.get('/users/list', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;
    const searchField = req.query.searchField || null;
    const status = req.query.status || null;
    const system = req.query.system || null;
    const country = req.query.country || null;
    const level = req.query.level ? parseInt(req.query.level) : null;

    const searchFieldMap = {
      email: 'ui.email', user_id: 'ui.user_id', google_account: 'ui.google_account',
      apple_account: 'ui.apple_account', apple_id: 'ui.apple_id', device_id: 'ui.device_id',
      idfa: 'ui.idfa', gaid: 'ui.gaid', register_ip: 'ui.register_ip',
    };
    const sortWhitelist = {
      user_creation_time: 'ui.user_creation_time', user_level: 'ui.user_level',
      user_points: 'ui.user_points', total_ad_views: 'ui.total_ad_views',
      country_multiplier: 'ui.country_multiplier', miner_level_multiplier: 'ui.miner_level_multiplier',
      mining_rate_per_second: 'mining_rate_per_second',
      current_bitcoin_balance: 'us.current_bitcoin_balance',
      bitcoin_accumulated_amount: 'us.bitcoin_accumulated_amount',
      last_login_time: 'us.last_login_time',
    };
    const sortByCol = sortWhitelist[req.query.sortBy] || 'ui.user_creation_time';
    const sortOrderStr = req.query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    let where = 'WHERE 1=1';
    const params = [];
    if (search) {
      if (searchField && searchFieldMap[searchField]) {
        where += ` AND ${searchFieldMap[searchField]} LIKE ?`;
        params.push(search);
      } else {
        where += ' AND (ui.email LIKE ? OR ui.user_id LIKE ? OR ui.google_account LIKE ? OR ui.apple_account LIKE ? OR ui.device_id LIKE ?)';
        params.push(search, search, search, search, search);
      }
    }
    if (status) { where += ' AND us.user_status = ?'; params.push(status); }
    if (system) { where += ' AND ui.`system` = ?'; params.push(system); }
    const acquisition = req.query.acquisition || null;
    if (acquisition) {
      if (acquisition === 'paid') { where += ' AND ui.acquisition_channel LIKE ?'; params.push('paid_%'); }
      else { where += ' AND ui.acquisition_channel = ?'; params.push(acquisition); }
    }
    if (country) { where += ' AND ui.country_code = ?'; params.push(country); }
    if (level !== null && !isNaN(level)) { where += ' AND ui.user_level = ?'; params.push(level); }

    const [[{ total }]] = await conn.query(
      `SELECT COUNT(*) AS total FROM user_information ui LEFT JOIN user_status us ON ui.user_id = us.user_id ${where}`, params
    );
    const [rows] = await conn.query(
      `SELECT ui.user_id, ui.email, ui.google_account, ui.apple_account, ui.country_code,
              ui.country_name_cn, ui.country_multiplier, ui.user_level, ui.miner_level_multiplier,
              ui.user_points, ui.total_ad_views, ui.\`system\`, ui.device_id,
              ui.acquisition_channel, ui.user_creation_time, ui.is_banned, ui.banned_at, ui.ban_reason,
              us.user_status, us.last_login_time, us.current_bitcoin_balance,
              us.bitcoin_accumulated_amount, us.total_withdrawal_amount, us.total_invitation_rebate,
              (
                SELECT COALESCE(SUM(
                  COALESCE(fc.base_hashrate, fc.hashrate)
                  * COALESCE(ui.miner_level_multiplier, 1.0)
                  * COALESCE(ui.country_multiplier, 1.0)
                  * IF(fc.has_daily_bonus = 1, 1.36, 1.0)
                ), 0)
                FROM free_contract_records fc
                WHERE fc.user_id = ui.user_id
                  AND fc.free_contract_end_time > NOW()
              ) + COALESCE((
                SELECT SUM(mc.hashrate)
                FROM mining_contracts mc
                WHERE mc.user_id = ui.user_id
                  AND mc.contract_end_time > NOW()
                  AND mc.is_cancelled = 0
              ), 0) AS mining_rate_per_second
       FROM user_information ui
       LEFT JOIN user_status us ON ui.user_id = us.user_id
       ${where}
       ORDER BY ${sortByCol} ${sortOrderStr}
       LIMIT ? OFFSET ?`, [...params, limit, offset]
    );
    res.json({ success: true, data: { total, page, limit, list: rows } });
  } catch (err) {
    console.error('Users list error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/users/stats
 * 用户统计：总数、活跃、新增
 */
router.get('/users/stats', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[totalRow]] = await conn.query('SELECT COUNT(*) AS cnt FROM user_information');
    const [[activeRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM user_status WHERE user_status = 'active within 3 days'");
    const [[todayRow]] = await conn.query('SELECT COUNT(*) AS cnt FROM user_information WHERE DATE(user_creation_time) = CURDATE()');
    const [[weekRow]] = await conn.query('SELECT COUNT(*) AS cnt FROM user_information WHERE user_creation_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)');
    const [[iosRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM user_information WHERE `system` = 'iOS'");
    const [[androidRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM user_information WHERE `system` = 'Android'");
    const [[invitedRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM user_information WHERE acquisition_channel = 'invited'");
    const [[organicRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM user_information WHERE acquisition_channel = 'organic'");
    const [[paidRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM user_information WHERE acquisition_channel LIKE 'paid_%'");
    res.json({ success: true, data: { total: totalRow.cnt, active: activeRow.cnt, newToday: todayRow.cnt, newThisWeek: weekRow.cnt, iosCount: iosRow.cnt, androidCount: androidRow.cnt, invitedCount: invitedRow.cnt, organicCount: organicRow.cnt, paidCount: paidRow.cnt } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── Orders ───────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/orders/list?page=1&limit=20&status=&search=
 * 分页订单列表
 */
router.get('/orders/list', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 200);
    const offset = (page - 1) * limit;
    // 统一搜索关键字：user_id / 订单号(payment_network_id) / 流水号(payment_gateway_id)
    const search      = req.query.search      ? `%${req.query.search}%` : null;
    // 兼容旧参数 uid
    const uid         = req.query.uid         ? `%${req.query.uid}%` : null;
    const searchKw    = search || uid;
    const status      = req.query.status      || null;
    const platform    = req.query.platform    || null;   // 'Android' | 'iOS'
    const startDate   = req.query.startDate   || null;
    const endDate     = req.query.endDate     || null;
    const productName = req.query.productName || null;   // 标题筛选
    const country     = req.query.country     ? `%${req.query.country}%` : null;  // 国家筛选
    const orderType   = req.query.orderType   || null;   // 'first' | 'renewal'

    const fromClause = 'FROM user_orders o LEFT JOIN user_information ui ON ui.user_id = o.user_id';
    let where = 'WHERE 1=1';
    const params = [];

    if (searchKw)   { where += ' AND (o.user_id LIKE ? OR o.payment_network_id LIKE ? OR o.payment_gateway_id LIKE ?)'; params.push(searchKw, searchKw, searchKw); }
    if (status)     { where += ' AND o.order_status = ?'; params.push(status); }
    if (platform === 'Android') { where += " AND o.payment_gateway_id LIKE 'GPA.%'"; }
    if (platform === 'iOS')     { where += " AND o.payment_gateway_id NOT LIKE 'GPA.%'"; }
    if (startDate)  { where += ' AND DATE(o.order_creation_time) >= ?'; params.push(startDate); }
    if (endDate)    { where += ' AND DATE(o.order_creation_time) <= ?'; params.push(endDate); }
    if (productName){ where += ' AND o.product_name = ?'; params.push(productName); }
    if (country)    { where += ' AND (COALESCE(o.country_code, ui.country_code) LIKE ? OR ui.country_name_cn LIKE ?)'; params.push(country, country); }
    // orderType 过滤：通过子查询判断 sub_seq，first=1，renewal>1
    if (orderType === 'new_user_first') {
      // 新用户首购：该产品首次订阅(sub_seq=1) 且 是用户第一笔订单(user_seq=1)
      where += ` AND (SELECT COUNT(*) FROM user_orders uo_f WHERE uo_f.user_id = o.user_id AND uo_f.product_id = o.product_id
                       AND (uo_f.order_creation_time < o.order_creation_time OR (uo_f.order_creation_time = o.order_creation_time AND uo_f.id <= o.id))) = 1`;
      where += ` AND (SELECT COUNT(*) FROM user_orders uo_u WHERE uo_u.user_id = o.user_id
                       AND (uo_u.order_creation_time < o.order_creation_time OR (uo_u.order_creation_time = o.order_creation_time AND uo_u.id <= o.id))) = 1`;
    } else if (orderType === 'cross_product') {
      // 跨产品首购：该产品首次订阅(sub_seq=1) 但 不是用户第一笔订单(user_seq>1)
      where += ` AND (SELECT COUNT(*) FROM user_orders uo_f WHERE uo_f.user_id = o.user_id AND uo_f.product_id = o.product_id
                       AND (uo_f.order_creation_time < o.order_creation_time OR (uo_f.order_creation_time = o.order_creation_time AND uo_f.id <= o.id))) = 1`;
      where += ` AND (SELECT COUNT(*) FROM user_orders uo_u WHERE uo_u.user_id = o.user_id
                       AND (uo_u.order_creation_time < o.order_creation_time OR (uo_u.order_creation_time = o.order_creation_time AND uo_u.id <= o.id))) > 1`;
    } else if (orderType === 'renewal') {
      // 续订：该产品第二次及以上订阅(sub_seq>1)
      where += ` AND (SELECT COUNT(*) FROM user_orders uo_r WHERE uo_r.user_id = o.user_id AND uo_r.product_id = o.product_id
                       AND (uo_r.order_creation_time < o.order_creation_time OR (uo_r.order_creation_time = o.order_creation_time AND uo_r.id <= o.id))) > 1`;
    } else if (orderType === 'first') {
      // 兼容旧值：首购（同 new_user_first + cross_product）
      where += ` AND (SELECT COUNT(*) FROM user_orders uo_f WHERE uo_f.user_id = o.user_id AND uo_f.product_id = o.product_id
                       AND (uo_f.order_creation_time < o.order_creation_time OR (uo_f.order_creation_time = o.order_creation_time AND uo_f.id <= o.id))) = 1`;
    }

    const [[{ total }]] = await conn.query(`SELECT COUNT(*) AS total ${fromClause} ${where}`, params);
    const [rows] = await conn.query(
      `SELECT o.id, o.user_id, o.email, o.google_account, o.product_id, o.product_name, o.product_price,
              o.order_status, o.order_creation_time, o.payment_time, o.currency_type,
              COALESCE(o.country_code, ui.country_code) AS country_code,
              ui.country_name_cn,
              o.payment_gateway_id, o.payment_network_id,
              (SELECT COUNT(*) FROM user_orders uo2
               WHERE uo2.user_id = o.user_id AND uo2.product_id = o.product_id
                 AND (uo2.order_creation_time < o.order_creation_time
                      OR (uo2.order_creation_time = o.order_creation_time AND uo2.id <= o.id))) AS sub_seq,
              (SELECT COUNT(*) FROM user_orders uo3
               WHERE uo3.user_id = o.user_id
                 AND (uo3.order_creation_time < o.order_creation_time
                      OR (uo3.order_creation_time = o.order_creation_time AND uo3.id <= o.id))) AS user_seq
       ${fromClause} ${where}
       ORDER BY o.id DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset]
    );
    res.json({ success: true, data: { total, page, limit, list: rows } });
  } catch (err) {
    console.error('Orders list error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/orders/subscription-stats
 * 订阅用户数统计 + 各档位活跃/取消明细
 */
router.get('/orders/subscription-stats', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    // 正在订阅中的用户总数
    const [[activeUsersRow]] = await conn.query(
      `SELECT COUNT(DISTINCT user_id) AS cnt FROM user_orders WHERE order_status IN ('active','renewing')`
    );
    // 活跃中的付费plan总数
    const [[activePlansRow]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM user_orders WHERE order_status IN ('active','renewing')`
    );
    // 已取消订阅的用户总数（mining_contracts 中明确标记 is_cancelled=1 的唯一用户）
    const [[cancelledUsersRow]] = await conn.query(
      `SELECT COUNT(DISTINCT user_id) AS cnt FROM mining_contracts WHERE is_cancelled = 1 AND contract_type = 'paid contract'`
    );
    // 已取消的plan总数
    const [[cancelledPlansRow]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM mining_contracts WHERE is_cancelled = 1 AND contract_type = 'paid contract'`
    );
    // 各档位活跃订阅数
    const [activeByPlan] = await conn.query(
      `SELECT product_name, product_price,
              COUNT(DISTINCT user_id) AS user_cnt,
              COUNT(*) AS plan_cnt
       FROM user_orders
       WHERE order_status IN ('active','renewing')
       GROUP BY product_name, product_price
       ORDER BY CAST(product_price AS DECIMAL(10,2))`
    );
    // 各档位已结束/取消订阅数（order_status='complete' 代表订阅周期结束或被取消）
    const [cancelledByPlan] = await conn.query(
      `SELECT product_name, product_price,
              COUNT(DISTINCT user_id) AS user_cnt,
              COUNT(*) AS plan_cnt
       FROM user_orders
       WHERE order_status = 'complete'
       GROUP BY product_name, product_price
       ORDER BY CAST(product_price AS DECIMAL(10,2))`
    );
    res.json({
      success: true,
      data: {
        summary: {
          activeUsers:    parseInt(activeUsersRow.cnt),
          activePlans:    parseInt(activePlansRow.cnt),
          cancelledUsers: parseInt(cancelledUsersRow.cnt),
          cancelledPlans: parseInt(cancelledPlansRow.cnt),
        },
        activeByPlan,
        cancelledByPlan,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/orders/stats
 * 订单统计汇总
 */
router.get('/orders/stats', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[totalRow]] = await conn.query('SELECT COUNT(*) AS cnt, COALESCE(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))),0) AS revenue FROM user_orders');
    const [[activeRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM user_orders WHERE order_status = 'active'");
    const [[refundRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM user_orders WHERE order_status IN ('refund request in progress','refund successful')");
    const [[todayRow]] = await conn.query("SELECT COUNT(*) AS cnt, COALESCE(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))),0) AS revenue FROM user_orders WHERE DATE(order_creation_time) = CURDATE()");
    res.json({
      success: true,
      data: {
        total: totalRow.cnt, totalRevenue: parseFloat(totalRow.revenue),
        active: activeRow.cnt, refund: refundRow.cnt,
        todayOrders: todayRow.cnt, todayRevenue: parseFloat(todayRow.revenue)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * DELETE /api/admin/orders/:id  删除单条订单
 */
router.delete('/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '无效ID' });
    await conn.query('DELETE FROM user_orders WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

/**
 * POST /api/admin/orders/bulk-delete  批量删除订单
 */
router.post('/orders/bulk-delete', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids不能为空' });
    const placeholders = ids.map(() => '?').join(',');
    await conn.query(`DELETE FROM user_orders WHERE id IN (${placeholders})`, ids);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

/**
 * POST /api/admin/orders/add  手动新增订单
 */
router.post('/orders/add', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      user_id, email = '', google_account = null,
      product_id, product_name, product_price,
      payment_gateway_id, payment_network_id,
      currency_type = 'USD', country_code = null,
      order_status = 'active', payment_time = null,
    } = req.body;
    if (!user_id || !product_id || !payment_gateway_id || !payment_network_id)
      return res.status(400).json({ success: false, message: '必填字段缺失' });
    await conn.query(
      `INSERT INTO user_orders
         (user_id, email, google_account, product_id, product_name, product_price,
          payment_gateway_id, payment_network_id, currency_type, country_code,
          order_status, payment_time, hashrate, order_creation_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [user_id, email, google_account, product_id, product_name, product_price,
       payment_gateway_id, payment_network_id, currency_type, country_code,
       order_status, payment_time || null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ─── Mining ───────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/mining/list?page=1&limit=20&type=&search=
 * 分页挖矿合约列表（含用户信息）
 */
router.get('/mining/list', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;
    const type = req.query.type || null;

    let where = 'WHERE 1=1';
    const params = [];
    if (search) { where += ' AND (mc.user_id LIKE ? OR ui.email LIKE ?)'; params.push(search, search); }
    if (type) { where += ' AND mc.contract_type = ?'; params.push(type); }

    const [[{ total }]] = await conn.query(
      `SELECT COUNT(*) AS total FROM mining_contracts mc LEFT JOIN user_information ui ON mc.user_id = ui.user_id ${where}`, params
    );
    const [rows] = await conn.query(
      `SELECT mc.id, mc.user_id, ui.email, mc.contract_type,
              mc.contract_creation_time, mc.contract_end_time,
              mc.hashrate,
              CASE WHEN mc.contract_end_time > NOW() THEN 'active' ELSE 'expired' END AS status
       FROM mining_contracts mc
       LEFT JOIN user_information ui ON mc.user_id = ui.user_id
       ${where}
       ORDER BY mc.contract_creation_time DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset]
    );
    res.json({ success: true, data: { total, page, limit, list: rows } });
  } catch (err) {
    console.error('Mining list error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/mining/stats
 * 挖矿整体统计
 */
router.get('/mining/stats', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[totalRow]] = await conn.query('SELECT COUNT(*) AS cnt FROM mining_contracts');
    const [[activeRow]] = await conn.query("SELECT COUNT(*) AS cnt, COALESCE(SUM(hashrate),0) AS totalHashrate FROM mining_contracts WHERE contract_end_time > NOW()");
    const [typeRows] = await conn.query("SELECT contract_type, COUNT(*) AS cnt FROM mining_contracts GROUP BY contract_type");
    res.json({
      success: true,
      data: {
        total: totalRow.cnt,
        active: activeRow.cnt,
        totalHashrate: parseFloat(activeRow.totalHashrate) || 0,
        byType: typeRows
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── Points ───────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/points/leaderboard?page=1&limit=20&search=
 * 积分排行榜
 */
router.get('/points/leaderboard', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;

    let where = 'WHERE 1=1';
    const params = [];
    if (search) { where += ' AND (ui.user_id LIKE ? OR ui.email LIKE ?)'; params.push(search, search); }

    const [[{ total }]] = await conn.query(
      `SELECT COUNT(*) AS total FROM user_information ui ${where}`, params
    );
    const [rows] = await conn.query(
      `SELECT ui.user_id, ui.email, ui.user_points, ui.user_level, ui.total_ad_views, ui.user_creation_time
       FROM user_information ui
       ${where}
       ORDER BY ui.user_points DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset]
    );
    res.json({ success: true, data: { total, page, limit, list: rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/points/transactions?page=1&limit=20&userId=&type=
 * 积分交易记录
 */
router.get('/points/transactions', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const userId = req.query.userId || null;
    const type = req.query.type || null;

    let where = 'WHERE 1=1';
    const params = [];
    if (userId) { where += ' AND pt.user_id = ?'; params.push(userId); }
    if (type) { where += ' AND pt.points_type = ?'; params.push(type); }

    const [[{ total }]] = await conn.query(
      `SELECT COUNT(*) AS total FROM points_transaction pt ${where}`, params
    );
    const [rows] = await conn.query(
      `SELECT pt.id, pt.user_id, ui.email, pt.points_type, pt.points_change,
              pt.balance_after, pt.description, pt.created_at, pt.related_user_id
       FROM points_transaction pt
       LEFT JOIN user_information ui ON pt.user_id = ui.user_id
       ${where}
       ORDER BY pt.created_at DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset]
    );
    res.json({ success: true, data: { total, page, limit, list: rows } });
  } catch (err) {
    console.error('Points transactions error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/points/stats
 * 积分整体统计
 */
router.get('/points/stats', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[totalRow]] = await conn.query('SELECT COALESCE(SUM(user_points),0) AS totalPoints, COUNT(*) AS users FROM user_information');
    const [[todayRow]] = await conn.query("SELECT COALESCE(SUM(points_change),0) AS pts FROM points_transaction WHERE DATE(created_at) = CURDATE() AND points_change > 0");
    const [[txRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM points_transaction WHERE DATE(created_at) = CURDATE()");
    res.json({ success: true, data: { totalPoints: parseFloat(totalRow.totalPoints), users: totalRow.users, todayEarned: parseFloat(todayRow.pts), todayTx: txRow.cnt } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── CheckIn ──────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/checkin/list?page=1&limit=20&search=
 * 用户签到汇总列表
 */
router.get('/checkin/list', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;

    let where = 'WHERE 1=1';
    const params = [];
    if (search) { where += ' AND (ci.user_id LIKE ? OR ui.email LIKE ?)'; params.push(search, search); }

    const [[{ total }]] = await conn.query(
      `SELECT COUNT(DISTINCT ci.user_id) AS total FROM user_check_in ci LEFT JOIN user_information ui ON ci.user_id = ui.user_id ${where}`, params
    );
    const [rows] = await conn.query(
      `SELECT ci.user_id, ui.email,
              COUNT(*) AS totalDays,
              MAX(ci.cumulative_days) AS maxCumulative,
              MAX(ci.check_in_date) AS lastCheckIn,
              COALESCE(SUM(ci.points_earned),0) AS totalRewards
       FROM user_check_in ci
       LEFT JOIN user_information ui ON ci.user_id = ui.user_id
       ${where}
       GROUP BY ci.user_id, ui.email
       ORDER BY totalDays DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset]
    );
    res.json({ success: true, data: { total, page, limit, list: rows } });
  } catch (err) {
    console.error('CheckIn list error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/checkin/stats
 * 签到整体统计
 */
router.get('/checkin/stats', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[todayRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM user_check_in WHERE check_in_date = CURDATE()");
    const [[totalRow]] = await conn.query("SELECT COUNT(*) AS cnt, COUNT(DISTINCT user_id) AS users FROM user_check_in");
    const [[weekRow]] = await conn.query("SELECT COUNT(DISTINCT user_id) AS cnt FROM user_check_in WHERE check_in_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)");
    const [trendRows] = await conn.query(
      "SELECT check_in_date AS d, COUNT(*) AS cnt FROM user_check_in WHERE check_in_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY check_in_date ORDER BY d"
    );
    res.json({ success: true, data: { todayCount: todayRow.cnt, totalRecords: totalRow.cnt, totalUsers: totalRow.users, weekActiveUsers: weekRow.cnt, trend: trendRows } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── Geography ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/geography/data
 * 按国家分布的用户和收入数据
 */
router.get('/geography/data', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [userRows] = await conn.query(
      `SELECT COALESCE(country_code,'Unknown') AS country, COUNT(*) AS users
       FROM user_information GROUP BY country_code ORDER BY users DESC LIMIT 50`
    );
    const [revenueRows] = await conn.query(
      `SELECT COALESCE(country_code,'Unknown') AS country,
              COUNT(*) AS orders,
              COALESCE(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))),0) AS revenue
       FROM user_orders GROUP BY country_code ORDER BY revenue DESC LIMIT 50`
    );
    // 合并
    const map = {};
    userRows.forEach(r => { map[r.country] = { country: r.country, users: r.users, orders: 0, revenue: 0 }; });
    revenueRows.forEach(r => {
      if (!map[r.country]) map[r.country] = { country: r.country, users: 0 };
      map[r.country].orders = r.orders;
      map[r.country].revenue = parseFloat(r.revenue);
    });
    const list = Object.values(map).sort((a, b) => b.users - a.users);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/analytics/trend?days=30
 * 多维度趋势分析（用户/收入/订单）
 */
router.get('/analytics/trend', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const [newUsers] = await conn.query(
      `SELECT DATE(user_creation_time) AS d, COUNT(*) AS users
       FROM user_information WHERE user_creation_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(user_creation_time) ORDER BY d`, [days]
    );
    const [orders] = await conn.query(
      `SELECT DATE(order_creation_time) AS d, COUNT(*) AS orders,
              COALESCE(ROUND(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))) * 0.75, 2), 0) AS revenue
       FROM user_orders WHERE order_creation_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         AND order_status NOT IN ('refund successful', 'error')
       GROUP BY DATE(order_creation_time) ORDER BY d`, [days]
    );
    const [checkins] = await conn.query(
      `SELECT check_in_date AS d, COUNT(*) AS checkins
       FROM user_check_in WHERE check_in_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY check_in_date ORDER BY d`, [days]
    );

    const map = {};
    const toKey = d => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
    newUsers.forEach(r => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].users = r.users; });
    orders.forEach(r => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].orders = r.orders; map[k].revenue = parseFloat(r.revenue); });
    checkins.forEach(r => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].checkins = r.checkins; });

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      result.push({ date: d, users: map[d]?.users || 0, orders: map[d]?.orders || 0, revenue: map[d]?.revenue || 0, checkins: map[d]?.checkins || 0 });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/analytics/country-rank?days=30
 * 国家排名（用户数 + 收入）
 */
router.get('/analytics/country-rank', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT COALESCE(ui.country_code,'Unknown') AS country,
              COUNT(DISTINCT ui.user_id) AS users,
              COALESCE(ROUND(SUM(CAST(CONVERT(uo.product_price, CHAR) AS DECIMAL(10,2))) * 0.75, 2), 0) AS revenue
       FROM user_information ui
       LEFT JOIN user_orders uo ON ui.user_id = uo.user_id
         AND uo.order_status NOT IN ('refund successful', 'error')
       GROUP BY country ORDER BY users DESC LIMIT 20`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── Ads ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/ads/stats
 * 广告整体统计
 */
router.get('/ads/stats', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[totalRow]] = await conn.query('SELECT COALESCE(SUM(total_ad_views),0) AS total, COUNT(*) AS users FROM user_information');
    const [[todayRow]] = await conn.query('SELECT COALESCE(SUM(view_count),0) AS cnt FROM ad_view_record WHERE view_date = CURDATE()');
    const [[weekRow]] = await conn.query('SELECT COALESCE(SUM(view_count),0) AS cnt FROM ad_view_record WHERE view_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)');
    const [[rewardRow]] = await conn.query("SELECT COALESCE(SUM(points_change),0) AS pts FROM points_transaction WHERE points_type LIKE '%AD%' OR points_type LIKE '%ad%' AND points_change > 0");
    res.json({
      success: true,
      data: {
        totalViews: parseFloat(totalRow.total),
        totalUsers: totalRow.users,
        todayViews: parseFloat(todayRow.cnt),
        weekViews: parseFloat(weekRow.cnt),
        totalRewards: parseFloat(rewardRow.pts)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/ads/trend?days=30
 * 广告观看趋势
 */
router.get('/ads/trend', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const [rows] = await conn.query(
      `SELECT view_date AS d, SUM(view_count) AS views, COUNT(DISTINCT user_id) AS watchers,
              COALESCE(SUM(points_earned),0) AS rewards
       FROM ad_view_record
       WHERE view_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY view_date ORDER BY d`, [days]
    );
    const map = {};
    rows.forEach(r => {
      const k = r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10);
      map[k] = { views: parseInt(r.views), watchers: r.watchers, rewards: parseFloat(r.rewards) };
    });
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      result.push({ date: d, views: map[d]?.views || 0, watchers: map[d]?.watchers || 0, rewards: map[d]?.rewards || 0 });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/ads/top-users?limit=20
 * 广告观看 Top 用户
 */
router.get('/ads/top-users', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const [rows] = await conn.query(
      `SELECT ui.user_id, ui.email, ui.total_ad_views, ui.user_points,
              COALESCE(avr.today_views,0) AS todayViews
       FROM user_information ui
       LEFT JOIN (
         SELECT user_id, SUM(view_count) AS today_views FROM ad_view_record WHERE view_date = CURDATE() GROUP BY user_id
       ) avr ON ui.user_id COLLATE utf8mb4_unicode_ci = avr.user_id COLLATE utf8mb4_unicode_ci
       ORDER BY ui.total_ad_views DESC LIMIT ?`, [limit]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── DataCenter ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/datacenter/daily?days=30
 * 每日综合数据（用于 DataCenter 报表）
 */
router.get('/datacenter/daily', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    // Support both startDate/endDate (new) and legacy days param
    let startDate, endDate;
    if (req.query.startDate && req.query.endDate) {
      startDate = req.query.startDate;
      endDate   = req.query.endDate;
    } else {
      const days = Math.min(parseInt(req.query.days) || 30, 365);
      endDate   = new Date().toISOString().slice(0, 10);
      startDate = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    }

    const [newUsers] = await conn.query(
      `SELECT DATE(user_creation_time) AS d, COUNT(*) AS cnt FROM user_information
       WHERE DATE(user_creation_time) BETWEEN ? AND ?
       GROUP BY DATE(user_creation_time)`, [startDate, endDate]);

    const [dau] = await conn.query(
      `SELECT DATE(last_login_time) AS d, COUNT(*) AS cnt FROM user_status
       WHERE DATE(last_login_time) BETWEEN ? AND ?
       GROUP BY DATE(last_login_time)`, [startDate, endDate]);

    // 首次订阅订单（不含续期）
    const [orders] = await conn.query(
      `SELECT DATE(order_creation_time) AS d, COUNT(*) AS cnt,
              COALESCE(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))), 0) AS salesAmount,
              COALESCE(ROUND(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))) * 0.75, 2), 0) AS revenue
       FROM user_orders
       WHERE DATE(order_creation_time) BETWEEN ? AND ?
         AND order_status NOT IN ('renewing', 'refund successful', 'error')
       GROUP BY DATE(order_creation_time)`, [startDate, endDate]);

    // 续期订单
    const [renewalOrders] = await conn.query(
      `SELECT DATE(order_creation_time) AS d, COUNT(*) AS cnt,
              COALESCE(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))), 0) AS amount
       FROM user_orders
       WHERE DATE(order_creation_time) BETWEEN ? AND ?
         AND order_status = 'renewing'
       GROUP BY DATE(order_creation_time)`, [startDate, endDate]);

    // 广告观看量
    const [adViews] = await conn.query(
      `SELECT view_date AS d, SUM(view_count) AS views
       FROM ad_view_record
       WHERE view_date BETWEEN ? AND ?
       GROUP BY view_date`, [startDate, endDate]);

    // 广告奖励积分（来自points_transaction AD_VIEW类型）
    const [adRewardRows] = await conn.query(
      `SELECT DATE(created_at) AS d, SUM(points_change) AS rewards
       FROM points_transaction
       WHERE points_type = 'AD_VIEW'
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)`, [startDate, endDate]);

    // 提现记录（使用 received_amount 为实际BTC到账数量）
    const [withdrawals] = await conn.query(
      `SELECT DATE(created_at) AS d, COUNT(*) AS cnt,
              COALESCE(SUM(received_amount), 0) AS btcAmount
       FROM withdrawal_records
       WHERE withdrawal_status = 'success'
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)`, [startDate, endDate]);

    const [checkins] = await conn.query(
      `SELECT check_in_date AS d, COUNT(*) AS cnt
       FROM user_check_in
       WHERE check_in_date BETWEEN ? AND ?
       GROUP BY check_in_date`, [startDate, endDate]);

    const toKey = d => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
    const map = {};
    newUsers.forEach(r       => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].newUsers           = r.cnt; });
    dau.forEach(r            => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].dau                = r.cnt; });
    orders.forEach(r         => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].orders = r.cnt; map[k].salesAmount = parseFloat(r.salesAmount); map[k].revenue = parseFloat(r.revenue); });
    renewalOrders.forEach(r  => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].renewalCount       = r.cnt; map[k].renewalAmount = parseFloat(r.amount); });
    adViews.forEach(r        => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].adViews            = parseInt(r.views); });
    adRewardRows.forEach(r   => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].adRewards          = parseFloat(r.rewards); });
    withdrawals.forEach(r    => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].withdrawals        = r.cnt; map[k].withdrawalBtcAmount = parseFloat(r.btcAmount); });
    checkins.forEach(r       => { const k = toKey(r.d); map[k] = map[k] || {}; map[k].checkins           = r.cnt; });

    // 生成日期序列
    const dates = [];
    let cur = new Date(startDate);
    const endD = new Date(endDate);
    while (cur <= endD) { dates.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }

    const result = dates.map(d => {
      const m = map[d] || {};
      return {
        date: d,
        newUsers:             m.newUsers            || 0,
        dau:                  m.dau                 || 0,
        firstSubOrders:       m.orders              || 0,
        firstSubAmount:       parseFloat((m.salesAmount          || 0).toFixed(2)),
        firstSubRevenue:      m.revenue             || 0,
        renewalCount:         m.renewalCount        || 0,
        renewalAmount:        parseFloat((m.renewalAmount        || 0).toFixed(2)),
        renewalRevenue:       parseFloat(((m.renewalAmount || 0) * 0.75).toFixed(2)),
        adViews:              m.adViews             || 0,
        adRewards:            parseFloat((m.adRewards            || 0).toFixed(10)),
        withdrawals:          m.withdrawals         || 0,
        withdrawalBtcAmount:  parseFloat((m.withdrawalBtcAmount  || 0).toFixed(8)),
        checkins:             m.checkins            || 0,
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('DataCenter daily error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── DataCenter daily-report (完整每日业务报表) ───────────────────────────────

/**
 * GET /api/admin/datacenter/daily-report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&platform=Android
 */
router.get('/datacenter/daily-report', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const platform = req.query.platform || 'Android';
    const endDate   = (req.query.endDate   || new Date().toISOString().slice(0, 10));
    const startDate = (req.query.startDate || new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));

    const toKey = d => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

    // 1. 每日新增用户
    const [nuRows] = await conn.query(
      `SELECT DATE(user_creation_time) AS d, COUNT(*) AS cnt
       FROM user_information
       WHERE DATE(user_creation_time) BETWEEN ? AND ?
       GROUP BY DATE(user_creation_time)`, [startDate, endDate]);

    // 2. DAU
    const [dauRows] = await conn.query(
      `SELECT DATE(last_login_time) AS d, COUNT(*) AS cnt
       FROM user_status
       WHERE DATE(last_login_time) BETWEEN ? AND ?
       GROUP BY DATE(last_login_time)`, [startDate, endDate]);

    // 3. 首次订阅订单（新购 & 跨产品首购，不含续订）
    const [ordRows] = await conn.query(
      `SELECT DATE(order_creation_time) AS d,
              COUNT(*) AS cnt,
              COALESCE(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))),0) AS revenue
       FROM user_orders
       WHERE DATE(order_creation_time) BETWEEN ? AND ?
         AND order_status NOT IN ('renewing', 'refund successful','error')
       GROUP BY DATE(order_creation_time)`, [startDate, endDate]);

    // 3b. 续期订单（order_status = 'renewing'）
    const [renewOrdRows] = await conn.query(
      `SELECT DATE(order_creation_time) AS d,
              COUNT(*) AS cnt,
              COALESCE(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))),0) AS amount
       FROM user_orders
       WHERE DATE(order_creation_time) BETWEEN ? AND ?
         AND order_status = 'renewing'
       GROUP BY DATE(order_creation_time)`, [startDate, endDate]);

    // 4. 取消订阅（按实际取消时间统计，cancelled_at 在 is_cancelled=1 时写入）
    const [cancelRows] = await conn.query(
      `SELECT DATE(cancelled_at) AS d, COUNT(*) AS cnt
       FROM mining_contracts
       WHERE DATE(cancelled_at) BETWEEN ? AND ?
         AND is_cancelled = 1
         AND contract_type = 'paid contract'
       GROUP BY DATE(cancelled_at)`, [startDate, endDate]);

    // 5. 广告投放数据
    const [adRows] = await conn.query(
      `SELECT stat_date, google_spend, applovin_spend, mintegral_spend,
              ad_new_users, new_users_m1, new_users_m2,
              cancel_count, renewal_count, renewal_amount,
              renewal_revenue, ad_count, ad_revenue, btc_avg_price
       FROM daily_ad_stats
       WHERE stat_date BETWEEN ? AND ? AND platform = ?`, [startDate, endDate, platform]);

    // 5b. 每日送出BTC数量（所有类型）
    const [btcSentRows] = await conn.query(
      `SELECT DATE(transaction_creation_time) AS d, SUM(transaction_amount) AS sent
       FROM bitcoin_transaction_records
       WHERE DATE(transaction_creation_time) BETWEEN ? AND ?
       GROUP BY DATE(transaction_creation_time)`, [startDate, endDate]);

    // 5c. 每日提现BTC数量
    const [wdDailyRows] = await conn.query(
      `SELECT DATE(created_at) AS d, SUM(received_amount) AS amt
       FROM withdrawal_records
       WHERE withdrawal_status = 'success'
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)`, [startDate, endDate]);

    // 5d. 次留数：D日注册的用户中，在D+1日有活跃记录的用户数
    // 查询范围：startDate 的前一天注册的用户是否在 startDate 活跃，直到 endDate 前一天注册用户在 endDate 的活跃
    // 即：注册日为 [startDate-1, endDate-1]，但在报表中展示到对应的 D+1 日（即 [startDate, endDate]）
    const [retentionRows] = await conn.query(
      `SELECT
         DATE_ADD(DATE(ui.user_creation_time), INTERVAL 1 DAY) AS retention_date,
         COUNT(DISTINCT uda.user_id) AS d1_count,
         COUNT(DISTINCT ui.user_id)  AS reg_count
       FROM user_information ui
       LEFT JOIN user_daily_active uda
         ON uda.user_id = ui.user_id
         AND uda.active_date = DATE_ADD(DATE(ui.user_creation_time), INTERVAL 1 DAY)
       WHERE DATE(ui.user_creation_time) BETWEEN DATE_SUB(?, INTERVAL 1 DAY) AND DATE_SUB(?, INTERVAL 1 DAY)
       GROUP BY DATE_ADD(DATE(ui.user_creation_time), INTERVAL 1 DAY)`,
      [startDate, endDate]);


    // 6. BTC 汇总统计（使用每个用户最新一笔非 NULL balance_after，避免 NULL 记录导致余额丢失）
    const [[btcRow]] = await conn.query(
      `SELECT COALESCE(SUM(t.balance_after), 0) AS totalBtc
       FROM bitcoin_transaction_records t
       INNER JOIN (
         SELECT user_id, MAX(id) AS mid
         FROM bitcoin_transaction_records
         WHERE balance_after IS NOT NULL
         GROUP BY user_id
       ) x ON t.id = x.mid`);
    const [[wdRow]] = await conn.query(
      `SELECT COALESCE(SUM(received_amount),0) AS totalWithdrawn
       FROM withdrawal_records WHERE withdrawal_status = 'success'`);

    const BTC_PRICE = 74000; // 可在 app_config 中配置
    const totalBtc       = parseFloat(btcRow.totalBtc || 0);
    const totalWithdrawn = parseFloat(wdRow.totalWithdrawn || 0);
    const summary = {
      totalBtcBalance: totalBtc,
      totalBtcBalanceUsd: (totalBtc * BTC_PRICE).toFixed(4),
      totalWithdrawn,
      totalWithdrawnUsd: (totalWithdrawn * BTC_PRICE).toFixed(4),
    };

    // 构建 map
    const nuMap = {}, dauMap = {}, ordMap = {}, renewOrdMap = {}, cancelMap = {}, adMap = {}, btcSentMap = {}, wdDailyMap = {}, retentionMap = {};
    nuMap; dauMap; ordMap; renewOrdMap; cancelMap; adMap; btcSentMap; wdDailyMap; retentionMap; // prevent unused warning
    nuRows.forEach(r     => { nuMap[toKey(r.d)]     = parseInt(r.cnt); });
    dauRows.forEach(r    => { dauMap[toKey(r.d)]    = parseInt(r.cnt); });
    ordRows.forEach(r    => { ordMap[toKey(r.d)]    = { cnt: parseInt(r.cnt), revenue: parseFloat(r.revenue) }; });
    renewOrdRows.forEach(r => { renewOrdMap[toKey(r.d)] = { cnt: parseInt(r.cnt), amount: parseFloat(r.amount) }; });
    cancelRows.forEach(r => { cancelMap[toKey(r.d)] = parseInt(r.cnt); });
    adRows.forEach(r     => { adMap[toKey(r.stat_date)] = r; });
    btcSentRows.forEach(r  => { btcSentMap[toKey(r.d)]  = parseFloat(r.sent || 0); });
    wdDailyRows.forEach(r  => { wdDailyMap[toKey(r.d)]  = parseFloat(r.amt  || 0); });
    retentionRows.forEach(r => {
      retentionMap[toKey(r.retention_date)] = {
        d1Count:  parseInt(r.d1_count  || 0),
        regCount: parseInt(r.reg_count || 0),
      };
    });

    // 生成日期序列
    const dates = [];
    let cur = new Date(startDate);
    const endD = new Date(endDate);
    while (cur <= endD) { dates.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }

    const rows = dates.map(d => {
      const ad = adMap[d] || {};
      const googleSpend     = parseFloat(ad.google_spend    || 0);
      const applovinSpend   = parseFloat(ad.applovin_spend  || 0);
      const mintegralSpend  = parseFloat(ad.mintegral_spend || 0);
      const totalSpend      = parseFloat((googleSpend + applovinSpend + mintegralSpend).toFixed(2));
      const adNewUsers      = parseInt(ad.ad_new_users  || 0);
      const newUsersM1      = parseInt(ad.new_users_m1  || 0);
      const newUsersM2      = parseInt(ad.new_users_m2  || 0);
      const totalNewUsers   = nuMap[d]  || 0;
      const dauVal          = dauMap[d] || 0;
      const ord             = ordMap[d] || {};
      const subOrders       = ord.cnt     || 0;
      const salesAmount     = parseFloat((ord.revenue || 0).toFixed(2));
      const subRevenue      = parseFloat((salesAmount * 0.75).toFixed(2));
      const cancelCount     = (cancelMap[d] || 0) + parseInt(ad.cancel_count || 0);
      const renewOrd        = renewOrdMap[d] || {};
      const renewalCount    = renewOrd.cnt    || 0;
      const renewalAmount   = parseFloat((renewOrd.amount || 0).toFixed(2));
      const renewalRevenue  = parseFloat((renewalAmount * 0.75).toFixed(2));
      const adCount         = parseInt(ad.ad_count           || 0);
      const adRevenue       = parseFloat(ad.ad_revenue       || 0);
      const btcAvgPrice     = parseFloat(ad.btc_avg_price    || 0) || BTC_PRICE;
      const btcSentAmount      = btcSentMap[d] || 0;
      const withdrawalBtcAmount= wdDailyMap[d] || 0;
      const adPerUser          = dauVal   > 0 ? parseFloat((adCount / dauVal).toFixed(2)) : 0;
      const ecpm               = adCount  > 0 ? parseFloat(((adRevenue / adCount) * 1000).toFixed(2)) : 0;
      const totalRevenue       = parseFloat((subRevenue + adRevenue + renewalRevenue).toFixed(2));
      const btcSentValue       = parseFloat((btcSentAmount    * btcAvgPrice).toFixed(2));
      const withdrawalBtcValue = parseFloat((withdrawalBtcAmount * btcAvgPrice).toFixed(2));
      const actualCost         = totalSpend;
      const profitSent         = parseFloat((totalRevenue - actualCost - btcSentValue).toFixed(2));
      const profitWithdraw     = parseFloat((totalRevenue - actualCost - withdrawalBtcValue).toFixed(2));
      const roi                = actualCost > 0 ? ((profitSent / actualCost) * 100).toFixed(2) + '%' : '0%';
      const roiWithdraw        = actualCost > 0 ? ((profitWithdraw / actualCost) * 100).toFixed(2) + '%' : '0%';
      const cpa     = totalNewUsers > 0 ? parseFloat((totalSpend / totalNewUsers).toFixed(2)) : 0;
      const adCpa   = adNewUsers    > 0 ? parseFloat((totalSpend / adNewUsers).toFixed(2))    : 0;
      const subCost = subOrders     > 0 ? parseFloat((totalSpend / subOrders).toFixed(2))     : 0;
      const subRate = totalNewUsers > 0 ? ((subOrders / totalNewUsers) * 100).toFixed(2) + '%' : '0%';
      const arppu   = subOrders     > 0 ? parseFloat((salesAmount / subOrders).toFixed(2))    : 0;
      const cancelRate = subOrders  > 0 ? ((cancelCount / subOrders) * 100).toFixed(2) + '%'  : '0%';
      const retention      = retentionMap[d] || {};
      const retentionCount = retention.d1Count  || 0;
      const retentionBase  = retention.regCount || 0;
      const retentionPct   = retentionBase > 0 ? ((retentionCount / retentionBase) * 100).toFixed(2) + '%' : '-';
      return {
        date: d, totalSpend, googleSpend, applovinSpend, mintegralSpend,
        adNewUsers, newUsersM1, newUsersM2, totalNewUsers,
        retentionRate: retentionCount, retentionRatePct: retentionPct, dau: dauVal, cpa, adCpa,
        subOrders, subCost, subRate, salesAmount, subRevenue, arppu,
        cancelCount, cancelRate, renewalCount, renewalAmount,
        renewalRevenue, adCount, adPerUser, ecpm, adRevenue, totalRevenue,
        btcSentAmount, btcSentValue, btcAvgPrice,
        withdrawalBtcAmount, withdrawalBtcValue, actualCost, profitSent, profitWithdraw, roi, roiWithdraw,
      };
    });

    // 总计行
    const sum = (key) => rows.reduce((s, r) => s + (typeof r[key] === 'number' ? r[key] : 0), 0);
    const ttlSpend = parseFloat(sum('totalSpend').toFixed(2));
    const ttlNew   = sum('totalNewUsers');
    const ttlAdNew = sum('adNewUsers');
    const ttlSub   = sum('subOrders');
    const ttlRev   = parseFloat(sum('salesAmount').toFixed(2));
    const ttlSubRevenue = parseFloat(sum('subRevenue').toFixed(2));
    const ttlCancel= sum('cancelCount');
    const ttlAdRevenue       = parseFloat(sum('adRevenue').toFixed(2));
    const ttlAdCount         = sum('adCount');
    const ttlRenewalRevenue  = parseFloat(sum('renewalRevenue').toFixed(2));
    const ttlTotalRevenue    = parseFloat((ttlSubRevenue + ttlAdRevenue + ttlRenewalRevenue).toFixed(2));
    const ttlBtcSent         = sum('btcSentAmount');
    const ttlBtcSentValue    = parseFloat(sum('btcSentValue').toFixed(2));
    const ttlWdBtc           = sum('withdrawalBtcAmount');
    const ttlWdBtcValue      = parseFloat(sum('withdrawalBtcValue').toFixed(2));
    const ttlProfitSent      = parseFloat((ttlTotalRevenue - ttlSpend - ttlBtcSentValue).toFixed(2));
    const ttlProfitWithdraw  = parseFloat((ttlTotalRevenue - ttlSpend - ttlWdBtcValue).toFixed(2));
    const totalRow = {
      date: '总计',
      totalSpend: ttlSpend, googleSpend: parseFloat(sum('googleSpend').toFixed(2)),
      applovinSpend: parseFloat(sum('applovinSpend').toFixed(2)), mintegralSpend: parseFloat(sum('mintegralSpend').toFixed(2)),
      adNewUsers: ttlAdNew, newUsersM1: sum('newUsersM1'), newUsersM2: sum('newUsersM2'),
      totalNewUsers: ttlNew, retentionRate: sum('retentionRate'), retentionRatePct: '-', dau: '-',
      cpa:    ttlNew   > 0 ? parseFloat((ttlSpend / ttlNew).toFixed(2))   : 0,
      adCpa:  ttlAdNew > 0 ? parseFloat((ttlSpend / ttlAdNew).toFixed(2)) : 0,
      subOrders: ttlSub,
      subCost:  ttlSub > 0 ? parseFloat((ttlSpend / ttlSub).toFixed(2))  : 0,
      subRate:  ttlNew > 0 ? ((ttlSub / ttlNew) * 100).toFixed(2) + '%'  : '0%',
      salesAmount: ttlRev, subRevenue: parseFloat(sum('subRevenue').toFixed(2)),
      arppu:      ttlSub > 0 ? parseFloat((ttlRev / ttlSub).toFixed(2)) : 0,
      cancelCount: ttlCancel,
      cancelRate:  ttlSub > 0 ? ((ttlCancel / ttlSub) * 100).toFixed(2) + '%' : '0%',
      renewalCount: sum('renewalCount'), renewalAmount: parseFloat(sum('renewalAmount').toFixed(2)),
      renewalRevenue: ttlRenewalRevenue,
      adCount: ttlAdCount,
      adPerUser: '-',
      ecpm: ttlAdCount > 0 ? parseFloat(((ttlAdRevenue / ttlAdCount) * 1000).toFixed(2)) : 0,
      adRevenue: ttlAdRevenue, totalRevenue: ttlTotalRevenue,
      btcSentAmount: ttlBtcSent, btcSentValue: ttlBtcSentValue,
      btcAvgPrice: '-',
      withdrawalBtcAmount: ttlWdBtc, withdrawalBtcValue: ttlWdBtcValue,
      actualCost: ttlSpend, profitSent: ttlProfitSent, profitWithdraw: ttlProfitWithdraw,
      roi:        ttlSpend > 0 ? ((ttlProfitSent     / ttlSpend) * 100).toFixed(2) + '%' : '0%',
      roiWithdraw: ttlSpend > 0 ? ((ttlProfitWithdraw / ttlSpend) * 100).toFixed(2) + '%' : '0%',
    };

    res.json({ success: true, data: [totalRow, ...rows], summary });
  } catch (err) {
    console.error('DataCenter daily-report error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * POST /api/admin/datacenter/ad-spend  添加/更新广告消耗
 */
router.post('/datacenter/ad-spend', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { statDate, platform = 'Android', googleSpend = 0, applovinSpend = 0, mintegralSpend = 0 } = req.body;
    if (!statDate) return res.status(400).json({ success: false, message: '日期不能为空' });
    await conn.query(
      `INSERT INTO daily_ad_stats (stat_date, platform, google_spend, applovin_spend, mintegral_spend)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         google_spend    = VALUES(google_spend),
         applovin_spend  = VALUES(applovin_spend),
         mintegral_spend = VALUES(mintegral_spend)`,
      [statDate, platform, googleSpend, applovinSpend, mintegralSpend]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

/**
 * POST /api/admin/datacenter/ad-data  添加/更新广告数据（M1/M2/M3 新增、取消、续期）
 */
router.post('/datacenter/ad-data', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { statDate, platform = 'Android', adNewUsers = 0, newUsersM1 = 0, newUsersM2 = 0,
            cancelCount = 0, renewalCount = 0, renewalAmount = 0,
            renewalRevenue = 0, adCount = 0, adRevenue = 0,
            btcAvgPrice = 0 } = req.body;
    if (!statDate) return res.status(400).json({ success: false, message: '日期不能为空' });
    await conn.query(
      `INSERT INTO daily_ad_stats (stat_date, platform, ad_new_users, new_users_m1, new_users_m2,
                                   cancel_count, renewal_count, renewal_amount,
                                   renewal_revenue, ad_count, ad_revenue, btc_avg_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ad_new_users      = VALUES(ad_new_users),
         new_users_m1      = VALUES(new_users_m1),
         new_users_m2      = VALUES(new_users_m2),
         cancel_count      = VALUES(cancel_count),
         renewal_count     = VALUES(renewal_count),
         renewal_amount    = VALUES(renewal_amount),
         renewal_revenue   = VALUES(renewal_revenue),
         ad_count          = VALUES(ad_count),
         ad_revenue        = VALUES(ad_revenue),
         btc_avg_price     = VALUES(btc_avg_price)`,
      [statDate, platform, adNewUsers, newUsersM1, newUsersM2,
       cancelCount, renewalCount, renewalAmount,
       renewalRevenue, adCount, adRevenue, btcAvgPrice]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ─── Reports ──────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/reports/summary
 * 报表概要统计（用于 Reports 页面）
 */
router.get('/reports/summary', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[users]] = await conn.query('SELECT COUNT(*) AS total, COUNT(DISTINCT country_code) AS countries FROM user_information');
    const [[orders]] = await conn.query("SELECT COUNT(*) AS total, COALESCE(SUM(CAST(CONVERT(product_price, CHAR) AS DECIMAL(10,2))),0) AS revenue FROM user_orders WHERE order_status NOT IN ('refund successful')");
    const [[mining]] = await conn.query('SELECT COUNT(*) AS total, COUNT(CASE WHEN contract_end_time > NOW() THEN 1 END) AS active FROM mining_contracts');
    const [[withdrawals]] = await conn.query("SELECT COUNT(*) AS total, COALESCE(SUM(withdrawal_request_amount),0) AS amount FROM withdrawal_records WHERE withdrawal_status = 'success'");
    const [[points]] = await conn.query('SELECT COALESCE(SUM(user_points),0) AS total FROM user_information');
    res.json({
      success: true,
      data: {
        users: { total: users.total, countries: users.countries },
        orders: { total: orders.total, revenue: parseFloat(orders.revenue) },
        mining: { total: mining.total, active: mining.active },
        withdrawals: { total: withdrawals.total, amount: parseFloat(withdrawals.amount) },
        points: { total: parseFloat(points.total) }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── Legacy stub endpoints (backward compat) ─────────────────────────────────

// GET /api/admin/stats
router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
  res.json({ users: 100, miningNodes: 10, revenue: 12345 });
});

// POST /api/admin/action
router.post('/action', authenticateToken, requireAdmin, (req, res) => {
  // 实际管理员操作逻辑应在此实现
  res.json({ message: 'Admin action executed' });
});

/**
 * @route   PUT /api/admin/country/:countryCode/multiplier
 * @desc    更新国家挖矿速率倍数（管理员）
 * @access  Admin
 * @param   {string} countryCode - 国家代码
 * @body    {number} multiplier - 新的挖矿速率倍数
 */
router.put('/country/:countryCode/multiplier', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { multiplier } = req.body;

    if (!multiplier || multiplier <= 0) {
      return res.status(400).json({
        success: false,
        message: '倍数必须大于0'
      });
    }

    const result = await CountryMiningService.updateMultiplier(countryCode, multiplier);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('更新国家配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/country/cache/clear
 * @desc    清除所有国家配置缓存（管理员）
 * @access  Admin
 */
router.post('/country/cache/clear', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await CountryMiningService.clearAllCache();
    res.json({
      success: true,
      message: '缓存清除成功'
    });
  } catch (error) {
    console.error('清除缓存失败:', error);
    res.status(500).json({
      success: false,
      message: '清除缓存失败',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/fix-referral-reward
 * @desc    手动补发指定被邀请人对应的邀请积分奖励（用于修复历史遗漏）
 * @access  Admin
 * @body    { refereeUserId: string }  被邀请人用户ID
 */
router.post('/fix-referral-reward', authenticateToken, requireAdmin, async (req, res) => {
  const { refereeUserId } = req.body;
  if (!refereeUserId) {
    return res.status(400).json({ success: false, message: '缺少参数: refereeUserId' });
  }

  const connection = await pool.getConnection();
  try {
    // 查找邀请关系
    const [relRows] = await connection.query(
      'SELECT referrer_user_id FROM invitation_relationship WHERE user_id = ?',
      [refereeUserId]
    );
    if (relRows.length === 0 || !relRows[0].referrer_user_id) {
      connection.release();
      return res.status(404).json({ success: false, message: '未找到邀请关系' });
    }
    const referrerId = relRows[0].referrer_user_id;

    // 检查被邀请人广告观看次数
    const [viewRows] = await connection.query(
      'SELECT SUM(view_count) as total FROM ad_view_record WHERE user_id = ?',
      [refereeUserId]
    );
    const totalViews = parseInt(viewRows[0].total || 0);
    if (totalViews < AdPointsService.REFERRAL_REQUIRED_ADS) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: `被邀请人广告观看次数不足（当前 ${totalViews} 次，需 ${AdPointsService.REFERRAL_REQUIRED_ADS} 次）`
      });
    }

    // 检查是否已发放过
    const [existRows] = await connection.query(
      'SELECT id FROM points_transaction WHERE user_id = ? AND related_user_id = ? AND points_type = ?',
      [referrerId, refereeUserId, PointsService.POINTS_TYPES.REFERRAL_1]
    );
    if (existRows.length > 0) {
      connection.release();
      return res.json({ success: false, message: '该邀请奖励已发放过，无需补发', referrerId, refereeUserId });
    }

    connection.release();

    // 发放积分
    const InvitationPointsService = require('../services/invitationPointsService');
    await PointsService.addPoints(
      referrerId,
      InvitationPointsService.FIRST_FRIEND_REWARD,
      PointsService.POINTS_TYPES.REFERRAL_1,
      `管理员补发邀请奖励（被邀请人 ${refereeUserId}）`,
      refereeUserId
    );

    console.log(`✅ 管理员手动补发邀请奖励：${referrerId} <- ${refereeUserId}, ${InvitationPointsService.FIRST_FRIEND_REWARD} 积分`);
    res.json({
      success: true,
      message: `补发成功：已向 ${referrerId} 补发 ${InvitationPointsService.FIRST_FRIEND_REWARD} 积分`,
      referrerId,
      refereeUserId,
      pointsAwarded: InvitationPointsService.FIRST_FRIEND_REWARD
    });
  } catch (error) {
    console.error('补发邀请奖励失败:', error);
    res.status(500).json({ success: false, message: '补发失败', error: error.message });
  }
});

/**
 * @route   POST /api/admin/scan-fix-missing-referral-rewards
 * @desc    扫描所有满足条件但未获得邀请奖励的邀请人，批量补发
 * @access  Admin
 */
router.post('/scan-fix-missing-referral-rewards', authenticateToken, requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    // 查找：被邀请人已看 >= 5 次广告，但邀请人从未收到 REFERRAL_1 积分
    const [missedRows] = await connection.query(`
      SELECT ir.referrer_user_id, ir.user_id AS referee_user_id,
             SUM(avr.view_count) AS total_views
      FROM invitation_relationship ir
      JOIN ad_view_record avr ON avr.user_id COLLATE utf8mb4_unicode_ci = ir.user_id COLLATE utf8mb4_unicode_ci
      LEFT JOIN points_transaction pt ON pt.user_id = ir.referrer_user_id
        AND pt.related_user_id = ir.user_id
        AND pt.points_type = 'REFERRAL_1'
      WHERE pt.id IS NULL
      GROUP BY ir.referrer_user_id, ir.user_id
      HAVING total_views >= 5
    `);

    connection.release();

    if (missedRows.length === 0) {
      return res.json({ success: true, message: '没有遗漏的邀请奖励', fixed: 0 });
    }

    const InvitationPointsService = require('../services/invitationPointsService');
    let fixed = 0;
    const details = [];

    for (const row of missedRows) {
      try {
        await PointsService.addPoints(
          row.referrer_user_id,
          InvitationPointsService.FIRST_FRIEND_REWARD,
          PointsService.POINTS_TYPES.REFERRAL_1,
          `系统补发邀请奖励（被邀请人 ${row.referee_user_id}）`,
          row.referee_user_id
        );
        fixed++;
        details.push({ referrerId: row.referrer_user_id, refereeUserId: row.referee_user_id, points: InvitationPointsService.FIRST_FRIEND_REWARD });
        console.log(`✅ 批量补发：${row.referrer_user_id} <- ${row.referee_user_id}`);
      } catch (e) {
        console.error(`补发失败 ${row.referrer_user_id} <- ${row.referee_user_id}:`, e.message);
        details.push({ referrerId: row.referrer_user_id, refereeUserId: row.referee_user_id, error: e.message });
      }
    }

    res.json({ success: true, message: `扫描完成，补发 ${fixed}/${missedRows.length} 条`, fixed, total: missedRows.length, details });
  } catch (error) {
    console.error('批量补发失败:', error);
    res.status(500).json({ success: false, message: '批量补发失败', error: error.message });
  }
});

// ─── User Ban / Unban ─────────────────────────────────────────────────────────

/**
 * PUT /api/admin/users/:userId/ban
 * 禁用用户：仅设置 is_banned=1，不终止挖矿合约（挖矿照常运行，仅限制提现）
 */
router.put('/users/:userId/ban', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body || {};
  if (!userId) return res.status(400).json({ success: false, message: 'userId 不能为空' });

  try {
    const [result] = await pool.query(
      'UPDATE user_information SET is_banned = 1, banned_at = NOW(), ban_reason = ? WHERE user_id = ?',
      [reason || null, userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, message: '用户已禁用（挖矿继续，提现已限制）' });
  } catch (err) {
    console.error('Ban user error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/admin/users/:userId/unban
 * 解除用户禁用
 */
router.put('/users/:userId/unban', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, message: 'userId 不能为空' });

  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(
      'UPDATE user_information SET is_banned = 0, banned_at = NULL, ban_reason = NULL WHERE user_id = ?',
      [userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, message: '用户已解除禁用' });
  } catch (err) {
    console.error('Unban user error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── Bitcoin Transaction Records (Admin - no day restriction) ────────────────
/**
 * GET /api/admin/bitcoin-transactions
 * 管理员查看比特币交易记录（支持日期范围，无3天限制）
 * Query: userId?, type?, startDate?, endDate?, page=1, limit=20
 */
router.get('/bitcoin-transactions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, type = 'all', startDate, endDate, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let where = '1=1';
    const replacements = { limit: limitNum, offset };

    if (userId) {
      where += ' AND btr.user_id = :userId';
      replacements.userId = userId;
    }
    if (type !== 'all') {
      where += ' AND btr.transaction_type = :type';
      replacements.type = type;
    }
    if (startDate) {
      where += ' AND btr.transaction_creation_time >= :startDate';
      replacements.startDate = startDate;
    }
    if (endDate) {
      where += ' AND btr.transaction_creation_time < DATE_ADD(:endDate, INTERVAL 1 DAY)';
      replacements.endDate = endDate;
    }

    const records = await sequelize.query(
      `SELECT id, user_id, transaction_type, transaction_amount, balance_after,
              description, transaction_creation_time, transaction_status
       FROM bitcoin_transaction_records btr
       WHERE ${where}
       ORDER BY transaction_creation_time DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM bitcoin_transaction_records btr WHERE ${where}`,
      { replacements, type: QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: {
        records: records.map(r => ({
          id: r.id,
          userId: r.user_id,
          type: r.transaction_type,
          amount: parseFloat(r.transaction_amount),
          balanceAfter: r.balance_after != null ? parseFloat(r.balance_after) : null,
          description: r.description || null,
          createdAt: r.transaction_creation_time,
          status: r.transaction_status,
        })),
        pagination: { total: countResult.total, page: pageNum, limit: limitNum,
          hasMore: offset + limitNum < countResult.total }
      }
    });
  } catch (error) {
    console.error('Admin bitcoin transactions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Invitation Rebate Records (Admin - no day restriction) ──────────────────
/**
 * GET /api/admin/invitation-rebate
 * 管理员查看邀请返利记录（支持日期范围，无3天限制）
 * Query: userId?, startDate?, endDate?, page=1, limit=20
 */
router.get('/invitation-rebate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let where = '1=1';
    const replacements = { limit: limitNum, offset };

    if (userId) {
      where += ' AND user_id = :userId';
      replacements.userId = userId;
    }
    if (startDate) {
      where += ' AND rebate_creation_time >= :startDate';
      replacements.startDate = startDate;
    }
    if (endDate) {
      where += ' AND rebate_creation_time < DATE_ADD(:endDate, INTERVAL 1 DAY)';
      replacements.endDate = endDate;
    }

    const records = await sequelize.query(
      `SELECT id, user_id, invitation_code, subordinate_user_id,
              subordinate_rebate_amount, rebate_creation_time
       FROM invitation_rebate
       WHERE ${where}
       ORDER BY rebate_creation_time DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM invitation_rebate WHERE ${where}`,
      { replacements, type: QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: {
        records: records.map(r => ({
          id: r.id,
          userId: r.user_id,
          invitationCode: r.invitation_code,
          subordinateUserId: r.subordinate_user_id,
          amount: parseFloat(r.subordinate_rebate_amount),
          createdAt: r.rebate_creation_time,
        })),
        pagination: { total: countResult.total, page: pageNum, limit: limitNum,
          hasMore: offset + limitNum < countResult.total }
      }
    });
  } catch (error) {
    console.error('Admin invitation rebate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 付费产品配置管理（Admin Only） ───────────────────────────────────────────

const PaidProduct = require('../models/paidProductList');
const PaidProductService = require('../services/paidProductService');

/**
 * PUT /api/admin/paid-products/:id
 * 更新付费产品字段（display_name, description, ios_product_id, android_product_id,
 *                    hashrate_raw, duration_days, sort_order, is_active）
 */
router.put('/paid-products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['display_name', 'description', 'ios_product_id', 'android_product_id',
      'hashrate_raw', 'duration_days', 'duration_months', 'sort_order', 'is_active'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: '无有效更新字段' });
    }
    const [affected] = await PaidProduct.update(updates, { where: { id } });
    if (affected === 0) {
      return res.status(404).json({ success: false, message: '产品不存在' });
    }
    PaidProductService.clearCache(); // 清除内存缓存，下次请求重新读 DB
    res.json({ success: true, message: '产品配置更新成功' });
  } catch (err) {
    console.error('❌ 更新付费产品失败:', err);
    res.status(500).json({ success: false, message: '服务器错误', error: err.message });
  }
});

// ─── User Detail (完整用户画像) ───────────────────────────────────────────────

/**
 * GET /api/admin/users/:userId/detail
 * 获取用户完整信息：基本信息 + 余额状态 + 邀请关系 + 近期交易 + 合约 + 设备 + 提现记录
 */
router.get('/users/:userId/detail', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, message: 'userId 不能为空' });
  const conn = await pool.getConnection();
  try {
    // 1. 基本信息 + 余额状态
    const [[user]] = await conn.query(
      `SELECT ui.user_id, ui.invitation_code, ui.email, ui.google_account,
              ui.apple_account, ui.apple_id, ui.nickname,
              ui.device_id, ui.gaid, ui.idfa, ui.att_status, ui.att_consent_updated_at,
              ui.register_ip, ui.country_code, ui.country_name_cn, ui.country_multiplier,
              ui.miner_level_multiplier, ui.user_level, ui.user_points, ui.total_ad_views,
              ui.\`system\`, ui.acquisition_channel, ui.user_creation_time,
              ui.is_banned, ui.banned_at, ui.ban_reason,
              us.user_status, us.last_login_time,
              us.current_bitcoin_balance, us.bitcoin_accumulated_amount,
              us.total_invitation_rebate, us.total_withdrawal_amount
       FROM user_information ui
       LEFT JOIN user_status us ON ui.user_id = us.user_id
       WHERE ui.user_id = ?`, [userId]
    );
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    // 2. 邀请关系：推荐人
    const [[invRel]] = await conn.query(
      `SELECT ir.referrer_user_id, ir.referrer_invitation_code, ir.invitation_creation_time,
              ri.email AS referrer_email
       FROM invitation_relationship ir
       LEFT JOIN user_information ri ON ri.user_id = ir.referrer_user_id
       WHERE ir.user_id = ?`, [userId]
    );

    // 3. 邀请关系：我邀请的人数 & 列表(最新10)
    const [[{ invited_count }]] = await conn.query(
      `SELECT COUNT(*) AS invited_count FROM invitation_relationship WHERE referrer_user_id = ?`, [userId]
    );
    const [invitedList] = await conn.query(
      `SELECT ir.user_id, ui.email, ir.invitation_creation_time
       FROM invitation_relationship ir
       LEFT JOIN user_information ui ON ui.user_id = ir.user_id
       WHERE ir.referrer_user_id = ?
       ORDER BY ir.invitation_creation_time DESC LIMIT 10`, [userId]
    );

    // 4. 近期BTC交易(最新20)
    const [recentTxs] = await conn.query(
      `SELECT transaction_type, transaction_amount, balance_after, description,
              transaction_creation_time, transaction_status
       FROM bitcoin_transaction_records
       WHERE user_id = ?
       ORDER BY transaction_creation_time DESC LIMIT 20`, [userId]
    );

    // 5. 合约摘要（同时统计 mining_contracts 和 free_contract_records）
    const [[contractStats]] = await conn.query(
      `SELECT COUNT(*) AS total_contracts,
              SUM(CASE WHEN end_time > NOW() AND is_cancelled = 0 THEN 1 ELSE 0 END) AS active_contracts,
              SUM(CASE WHEN is_paid = 1 THEN 1 ELSE 0 END) AS paid_contracts,
              SUM(CASE WHEN is_paid = 0 THEN 1 ELSE 0 END) AS free_contracts,
              SUM(CASE WHEN (end_time <= NOW() OR is_cancelled = 1) AND is_paid = 1 THEN 1 ELSE 0 END) AS expired_contracts
       FROM (
         SELECT contract_end_time AS end_time, is_cancelled,
                CASE WHEN contract_type = 'paid contract' THEN 1 ELSE 0 END AS is_paid
         FROM mining_contracts WHERE user_id = ?
         UNION ALL
         SELECT free_contract_end_time AS end_time, 0 AS is_cancelled, 0 AS is_paid
         FROM free_contract_records WHERE user_id = ?
       ) combined`, [userId, userId]
    );

    // 6. 订单摘要
    // 注意：product_price 是 ENUM 类型，直接 CAST AS DECIMAL 会返回枚举序号而非金额。
    // 需用 CONCAT(product_price,'') 强制转为字符串后再转数字。
    const [[orderStats]] = await conn.query(
      `SELECT COUNT(*) AS total_orders,
              COALESCE(SUM(CASE WHEN order_status != 'refund successful'
                           THEN CAST(CONCAT(product_price, '') AS DECIMAL(10,2)) ELSE 0 END), 0) AS total_spent,
              SUM(CASE WHEN order_status IN ('refund request in progress','refund successful') THEN 1 ELSE 0 END) AS refund_count
       FROM user_orders WHERE user_id = ?`, [userId]
    );

    // 7. 近期提现(最新5)
    const [recentWithdrawals] = await conn.query(
      `SELECT withdrawal_request_amount, received_amount, withdrawal_status,
              wallet_address, created_at
       FROM withdrawal_records WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 5`, [userId]
    );

    res.json({
      success: true,
      data: {
        basic: user,
        referrer: invRel || null,
        invitedCount: invited_count,
        invitedList,
        recentTxs,
        contractStats,
        orderStats,
        recentWithdrawals,
      }
    });
  } catch (err) {
    console.error('User detail error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── User Contracts Detail ────────────────────────────────────────────────────

/**
 * GET /api/admin/users/:userId/contracts
 * 获取用户全部合约详情，按状态分组：运行中 / 未激活 / 已过期
 */
router.get('/users/:userId/contracts', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, message: 'userId 不能为空' });
  const conn = await pool.getConnection();
  try {
    // 1. mining_contracts（付费 + 系统颁发的免费合约）
    // product_id 有值时按 product_id JOIN；为 NULL 时按 hashrate_raw 精确匹配
    const [paidRows] = await conn.query(
      `SELECT mc.id, mc.contract_type, mc.product_id, mc.platform,
              mc.contract_creation_time, mc.contract_end_time, mc.contract_duration,
              mc.hashrate, mc.is_cancelled, mc.is_renewal, mc.order_id,
              p.product_name, p.product_price,
              TIMESTAMPDIFF(SECOND, NOW(), mc.contract_end_time) AS remaining_seconds
       FROM mining_contracts mc
       LEFT JOIN paid_products_list_config p ON
         p.product_id = COALESCE(
           mc.product_id,
           (SELECT product_id FROM paid_products_list_config pfb
            WHERE pfb.hashrate_raw = mc.hashrate LIMIT 1)
         )
       WHERE mc.user_id = ?
       ORDER BY mc.contract_creation_time DESC`, [userId]
    );

    // 2. free_contract_records（广告/签到/邀请/绑定推荐人免费合约）
    const [freeRows] = await conn.query(
      `SELECT fcr.id, fcr.free_contract_type AS contract_type,
              fcr.free_contract_creation_time AS contract_creation_time,
              fcr.free_contract_end_time AS contract_end_time,
              fcr.hashrate, fcr.base_hashrate, fcr.has_daily_bonus,
              fcr.mining_status, fcr.free_contract_revenue AS revenue,
              TIMESTAMPDIFF(SECOND, NOW(), fcr.free_contract_end_time) AS remaining_seconds,
              ui.miner_level_multiplier AS level_multiplier,
              ui.country_multiplier,
              COALESCE(fcr.base_hashrate, fcr.hashrate)
                * COALESCE(ui.miner_level_multiplier, 1.0)
                * COALESCE(ui.country_multiplier, 1.0)
                * IF(fcr.has_daily_bonus = 1, 1.36, 1.0) AS effective_hashrate
       FROM free_contract_records fcr
       JOIN user_information ui ON ui.user_id = fcr.user_id
       WHERE fcr.user_id = ?
       ORDER BY fcr.free_contract_creation_time DESC`, [userId]
    );

    const active = [], inactive = [], expired = [];

    for (const row of paidRows) {
      const item = {
        id: row.id,
        source: 'mining_contracts',
        contract_type: row.contract_type,
        product_id: row.product_id || null,
        product_name: row.product_name || null,
        product_price: row.product_price || null,
        platform: row.platform || null,
        hashrate: row.hashrate,
        created_at: row.contract_creation_time,
        end_time: row.contract_end_time,
        remaining_seconds: row.remaining_seconds,
        is_cancelled: row.is_cancelled,
        is_renewal: row.is_renewal,
        order_id: row.order_id || null,
      };
      if (row.is_cancelled) {
        expired.push({ ...item, status: 'cancelled' });
      } else if (!row.contract_end_time) {
        inactive.push({ ...item, status: 'inactive' });
      } else if (row.remaining_seconds > 0) {
        active.push({ ...item, status: 'active' });
      } else {
        expired.push({ ...item, status: 'expired' });
      }
    }

    for (const row of freeRows) {
      const item = {
        id: row.id,
        source: 'free_contract_records',
        contract_type: row.contract_type,
        hashrate: row.hashrate,
        base_hashrate: row.base_hashrate,
        effective_hashrate: row.effective_hashrate,
        has_daily_bonus: row.has_daily_bonus,
        level_multiplier: row.level_multiplier,
        country_multiplier: row.country_multiplier,
        created_at: row.contract_creation_time,
        end_time: row.contract_end_time,
        remaining_seconds: row.remaining_seconds,
        mining_status: row.mining_status,
        revenue: row.revenue,
      };
      const rem = typeof row.remaining_seconds === 'string'
        ? parseInt(row.remaining_seconds) : row.remaining_seconds;
      // 优先判断剩余时间：end_time 在未来 → 运行中；再判断 mining_status
      if (row.mining_status === 'mining' || (row.contract_end_time && rem !== null && rem > 0)) {
        active.push({ ...item, status: 'active' });
      } else if (!row.contract_end_time || row.mining_status === 'error') {
        inactive.push({ ...item, status: 'inactive' });
      } else {
        expired.push({ ...item, status: 'expired' });
      }
    }

    res.json({ success: true, data: { active, inactive, expired } });
  } catch (err) {
    console.error('User contracts error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── Adjust BTC Balance (手动增减BTC) ────────────────────────────────────────

/**
 * POST /api/admin/users/:userId/adjust-btc
 * 手动调整用户BTC余额
 * Body: { amount: number (正=增加, 负=减少), reason: string }
 */
router.post('/users/:userId/adjust-btc', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { amount, reason } = req.body || {};
  if (!userId) return res.status(400).json({ success: false, message: 'userId 不能为空' });
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount === 0) return res.status(400).json({ success: false, message: 'amount 必须为非零数字' });
  if (!reason || String(reason).trim().length === 0) return res.status(400).json({ success: false, message: '必须填写操作原因' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 查询当前余额
    const [[statusRow]] = await conn.query(
      'SELECT current_bitcoin_balance, bitcoin_accumulated_amount FROM user_status WHERE user_id = ?', [userId]
    );
    if (!statusRow) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const currentBalance = parseFloat(statusRow.current_bitcoin_balance || 0);
    const newBalance = currentBalance + numAmount;

    if (newBalance < 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `余额不足：当前余额 ${currentBalance.toFixed(18)} BTC，无法扣减 ${Math.abs(numAmount).toFixed(18)} BTC`
      });
    }

    // 更新余额
    const accumulatedUpdate = numAmount > 0
      ? ', bitcoin_accumulated_amount = bitcoin_accumulated_amount + ?'
      : '';
    const accParams = numAmount > 0 ? [newBalance, numAmount, userId] : [newBalance, userId];
    await conn.query(
      `UPDATE user_status SET current_bitcoin_balance = ? ${accumulatedUpdate} WHERE user_id = ?`,
      accParams
    );

    // 记录交易
    const txType = numAmount > 0 ? 'admin_add' : 'admin_deduct';
    const txDesc = `管理员手动${numAmount > 0 ? '增加' : '减少'} BTC：${reason}`;
    await conn.query(
      `INSERT INTO bitcoin_transaction_records
       (user_id, transaction_type, transaction_amount, balance_after, description, transaction_status)
       VALUES (?, ?, ?, ?, ?, 'success')`,
      [userId, txType, Math.abs(numAmount), newBalance, txDesc]
    );

    await conn.commit();
    res.json({
      success: true,
      message: `BTC余额已${numAmount > 0 ? '增加' : '减少'} ${Math.abs(numAmount)} BTC`,
      data: { previousBalance: currentBalance, adjustment: numAmount, newBalance }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Adjust BTC error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * POST /api/admin/users/:userId/adjust-points
 * 手动增加/减少积分 (amount 正=增加, 负=减少)
 */
router.post('/users/:userId/adjust-points', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { amount, reason } = req.body || {};
  if (!userId) return res.status(400).json({ success: false, message: 'userId 不能为空' });
  const numAmount = parseInt(amount);
  if (isNaN(numAmount) || numAmount === 0) return res.status(400).json({ success: false, message: 'amount 必须为非零整数' });
  if (!reason || String(reason).trim().length === 0) return res.status(400).json({ success: false, message: '必须填写操作原因' });

  try {
    const desc = `管理员手动${numAmount > 0 ? '增加' : '减少'}积分：${reason}`;
    let result;
    if (numAmount > 0) {
      result = await PointsService.addPoints(userId, numAmount, PointsService.POINTS_TYPES.MANUAL_ADD, desc);
    } else {
      result = await PointsService.deductPoints(userId, Math.abs(numAmount), PointsService.POINTS_TYPES.MANUAL_DEDUCT, desc);
    }
    res.json({
      success: true,
      message: `积分已${numAmount > 0 ? '增加' : '减少'} ${Math.abs(numAmount)} 分`,
      data: result
    });
  } catch (err) {
    console.error('Adjust points error:', err);
    const status = err.message === '用户不存在' ? 404 : err.message === '可用积分不足' ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/admin/users/:userId/update-country
 * 修改用户国家（同步更新 country_code, country_name_cn, country_multiplier）
 */
router.put('/users/:userId/update-country', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { country_code, country_name_cn } = req.body || {};
  if (!userId) return res.status(400).json({ success: false, message: 'userId 不能为空' });
  if (!country_code) return res.status(400).json({ success: false, message: 'country_code 不能为空' });

  const conn = await pool.getConnection();
  try {
    // 从 country_mining_config 查对应倍率
    const [[configRow]] = await conn.query(
      'SELECT mining_multiplier, country_name_cn AS cfg_name FROM country_mining_config WHERE country_code = ? LIMIT 1',
      [country_code]
    );
    const multiplier = configRow ? parseFloat(configRow.mining_multiplier) : 1.0;
    const finalName = country_name_cn || (configRow ? configRow.cfg_name : country_code);

    const [result] = await conn.query(
      'UPDATE user_information SET country_code = ?, country_name_cn = ?, country_multiplier = ? WHERE user_id = ?',
      [country_code, finalName, multiplier, userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: '用户不存在' });

    res.json({
      success: true,
      message: `国家已更新为 ${finalName}（${country_code}），倍率 ${multiplier}`,
      data: { country_code, country_name_cn: finalName, country_multiplier: multiplier }
    });
  } catch (err) {
    console.error('Update country error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ─── BTC 价格（前端用） ────────────────────────────────────────────────────
router.get('/btc-price', authenticateToken, requireAdmin, (req, res) => {
  try {
    const priceInfo = bitcoinPriceService.getCurrentPrice();
    res.json({ success: true, data: { price: priceInfo.price, lastUpdate: priceInfo.lastUpdate } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── 用户国家列表（前端下拉筛选用） ──────────────────────────────────────
router.get('/users/countries', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT DISTINCT ui.country_code, cmc.country_name_cn
       FROM user_information ui
       LEFT JOIN country_mining_config cmc ON cmc.country_code = ui.country_code COLLATE utf8mb4_unicode_ci
       WHERE ui.country_code IS NOT NULL AND ui.country_code != ''
       ORDER BY ui.country_code`
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  } finally {
    conn.release();
  }
});

// ─── 速率配置（RateConfig 页面） ──────────────────────────────────────────
router.get('/rate-config', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[baseRow]] = await conn.query(
      `SELECT config_value FROM system_config WHERE config_key = 'base_mining_hashrate' LIMIT 1`
    );
    const [countries] = await conn.query(
      `SELECT country_code, country_name, country_name_cn, mining_multiplier, is_active FROM country_mining_config ORDER BY country_code`
    );
    res.json({
      success: true,
      data: {
        baseHashrate: baseRow ? baseRow.config_value : '0.000000000000139',
        countries
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  } finally {
    conn.release();
  }
});

router.put('/rate-config/base-rate', authenticateToken, requireAdmin, async (req, res) => {
  const { value } = req.body;
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return res.status(400).json({ success: false, message: '无效的基础算力值' });
  const conn = await pool.getConnection();
  try {
    // 1. 更新 system_config
    await conn.query(
      `UPDATE system_config SET config_value = ?, updated_at = NOW() WHERE config_key = 'base_mining_hashrate'`,
      [num.toFixed(18)]
    );
    // 2. 同步更新所有正在运行的免费合约 base_hashrate
    const [freeResult] = await conn.query(
      `UPDATE free_contract_records SET base_hashrate = ?, hashrate = ?
       WHERE free_contract_end_time > NOW()`,
      [num.toFixed(18), num.toFixed(18)]
    );
    // 3. 同步更新活跃的 Bind Referrer Reward 合约
    const [bindResult] = await conn.query(
      `UPDATE mining_contracts SET base_hashrate = ?, hashrate = ?
       WHERE contract_end_time > NOW() AND contract_type = 'Bind Referrer Reward' AND is_cancelled = 0`,
      [num.toFixed(18), num.toFixed(18)]
    );
    // 4. 清除 Redis 基础速率缓存
    await MiningConfigService.clearBaseHashrateCache();
    res.json({
      success: true,
      message: `基础算力已更新，已同步 ${freeResult.affectedRows} 个免费合约、${bindResult.affectedRows} 个绑定推荐人合约`,
      data: { baseHashrate: num.toFixed(18) }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  } finally {
    conn.release();
  }
});

router.put('/rate-config/country/:code', authenticateToken, requireAdmin, async (req, res) => {
  const { code } = req.params;
  const { multiplier } = req.body;
  const num = parseFloat(multiplier);
  if (isNaN(num) || num <= 0) return res.status(400).json({ success: false, message: '倍率必须大于0' });
  try {
    const result = await CountryMiningService.updateMultiplier(code, num);
    if (result.success) res.json(result);
    else res.status(404).json(result);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/rate-config/country/batch', authenticateToken, requireAdmin, async (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ success: false, message: '无效的批量更新数据' });
  }
  try {
    const mapped = updates.map(u => ({ countryCode: u.code, multiplier: u.multiplier }));
    const result = await CountryMiningService.batchUpdateMultipliers(mapped);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── 删除用户（单个） ──────────────────────────────────────────────────────
async function deleteUserById(conn, userId) {
  const tables = [
    'ad_view_record',
    'bitcoin_transaction_records',
    'free_contract_records',
    'invitation_rebate',
    'invitation_relationship',
    'mining_contracts',
    'notification_log',
    'points_transaction',
    'push_tokens',
    'referral_milestone',
    'subscription_point_awards',
    'user_check_in',
    'user_log',
    'user_orders',
    'user_points',
    'user_status',
    'withdrawal_records',
  ];
  for (const table of tables) {
    await conn.query(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
  }
  // invitation_relationship 中 referrer_user_id 也指向该用户
  await conn.query('DELETE FROM invitation_relationship WHERE referrer_user_id = ?', [userId]);
  // 最后删除主表
  await conn.query('DELETE FROM user_information WHERE user_id = ?', [userId]);
}

router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, message: 'userId 不能为空' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[user]] = await conn.query('SELECT user_id FROM user_information WHERE user_id = ?', [userId]);
    if (!user) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    await deleteUserById(conn, userId);
    await conn.commit();
    res.json({ success: true, message: `用户 ${userId} 已删除` });
  } catch (e) {
    await conn.rollback();
    console.error('Delete user error:', e);
    res.status(500).json({ success: false, message: e.message });
  } finally {
    conn.release();
  }
});

// ─── 批量删除用户 ──────────────────────────────────────────────────────────
router.post('/users/bulk-delete', authenticateToken, requireAdmin, async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ success: false, message: '请提供要删除的用户ID列表' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const userId of userIds) {
      await deleteUserById(conn, userId);
    }
    await conn.commit();
    res.json({ success: true, message: `已删除 ${userIds.length} 个用户`, deleted: userIds.length });
  } catch (e) {
    await conn.rollback();
    console.error('Bulk delete users error:', e);
    res.status(500).json({ success: false, message: e.message });
  } finally {
    conn.release();
  }
});

// 导出路由模块，供主应用挂载
module.exports = router;
