/**
 * admobSyncJob.js
 * 每天 UTC 02:00 自动从 AdMob Reporting API 拉取昨日数据，
 * 写入 daily_ad_stats.ad_count / ad_revenue。
 *
 * 依赖：googleapis（已安装）、node-cron（已安装）
 *
 * 所需环境变量：
 *   ADMOB_PUBLISHER_ID       - AdMob 账户 ID，格式 pub-XXXXXXXXXXXXXXXX
 *   ADMOB_CLIENT_EMAIL       - Service Account 邮箱
 *   ADMOB_PRIVATE_KEY        - Service Account 私钥（PEM，\n 转义）
 *   ADMOB_APP_ID_ANDROID     - Android App ID，格式 ca-app-pub-xxx~yyy（可选，不传则汇总所有应用）
 *   ADMOB_APP_ID_IOS         - iOS App ID（可选）
 */

'use strict';

const cron                = require('node-cron');
const { google }          = require('googleapis');
const pool                = require('../config/database_native');
const bitcoinPriceService = require('../services/bitcoinPriceService');

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const ADMOB_SCOPES = ['https://www.googleapis.com/auth/admob.readonly'];
const { OAuth2Client } = require('google-auth-library');

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 将 Date 转换为 AdMob API 所需的 { year, month, day } 对象（UTC）
 */
function toAdMobDate(d) {
  return {
    year:  d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day:   d.getUTCDate(),
  };
}

/**
 * 将 Date 转换为 YYYY-MM-DD 字符串（UTC）
 */
