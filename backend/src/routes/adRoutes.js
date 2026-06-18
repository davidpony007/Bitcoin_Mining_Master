/**
 * 广告系统 API 路由
 * 提供广告观看记录、积分奖励、查询广告数据等接口
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const AdService = require('../services/adService');
const AdPointsService = require('../services/adPointsService');
const pool = require('../config/database_native');
const authenticate = require('../middleware/auth');

// ─── AdMob SSV 公钥缓存（24小时TTL，避免每次请求都拉取）─────────────────────
let _ssvKeyCache = null;
let _ssvKeyCacheExpiry = 0;

async function fetchSsvPublicKeys() {
  const now = Date.now();
  if (_ssvKeyCache && now < _ssvKeyCacheExpiry) return _ssvKeyCache;
  const { data } = await axios.get(
    'https://www.gstatic.com/admob/reward/verifier-keys.json',
    { timeout: 5000 }
  );
  _ssvKeyCache = data.keys;
  _ssvKeyCacheExpiry = now + 24 * 3600 * 1000;
  return _ssvKeyCache;
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/ad/watch
 * @desc    记录广告观看并奖励积分（使用新的积分系统）
 * @access  Private
 * @body    ad_type - 广告类型 (可选，默认REWARD_AD)
 */
router.post('/watch', authenticate, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { ad_type = 'REWARD_AD' } = req.body;

    // 使用新的AdPointsService，集成积分系统
    const result = await AdPointsService.recordAdViewAndReward(user_id);

    res.json(result);

  } catch (error) {
    console.error('记录广告观看失败:', error);
    res.status(500).json({
      success: false,
      message: '记录广告观看失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/today
 * @desc    获取今日广告观看记录（使用新的积分系统）
 * @access  Private
 */
router.get('/today', authenticate, async (req, res) => {
  try {
    const user_id = req.user.user_id;

    // 使用新的AdPointsService
    const result = await AdPointsService.getTodayAdRecord(user_id);

    res.json(result);

  } catch (error) {
    console.error('获取今日广告记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取今日广告记录失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/count (兼容旧接口)
 * @desc    获取广告观看次数
 * @access  Private
 */
router.get('/count', authenticate, async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const result = await AdPointsService.getTodayAdRecord(user_id);

    res.json({
      success: true,
      data: {
        todayCount: result.viewCount || 0,
        dailyLimit: result.dailyLimit,
        remainingViews: result.remainingViews
      }
    });

  } catch (error) {
    console.error('获取广告观看次数失败:', error);
    res.status(500).json({
      success: false,
      message: '获取广告观看次数失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/history
 * @desc    获取广告观看历史（使用新的积分系统）
 * @access  Private
 * @query   user_id - 用户ID
 * @query   days - 查询天数 (默认30天)
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const { user_id, days } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const daysNumber = parseInt(days) || 30;
    
    // 使用新的AdPointsService
    const result = await AdPointsService.getAdViewHistory(user_id, daysNumber);

    res.json(result);

  } catch (error) {
    console.error('获取广告历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取广告历史失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/subordinate
 * @desc    获取下级用户广告观看统计
 * @access  Private
 * @query   user_id - 用户ID (邀请人ID)
 */
router.get('/subordinate', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const result = await AdPointsService.getSubordinateAdStatistics(user_id);

    res.json(result);

  } catch (error) {
    console.error('获取下级广告统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取下级广告统计失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/statistics (兼容旧接口)
 * @desc    获取广告观看统计
 * @access  Private
 * @query   user_id - 用户ID
 */
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    // 使用新的AdPointsService获取历史数据
    const historyResult = await AdPointsService.getAdViewHistory(user_id, 30);

    res.json({
      success: true,
      data: historyResult.data.statistics
    });

  } catch (error) {
    console.error('获取广告统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取广告统计失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/referral-progress (兼容旧接口)
 * @desc    获取下级用户广告观看进度
 * @access  Private
 * @query   user_id - 用户ID (邀请人ID)
 */
router.get('/referral-progress', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '缺少参数: user_id'
      });
    }

    const result = await AdPointsService.getSubordinateAdStatistics(user_id);

    res.json(result);

  } catch (error) {
    console.error('获取下级用户广告进度失败:', error);
    res.status(500).json({
      success: false,
      message: '获取下级用户广告进度失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ad/ssv
 * @desc    AdMob SSV (Server-Side Verification) 回调接口
 *          Google 服务器在用户完整观看激励广告后，向本接口发送 RSA-SHA256 签名请求。
 *          接口职责：验证签名真实性 + 幂等记录已核实的观看凭证（admob_ssv_log）。
 *          本接口不直接发放游戏奖励，奖励由客户端在收到 onUserEarnedReward 后
 *          调用 /api/mining-pool/extend-contract 或 /api/check-in/daily 完成。
 *          admob_ssv_log 作为反欺诈凭证：若奖励接口发现对应 transaction_id 不在
 *          ssv_log 中，可判定该请求为伪造。
 * @access  Public（由 AdMob 服务器直接调用，无 JWT）
 *
 * 查询参数（AdMob 固定格式）：
 *   ad_network     - 出价方网络ID
 *   ad_unit        - 广告单元ID（ca-app-pub-xxx/xxx）
 *   custom_data    - 自定义数据（可选，由客户端 ServerSideVerificationOptions.customData 传入）
 *   key_id         - 用于查找公钥的 keyId
 *   reward_amount  - 奖励数量
 *   reward_item    - 奖励类型
 *   timestamp      - Unix 毫秒时间戳
 *   transaction_id - 全局唯一交易ID（AdMob 生成）
 *   user_id        - 客户端 ServerSideVerificationOptions.userId 传入的用户ID
 *   signature      - Base64URL 编码的 RSA-SHA256 签名（位于查询串末尾）
 *
 * 签名验证原理：
 *   签名内容 = 查询串中 &key_id=... 之前的全部内容
 *   即：ad_network=...&ad_unit=...&...&user_id=...（不含 key_id 和 signature）
 *   算法：RSA-SHA256，公钥来自 gstatic.com/admob/reward/verifier-keys.json
 */
router.get('/ssv', async (req, res) => {
  const { key_id, signature, transaction_id, user_id, reward_amount, reward_item, ad_unit, ad_network, timestamp } = req.query;

  // ① 参数完整性检查（user_id 为可选，AdMob 验证回调时可能为空）
  if (!key_id || !signature || !transaction_id) {
    console.warn('⚠️ SSV: 缺少必要参数', req.query);
    return res.status(400).send('Missing required parameters');
  }

  try {
    // ② 重放攻击防护：时间戳必须在 ±10 分钟以内
    const tsMs = parseInt(timestamp, 10);
    if (isNaN(tsMs) || Math.abs(Date.now() - tsMs) > 10 * 60 * 1000) {
      console.warn(`⚠️ SSV: 时间戳过期，transaction=${transaction_id}`);
      return res.status(400).send('Timestamp expired or invalid');
    }

    // ③ 重建签名内容：取 &signature= 和 &key_id= 中靠前的那个之前的部分
    //    AdMob 实际格式：...&signature=XXX&key_id=YYY（signature 在前）
    //    AdMob 文档格式：...&key_id=YYY&signature=XXX（key_id 在前）
    //    两种格式均支持：取两者中位置更小的作为切割点
    const rawQuery = req.url.split('?')[1] || '';
    const keyIdPos = rawQuery.indexOf('&key_id=');
    const sigPos   = rawQuery.indexOf('&signature=');
    if (keyIdPos === -1 && sigPos === -1) {
      console.warn(`⚠️ SSV: 查询串格式异常，缺少 &key_id= 和 &signature=，transaction=${transaction_id}`);
      return res.status(400).send('Invalid query format');
    }
    const cutPos = (keyIdPos === -1) ? sigPos
                 : (sigPos === -1)   ? keyIdPos
                 : Math.min(keyIdPos, sigPos);
    // AdMob 对 URL 解码后的查询串内容进行签名（%20 → 空格），需解码后再验证
    const signedContent = decodeURIComponent(rawQuery.substring(0, cutPos));

    // ④ 获取 AdMob 公钥并匹配 key_id
    const keys = await fetchSsvPublicKeys();
    const matchingKey = keys.find(k => String(k.keyId) === String(key_id));
    if (!matchingKey) {
      console.error(`❌ SSV: 未知 key_id=${key_id}，transaction=${transaction_id}`);
      // key 未找到可能是缓存过期，强制刷新一次
      _ssvKeyCache = null;
      return res.status(400).send('Unknown key_id');
    }

    // ⑤ ECDSA-SHA256 签名验证（signature 为 Base64URL 编码）
    // 从 rawQuery 中直接提取原始签名（避免 Express query 解析带来的差异）
    const sigMatch = rawQuery.match(/(?:^|&)signature=([^&]+)/);
    const rawSig = sigMatch ? sigMatch[1] : signature;

    let isValid = false;
    try {
      const sigBuf = Buffer.from(rawSig, 'base64url');
      const v = crypto.createVerify('SHA256');
      v.update(signedContent);
      isValid = v.verify(matchingKey.pem, sigBuf);
    } catch(ve) {
      console.error(`❌ SSV: 签名验证异常: ${ve.message}`);
    }

    if (!isValid) {
      console.error(`❌ SSV: 签名验证失败，transaction=${transaction_id}，user=${user_id}`);
      return res.status(400).send('Invalid signature');
    }
    console.log(`✅ SSV: 签名验证通过 transaction=${transaction_id}`);

    // ⑥ 幂等保护：同一 transaction_id 只处理一次
    const [existing] = await pool.query(
      'SELECT id FROM admob_ssv_log WHERE transaction_id = ?',
      [transaction_id]
    );
    if (existing.length > 0) {
      // 已处理过（AdMob 可能重试），返回 200 避免 AdMob 继续重试
      console.log(`ℹ️ SSV: 已处理过的交易，跳过。transaction=${transaction_id}`);
      return res.status(200).send('OK');
    }

    // ⑦ 写入验证凭证（INSERT IGNORE 兜底并发场景）
    await pool.query(
      `INSERT IGNORE INTO admob_ssv_log
         (transaction_id, user_id, reward_amount, reward_item, ad_unit, ad_network)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        transaction_id,
        user_id      || '',
        parseInt(reward_amount) || 1,
        reward_item  || '',
        ad_unit      || '',
        ad_network   || '',
      ]
    );

    console.log(`✅ SSV 验证成功: user=${user_id}, transaction=${transaction_id}, reward=${reward_amount} ${reward_item}`);
    return res.status(200).send('OK');

  } catch (err) {
    console.error('❌ SSV 处理异常:', err.message);
    // 服务端错误返回 200，避免 AdMob 将正常请求标记为失败并停止回调
    return res.status(200).send('OK');
  }
});

/**
 * @route   GET /api/ad/ssv/check
 * @desc    查询指定 transaction_id 是否已通过 SSV 验证（供奖励接口内部调用或运维排查）
 * @access  Private (需 JWT)
 * @query   transaction_id - 要查询的交易ID
 */
router.get('/ssv/check', authenticate, async (req, res) => {
  const { transaction_id } = req.query;
  if (!transaction_id) {
    return res.status(400).json({ success: false, message: '缺少 transaction_id' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT id, user_id, reward_amount, reward_item, created_at FROM admob_ssv_log WHERE transaction_id = ?',
      [transaction_id]
    );
    return res.json({
      success: true,
      verified: rows.length > 0,
      data: rows[0] || null,
    });
  } catch (err) {
    console.error('SSV check 查询失败:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
