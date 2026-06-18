/**
 * 修复脚本: 补建用户 U2026051904554748398 的 2 个缺失 iOS 付费合约
 *
 * 问题根因:
 *   - 用户购买了 appstore04.99 ($4.99) 和 appstore06.99 ($6.99) 两个订阅
 *   - 客户端 App 版本 1.0.4 将 base64 收据截断，导致 Apple verifyReceipt 返回 21002
 *   - Apple App Store Server API (ASAPI) 凭证未配置，后端无法通过 transactionId 降级验证
 *   - Apple S2S INITIAL_BUY 通知若有 appAccountToken 则可自动处理，
 *     但后端容器重启后日志丢失，无法确认通知是否曾被处理
 *
 * 修复内容:
 *   1. 补建 user_orders 记录 (p0499, p0699)
 *   2. 补建 mining_contracts 记录 (p0499, p0699)
 *
 * 注意:
 *   - original_transaction_id 使用占位符（因真实 Apple transaction_id 未知）
 *   - 合约到期时间按注册日期(2026-05-19) + 30天 估算
 *   - 待 ASAPI 凭证配置后，用户 restore 时会自动补全真实 transaction_id
 *   - 若届时产生重复合约，需手动取消本脚本创建的占位合约
 *
 * 执行方式:
 *   docker cp fix_missing_ios_contracts_U2026051904554748398.js bitcoin_backend_prod:/tmp/
 *   docker exec bitcoin_backend_prod node /tmp/fix_missing_ios_contracts_U2026051904554748398.js
 */

'use strict';

const { UserOrder, MiningContract } = require('/app/src/models');
const sequelize = require('/app/src/config/database');

const USER_ID = 'U2026051904554748398';

// 用户注册于 2026-05-19，按 30 天估算合约到期时间
// 实际到期时间需 ASAPI 配置后通过 restore 更新
const MISSING_CONTRACTS = [
  {
    product_id:    'p0499',
    product_name:  'contract_4.99',
    product_price: '4.99',
    // 占位符 transaction_id：包含用户 ID 和产品，确保唯一且不与 Apple 真实 ID 冲突
    original_transaction_id: `MANUAL_${USER_ID}_p0499`,
    hashrate:      0.000000000004456,
    // 注册日期 2026-05-19 + 30 天
    contract_end_time: new Date('2026-06-19T23:59:59.000Z'),
  },
  {
    product_id:    'p0699',
    product_name:  'contract_6.99',
    product_price: '6.99',
    original_transaction_id: `MANUAL_${USER_ID}_p0699`,
    hashrate:      0.000000000007723,
    contract_end_time: new Date('2026-06-19T23:59:59.000Z'),
  },
];

(async () => {
  console.log(`\n=== 修复缺失 iOS 合约: ${USER_ID} ===\n`);

  for (const item of MISSING_CONTRACTS) {
    const {
      product_id, product_name, product_price,
      original_transaction_id, hashrate, contract_end_time,
    } = item;

    console.log(`--- 处理 ${product_id} (placeholder_tx=${original_transaction_id}) ---`);

    // 幂等检查: UserOrder
    const existingOrder = await UserOrder.findOne({
      where: { payment_gateway_id: original_transaction_id },
    });
    if (existingOrder) {
      console.log(`  ⚠️ UserOrder 已存在 (id=${existingOrder.id})，跳过创建`);
    } else {
      const now = new Date();
      const order = await UserOrder.create({
        user_id:             USER_ID,
        email:               '',
        google_account:      null,
        apple_account:       'quinn.ripper@icloud.com',
        product_id,
        product_name,
        product_price,
        hashrate,
        order_creation_time: now,
        payment_time:        now,
        currency_type:       'USD',
        country_code:        'US',
        payment_gateway_id:  original_transaction_id,
        payment_network_id:  original_transaction_id,
        order_status:        'active',
      });
      console.log(`  ✅ UserOrder 创建成功 (id=${order.id})`);
    }

    // 幂等检查: MiningContract
    const existingContract = await MiningContract.findOne({
      where: { original_transaction_id, contract_type: 'paid contract' },
    });
    if (existingContract) {
      console.log(`  ⚠️ MiningContract 已存在 (id=${existingContract.id})，跳过创建`);
    } else {
      const now = new Date();
      const durationMs    = contract_end_time - now;
      const durationHours = Math.floor(durationMs / 3600000);
      const contractDuration = `${durationHours}:00:00`;

      const contract = await MiningContract.create({
        user_id:               USER_ID,
        contract_type:         'paid contract',
        product_id,
        platform:              'ios',
        contract_creation_time: now,
        contract_end_time,
        contract_duration:     contractDuration,
        hashrate,
        base_hashrate:         hashrate,
        is_cancelled:          0,
        original_transaction_id,
        order_id:              original_transaction_id,
        is_renewal:            0,
        previous_contract_id:  null,
      });
      console.log(`  ✅ MiningContract 创建成功 (id=${contract.id}), 到期: ${contract_end_time.toISOString()}`);
    }
  }

  // 验证
  console.log('\n=== 验证: 该用户当前所有付费合约 ===');
  const allContracts = await MiningContract.findAll({
    where: { user_id: USER_ID, contract_type: 'paid contract' },
    order: [['id', 'ASC']],
    raw: true,
  });
  for (const c of allContracts) {
    const status = c.is_cancelled ? '已取消' : '活跃';
    console.log(`  合约 #${c.id}: ${c.product_id} | ${status} | 到期: ${c.contract_end_time} | tx: ${c.original_transaction_id}`);
  }

  console.log('\n=== 修复完成 ===\n');
  process.exit(0);
})().catch((e) => {
  console.error('❌ 修复失败:', e.message);
  process.exit(1);
});
