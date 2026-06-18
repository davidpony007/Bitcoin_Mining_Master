/**
 * 修复脚本: 补建用户 U2026052807450179420 的 2 个缺失 iOS 付费合约
 *
 * 问题根因:
 *   - appstore04.99 (txId=260003008751445) 和 appstore19.99 (txId=260003008175502)
 *     的 verify-purchase 调用均因 Apple 返回 21002（收据数据被客户端截断导致格式损坏）而失败
 *   - 这两笔订阅购买时 App 版本较旧，未传入 applicationUserName，
 *     Apple S2S INITIAL_BUY 通知无法自动关联用户（appAccountToken=null），
 *     故后端无法通过通知兜底创建合约
 *   - Apple 订阅管理截图已确认两笔订阅均为活跃状态，续费日 June 29, 2026
 *
 * 修复内容:
 *   1. 补建 user_orders 记录 (p0499, p1999)
 *   2. 补建 mining_contracts 记录 (p0499, p1999)
 *
 * 执行方式:
 *   docker cp fix_missing_ios_contracts_U2026052807450179420.js bitcoin_backend_prod:/tmp/
 *   docker exec bitcoin_backend_prod node /tmp/fix_missing_ios_contracts_U2026052807450179420.js
 */

const { UserOrder, MiningContract } = require('/app/src/models');
const sequelize = require('/app/src/config/database');

const USER_ID = 'U2026052807450179420';

// Apple 订阅管理截图确认的两笔缺失订阅
const MISSING_CONTRACTS = [
  {
    product_id: 'p0499',
    product_name: 'contract_4.99',
    product_price: '4.99',
    original_transaction_id: '260003008751445',
    hashrate: 0.000000000004456,
    // Apple 订阅续费日 June 29, 2026 → 当前周期到期时间
    contract_end_time: new Date('2026-06-29T23:59:59.000Z'),
  },
  {
    product_id: 'p1999',
    product_name: 'contract_19.99',
    product_price: '19.99',
    original_transaction_id: '260003008175502',
    hashrate: 0.000000000033522,
    // Apple 订阅续费日 June 29, 2026 → 当前周期到期时间
    contract_end_time: new Date('2026-06-29T23:59:59.000Z'),
  },
];

(async () => {
  console.log(`\n=== 修复缺失 iOS 合约: ${USER_ID} ===\n`);

  for (const item of MISSING_CONTRACTS) {
    const { product_id, product_name, product_price, original_transaction_id, hashrate, contract_end_time } = item;

    console.log(`--- 处理 ${product_id} (original_tx=${original_transaction_id}) ---`);

    // 幂等检查: UserOrder
    const existingOrder = await UserOrder.findOne({
      where: { payment_gateway_id: original_transaction_id },
    });
    if (existingOrder) {
      console.log(`  ⚠️ UserOrder 已存在 (id=${existingOrder.id})，跳过创建`);
    } else {
      const now = new Date();
      const order = await UserOrder.create({
        user_id: USER_ID,
        email: '',
        google_account: null,
        product_id,
        product_name,
        product_price,
        hashrate,
        order_creation_time: now,
        payment_time: now,
        currency_type: 'USD',
        country_code: null,
        payment_gateway_id: original_transaction_id,
        payment_network_id: original_transaction_id,
        order_status: 'active',
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
      // 合约时长: 从现在到 Apple 续费日（剩余天数，按实际计算）
      const durationMs = contract_end_time - now;
      const durationHours = Math.floor(durationMs / 3600000);
      const contractDuration = `${durationHours}:00:00`;

      const contract = await MiningContract.create({
        user_id: USER_ID,
        contract_type: 'paid contract',
        product_id,
        platform: 'ios',
        contract_creation_time: now,
        contract_end_time,
        contract_duration: contractDuration,
        hashrate,
        base_hashrate: hashrate,
        is_cancelled: 0,
        original_transaction_id,
        order_id: original_transaction_id,
        is_renewal: 0,
        previous_contract_id: null,
      });
      console.log(`  ✅ MiningContract 创建成功 (id=${contract.id}), 到期: ${contract_end_time.toISOString()}`);
    }
  }

  // 验证: 输出该用户所有当前合约
  console.log('\n=== 验证: 该用户当前所有付费合约 ===');
  const allContracts = await MiningContract.findAll({
    where: { user_id: USER_ID, contract_type: 'paid contract' },
    order: [['id', 'ASC']],
    raw: true,
  });
  for (const c of allContracts) {
    const status = c.is_cancelled ? '已取消' : '活跃';
    console.log(`  合约 #${c.id}: ${c.product_id} | ${status} | 到期: ${c.contract_end_time} | orig_tx: ${c.original_transaction_id}`);
  }

  console.log('\n=== 修复完成 ===\n');
  process.exit(0);
})().catch((e) => {
  console.error('❌ 修复失败:', e.message);
  process.exit(1);
});