function toDateStr(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

// ─── 核心拉取逻辑 ─────────────────────────────────────────────────────────────

/**
 * 从 AdMob 拉取指定日期范围的数据，按 DATE 聚合，
 * 返回 Map<dateStr, { impressions, estimatedEarnings }>
 *
 * @param {Date} startDate - 起始日期（含，UTC 00:00）
 * @param {Date} endDate   - 结束日期（含，UTC 00:00）
 * @param {string} [platform] - 过滤平台 'Android' | 'iOS'（不传则两端合并）
 */
async function fetchAdMobData(startDate, endDate, platform) {
  const publisherId   = process.env.ADMOB_PUBLISHER_ID;
  const clientId      = process.env.ADMOB_OAUTH_CLIENT_ID;
  const clientSecret  = process.env.ADMOB_OAUTH_CLIENT_SECRET;
  const refreshToken  = process.env.ADMOB_OAUTH_REFRESH_TOKEN;

  if (!publisherId || !clientId || !clientSecret || !refreshToken) {
    throw new Error('AdMob 配置缺失：请设置 ADMOB_PUBLISHER_ID、ADMOB_OAUTH_CLIENT_ID、ADMOB_OAUTH_CLIENT_SECRET、ADMOB_OAUTH_REFRESH_TOKEN');
  }

  const auth = new OAuth2Client(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  const admob = google.admob({ version: 'v1', auth });

  // 构建维度过滤器
  const dimensionFilters = [];
  if (platform) {
    const appIdEnvKey = platform === 'iOS' ? 'ADMOB_APP_ID_IOS' : 'ADMOB_APP_ID_ANDROID';
    const appId = process.env[appIdEnvKey];
    if (appId) {
      dimensionFilters.push({
        dimension: 'APP',
        matchesAny: { values: [appId] },
      });
    }
  }

  const body = {
    reportSpec: {
      dateRange: {
        startDate: toAdMobDate(startDate),
        endDate:   toAdMobDate(endDate),
      },
      dimensions: ['DATE'],
      metrics: ['IMPRESSIONS', 'ESTIMATED_EARNINGS'],
      ...(dimensionFilters.length ? { dimensionFilters } : {}),
    },
  };

  const response = await admob.accounts.networkReport.generate({
    parent: `accounts/${publisherId}`,
    requestBody: body,
  });

  // response.data 是流式行数组，每行格式：
  //   { header: ... } | { row: { dimensionValues, metricValues } } | { footer: ... }
  const rows = response.data;
  const result = new Map(); // dateStr → { impressions, estimatedEarnings }

  for (const item of rows) {
    if (!item.row) continue;
    const { dimensionValues, metricValues } = item.row;

    // dimensionValues.DATE.value 格式: "YYYYMMDD"
    const rawDate = dimensionValues.DATE?.value;
    if (!rawDate || rawDate.length !== 8) continue;

    const dateStr = `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;

    const impressions       = parseInt(metricValues.IMPRESSIONS?.integerValue       || '0', 10);
    // ESTIMATED_EARNINGS 单位是 micros（百万分之一美元）
    const earningsMicros    = parseInt(metricValues.ESTIMATED_EARNINGS?.microsValue || '0', 10);
    const estimatedEarnings = parseFloat((earningsMicros / 1_000_000).toFixed(4));

    const existing = result.get(dateStr) || { impressions: 0, estimatedEarnings: 0 };
    result.set(dateStr, {
      impressions:        existing.impressions        + impressions,
      estimatedEarnings:  existing.estimatedEarnings  + estimatedEarnings,
    });
  }

  return result;
}

/**
 * 将 AdMob 数据写入 daily_ad_stats 表（UPSERT，仅更新 ad_count / ad_revenue）
 *
 * @param {Map<string, {impressions, estimatedEarnings}>} dataMap
 * @param {string} platform - 'Android' | 'iOS'
 */
async function upsertAdMobData(dataMap, platform) {
  if (dataMap.size === 0) return;

  const btcPrice = bitcoinPriceService.getCurrentPrice()?.price || 0;
  const conn = await pool.getConnection();
  try {
    for (const [dateStr, { impressions, estimatedEarnings }] of dataMap) {
      await conn.query(
        `INSERT INTO daily_ad_stats (stat_date, platform, ad_count, ad_revenue, btc_avg_price)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           ad_count      = VALUES(ad_count),
           ad_revenue    = VALUES(ad_revenue),
           btc_avg_price = IF(VALUES(btc_avg_price) > 0, VALUES(btc_avg_price), btc_avg_price)`,
        [dateStr, platform, impressions, estimatedEarnings, btcPrice]
      );
    }
  } finally {
    conn.release();
  }
}

// ─── 主同步入口 ───────────────────────────────────────────────────────────────

/**
 * 同步指定日期范围（默认昨天）
 *
 * @param {Object} [options]
 * @param {Date}   [options.startDate] - 默认昨天 UTC
 * @param {Date}   [options.endDate]   - 默认昨天 UTC
 * @param {string} [options.platform]  - 'Android' | 'iOS' | undefined（两端分别同步）
 * @returns {Promise<{success: boolean, message: string, dates: number}>}
 */
async function syncAdMobData({ startDate, endDate, platform } = {}) {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  const start = startDate || yesterday;
  const end   = endDate   || yesterday;

  const platforms = platform ? [platform] : ['Android', 'iOS'];
  let totalDates = 0;

  for (const pf of platforms) {
    // Android 若没配 App ID 则跳过（账户下没有 Android 应用时不拉）
    if (pf === 'Android' && !process.env.ADMOB_APP_ID_ANDROID) {
      console.log(`[AdMobSync] 跳过 Android（未配置 ADMOB_APP_ID_ANDROID）`);
      continue;
    }
    // iOS 若没配 App ID 则跳过（避免误拉全量数据）
    if (pf === 'iOS' && !process.env.ADMOB_APP_ID_IOS && !process.env.ADMOB_PUBLISHER_ID) {
      continue;
    }

    console.log(`[AdMobSync] 开始拉取 ${pf} 数据：${toDateStr(start)} ~ ${toDateStr(end)}`);

    const dataMap = await fetchAdMobData(start, end, pf);
    await upsertAdMobData(dataMap, pf);

    console.log(`[AdMobSync] ${pf} 写入 ${dataMap.size} 条记录`);
    totalDates += dataMap.size;
  }

  return {
    success: true,
    message: `AdMob 同步完成：${toDateStr(start)} ~ ${toDateStr(end)}`,
    dates:   totalDates,
  };
}

// ─── 定时任务注册 ─────────────────────────────────────────────────────────────

/**
 * 启动 AdMob 数据定时同步
 * 执行时间：每天 UTC 02:00（AdMob 数据通常在 UTC 01:30 左右稳定）
 */
function startAdMobSyncJob() {
  if (!process.env.ADMOB_PUBLISHER_ID) {
    console.warn('[AdMobSync] ⚠️ 未配置 ADMOB_PUBLISHER_ID，自动同步已跳过');
    return;
  }
  if (!process.env.ADMOB_OAUTH_REFRESH_TOKEN) {
    console.warn('[AdMobSync] ⚠️ 未配置 ADMOB_OAUTH_REFRESH_TOKEN，自动同步已跳过');
    return;
  }

  // UTC 02:00 = 每天凌晨2点（UTC），对应北京时间 10:00
  cron.schedule('0 2 * * *', async () => {
    console.log('[AdMobSync] 开始每日自动同步...');
    try {
      const result = await syncAdMobData();
      console.log(`[AdMobSync] ✅ ${result.message}（共 ${result.dates} 条）`);
    } catch (err) {
      console.error('[AdMobSync] ❌ 同步失败:', err.message);
    }
  }, { timezone: 'UTC' });

  console.log('✓ AdMob 数据自动同步任务已启动（每天 UTC 02:00）');
}

module.exports = {
  startAdMobSyncJob,
  syncAdMobData,
};
