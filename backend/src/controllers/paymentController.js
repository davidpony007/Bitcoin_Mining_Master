'use strict';

const axios = require('axios');
const { UserOrder, UserInformation, MiningContract } = require('../models');
const { Op } = require('sequelize');
const paidContractService = require('../services/paidContractService');
const PaidProductService = require('../services/paidProductService');
const SubscriptionPointsService = require('../services/subscriptionPointsService');
const googlePlayVerifyService = require('../services/googlePlayVerifyService');

/**
 * POST /api/payment/verify-purchase
 * Body: {
 *   user_id, platform ('android'|'ios'),
 *   store_product_id, backend_product_id,
 *   transaction_id,
 *   verification_data (iOS base64 receipt),
 *   purchase_token (Android only)
 * }
 */
exports.verifyPurchase = async (req, res) => {
  const {
    user_id,
    platform,
    store_product_id,
    backend_product_id,
    transaction_id,
    verification_data,
    purchase_token,
  } = req.body;

  // ── JWT 用户身份校验：防止用户 A 的 Token 传入用户 B 的 user_id 来创建合约 ──
  const jwtUserId = req.user?.userId || req.user?.user_id;
  if (jwtUserId && user_id && String(jwtUserId) !== String(user_id)) {
    console.warn(`⚠️ [paymentController] JWT 用户(${jwtUserId})与 body user_id(${user_id})不匹配，拒绝`);
    return res.status(403).json({ success: false, message: '身份验证失败' });
  }

  console.log(`🛒 [paymentController] verifyPurchase 收到请求: user=${user_id} platform=${platform} product=${store_product_id} txId=${transaction_id}`);

  // ── 基础参数校验 ──────────────────────────────────────────
  if (!user_id || !platform || !store_product_id || !transaction_id) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: user_id, platform, store_product_id, transaction_id',
    });
  }

  // 确定 backend_product_id（优先使用客户端传来的，否则从 DB 产品表推导）
  const resolvedBackendProductId =
    backend_product_id || (await PaidProductService.resolveProductId(store_product_id));

  if (!resolvedBackendProductId) {
    return res.status(400).json({
      success: false,
      message: `未知的商品ID: ${store_product_id}`,
    });
  }

  // 提前加载产品元信息（供后续订单记录使用）
  const productInfo = await PaidProductService.getProductInfo(resolvedBackendProductId);

  if (!['android', 'ios'].includes(platform)) {
    return res.status(400).json({
      success: false,
      message: `不支持的平台: ${platform}`,
    });
  }

  try {
    // ── 防重复校验：检查 transaction_id 是否已处理 ──────────
    // iOS 自动续期订阅用 original_transaction_id（同一订阅生命周期内不变）
    // 存在则说明是"续订"，更新合约到期时间即可
    const lookupId = transaction_id;
    const existingOrder = await UserOrder.findOne({
      where: { payment_gateway_id: lookupId },
    });
    if (existingOrder) {
      // 验证该订单对应的合约是否仍活跃（未取消且未过期）
      // 若合约已取消/过期，不能返回假成功——客户端会误以为合约已激活
      const activeContract = await MiningContract.findOne({
        where: {
          user_id,
          product_id: existingOrder.product_id || resolvedBackendProductId,
          is_cancelled: 0,
          contract_end_time: { [Op.gt]: new Date() },
        },
      });
      if (activeContract) {
        return res.status(200).json({
          success: true,
          message: '订单已处理（重复请求），合约已激活',
          orderId: existingOrder.id,
        });
      } else {
        // 旧订单存在但合约已取消/过期（如沙盒订阅自动到期、用户关闭自动续期）
        // 该 transaction_id 对应的订阅已失效，需用户重新发起购买以获得新的 transaction_id
        console.warn(`⚠️ [paymentController] existingOrder found but contract expired/cancelled: user=${user_id} product=${resolvedBackendProductId} txId=${transaction_id}`);
        return res.status(200).json({
          success: false,
          message: 'Your previous subscription has expired. Please tap Subscribe again to purchase a new subscription.',
          code: 'SUBSCRIPTION_EXPIRED',
        });
      }
    }

    // ── 平台收据验证 ─────────────────────────────────────────
    if (platform === 'ios') {
      if (!verification_data) {
        return res.status(400).json({
          success: false,
          message: 'iOS 平台缺少 verification_data (收据)',
        });
      }
      const verifyResult = await verifyAppleReceipt(
        verification_data,
        transaction_id,
        store_product_id
      );
      if (!verifyResult.valid) {
        console.warn(`⚠️ [paymentController] iOS 收据验证失败: ${verifyResult.reason} | txId=${transaction_id}`);
        return res.status(400).json({
          success: false,
          message: `Apple 收据验证失败: ${verifyResult.reason}`,
        });
      }

      // ── iOS 自动续期订阅：续订 / 档位切换处理 ──────────────
      // original_transaction_id 在整个订阅组生命周期内不变，用它识别续订和档位切换
      // ⚠️ 必须同时过滤 user_id，防止不同 App 用户使用同一 Apple 沙盒账号导致误匹配
      const originalTxId = verifyResult.originalTransactionId;
      if (originalTxId && originalTxId !== transaction_id) {
        // 当前 transaction_id 是新交易，但 original_transaction_id 已存在
        // 取最新一笔订单（ORDER BY id DESC），以准确判断当前档位
        const renewalOrder = await UserOrder.findOne({
          where: { payment_network_id: originalTxId, user_id: user_id },
          order: [['id', 'DESC']],
        });
        if (renewalOrder && renewalOrder.product_id === resolvedBackendProductId) {
          // ── 同档位续订：更新合约到期时间并记录续订订单 ──────
          console.log(`🔄 [paymentController] iOS 同档位续订: user=${user_id} product=${resolvedBackendProductId} originalTxId=${originalTxId} newTxId=${transaction_id}`);
          const rawExpiry = verifyResult.expiresDateMs
            ? new Date(parseInt(verifyResult.expiresDateMs))
            : null;
          // 验证到期时间在未来（至少 > now + 1小时），防止沙盒陈旧 expiresDateMs 把合约续订到过去
          // 若 Apple 提供的 expiresDate 已过期（沙盒超短周期或收据延迟），回退到从当前合约到期时间 +1 个月
          const ONE_HOUR_MS = 3600 * 1000;
          let newExpiry = (rawExpiry && rawExpiry.getTime() > Date.now() + ONE_HOUR_MS) ? rawExpiry : null;
          if (rawExpiry && !newExpiry) {
            // expiresDate 不可用（沙盒超短周期） → 从 now 起算 1 个自然月
            // ⚠️ 必须用 now 而非 existingEndTime：沙盒每 5 分钟发一次 DID_RENEW，
            // 若用 MAX(existingEndTime, now) 则每次都在上次延伸基础上再加一个月，
            // 导致多条通知叠加后合约时长暴增（如 10 条 → +10 个月）。
            // 用 now 作为基时，所有重复通知的结果均约等于 now+tierMonths，幂等安全。
            const tierMonths = productInfo?.duration_months || 1;
            const fallbackExpiry = new Date();
            fallbackExpiry.setMonth(fallbackExpiry.getMonth() + tierMonths);
            newExpiry = fallbackExpiry;
            console.warn(`⚠️ [paymentController] 续订 expiresDate 已过期 (${rawExpiry.toISOString()})，回退自然月延期(from now): newExpiry=${newExpiry.toISOString()}`);
          }
          const [updatedRows] = await MiningContract.update(
            { contract_end_time: newExpiry, is_renewal: 1, is_cancelled: 0 },
            { where: { original_transaction_id: originalTxId, user_id: user_id } }
          );
          let contractUpdated = updatedRows > 0;
          if (!contractUpdated) {
            // 回退：按 (user_id) 查找最新活跃付费合约，处理 product_id/original_transaction_id=null 的历史数据
            const fallbackContract = await MiningContract.findOne({
              where: { user_id, contract_type: 'paid contract', is_cancelled: 0 },
              order: [['id', 'DESC']],
            });
            if (fallbackContract) {
              await MiningContract.update(
                { contract_end_time: newExpiry, is_renewal: 1, is_cancelled: 0, original_transaction_id: originalTxId },
                { where: { id: fallbackContract.id } }
              );
              contractUpdated = true;
              console.log(`✅ [paymentController] 续订回退修复合约(id=${fallbackContract.id}): original_transaction_id已补全`);
            } else {
              console.warn(`⚠️ [paymentController] 续订：未找到合约，将作为新购处理: user=${user_id} product=${resolvedBackendProductId}`);
            }
          }
          if (contractUpdated) {
            console.log(`✅ [paymentController] 续订合约到期时间已更新: user=${user_id} newExpiry=${newExpiry}`);
            const renewUser = await UserInformation.findOne({ where: { user_id }, attributes: ['email', 'apple_account'] });
            // ── 幂等性：同一账期防止重复建单 ──────────────────────────────────────────
            // Apple 一个账期可能产生多个 transactionId（introductory offer 转正、账单确认等），
            // 它们 expires_date_ms 完全相同。客户端重新上报任意一个都会走到这里。
            // 检查是否已有一笔同账期（相同到期时间 ±5min）的续订订单存在，有则跳过建单。
            const FIVE_MIN_MS = 5 * 60 * 1000;
            const duplicatePeriodOrder = await UserOrder.findOne({
              where: {
                payment_network_id: originalTxId,
                order_creation_time: {
                  [Op.gte]: new Date(newExpiry.getTime() - 35 * 24 * 3600 * 1000), // 最近 35 天
                },
              },
              order: [['id', 'DESC']],
            });
            const duplicateContract = await MiningContract.findOne({
              where: { user_id, contract_type: 'paid contract' },
              order: [['id', 'DESC']],
            });
            const contractEndTime = duplicateContract?.contract_end_time
              ? new Date(duplicateContract.contract_end_time)
              : null;
            const isAlreadyThisPeriod =
              duplicatePeriodOrder ||
              (contractEndTime &&
                rawExpiry &&
                Math.abs(contractEndTime.getTime() - rawExpiry.getTime()) < FIVE_MIN_MS);
            if (isAlreadyThisPeriod) {
              console.log(`ℹ️ [paymentController] 跳过重复建单（同账期已记录）: user=${user_id} txId=${transaction_id} originalTxId=${originalTxId} newExpiry=${newExpiry.toISOString()}`);
              return res.status(200).json({
                success: true,
                message: '订阅已处于最新状态',
                renewed: true,
                newExpiry,
              });
            }
            await UserOrder.create({
              user_id,
              email: renewUser?.email || '',
              apple_account: renewUser?.apple_account || null,
              product_id: resolvedBackendProductId,
              product_name: productInfo?.product_name || store_product_id,
              product_price: String(productInfo?.product_price || 0),
              hashrate: productInfo?.hashrate_raw || 0,
              order_creation_time: new Date(),
              payment_time: new Date(),
              currency_type: 'USD',
              payment_gateway_id: transaction_id,
              payment_network_id: originalTxId,
              order_status: 'renewing',
            });
            return res.status(200).json({
              success: true,
              message: '订阅续订成功，合约已延期',
              renewed: true,
              newExpiry,
            });
          }
          // contractUpdated=false: 降级为新购流程（不 return，继续往下走）
        }
        // renewalOrder 不存在，或 renewalOrder 不匹配 → 视为首次订阅，直接往下走
        // ⚠️ 架构说明：本 App 采用「4 独立订阅组」设计，每个 Plan 各自独立订阅组，
        // 因此每个 Plan 有独立的 original_transaction_id，续订检测只会命中同 Plan 的历史订单。
        // 「同 originalTxId + 不同 product_id」理论上不会出现，无需处理档位切换逻辑。
      }

      // 新订阅：继续后续流程，携带 expiresDate 和 originalTxId
      req._iosSubscriptionMeta = {
        originalTransactionId: originalTxId || transaction_id,
        expiresDateMs: verifyResult.expiresDateMs,
      };

      // ── iOS 同档位活跃合约兜底：originalTxId === transaction_id（全新首次购买）时，
      // 上方续订分支不会触发（因为没有历史 original_transaction_id 可匹配）。
      // 此处额外做一次服务端检查：若该用户已有同档位活跃合约，将本次新购视为续订处理，
      // 防止 StoreKit 沙盒异常 / 退款后重订 / Apple 账号切换等场景创建重复合约。
      // ⚠️ 仅当 originalTxId === transaction_id（真首次购买）时才需要此检查；
      //    originalTxId !== transaction_id 的续订场景已由上方逻辑处理。
      if (!originalTxId || originalTxId === transaction_id) {
        const existingActiveIosContract = await MiningContract.findOne({
          where: {
            user_id,
            product_id: resolvedBackendProductId,
            platform: 'ios',
            is_cancelled: 0,
            contract_end_time: { [Op.gt]: new Date() },
          },
          order: [['id', 'DESC']],
        });
        if (existingActiveIosContract) {
          console.warn(`⚠️ [paymentController] iOS 同档位活跃合约已存在，新购视为续订: user=${user_id} product=${resolvedBackendProductId} existingContractId=${existingActiveIosContract.id} txId=${transaction_id}`);
          const rawExpiry = verifyResult.expiresDateMs ? new Date(parseInt(verifyResult.expiresDateMs)) : null;
          const ONE_HOUR_MS = 3600 * 1000;
          let newExpiry;
          if (rawExpiry && rawExpiry.getTime() > Date.now() + ONE_HOUR_MS) {
            newExpiry = rawExpiry.getTime() > existingActiveIosContract.contract_end_time.getTime()
              ? rawExpiry : existingActiveIosContract.contract_end_time;
          } else {
            const tierMonths = productInfo?.duration_months || 1;
            newExpiry = new Date(existingActiveIosContract.contract_end_time);
            newExpiry.setMonth(newExpiry.getMonth() + tierMonths);
          }
          await MiningContract.update(
            { contract_end_time: newExpiry, is_renewal: 1, is_cancelled: 0 },
            { where: { id: existingActiveIosContract.id } }
          );
          const existingRenewOrder = await UserOrder.findOne({ where: { payment_gateway_id: transaction_id } });
          if (!existingRenewOrder) {
            const renewUser = await UserInformation.findOne({ where: { user_id }, attributes: ['email', 'apple_account'] });
            await UserOrder.create({
              user_id,
              email: renewUser?.email || '',
              apple_account: renewUser?.apple_account || null,
              product_id: resolvedBackendProductId,
              product_name: productInfo?.product_name || store_product_id,
              product_price: String(productInfo?.product_price || 0),
              hashrate: productInfo?.hashrate_raw || 0,
              order_creation_time: new Date(),
              payment_time: new Date(),
              currency_type: 'USD',
              payment_gateway_id: transaction_id,
              payment_network_id: transaction_id,
              order_status: 'renewing',
            });
          }
          return res.status(200).json({
            success: true,
            message: '订阅续订成功，合约已延期',
            renewed: true,
            newExpiry,
          });
        }
      }
    }
    // Android：续订检测 + Google Play Developer API 验证 purchase_token
    if (platform === 'android') {
      if (!purchase_token) {
        return res.status(400).json({ success: false, message: '缺少 purchase_token' });
      }

      // ── Android 优先验票；未配置时降级为幂等保护模式 ──
      // 线上若暂未完成 Google Service Account 配置，不能直接拒绝所有支付。
      // 但必须保证幂等，防止重复上报导致合约时长叠加。
      const packageName = process.env.ANDROID_PACKAGE_NAME;
      let playResult = null;
      let verifiedExpiry = null;
      const canVerifyAndroid = !!(googlePlayVerifyService.isInitialized && packageName);

      if (canVerifyAndroid) {
        playResult = await googlePlayVerifyService.verifySubscription(
          packageName,
          store_product_id,
          purchase_token,
        );
        if (!playResult.success) {
          console.warn(`❌ [paymentController] Android 购买验证失败: ${playResult.error} (user=${user_id} product=${store_product_id})`);
          return res.status(400).json({ success: false, message: `Google Play 验证失败: ${playResult.error}` });
        }

        // 服务端订单号与客户端上报不一致时拒绝，防止客户端篡改 transaction_id。
        if (playResult.orderId && transaction_id !== playResult.orderId) {
          console.warn(`❌ [paymentController] Android orderId 不匹配: user=${user_id} clientTx=${transaction_id} serverTx=${playResult.orderId}`);
          return res.status(400).json({ success: false, message: '订单号校验失败，请刷新后重试' });
        }

        verifiedExpiry = playResult.expiryTimeMillis
          ? new Date(parseInt(playResult.expiryTimeMillis, 10))
          : null;

        console.log(`✅ [paymentController] Android 购买验证通过: orderId=${playResult.orderId} expiry=${verifiedExpiry?.toISOString?.() || 'N/A'}`);
      } else {
        console.warn('⚠️ [paymentController] Android 验票服务未就绪，启用无验票幂等保护模式');
      }

      // ── Android 续订检测：查找同用户同档位的活跃合约 ──
      // Google Play 每次续订都产生新 purchaseToken，但 productId 不变。
      // 若用户已有该档位的活跃合约，视为续订：延长到期时间，记录续订订单，不创建新合约。
      // (与 iOS 的 original_transaction_id 续订逻辑对等)
      const existingActiveAndroidContract = await MiningContract.findOne({
        where: {
          user_id,
          product_id: resolvedBackendProductId,
          platform: 'android',
          is_cancelled: 0,
          contract_end_time: { [Op.gt]: new Date() },
        },
        order: [['id', 'DESC']],
      });
      if (existingActiveAndroidContract) {
        // ── 先做去重：同一 transaction_id（GPA 订单号）只处理一次 ──
        // 必须在 MiningContract.update 之前检查，否则重复请求时合约已延期
        // 而 UserOrder INSERT 才触发 UNIQUE 约束 → 合约错误累加 + 客户端收到 500
        const existingRenewalOrder = await UserOrder.findOne({
          where: { payment_gateway_id: transaction_id },
        });
        if (existingRenewalOrder) {
          console.log(`⚠️ [paymentController] Android 续订重复请求，已忽略: txId=${transaction_id} user=${user_id}`);
          return res.status(200).json({
            success: true,
            message: 'Android 订阅续订成功，合约已延期',
            renewed: true,
            newExpiry: existingActiveAndroidContract.contract_end_time,
            pointsAwarded: 0,
          });
        }

        // 账期幂等：Google 返回的到期时间若未推进（或仅有秒级抖动），不再重复延期。
        const ONE_MIN_MS = 60 * 1000;
        const currentExpiryMs = new Date(existingActiveAndroidContract.contract_end_time).getTime();
        if (verifiedExpiry && verifiedExpiry.getTime() <= currentExpiryMs + ONE_MIN_MS) {
          console.log(`ℹ️ [paymentController] Android 跳过重复续订（账期未推进）: user=${user_id} txId=${transaction_id} currentExpiry=${existingActiveAndroidContract.contract_end_time.toISOString?.() || existingActiveAndroidContract.contract_end_time} verifiedExpiry=${verifiedExpiry.toISOString()}`);
          return res.status(200).json({
            success: true,
            message: '订阅已处于最新状态',
            renewed: true,
            newExpiry: existingActiveAndroidContract.contract_end_time,
            pointsAwarded: 0,
          });
        }

        // 优先使用 Google 返回的真实到期时间，避免按本地月份累加导致重复叠加。
        // 无验票模式下以 now + tierMonths 为基准，避免同一分钟重复请求基于 currentExpiry 级联叠加。
        let newExpiry;
        if (verifiedExpiry && verifiedExpiry.getTime() > Date.now()) {
          newExpiry = verifiedExpiry;
        } else {
          const THREE_DAYS_MS = 3 * 24 * 3600 * 1000;
          if (currentExpiryMs > Date.now() + THREE_DAYS_MS) {
            console.log(`ℹ️ [paymentController] Android 跳过无验票续订（未到续费窗口）: user=${user_id} txId=${transaction_id} currentExpiry=${existingActiveAndroidContract.contract_end_time.toISOString?.() || existingActiveAndroidContract.contract_end_time}`);
            return res.status(200).json({
              success: true,
              message: '订阅已处于有效期内',
              renewed: true,
              newExpiry: existingActiveAndroidContract.contract_end_time,
              pointsAwarded: 0,
            });
          }

          const tierMonths = productInfo?.duration_months || 1;
          newExpiry = new Date();
          newExpiry.setMonth(newExpiry.getMonth() + tierMonths);

          // 账期未推进则忽略，防止重复上报造成时长累计。
          if (newExpiry.getTime() <= currentExpiryMs + ONE_MIN_MS) {
            console.log(`ℹ️ [paymentController] Android 跳过重复续订（无验票账期未推进）: user=${user_id} txId=${transaction_id}`);
            return res.status(200).json({
              success: true,
              message: '订阅已处于最新状态',
              renewed: true,
              newExpiry: existingActiveAndroidContract.contract_end_time,
              pointsAwarded: 0,
            });
          }

          console.warn(`⚠️ [paymentController] Android 未取得有效 expiryTimeMillis，回退按 now+档位月数延期: user=${user_id} fallbackExpiry=${newExpiry.toISOString()}`);
        }
        console.log(`🔄 [paymentController] Android 同档位续订: user=${user_id} product=${resolvedBackendProductId} purchaseToken=${purchase_token?.substring(0, 30)} newExpiry=${newExpiry.toISOString()}`);
        await MiningContract.update(
          { contract_end_time: newExpiry, original_transaction_id: purchase_token, is_renewal: 1, is_cancelled: 0 },
          { where: { id: existingActiveAndroidContract.id } }
        );
        const renewUserAndroid = await UserInformation.findOne({ where: { user_id }, attributes: ['email'] });
        await UserOrder.create({
          user_id,
          email: renewUserAndroid?.email || '',
          product_id: resolvedBackendProductId,
          product_name: productInfo?.product_name || store_product_id,
          product_price: String(productInfo?.product_price || 0),
          hashrate: productInfo?.hashrate_raw || 0,
          order_creation_time: new Date(),
          payment_time: new Date(),
          currency_type: 'USD',
          payment_gateway_id: transaction_id,
          payment_network_id: purchase_token,
          order_status: 'renewing',
        });
        return res.status(200).json({
          success: true,
          message: 'Android 订阅续订成功，合约已延期',
          renewed: true,
          newExpiry,
          pointsAwarded: 0,
        });
      }
    }

    // ── 创建付费合约 ─────────────────────────────────────────
    // iOS 自动续期：使用 Apple 收据中的到期时间
    const iosMeta = req._iosSubscriptionMeta;
    const expiresDate = iosMeta?.expiresDateMs
      ? new Date(parseInt(iosMeta.expiresDateMs))
      : null;

    // ── 过期收据拦截：iOS 收据中 expiresDateMs 已在过去，说明是已取消/到期的旧订阅被 StoreKit 重放 ──
    // 不创建注定过期的合约，直接返回错误让客户端提示用户重新订阅
    if (platform === 'ios' && expiresDate && expiresDate.getTime() < Date.now()) {
      console.warn(`⚠️ [paymentController] iOS 收据 expiresDate 已过期 (${expiresDate.toISOString()})，拒绝创建过期合约: user=${user_id} product=${resolvedBackendProductId} txId=${transaction_id}`);
      return res.status(200).json({
        success: false,
        message: 'Your previous subscription has expired. Please tap Subscribe again to purchase a new subscription.',
        code: 'SUBSCRIPTION_EXPIRED',
      });
    }

    // 查询用户邮箱和Apple账号（仅用于订单记录，设备登录用户可能无邮箱）
    const user = await UserInformation.findOne({
      where: { user_id },
      attributes: ['email', 'apple_account'],
    });
    // 用户不在 DB 时不阻断购买（收据已通过 Apple 验证，必须创建合约）
    const userEmail = user?.email || '';
    const userAppleAccount = user?.apple_account || null;
    if (!user) {
      console.warn(`⚠️ [paymentController] 用户 ${user_id} 不在 user_information 表，继续创建合约（邮箱置空）`);
    }

    // ── 先写订单记录（payment_gateway_id 有 UNIQUE 约束）────
    // 利用 DB 唯一约束作为并发互斥锁：并发请求中只有第一个能成功 INSERT，
    // 其余请求触发 SequelizeUniqueConstraintError，直接返回"已处理"，
    // 从而确保每笔 transaction_id 只创建一条合约。
    const originalTxId = iosMeta?.originalTransactionId || purchase_token || transaction_id;

    // ── iOS 硬去重兜底：同一 user + product + original_transaction_id 只保留一条活跃付费合约 ──
    // 目的：即使上游续订识别分支偶发未命中，也不允许再创建第二条活跃同档位合约。
    if (platform === 'ios' && originalTxId && originalTxId !== transaction_id) {
      const chainOrder = await UserOrder.findOne({
        where: {
          user_id,
          product_id: resolvedBackendProductId,
          payment_network_id: originalTxId,
        },
        order: [['id', 'DESC']],
      });

      if (chainOrder) {
        // 优先用 original_transaction_id 精确匹配；历史脏数据 original_transaction_id 为空时回退到同档位活跃合约
        let existingActiveContract = await MiningContract.findOne({
          where: {
            user_id,
            product_id: resolvedBackendProductId,
            contract_type: 'paid contract',
            is_cancelled: 0,
            contract_end_time: { [Op.gt]: new Date() },
            original_transaction_id: originalTxId,
          },
          order: [['id', 'DESC']],
        });

        if (!existingActiveContract) {
          // 历史数据 product_id 可能为 NULL，不用 product_id 过滤以确保能命中
          existingActiveContract = await MiningContract.findOne({
            where: {
              user_id,
              contract_type: 'paid contract',
              is_cancelled: 0,
              contract_end_time: { [Op.gt]: new Date() },
            },
            order: [['id', 'DESC']],
          });
        }

        if (existingActiveContract) {
          const ONE_HOUR_MS = 3600 * 1000;
          let mergedExpiry = new Date(existingActiveContract.contract_end_time);
          if (expiresDate instanceof Date && !isNaN(expiresDate) && expiresDate.getTime() > Date.now() + ONE_HOUR_MS) {
            if (expiresDate.getTime() > mergedExpiry.getTime()) {
              mergedExpiry = expiresDate;
            }
          }

          await MiningContract.update(
            {
              contract_end_time: mergedExpiry,
              original_transaction_id: originalTxId,
              is_renewal: 1,
              is_cancelled: 0,
            },
            { where: { id: existingActiveContract.id } }
          );

          // 记录续订订单（幂等：同一 transaction_id 只插一次）
          const existingRenewOrder = await UserOrder.findOne({ where: { payment_gateway_id: transaction_id } });
          if (!existingRenewOrder) {
            await UserOrder.create({
              user_id,
              email: userEmail,
              apple_account: userAppleAccount,
              product_id: resolvedBackendProductId,
              product_name: productInfo?.product_name || store_product_id,
              product_price: String(productInfo?.product_price || 0),
              hashrate: productInfo?.hashrate_raw || 0,
              order_creation_time: new Date(),
              payment_time: new Date(),
              currency_type: 'USD',
              payment_gateway_id: transaction_id,
              payment_network_id: originalTxId,
              order_status: 'renewing',
            });
          }

          console.log(`✅ [paymentController] iOS 硬去重命中，按续订处理: user=${user_id} product=${resolvedBackendProductId} origTx=${originalTxId} txId=${transaction_id}`);
          return res.status(200).json({
            success: true,
            message: '订阅续订成功，合约已延期',
            renewed: true,
            newExpiry: mergedExpiry,
            pointsAwarded: 0,
          });
        }
      }
    }

    let newOrder;
    try {
      newOrder = await UserOrder.create({
        user_id,
        email: userEmail,
        apple_account: platform === 'ios' ? userAppleAccount : null,
        product_id: resolvedBackendProductId,
        product_name: productInfo?.product_name || store_product_id,
        product_price: String(productInfo?.product_price || 0),
        hashrate: productInfo?.hashrate_raw || 0,
        order_creation_time: new Date(),
        payment_time: new Date(),
        currency_type: 'USD',
        payment_gateway_id: transaction_id,
        payment_network_id: originalTxId,
        order_status: 'active',
      });
    } catch (dupErr) {
      if (dupErr.name === 'SequelizeUniqueConstraintError') {
        console.log(`⚠️ [paymentController] 并发重复请求被 UNIQUE 约束拦截: txId=${transaction_id}`);
        return res.status(200).json({
          success: true,
          message: '订单已处理（并发重复请求），合约已激活',
        });
      }
      throw dupErr; // 其他 DB 错误继续向上抛出
    }

    // 订单写入成功，继续创建合约
    const contract = await paidContractService.createPaidContract(
      user_id,
      resolvedBackendProductId,
      transaction_id,
      expiresDate,
      platform,                                      // ios / android
      iosMeta?.originalTransactionId || (platform === 'android' ? purchase_token : null)
    );

    // ── Android 订阅确认（Google Play 要求 3 天内 acknowledge，否则自动退款/取消）────
    // 必须在合约创建后调用，且失败不阻断主流程（避免因 acknowledge 失败让用户看到"购买失败"）
    if (platform === 'android' && purchase_token && googlePlayVerifyService.isInitialized) {
      const packageName = process.env.ANDROID_PACKAGE_NAME;
      if (packageName) {
        try {
          await googlePlayVerifyService.acknowledgeSubscription(packageName, store_product_id, purchase_token);
        } catch (ackErr) {
          console.warn(`⚠️ [paymentController] Android 订阅 acknowledge 失败（不影响合约）: ${ackErr.message}`);
        }
      }
    }

    // ── 订阅积分奖励（首次订阅该档位 +20 分，幂等，失败不阻断主流程）────
    // ⚠️ 必须用独立 try/catch 包裹，防止积分表不存在或 DB 异常时
    // 导致 verifyPurchase 整体返回 500，用户看到"Server verification failed"
    let pointsResult = { awarded: false, pointsAwarded: 0 };
    try {
      pointsResult = await SubscriptionPointsService.awardSubscriptionPoints(
        user_id,
        resolvedBackendProductId
      );
    } catch (pointsErr) {
      console.warn(`⚠️ [paymentController] 积分奖励失败（不影响主流程）: ${pointsErr.message}`);
    }

    if (!contract?.contract?.id) {
      console.warn(`⚠️ [paymentController] 合约创建失败或返回空: user=${user_id} product=${resolvedBackendProductId} orderId=${newOrder?.id}`, contract);
    }

    return res.status(200).json({
      success: true,
      message: '购买验证成功，合约已激活',
      contractId: contract?.contract?.id,
      orderId: newOrder?.id,
      pointsAwarded: pointsResult.awarded ? pointsResult.pointsAwarded : 0,
      pointsReason: pointsResult.awarded ? '首次订阅积分奖励' : null,
    });
  } catch (err) {
    console.error('❌ [paymentController] verifyPurchase 异常:', err);
    // 防止 Express 超时中间件已发送 503 响应后，此处再次尝试发送响应导致 ERR_HTTP_HEADERS_SENT
    if (res.headersSent) return;
    return res.status(500).json({
      success: false,
      message: '服务器内部错误，请联系客服',
    });
  }
};

