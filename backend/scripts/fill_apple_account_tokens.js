'use strict';
/**
 * fill_apple_account_tokens.js
 * 一次性迁移脚本：批量补全所有 iOS 用户的 apple_app_account_token
 *
 * 背景：
 *   apple_app_account_token 由 deriveAppleAccountToken(userId) 确定性衍生，
 *   是 iOS 客户端购买时传给 Apple 的 applicationUserName（UUID 格式），
 *   Apple 将其回传到 signedTransactionInfo.appAccountToken，后端据此关联用户与交易。
 *   历史用户由于首次购买时后端尚未保存此字段，导致 S2S 通知无法主动补录。
 *
 * 本脚本无副作用：
 *   - 只填充 NULL / '' 的用户，已有值的不覆盖
 *   - 幂等，可多次执行
 *
 * 用法（在容器内运行）:
 *   node /app/scripts/fill_apple_account_tokens.js
 */

try { require('dotenv').config({ path: '/app/.env' }); } catch (_) {}

const pool = require('../src/config/database_native');
const { deriveAppleAccountToken } = require('../src/utils/deriveAppleAccountToken');

async function main() {
  console.log('🚀 [fill_apple_account_tokens] 开始批量补全 apple_app_account_token...');

  // 查询所有缺少 token 的用户（不限 system 类型，iOS/通用均补全）
  const [rows] = await pool.execute(`
    SELECT user_id
    FROM user_information
    WHERE apple_app_account_token IS NULL
       OR apple_app_account_token = ''
  `);

  console.log(`   待补全用户数: ${rows.length}`);
  if (rows.length === 0) {
    console.log('✅ 所有用户已有 apple_app_account_token，无需补全。');
    await pool.end();
    return;
  }

  // 批量更新（每批 500 条）
  const BATCH = 500;
  let updated = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    // 构造 CASE WHEN ... 批量更新，减少 DB 往返
    const cases = batch.map(r => `WHEN ? THEN ?`).join(' ');
    const ids   = batch.map(r => r.user_id);
    const params = batch.flatMap(r => [r.user_id, deriveAppleAccountToken(r.user_id)]);

    await pool.execute(
      `UPDATE user_information
       SET apple_app_account_token = CASE user_id ${cases} END
       WHERE user_id IN (${ids.map(() => '?').join(',')})
         AND (apple_app_account_token IS NULL OR apple_app_account_token = '')`,
      [...params, ...ids]
    );

    updated += batch.length;
    console.log(`   已处理 ${updated}/${rows.length}...`);
  }

  console.log(`\n✅ 完成！共补全 ${updated} 个用户的 apple_app_account_token`);

  // 验证结果
  const [[{ remaining }]] = await pool.execute(`
    SELECT COUNT(*) remaining
    FROM user_information
    WHERE apple_app_account_token IS NULL OR apple_app_account_token = ''
  `);
  console.log(`   验证：仍有 ${remaining} 个用户缺少 token（应为 0）`);

  await pool.end();
}

main().catch(err => {
  console.error('❌ 脚本出错:', err.message);
  process.exit(1);
});
