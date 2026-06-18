/**
 * mintegralSyncJob.js
 * 每天 UTC 03:00 自动从 Mintegral Reporting API 拉取昨日广告消耗和安装转化数，
 * 写入 daily_ad_stats.mintegral_spend 和 daily_ad_stats.mintegral_installs。
 *
 * 所需环境变量：
 *   MINTEGRAL_SKEY   - Access Key（Mintegral Dashboard → Account Center → API Management）
 *   MINTEGRAL_PKEY   - API Key（同上位置，用于生成 token）
 *
 * Mintegral Token 生成规则：
 *   token = MD5( api_key + MD5( timestamp ) )
 *   Headers: access-key, token, timestamp
 *
 * 接口为两步异步：
 *   Step1: type=1 触发生成，轮询直到 code=200
 *   Step2: type=2 下载 TSV 文件（tab 分隔）
 */

'use strict';

const cron   = require('node-cron');
const https  = require('https');
const crypto = require('crypto');
const pool   = require('../config/database_native');

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

function toDateStr(d) {
  const y  = d.getUTCFullYear();
  const m  = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

/** 生成鉴权 Headers，每次调用时重新生成（timestamp 会变化） */
function buildAuthHeaders(skey, pkey) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const token     = crypto.createHash('md5')
    .update(pkey + crypto.createHash('md5').update(timestamp).digest('hex'))
    .digest('hex');
  return { 'access-key': skey, 'token': token, 'timestamp': timestamp };
}

/** 发起一次 HTTPS GET，返回 { statusCode, body } */
function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path, method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end',  () => resolve({ statusCode: res.statusCode, body }));
    }).on('error', reject);
  });
}

// ─── 核心拉取逻辑 ──────────────────────────────────────────────────────────────

/**
 * 拉取单个 ≤7 天区间的数据（Mintegral API 限制单次最多 7 天）
 *
 * @param {string} skey
 * @param {string} pkey
 * @param {string} startStr  YYYY-MM-DD
 * @param {string} endStr    YYYY-MM-DD
 * @returns {Promise<Map<string, {spend: number, installs: number}>>}
 */
async function fetchChunk(skey, pkey, startStr, endStr) {
  const baseQS = `start_time=${startStr}&end_time=${endStr}&tz=0`;

  // ── Step 1: 触发数据生成，轮询直到 code=200（最多等待约 4 分钟）─────────────
  let ready = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 20000)); // 每次等 20s
    }

    const { body } = await httpsGet(
      'ss-api.mintegral.com',
      `/api/v2/reports/data?${baseQS}&type=1`,
      buildAuthHeaders(skey, pkey)
    );

    let json;
    try { json = JSON.parse(body); } catch (e) {
      throw new Error(`Mintegral type=1 解析失败: ${body.substring(0, 200)}`);
    }

    if (json.code === 200) {
      ready = true;
      break;
    } else if (json.code === 201 || json.code === 202) {
      console.log(`[MintegralSync] [${startStr}~${endStr}] 数据生成中 (code=${json.code})，第 ${attempt + 1} 次等待...`);
    } else {
      throw new Error(`Mintegral type=1 错误 code=${json.code}: ${json.msg} ${JSON.stringify(json.data || {})}`);
    }
  }

  if (!ready) {
    throw new Error(`Mintegral 数据生成超时 [${startStr}~${endStr}]（12 次轮询）`);
  }

  // ── Step 2: 下载 TSV 文件（若 204 还未就绪则再重试几次）─────────────────────
  let fileContent = '';
  for (let dl = 0; dl < 4; dl++) {
    if (dl > 0) await new Promise(r => setTimeout(r, 15000));
    const { statusCode, body } = await httpsGet(
      'ss-api.mintegral.com',
      `/api/v2/reports/data?${baseQS}&type=2`,
      buildAuthHeaders(skey, pkey)
    );
    if (body.includes('\t')) {
      fileContent = body;
      break;
    }
    let errCode = '';
    try { const j = JSON.parse(body); errCode = `code=${j.code}: ${j.msg}`; } catch (_) { errCode = body.substring(0, 100); }
    if (statusCode !== 200) {
      throw new Error(`Mintegral type=2 下载失败 (HTTP ${statusCode}): ${errCode}`);
    }
    console.log(`[MintegralSync] [${startStr}~${endStr}] type=2 未就绪 (${errCode})，第 ${dl + 1} 次等待...`);
  }

  if (!fileContent) {
    throw new Error(`Mintegral type=2 数据始终未就绪 [${startStr}~${endStr}]`);
  }

  // ── 解析 TSV ──────────────────────────────────────────────────────────────────
  const result = new Map();
  const lines  = fileContent.split('\n').filter(l => l.trim());
  if (lines.length < 2) return result;

  const hdrs      = lines[0].split('\t');
  const dateIdx   = hdrs.indexOf('Date');
  const spendIdx  = hdrs.indexOf('Spend');
  const convIdx   = hdrs.indexOf('Conversion'); // 安装归因数（单数，不是 Conversions）

  if (dateIdx < 0 || spendIdx < 0) {
    throw new Error(`Mintegral TSV 缺少 Date/Spend 列，实际表头: ${hdrs.join(', ')}`);
  }

  for (let i = 1; i < lines.length; i++) {
    const cols    = lines[i].split('\t');
    const rawDate = (cols[dateIdx] || '').trim(); // 格式 20220418
    const spend   = parseFloat(cols[spendIdx] || '0');
    const installs = convIdx >= 0 ? parseInt(cols[convIdx] || '0', 10) : 0;
    if (rawDate.length < 8) continue;
    const dateStr = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
    const prev = result.get(dateStr) || { spend: 0, installs: 0 };
    result.set(dateStr, { spend: prev.spend + spend, installs: prev.installs + installs });
  }

  return result;
}