// ── Apple 收据验证辅助函数 ────────────────────────────────────

/**
 * 向 Apple 服务器验证 IAP 收据
 * @param {string} receiptData  base64 编码的收据
 * @param {string} transactionId 期望匹配的交易ID
 * @param {string} productId    期望匹配的商品ID
 * @returns {{ valid: boolean, reason?: string }}
 */
async function verifyAppleReceipt(receiptData, transactionId, productId) {
  const sharedSecret = process.env.APPLE_IAP_SHARED_SECRET || '';

  // 如果未配置 shared secret，记录警告（仍继续，Apple 对免费沙盒 App 可能不需要）
  if (!sharedSecret) {
    console.warn('⚠️ [IAP] APPLE_IAP_SHARED_SECRET 未配置，自动续期订阅验证可能失败（21004）');
  }

  const payload = {
    'receipt-data': receiptData,
    password: sharedSecret,
    'exclude-old-transactions': true,
  };

  // 先尝试生产环境，21007 → 切换到沙盒
  let appleUrl = 'https://buy.itunes.apple.com/verifyReceipt';
  let activeUrl = appleUrl; // 追踪实际最终使用的环境 URL（生产 or 沙盒）
  let appleRes;

  try {
    appleRes = await axios.post(appleUrl, payload, { timeout: 20000 });
  } catch (e) {
    console.error(`❌ [IAP] Apple 生产环境请求失败: ${e.message}`);
    return { valid: false, reason: `Apple 服务器请求失败: ${e.message}` };
  }

  let currentStatus = appleRes.data.status;
  console.log(`📡 [IAP] Apple 生产环境响应状态: ${currentStatus} | txId=${transactionId}`);

  // 21007 = 沙盒收据发到了生产环境，切换到沙盒
  if (currentStatus === 21007) {
    console.log(`🔄 [IAP] 沙盒收据，切换到沙盒环境验证 | txId=${transactionId}`);
    activeUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
    try {
      appleRes = await axios.post(
        activeUrl,
        payload,
        { timeout: 20000 }
      );
      currentStatus = appleRes.data.status;
      console.log(`📡 [IAP] Apple 沙盒响应状态: ${currentStatus} | txId=${transactionId}`);
    } catch (e) {
      console.error(`❌ [IAP] Apple 沙盒请求失败: ${e.message}`);
      return { valid: false, reason: `Apple 沙盒请求失败: ${e.message}` };
    }
  }

  // 21004 = shared secret 不匹配（未配置时常见）
  // 在沙盒/开发环境下，如果 shared secret 未配置，降级为仅信任客户端 transaction_id
  if (currentStatus === 21004 && !sharedSecret) {
    console.warn(`⚠️ [IAP] Apple 返回 21004（shared secret 未配置），降级信任客户端数据: txId=${transactionId} productId=${productId}`);
    return {
      valid: true,
      originalTransactionId: transactionId,
      expiresDateMs: String(Date.now() + 30 * 24 * 3600 * 1000), // 默认30天
    };
  }

  // 21105 = Apple 服务器临时内部错误（数据库访问失败），重试一次
  if (currentStatus === 21105) {
    console.warn(`⚠️ [IAP] Apple 返回 21105（临时内部错误），2秒后重试 | txId=${transactionId}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const retryRes = await axios.post(activeUrl, payload, { timeout: 20000 });
      const retryStatus = retryRes.data.status;
      console.log(`📡 [IAP] Apple 21105 重试响应状态: ${retryStatus} | txId=${transactionId}`);
      if (retryStatus === 0) {
        appleRes = retryRes;
        currentStatus = 0;
      } else {
        // 重试后仍然失败，降级信任客户端（避免因 Apple 临时故障拒绝真实购买）
        console.warn(`⚠️ [IAP] Apple 21105 重试仍失败(${retryStatus})，降级信任客户端数据: txId=${transactionId}`);
        return {
          valid: true,
          originalTransactionId: transactionId,
          expiresDateMs: String(Date.now() + 30 * 24 * 3600 * 1000),
        };
      }
    } catch (e) {
      console.warn(`⚠️ [IAP] Apple 21105 重试请求失败(${e.message})，降级信任客户端数据: txId=${transactionId}`);
      return {
        valid: true,
        originalTransactionId: transactionId,
        expiresDateMs: String(Date.now() + 30 * 24 * 3600 * 1000),
      };
    }
  }

  const finalStatus = appleRes.data.status;
  if (finalStatus !== 0) {
    console.warn(`⚠️ [IAP] Apple 收据验证失败，状态码 ${finalStatus} | txId=${transactionId}`);
    return { valid: false, reason: `Apple 状态码: ${finalStatus}` };
  }

  // 检查收据中是否存在对应的交易
  const receipts = appleRes.data.latest_receipt_info || [];

  // ── 4 独立订阅组匹配策略 ──────────────────────────────────────────────────
  // 每个 Plan 属于独立订阅组，各自有独立的 original_transaction_id。
  // 但沙盒环境下 transaction_id 并非全局唯一：subscriptionA 的某次续订 txId
  // 可能与 subscriptionB 的首次购买 txId 相同（沙盒 ID 空间复用），导致
  // 跨产品 "exactMatch" 误判。因此必须在 exactMatch 中同时要求 product_id 一致。
  //
  // 匹配优先级：
  // 1. 精确匹配（txId + 正确 product_id）→ 最可信
  // 2. 同产品最新收据（忽略 txId）→ 用于新购后收据传播延迟场景
  // 3. 两者均无 → 降级信任客户端（Apple 沙盒时序延迟，或首次购买缓存未到）
  // 跨产品 txId 碰撞仅记录警告，不拒绝购买（沙盒特有，生产环境 txId 全局唯一不会碰撞）

  // 1. 精确匹配：txId 相同 AND product_id 也相同
  const exactMatch = receipts.find(
    (r) => r.product_id === productId &&
           (r.transaction_id === transactionId || r.original_transaction_id === transactionId)
  );

  // 2. 同产品最新收据（productId 过滤，取 expires_date_ms 最大的一条）
  const productFallback = receipts
    .filter(r => r.product_id === productId)
    .sort((a, b) => parseInt(b.expires_date_ms || '0') - parseInt(a.expires_date_ms || '0'))[0] || null;

  // 沙盒跨产品碰撞检测（仅用于日志，不用于拒绝逻辑）
  const crossProductMatch = !exactMatch && receipts.find(
    (r) => r.product_id !== productId &&
           (r.transaction_id === transactionId || r.original_transaction_id === transactionId)
  );
  if (crossProductMatch) {
    console.warn(`⚠️ [IAP] 跨订阅组 txId 碰撞（沙盒特有，不影响验证）: txId=${transactionId} 期望=${productId} 碰撞到=${crossProductMatch.product_id}`);
  }

  const match = exactMatch || productFallback;

  if (!match) {
    // Apple 返回 status=0 但收据中没有此产品，可能是沙盒时序延迟，降级信任客户端
    console.warn(`⚠️ [IAP] 收据中未找到 product=${productId} txId=${transactionId}，降级信任客户端数据`);
    return {
      valid: true,
      originalTransactionId: transactionId,
      expiresDateMs: String(Date.now() + 30 * 24 * 3600 * 1000),
    };
  }

  console.log(`✅ [IAP] Apple 收据验证通过: txId=${transactionId} product=${productId} expires=${match.expires_date_ms}`);
  return {
    valid: true,
    originalTransactionId: match.original_transaction_id,
    expiresDateMs: match.expires_date_ms || null,
  };
}

/**
 * POST /api/payment/sync-ios-status
 * 客户端在打开合约页面 / App 恢复前台时，主动发送最新收据，
 * 后端重新验证并更新订阅状态（to prevent Apple notification delivery failures affecting display）
 * 需要 JWT 鉴权
 * Body: { verification_data }
 */
exports.syncIosStatus = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.user_id;
    const { verification_data } = req.body;

    if (!userId || !verification_data) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    const sharedSecret = process.env.APPLE_IAP_SHARED_SECRET || '';
    const payload = {
      'receipt-data': verification_data,
      password: sharedSecret,
      'exclude-old-transactions': false, // 需要完整历史来判断各产品状态
    };

    // 先尝试生产，21007 → 沙盒
    let appleUrl = 'https://buy.itunes.apple.com/verifyReceipt';
    let appleRes;
    try {
      appleRes = await axios.post(appleUrl, payload, { timeout: 15000 });
    } catch (e) {
      return res.status(500).json({ success: false, message: `Apple 请求失败: ${e.message}` });
    }

    if (appleRes.data.status === 21007) {
      try {
        appleRes = await axios.post('https://sandbox.itunes.apple.com/verifyReceipt', payload, { timeout: 15000 });
      } catch (e) {
        return res.status(500).json({ success: false, message: `Apple 沙盒请求失败: ${e.message}` });
      }
    }

    if (appleRes.data.status !== 0) {
      return res.status(400).json({ success: false, message: `Apple 验证失败: status=${appleRes.data.status}` });
    }

    const pendingRenewalInfo = appleRes.data.pending_renewal_info || [];
    const latestReceiptInfo = appleRes.data.latest_receipt_info || [];

    const { MiningContract } = require('../models');
    let cancelledCount = 0;
    let updatedExpiry = 0;

    for (const renewalItem of pendingRenewalInfo) {
      const origTxId = renewalItem.original_transaction_id;
      const autoRenewStatus = renewalItem.auto_renew_status; // '0' = 已关闭自动续期

      // 找对应的最新收据信息更新 contract_end_time
      const latestEntry = latestReceiptInfo
        .filter(r => r.original_transaction_id === origTxId)
        .sort((a, b) => parseInt(b.expires_date_ms || '0') - parseInt(a.expires_date_ms || '0'))[0];

      const contracts = await MiningContract.findAll({
        where: { user_id: userId, original_transaction_id: origTxId, contract_type: 'paid contract' },
      });

      for (const contract of contracts) {
        // 更新 contract_end_time 为 Apple 实际到期时间
        // ⚠️ 沙盒保护：Apple 沙盒订阅周期仅 5 分钟，expires_date_ms = now+5min
        // 若直接更新会把原本 1 个月的合约覆盖成 5 分钟，导致矿工停止。
        // 与 paidContractService / appleNotificationController DID_RENEW 保持一致：
        // 到期时间 ≤ now+1小时 时视为沙盒陈旧值，跳过本次更新。
        const ONE_HOUR_MS = 3600 * 1000;
        if (latestEntry?.expires_date_ms) {
          const appleExpiry = new Date(parseInt(latestEntry.expires_date_ms));
          if (appleExpiry.getTime() <= Date.now() + ONE_HOUR_MS) {
            console.log(`ℹ️ [syncIos] 沙盒超短周期到期时间 (${appleExpiry.toISOString()})，跳过 contract_end_time 更新: user=${userId} origTx=${origTxId}`);
          } else if (contract.contract_end_time?.getTime() !== appleExpiry.getTime()) {
            await contract.update({ contract_end_time: appleExpiry });
            updatedExpiry++;
            console.log(`🔄 [syncIos] 更新合约到期时间: user=${userId} origTx=${origTxId} newExpiry=${appleExpiry.toISOString()}`);
          }
        }

        // 取消逻辑：
        // - subscriptionExpired（到期时间已过）→ 订阅实际已过期，标记取消
        // - isExplicitCancel（关闭自动续期但合约仍在有效期）→ 当期继续有效，不设 is_cancelled，
        //   contractRewardService 会在 contract_end_time 到期后自动停止发放收益
        // - isPlanChange（切换档位）→ 当期继续有效，不做任何操作
        const autoRenewProductId = renewalItem.auto_renew_product_id;
        const subscriptionExpired = latestEntry?.expires_date_ms
          ? new Date(parseInt(latestEntry.expires_date_ms)) < new Date()
          : false;
        const isExplicitCancel = (autoRenewStatus === '0' || autoRenewStatus === 0) && !autoRenewProductId;
        const isPlanChange    = (autoRenewStatus === '0' || autoRenewStatus === 0) && !!autoRenewProductId;

        if (subscriptionExpired && contract.is_cancelled === 0) {
          await contract.update({ is_cancelled: 1 });
          cancelledCount++;
          console.log(`📴 [syncIos] 合约已过期并标记取消: user=${userId} origTx=${origTxId}`);
        } else if (!subscriptionExpired && contract.is_cancelled === 1) {
          // 订阅确认仍在有效期内，但 is_cancelled=1（可能由延迟/乱序通知误设）→ 恢复活跃
          await contract.update({ is_cancelled: 0 });
          console.log(`✅ [syncIos] 订阅有效期内发现 is_cancelled=1，已恢复活跃: user=${userId} origTx=${origTxId}`);
        } else if (isExplicitCancel && !subscriptionExpired) {
          // 用户已关闭自动续期，但当期合约仍有效，继续挖矿直到 contract_end_time
          console.log(`ℹ️ [syncIos] 用户关闭自动续期，当期继续有效直到 ${latestEntry?.expires_date_ms ? new Date(parseInt(latestEntry.expires_date_ms)).toISOString() : '未知'}: user=${userId} origTx=${origTxId}`);
        } else if (isPlanChange && !subscriptionExpired) {
          console.log(`ℹ️ [syncIos] 档位切换，当期继续有效: user=${userId} origTx=${origTxId} nextPlan=${autoRenewProductId}`);
        }
      }
    }

    console.log(`✅ [syncIos] 同步完成: user=${userId} cancelled=${cancelledCount} expiry_updated=${updatedExpiry}`);
    return res.status(200).json({
      success: true,
      cancelledCount,
      updatedExpiry,
      message: `同步完成 (${cancelledCount} 个合约已标记取消)`,
    });
  } catch (err) {
    console.error('❌ [syncIos] 异常:', err);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};
