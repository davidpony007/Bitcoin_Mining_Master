'use strict';

/**
 * 修复脚本: 补建用户 U2026052805542979173 的 2 个缺失 iOS 付费合约
 *
 * 问题根因: 同 U2026051904554748398 —— App 1.0.5 收据被截断，Apple 返回 21002，
 *           后端无法验证，合约未创建。ASAPI 凭证未配置，无法降级验证。
 * 产品: appstore04.99 ($4.99) + appstore19.99 ($19.99)
 * 注册时间: 2026-05-28，合约到期按 +30 天估算 (2026-06-28)
 *
 * 执行方式:
 *   docker cp fix_missing_ios_contracts_U2026052805542979173.js bitcoin_backend_prod:/tmp/
 *   docker exec bitcoin_backend_prod node /tmp/fix_missing_ios_contracts_U2026052805542979173.js
 */

const { UserOrder, MiningContract } = require('/app/src/models');

const USER_ID      = 'U2026052805542979173';
const APPLE_ACCT   = 'akaiaross14@gmail.com';
const COUNTRY_CODE = 'US';

const MISSING_CONTRACTS = [
  {
    product_id:              'p0499',
    product_name:            'contract_4.99',
    product_price:           '4.99',
    original_transaction_id: `MANUAL_${USER_ID}_p0499`,
    hashrate:                0.000000000004456,
    contract_end_time:       new Date('2026-06-28T23:59:59.000Z'),
  },
  {
    product_id:              'p1999',
    product_name:            'contract_19.99',
    product_price:           '19.99',
    original_transaction_id: `MANUAL_${USER_ID}_p1999`,
    hashrate:                0.000000000033522,
    contract_end_time:       new Date('2026-06-28T23:59:59.000Z'),
  },
];

(async () => {
  console.log(`\n=== 修复缺失 iOS 合约: ${USER_ID} ===\n`);

  for (const item of MISSING_CONTRACTS) {
    const { product_id, product_name, product_price, original_transaction_id, hashrate, contract_end_time } = item;
    console.log(`--- 处理 ${product_id} (tx=${original_transaction_id}) ---`);

    const existingOrder = await UserOrder.findOne({ where: { payment_gateway_id: original_transaction_id } });
    if (existingOrder) {
      console.log(`  ⚠️ UserOrder 已存在 (id=${existingOrder.id})，跳过`);
    } else {
      const now = new Date();
      const order = await UserOrder.create({
        user_id: USER_ID, email: '', google_account: null,
        apple_account: APPLE_ACCT, product_id, product_name, product_price, hashrate,
        order_creation_time: now, payment_time: now, currency_type: 'USD',
        country_code: COUNTRY_CODE,
        payment_gateway_id: original_transaction_id,
        payment_network_id: original_transaction_id,
        order_status: 'active',
      });
      console.log(`  ✅ UserOrder 创建成功 (id=${order.id})`);
    }

    const existingContract = await MiningContract.findOne({
      where: { original_transaction_id, contract_type: 'paid contract' },
    });
    if (existingContract) {
      console.log(`  ⚠️ MiningContract 已存在 (id=${existingContract.id})，跳过`);
    } else {
      const now = new Date();
      const durationHours = Math.floor((contract_end_time - now) / 3600000);
      const contract = await MiningContract.create({
        user_id: USER_ID, contract_type: 'paid contract', product_id, platform: 'ios',
        contract_creation_time: now, contract_end_time,
        contract_duration: `${durationHours}:00:00`,
        hashrate, base_hashrate: hashrate, is_cancelled: 0,
        original_transaction_id, order_id: original_transaction_id,
        is_renewal: 0, previous_contract_id: null,
      });
      console.log(`  ✅ MiningContract 创建成功 (id=${contract.id}), 到期: ${contract_end_time.toISOString()}`);
    }
  }

  console.log('\n=== 验证 ===');
  const all = await MiningContract.findAll({
    where: { user_id: USER_ID, contract_type: 'paid contract' },
    order: [['id', 'ASC']], raw: true,
  });
  for (const c of all) {
    console.log(`  合约 #${c.id}: ${c.product_id} | ${c.is_cancelled ? '已取消' : '活跃'} | 到期: ${c.contract_end_time}`);
  }
  console.log('\n=== 修复完成 ===\n');
  process.exit(0);
})().catch(e => { console.error('❌ 修复失败:', e.message); process.exit(1); });