/**
 * 从 Mintegral Reporting API 拉取指定日期范围的每日消耗数据。
 * 自动将超过 7 天的范围拆分为多个请求（API 限制）。
 *
 * @param {Date} startDate - 起始日期（含，UTC 00:00）
 * @param {Date} endDate   - 结束日期（含，UTC 00:00）
 * @returns {Promise<Map<string, {spend: number, installs: number}>>} dateStr → {spend, installs}
 */
async function fetchMintegralData(startDate, endDate) {
  const skey = process.env.MINTEGRAL_SKEY;
  const pkey = process.env.MINTEGRAL_PKEY;

  if (!skey || !pkey) {
    throw new Error('Mintegral 配置缺失：请设置 MINTEGRAL_SKEY 和 MINTEGRAL_PKEY');
  }

  const result    = new Map();
  const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;
  let   chunkStart = new Date(startDate);

  while (chunkStart <= endDate) {
    // 每片最多 7 天
    const chunkEnd = new Date(Math.min(chunkStart.getTime() + MS_7_DAYS - 86400000, endDate.getTime()));
    const chunkData = await fetchChunk(skey, pkey, toDateStr(chunkStart), toDateStr(chunkEnd));

    for (const [date, data] of chunkData) {
      const prev = result.get(date) || { spend: 0, installs: 0 };
      result.set(date, { spend: prev.spend + data.spend, installs: prev.installs + data.installs });
    }

    chunkStart = new Date(chunkEnd.getTime() + 86400000); // 下一片从 chunkEnd + 1 天开始
  }

  return result;
}

/**
 * 将 Mintegral 消耗和安装数写入 daily_ad_stats（UPSERT）
 *
 * @param {Map<string, {spend: number, installs: number}>} dataMap  dateStr → {spend, installs}
 */
async function upsertMintegralData(dataMap) {
  if (dataMap.size === 0) return;

  const conn = await pool.getConnection();
  try {
    for (const [dateStr, { spend, installs }] of dataMap) {
      await conn.query(
        `INSERT INTO daily_ad_stats (stat_date, platform, mintegral_spend, mintegral_installs)
         VALUES (?, 'Android', ?, ?)
         ON DUPLICATE KEY UPDATE
           mintegral_spend    = VALUES(mintegral_spend),
           mintegral_installs = VALUES(mintegral_installs)`,
        [dateStr, parseFloat(spend.toFixed(4)), installs]
      );
    }
  } finally {
    conn.release();
  }
}

// ─── 主同步入口 ────────────────────────────────────────────────────────────────

/**
 * 同步指定日期范围（默认昨天）
 *
 * @param {Object} [options]
 * @param {Date}   [options.startDate] - 默认昨天 UTC
 * @param {Date}   [options.endDate]   - 默认昨天 UTC
 * @returns {Promise<{success: boolean, message: string, dates: number}>}
 */
async function syncMintegralData({ startDate, endDate } = {}) {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  const start = startDate || yesterday;
  const end   = endDate   || yesterday;

  console.log(`[MintegralSync] 拉取 ${toDateStr(start)} ~ ${toDateStr(end)}`);

  const dataMap = await fetchMintegralData(start, end);
  await upsertMintegralData(dataMap);

  console.log(`[MintegralSync] 写入 ${dataMap.size} 条消耗+安装记录`);
  return {
    success: true,
    message: `Mintegral 同步完成：${toDateStr(start)} ~ ${toDateStr(end)}`,
    dates:   dataMap.size,
  };
}

// ─── 定时任务注册 ──────────────────────────────────────────────────────────────

/**
 * 启动 Mintegral 消耗定时同步
 * 执行时间：每天 UTC 03:00（比 AdMob 晚 1 小时，避免数据库争用）
 */
function startMintegralSyncJob() {
  if (!process.env.MINTEGRAL_SKEY || !process.env.MINTEGRAL_PKEY) {
    console.warn('[MintegralSync] ⚠️ 未配置 MINTEGRAL_SKEY / MINTEGRAL_PKEY，自动同步已跳过');
    return;
  }

  cron.schedule('0 3 * * *', async () => {
    console.log('[MintegralSync] 开始每日自动同步...');
    try {
      const result = await syncMintegralData();
      console.log(`[MintegralSync] ✅ ${result.message}（共 ${result.dates} 条）`);
    } catch (err) {
      console.error('[MintegralSync] ❌ 同步失败:', err.message);
    }
  }, { timezone: 'UTC' });

  console.log('✓ Mintegral 消耗自动同步任务已启动（每天 UTC 03:00）');
}

module.exports = {
  startMintegralSyncJob,
  syncMintegralData,
};
