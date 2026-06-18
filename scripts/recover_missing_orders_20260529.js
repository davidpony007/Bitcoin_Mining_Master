'use strict';
/**
 * 漏单补录脚本 — 2026-05-29 Android 5笔丢单
 * 根因：Flutter 购买未设置 obfuscatedExternalAccountId → RTDN 无法反查用户
 * 操作：Google Play API 验证订阅 → 创建 user_orders + mining_contracts → acknowledge
 *
 * 执行方式：
 *   docker cp recover_missing_orders_20260529.js bitcoin_backend_prod:/tmp/
 *   docker exec bitcoin_backend_prod node /tmp/recover_missing_orders_20260529.js
 */

const googlePlayVerifyService = require('/app/src/services/googlePlayVerifyService');
const paidContractService = require('/app/src/services/paidContractService');
const PaidProductService = require('/app/src/services/paidProductService');
const { UserOrder, UserInformation } = require('/app/src/models');

// 注意：ANDROID_PACKAGE_NAME 环境变量值有误（bitcoin_mining_master），
// 实际 Google Play 包名为 bitcoin_mining_app（来自 build.gradle.kts）
const PACKAGE_NAME = 'com.cloudminingtool.bitcoin_mining_app';

// 5 笔漏单（userId 由服务器日志追溯确认）
const MISSING_ORDERS = [
  {
    gpaOrderId: 'GPA.3315-2446-2761-70069',
    purchaseToken:
      'iokojkbghcpkgcfbbjgpajaa.AO-J1OxKkp5VDcYKOxwFq21m5md_AyfGs7Zaj0SukKu1E5aT57-6-mboHnB_nkW5DJKiEHJdynCq16iXIJyTM6OORxBvXxT55H1crQEV-Swwh1-JJGaDrBiWoMioh8-e_D6Ngt7nYlC2',
    userId: 'U2026052917584616547',
    subscriptionId: 'p19.99',
    productId: 'p1999',
    purchaseTime: new Date('2026-05-29T18:05:20Z'),
    note: 'cindygirard494@gmail.com  USD 21.83',
  },
  {
    gpaOrderId: 'GPA.3370-4233-6987-03276',
    purchaseToken:
      'mppbjadfldbifjfkompfnhnn.AO-J1Ox3S77GrQcd_hQBl6OsG3pUC1o2oMI0LT4H1fELegRNOqEGcszctzNo-46-SpggYqWyKHBSAE19qoaTlsGjXFcXvg6LSoxkB33uRrwURaXi4OVrhZSpAwrR1JEqTslGRe1azKyU',
    userId: 'U2026052917584616547',
    subscriptionId: 'p09.99',
    productId: 'p0999',
    purchaseTime: new Date('2026-05-29T18:07:00Z'),
    note: 'cindygirard494@gmail.com  USD 10.91',
  },
  {
    gpaOrderId: 'GPA.3343-8078-1646-34146',
    purchaseToken:
      'lfklmckdoepkbpaenkfjdggn.AO-J1OwCvmhgs7GYw7ZSqwuE3oIrDIppGfCLPBjkWddSuhijxRwH30yqwi_7XH1LYtFTcDKuhF_tWdw2ZrV1ap6C8EpR3NNVZIRnwCqUvQzErCPMRMvkOobtuaepIVsUjro9fcws3TL_',
    userId: 'U2026052506175849576',
    subscriptionId: 'p04.99',
    productId: 'p0499',
    purchaseTime: new Date('2026-05-29T19:34:00Z'),
    note: 'tyoakley87@gmail.com  USD 4.99',
  },
  {
    gpaOrderId: 'GPA.3340-7958-4016-41163',
    purchaseToken:
      'beegeleponiamklgplndkegf.AO-J1OyZQfq_cmOhL7vdH_CBIfmaW4ztjZhVSusZo6mTMEnA8uEJlHQNo-9yK7EOFsG1k3IWBxM8RJ9Q8hoyX76QvmZxrAYEmmmXf3SJm6bfsNRhQG3Ex11LhKCMNmTt2ZOnTqT-cyrl',
    userId: 'U2026052506175849576',
    subscriptionId: 'p06.99',
    productId: 'p0699',
    purchaseTime: new Date('2026-05-29T19:37:00Z'),
    note: 'tyoakley87@gmail.com  USD 6.99',
  },
  {
    gpaOrderId: 'GPA.3331-2432-7705-38091',
    purchaseToken:
      'gjafhofckomdcmfggkfenoan.AO-J1OyN_ZdNGmqrgc5xQcoGuKnBQjM7BWddQDEIP6fVwBD8_vuA-PVwVuhMQHXd8h-UzT_JmY_0rD5F6cb25el5dNo1BYa5G26u-7OFvH5j9-a4DVD8HNK7PXy3slE3oHt6lXP-2Wn7',
    userId: 'U2026052503415768816',
    subscriptionId: 'p04.99',
    productId: 'p0499',
    purchaseTime: new Date('2026-05-29T23:59:00Z'),
    note: 'davidpaico2003@gmail.com  PEN 16.99',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

async function recoverOrder(order) {
  const { gpaOrderId, purchaseToken, userId, subscriptionId, productId, purchaseTime, note } = order;

  console.log(`\n${'─'.repeat(72)}`);
  console.log(`▶  ${gpaOrderId}`);
  console.log(`   ${note}  |  userId: ${userId}`);

  // ── Step 1：幂等检查，已存在则跳过创建 ────────────────────────────────────
  const existingOrder = await UserOrder.findOne({ where: { payment_gateway_id: gpaOrderId } });
  if (existingOrder) {
    console.log(`ℹ️  订单已存在 (id=${existingOrder.id})，跳过创建`);
    // 即使订单存在，合约可能缺失（上次脚本已创建订单但合约失败），需补建
    const { MiningContract } = require('/app/src/models');
    const existingContract = await MiningContract.findOne({
      where: { user_id: userId, product_id: productId, contract_type: 'paid contract', is_cancelled: 0 },
    });
    if (existingContract) {
      console.log(`ℹ️  合约已存在 (id=${existingContract.id})，跳过`);
    } else {
      // 补建合约：调用 API 获取到期时间
      console.log(`⚠️  合约缺失，补建中...`);
      console.log(`📡 获取订阅详情...`);
      let subDetails;
      try {
        subDetails = await googlePlayVerifyService.getSubscriptionV2Details(PACKAGE_NAME, purchaseToken);
      } catch (err) {
        console.error(`❌ Google Play API 失败: ${err.message}`);
        return { success: false, gpaOrderId, error: `Google API: ${err.message}` };
      }
      const expiryTime = subDetails?.lineItems?.[0]?.expiryTime
        ? new Date(subDetails.lineItems[0].expiryTime)
        : null;
      console.log(`   expiryTime: ${expiryTime?.toISOString() || '(null)'}`);

      try {
        const contractResult = await paidContractService.createPaidContract(
          userId, productId,
          gpaOrderId,    // 3rd → mining_contracts.order_id (varchar 80)
          expiryTime,
          'android',
          purchaseToken, // 6th → mining_contracts.original_transaction_id (varchar 700)
        );
        if (contractResult.success) {
          console.log(`✅ 补建合约成功 (id=${contractResult.contract?.id})`);
        } else {
          console.error(`❌ 补建合约失败: ${contractResult.message}`);
          return { success: false, gpaOrderId, error: `contract: ${contractResult.message}` };
        }
      } catch (err) {
        console.error(`❌ 补建合约异常: ${err.message}`);
        return { success: false, gpaOrderId, error: `contract: ${err.message}` };
      }
    }
  } else {
    // ── Step 2：调用 Google Play API 获取订阅详情 ──────────────────────────
    console.log(`📡 获取订阅详情...`);
    let subDetails;
    try {
      subDetails = await googlePlayVerifyService.getSubscriptionV2Details(
        PACKAGE_NAME,
        purchaseToken,
      );
    } catch (err) {
      console.error(`❌ Google Play API 失败: ${err.message}`);
      return { success: false, gpaOrderId, error: `Google API: ${err.message}` };
    }

    const apiOrderId = subDetails?.latestOrderId;
    const expiryTime = subDetails?.lineItems?.[0]?.expiryTime
      ? new Date(subDetails.lineItems[0].expiryTime)
      : null;
    const apiUserId =
      subDetails?.externalAccountIdentifiers?.obfuscatedExternalAccountId || '(未绑定)';

    console.log(`   latestOrderId: ${apiOrderId}`);
    console.log(`   expiryTime:    ${expiryTime?.toISOString() || '(null)'}`);
    console.log(`   obfuscatedId:  ${apiUserId}`);

    // orderId 与 Google Play Console 数据核对
    if (apiOrderId && apiOrderId !== gpaOrderId) {
      console.warn(`⚠️  latestOrderId(${apiOrderId}) 与预期(${gpaOrderId}) 不符，继续使用控制台确认值`);
    }

    // ── Step 3：获取产品信息和用户邮箱 ────────────────────────────────────
    const productInfo = await PaidProductService.getProductInfo(productId);
    const user = await UserInformation.findOne({
      where: { user_id: userId },
      attributes: ['email'],
    });

    console.log(`   产品: ${productInfo?.product_name || productId}  $${productInfo?.product_price}`);
    console.log(`   邮箱: ${user?.email || '(未找到)'}`);

    // ── Step 4：创建 user_orders 记录 ────────────────────────────────────
    try {
      await UserOrder.create({
        user_id: userId,
        email: user?.email || '',
        product_id: productId,
        product_name: productInfo?.product_name || productId,
        product_price: String(productInfo?.product_price || 0),
        hashrate: productInfo?.hashrate_raw || 0,
        order_creation_time: purchaseTime,   // 使用实际购买时间
        payment_time: purchaseTime,
        currency_type: 'USD',
        payment_gateway_id: gpaOrderId,      // GPA.xxx  → Android 判断依据
        payment_network_id: purchaseToken,   // purchaseToken → Google Play API 验证
        order_status: 'active',
      });
      console.log(`✅ user_orders 创建成功`);
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        console.log(`ℹ️  user_orders 唯一约束冲突（并发），跳过`);
      } else {
        console.error(`❌ user_orders 创建失败: ${err.message}`);
        return { success: false, gpaOrderId, error: `user_orders: ${err.message}` };
      }
    }

    // ── Step 5：创建 mining_contracts 记录 ───────────────────────────────
    // 正确参数语义（与 paymentController.verifyPurchase 一致，与 DB 实际数据核对）：
    //   3rd (orderId)      = gpaOrderId    → mining_contracts.order_id (varchar 80)
    //   6th (originalTxId) = purchaseToken → mining_contracts.original_transaction_id (varchar 700)
    try {
      const contractResult = await paidContractService.createPaidContract(
        userId,
        productId,
        gpaOrderId,     // 3rd → mining_contracts.order_id
        expiryTime,     // 4th
        'android',      // 5th
        purchaseToken,  // 6th → mining_contracts.original_transaction_id
      );
      if (contractResult.success) {
        const c = contractResult.contract;
        console.log(`✅ mining_contracts 创建成功 (id=${c?.id})`);
        console.log(`   合约周期: ${c?.startTime} ~ ${c?.endTime}`);
      } else {
        console.error(`❌ 合约创建失败: ${contractResult.message}`);
        return { success: false, gpaOrderId, error: `contract: ${contractResult.message}` };
      }
    } catch (err) {
      console.error(`❌ mining_contracts 异常: ${err.message}`);
      return { success: false, gpaOrderId, error: `contract: ${err.message}` };
    }
  }

  // ── Step 6：Acknowledge（防止 Google 3天后自动退款）───────────────────
  console.log(`🔐 Acknowledge 订阅 (${subscriptionId})...`);
  const ackResult = await googlePlayVerifyService.acknowledgeSubscription(
    PACKAGE_NAME,
    subscriptionId,
    purchaseToken,
  );
  if (ackResult.success) {
    console.log(`✅ Acknowledge 成功`);
  } else {
    console.warn(`⚠️  Acknowledge 失败（不影响已创建的记录）: ${ackResult.error}`);
  }

  return { success: true, gpaOrderId, acknowledged: ackResult.success };
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`🚀 漏单补录脚本启动  ${new Date().toISOString()}`);
  console.log(`   PACKAGE_NAME: ${PACKAGE_NAME}`);
  console.log(
    `   Google Play 服务: ${googlePlayVerifyService.isInitialized ? '✅ 已初始化' : '❌ 未初始化'}`,
  );
  console.log(`${'═'.repeat(72)}`);

  if (!googlePlayVerifyService.isInitialized) {
    console.error('❌ Google Play 验证服务未初始化，无法继续');
    process.exit(1);
  }

  const results = [];
  for (const order of MISSING_ORDERS) {
    try {
      const result = await recoverOrder(order);
      results.push(result);
    } catch (err) {
      console.error(`💥 未捕获异常 (${order.gpaOrderId}): ${err.message}`);
      results.push({ success: false, gpaOrderId: order.gpaOrderId, error: err.message });
    }
  }

  // ── 汇总 ────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`📊 补录结果汇总:`);
  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    const ack = r.success ? (r.acknowledged ? ' [acked]' : ' [ack失败]') : '';
    console.log(`  ${icon} ${r.gpaOrderId}${ack}${r.error ? '  → ' + r.error : ''}`);
  }
  const ok = results.filter((r) => r.success).length;
  const fail = results.filter((r) => !r.success).length;
  console.log(`\n  总计: ${results.length}  成功: ${ok}  失败: ${fail}`);
  console.log(`${'═'.repeat(72)}\n`);

  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('💥 脚本崩溃:', err);
  process.exit(1);
});
