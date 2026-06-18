'use strict';

/**
 * 从 user_id 衍生确定性 UUID v4（FNV-1a 32-bit × 4）
 *
 * 算法与 Flutter 端 apple_in_app_purchase_service.dart 的
 * _deriveAccountToken() 完全一致，两端必须保持同步。
 *
 * 用途：
 *   - iOS 购买时作为 SKPayment.applicationUsername 传入 Apple
 *   - Apple 将其存入 signedTransactionInfo.appAccountToken（UUID 格式时有效）
 *   - SUBSCRIBED/INITIAL_BUY 通知到达后，用该值反查 user_information.apple_app_account_token
 */
function deriveAppleAccountToken(userId) {
  const input = 'btcmining:' + userId;
  let h0 = 0x6c62272e >>> 0;
  let h1 = 0x07bb0142 >>> 0;
  let h2 = 0x62b82175 >>> 0;
  let h3 = 0x6295c58d >>> 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h0 = Math.imul(h0 ^ c, 0x01000193) >>> 0;
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x01000193) >>> 0;
    h3 = Math.imul(h3 ^ c, 0x01000193) >>> 0;
  }
  // 设置 UUID v4 版本位（time_hi 高4位 = 0100）
  h1 = ((h1 & 0xFFFF0FFF) | 0x00004000) >>> 0;
  // 设置 RFC4122 variant 位（clock_seq 高2位 = 10）
  h2 = ((h2 & 0x3FFFFFFF) | 0x80000000) >>> 0;
  const hex = (n, len) => (n >>> 0).toString(16).padStart(len, '0');
  return [
    hex(h0, 8),
    hex(h1 >>> 16, 4),
    hex(h1 & 0xFFFF, 4),
    hex(h2 >>> 16, 4),
    hex(h2 & 0xFFFF, 4) + hex(h3, 8),
  ].join('-');
}

module.exports = { deriveAppleAccountToken };
