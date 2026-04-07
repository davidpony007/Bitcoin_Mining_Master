import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:io';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import '../services/apple_in_app_purchase_service.dart';
import '../services/analytics_service.dart';
import 'paid_contracts_screen.dart';
import '../widgets/mining_machine_animation.dart';

/// 合约屏幕 - Contracts with tabs
class ContractsScreen extends StatefulWidget {
  const ContractsScreen({super.key});

  @override
  State<ContractsScreen> createState() => ContractsScreenState();
}

class ContractsScreenState extends State<ContractsScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late TabController _tabController;
  final _storageService = StorageService();
  final _apiService = ApiService();
  final bool _isPageVisible = true;
  final List<Map<String, dynamic>> _activePaidContracts = [];
  final List<Map<String, dynamic>> _expiredPaidContracts = [];

  // 4个固定订阅档位（始终显示于 All tab 的 Subscription Contract Queue）
  static final List<Map<String, dynamic>> _subscriptionTiers = [
    {'id': 'p0499', 'name': 'Starter Plan', 'hashrate': '176.3 Gh/s', 'price': r'$4.99', 'color': const Color(0xFF4A90E2)},
    {'id': 'p0699', 'name': 'Standard Plan', 'hashrate': '305.6 Gh/s', 'price': r'$6.99', 'color': const Color(0xFF50C878)},
    {'id': 'p0999', 'name': 'Advanced Plan', 'hashrate': '611.2 Gh/s', 'price': r'$9.99', 'color': const Color(0xFFFF6B35)},
    {'id': 'p1999', 'name': 'Premium Plan', 'hashrate': '1326.4 Gh/s', 'price': r'$19.99', 'color': const Color(0xFFFFD700)},
  ];

  // 合约状态
  bool _isLoadingContracts = true;
  bool _isDailyCheckInActive = false;
  bool _isAdRewardActive = false;
  bool _inviteFriendExists = false;
  bool _isInviteFriendActive = false;
  bool _bindReferrerExists = false;
  bool _isBindReferrerActive = false;
  int _dailyCheckInRemainingSeconds = 0;
  int _adRewardRemainingSeconds = 0;
  int _inviteFriendRemainingSeconds = 0;
  int _bindReferrerRemainingSeconds = 0;
  int _userLevel = 1; // 用户矿工等级
  Timer? _contractTimer;
  Timer? _refreshTimer;
  // 乐观保护：订阅成功后，在服务端确认建立合约前，任何 _loadContracts 结果都不得清除该档位的主动条目
  // Map key = productId，value = 60秒超时 Timer；支持同时保护多个档位（多套餐并购场景）
  final Map<String, Timer> _pendingOptimisticTimers = {};
  // 防 race condition：每次 _loadContracts() 调用递增，响应到达时若序号已过时则丢弃
  int _loadContractsSeq = 0;
  // iOS 订阅状态同步冷却：5 分钟内不重复调用 restorePurchases()，避免频繁触发 StoreKit 事件
  DateTime? _lastIosSyncTime;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _tabController = TabController(length: 2, vsync: this);
    _loadUserLevel(); // 加载用户等级
    _loadContracts();

    // 每秒更新倒计时
    _contractTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        if (_dailyCheckInRemainingSeconds > 0) {
          _dailyCheckInRemainingSeconds--;
        } else {
          _isDailyCheckInActive = false;
        }

        if (_adRewardRemainingSeconds > 0) {
          _adRewardRemainingSeconds--;
        } else {
          _isAdRewardActive = false;
        }

        if (_inviteFriendRemainingSeconds > 0) {
          _inviteFriendRemainingSeconds--;
          if (_inviteFriendRemainingSeconds == 0) {
            _isInviteFriendActive = false;
          }
        }

        if (_bindReferrerRemainingSeconds > 0) {
          _bindReferrerRemainingSeconds--;
          if (_bindReferrerRemainingSeconds == 0) {
            _isBindReferrerActive = false;
          }
        }

        // 每秒同步减少付费合约的本地剩余秒数，驱动倒计时跳动
        for (final contract in _activePaidContracts) {
          final secs = (contract['_remainingSeconds'] as int?) ?? 0;
          if (secs > 0) {
            contract['_remainingSeconds'] = secs - 1;
          }
        }
      });
    });

    // 每30秒刷新一次合约数据（防止时间漂移）
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      _loadContracts();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tabController.dispose();
    _contractTimer?.cancel();
    _refreshTimer?.cancel();
    for (final t in _pendingOptimisticTimers.values) {
      t.cancel();
    }
    _pendingOptimisticTimers.clear();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) ApiService.notifyAppResumed();
    if (state == AppLifecycleState.resumed && _isPageVisible) {
      // 延迟 800ms 再发请求：iOS 从后台恢复后网络接口需要短暂时间重建
      Future.delayed(const Duration(milliseconds: 800), () {
        if (!mounted) return;
        _loadContracts();
        if (Platform.isIOS) {
          _syncIosSubscriptionStatus();
        }
      });
    }
  }

  /// iOS 专属：恢复订阅收据并发到后端同步状态（取消/到期 识别）
  Future<void> _syncIosSubscriptionStatus() async {
    // 5 分钟冷却：防止频繁切换后台/前台时反复调用 restorePurchases() 触发 StoreKit 弹窗
    final now = DateTime.now();
    if (_lastIosSyncTime != null &&
        now.difference(_lastIosSyncTime!).inMinutes < 5) {
      return;
    }
    _lastIosSyncTime = now;
    try {
      final token = _storageService.getAuthToken();
      if (token == null || token.isEmpty) return;
      // 只有存在活跃付费合约时才需要同步
      final hasActivePaid = _activePaidContracts.any(
        (c) => c['platform'] == 'ios' && c['status'] == 'active',
      );
      if (!hasActivePaid) return;

      final appleService = AppleInAppPurchaseService();
      appleService.userId = _storageService.getUserId();
      await appleService.syncSubscriptionStatus(token: token);
      // 同步完成后重新拉取合约数据以反映最新状态
      await Future.delayed(const Duration(milliseconds: 500));
      _loadContracts();
    } catch (e) {
      print('⚠️ [contracts] iOS 订阅状态同步失败: $e');
    }
  }

  // 加载用户等级
  Future<void> _loadUserLevel() async {
    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) return;

      final response = await _apiService.getUserLevel(userId);
      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];
        final level = data['level'] ?? 1;
        setState(() {
          _userLevel = level.clamp(1, 9);
        });
        // 同步更新本地存储
        _storageService.saveUserLevel(level);
      }
    } catch (e) {
      // 如果API失败，回退到本地存储的等级
      setState(() {
        _userLevel = _storageService.getUserLevel().clamp(1, 9);
      });
    }
  }

  // 公开的刷新方法，供外部调用
  void refreshContracts() {
    _loadContracts();
  }

  /// 订阅成功后立即乐观更新对应档位为 Mining 状态，无需等待 API 响应
  void _applyOptimisticContractUpdate(String productId) {
    if (productId.isEmpty) return;
    // 设置乐观保护：60秒内任何 _loadContracts 刷新都不得清除该档位
    // 每个 productId 独立计时，互不干扰（支持同时订阅多个套餐）
    _pendingOptimisticTimers[productId]?.cancel();
    _pendingOptimisticTimers[productId] = Timer(const Duration(seconds: 60), () {
      _pendingOptimisticTimers.remove(productId);
    });
    setState(() {
      // 移除同一 productId 的非活跃旧条目（如 cancelled）
      _activePaidContracts.removeWhere(
        (c) => c['productId']?.toString() == productId && c['status'] != 'active',
      );
      // 若尚无该档位的 active 合约，则立即插入乐观条目
      if (!_activePaidContracts.any(
        (c) => c['productId']?.toString() == productId && c['status'] == 'active',
      )) {
        _activePaidContracts.add({
          'productId': productId,
          'status': 'active',
          '_remainingSeconds': 30 * 24 * 3600, // 30天占位，后续由API刷新覆盖
        });
      }
    });
  }

  /// 广告奖励领取成功后立即乐观更新 UI，不等待 API 回叁
  /// [addedSeconds] 本次增加的秒数（默认 2 小时 = 7200）
  void activateAdRewardImmediately({int addedSeconds = 7200}) {
    setState(() {
      _isAdRewardActive = true;
      // 如果已有剩余时间则叠加，否则直接设为 addedSeconds
      _adRewardRemainingSeconds =
          (_adRewardRemainingSeconds > 0
              ? _adRewardRemainingSeconds
              : 0) +
          addedSeconds;
    });
    // 后台真实刷新，让数据与服务器对齐
    _loadContracts();
  }

  Future<void> _loadContracts() async {
    final seq = ++_loadContractsSeq; // 捕获本次请求的序列号
    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) {
        if (!mounted) return;
        setState(() {
          _isLoadingContracts = false;
        });
        return;
      }

      print('📝 加载合约数据 - userId: $userId seq=$seq');

      // 同时刷新用户等级
      _loadUserLevel();

      final response = await _apiService.getMyContracts(userId);
      print('📦 API响应 seq=$seq (current=${_loadContractsSeq}): $response');

      // 若已有更新的请求在途，丢弃本次过时响应，避免覆盖较新结果
      if (seq < _loadContractsSeq) {
        print('⚠️ [contracts] 丢弃过时响应 seq=$seq，当前序号=${_loadContractsSeq}');
        return;
      }

      if (!mounted) return;

      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];

        print('✅ Daily Check-in: ${data['dailyCheckIn']}');
        print('✅ Ad Reward: ${data['adReward']}');

        setState(() {
          // Daily Check-in状态
          _isDailyCheckInActive = data['dailyCheckIn']['isActive'] == true;
          _dailyCheckInRemainingSeconds =
              data['dailyCheckIn']['remainingSeconds'] ?? 0;

          // Ad Reward状态
          _isAdRewardActive = data['adReward']['isActive'] == true;
          _adRewardRemainingSeconds = data['adReward']['remainingSeconds'] ?? 0;

          // Invite Friend Reward状态
          _inviteFriendExists = data['inviteFriendReward']['exists'] == true;
          _isInviteFriendActive = data['inviteFriendReward']['isActive'] == true;
          _inviteFriendRemainingSeconds = data['inviteFriendReward']['remainingSeconds'] ?? 0;
          // hashrate现在是字符串（如"5.5Gh/s"），不需要解析

          // Bind Referrer Reward状态
          _bindReferrerExists = data['bindReferrerReward']['exists'] == true;
          _isBindReferrerActive = data['bindReferrerReward']['isActive'] == true;
          _bindReferrerRemainingSeconds = data['bindReferrerReward']['remainingSeconds'] ?? 0;
          // hashrate现在是字符串（如"5.5Gh/s"），不需要解析

          _activePaidContracts
            ..clear()
            ..addAll(
              List<Map<String, dynamic>>.from(
                data['paidContracts']?['active'] ?? const [],
              ).map((c) => Map<String, dynamic>.from(c)).toList(),
            )
            // 已取消的合约也显示在 All tab（Not Active），不归入 Expired
            ..addAll(
              List<Map<String, dynamic>>.from(
                data['paidContracts']?['cancelled'] ?? const [],
              ).map((c) => Map<String, dynamic>.from(c)).toList(),
            );
          // 初始化各合约的本地倒计时秒数（供每秒 Timer 驱动 UI 倒计时跳动）
          // ⚠️ 直接使用 API 返回的 remainingSeconds 整数字段，而非 remainingFormatted 字符串；
          //    remainingFormatted 携带 'Xd Xh Xm'（无秒）格式，正则解析会失败并返回 0。
          for (final contract in _activePaidContracts) {
            if (contract['status'] != 'cancelled') {
              final serverSecs = (contract['remainingSeconds'] as num?)?.toInt() ?? 0;
              final localSecs = (contract['_remainingSeconds'] as int?) ?? -1;
              // 漂移校正：本地已追踪计时时，只在差值 > 120s 时才用服务端值覆盖，
              // 避免每次 _loadContracts 触发后计时器出现可见跳变。
              if (localSecs < 0 || (localSecs - serverSecs).abs() > 120) {
                contract['_remainingSeconds'] = serverSecs;
              }
              // 否则保留本地已连续倒计时的值，不跳变。
            }
          }

          // 乐观保护：遍历所有待确认档位，独立判断服务端是否已确认
          for (final pid in List<String>.from(_pendingOptimisticTimers.keys)) {
            final serverConfirmed = _activePaidContracts.any(
              (c) => c['productId']?.toString() == pid && c['status'] == 'active',
            );
            if (serverConfirmed) {
              // 服务端已确认，取消并移除该档位的保护
              _pendingOptimisticTimers[pid]?.cancel();
              _pendingOptimisticTimers.remove(pid);
            } else {
              // 服务端尚未包含，将乐观条目加回列表
              _activePaidContracts
                ..removeWhere(
                  (c) => c['productId']?.toString() == pid && c['status'] != 'active',
                );
              if (!_activePaidContracts.any(
                (c) => c['productId']?.toString() == pid && c['status'] == 'active',
              )) {
                _activePaidContracts.add({
                  'productId': pid,
                  'status': 'active',
                  '_remainingSeconds': 30 * 24 * 3600,
                });
              }
            }
          }
          _expiredPaidContracts
            ..clear()
            ..addAll(
              List<Map<String, dynamic>>.from(
                data['paidContracts']?['expired'] ?? const [],
              ),
            );

          _isLoadingContracts = false;
        });

        print(
          '🔄 状态更新: Daily=$_isDailyCheckInActive, Ad=$_isAdRewardActive, InviteFriend=$_isInviteFriendActive, BindReferrer=$_isBindReferrerActive',
        );
        print(
          '📊 合约存在性: InviteFriendExists=$_inviteFriendExists, BindReferrerExists=$_bindReferrerExists',
        );
        print(
          '⏱️ 剩余时间: InviteFriend=$_inviteFriendRemainingSeconds秒, BindReferrer=$_bindReferrerRemainingSeconds秒',
        );
        print(
          '💳 付费合约: Active=${_activePaidContracts.length}, Expired=${_expiredPaidContracts.length}',
        );
      } else {
        print('❌ API响应失败或数据为空');
        if (!mounted) return;
        setState(() {
          _isLoadingContracts = false;
        });
      }
    } catch (e) {
      print('❌ 加载合约失败: $e');
      if (!mounted) return;
      setState(() {
        _isLoadingContracts = false;
      });
    }
  }

  String _formatDuration(int totalSeconds) {
    if (totalSeconds <= 0) return '00h 00m 00s';

    final hours = totalSeconds ~/ 3600;
    final minutes = (totalSeconds % 3600) ~/ 60;
    final seconds = totalSeconds % 60;

    return '${hours.toString().padLeft(2, '0')}h ${minutes.toString().padLeft(2, '0')}m ${seconds.toString().padLeft(2, '0')}s';
  }

  /// 将 "00h 04m 28s" 格式的字符串解析为总秒数
  int _parseFormattedDuration(String formatted) {
    final match = RegExp(r'(\d+)h\s*(\d+)m\s*(\d+)s').firstMatch(formatted);
    if (match == null) return 0;
    final h = int.tryParse(match.group(1) ?? '0') ?? 0;
    final m = int.tryParse(match.group(2) ?? '0') ?? 0;
    final s = int.tryParse(match.group(3) ?? '0') ?? 0;
    return h * 3600 + m * 60 + s;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Contracts'),
        centerTitle: false,
        actions: [
          TextButton.icon(
            onPressed: () {
              Navigator.push<String?>(
                context,
                MaterialPageRoute(
                  builder: (context) => const PaidContractsScreen(),
                ),
              ).then((productId) {
                if (productId != null && mounted) {
                  _applyOptimisticContractUpdate(productId);
                  // 延迟 2 秒再 fetch，确保后端 DB 已完全写入
                  Future.delayed(const Duration(seconds: 2), () {
                    if (mounted) _loadContracts();
                  });
                }
              });
            },
            icon: Icon(
              Icons.add_shopping_cart,
              color: AppColors.primary,
              size: 20,
            ),
            label: Text(
              'Buy Contract',
              style: TextStyle(
                color: AppColors.primary,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            ),
          ),
          const SizedBox(width: 8),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Expired'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [_buildAllTab(), _buildExpiredTab()],
      ),
    );
  }

  Widget _buildExpiredTab() {
    // 已续订（有 active 合约）的档位，即使旧记录仍在 expired 列表，也不再展示
    final activeProductIds = _activePaidContracts
        .where((c) => c['status']?.toString() == 'active')
        .map((c) => c['productId']?.toString())
        .toSet();

    // 收集所有已过期的合约（排除已续订的档位）
    List<Widget> expiredContracts = [];

    for (final contract in _expiredPaidContracts) {
      final productId = contract['productId']?.toString();
      if (productId != null && activeProductIds.contains(productId)) {
        // 该档位已续订，跳过
        continue;
      }
      expiredContracts.add(_buildPaidContractCard(contract, isExpired: true));
      expiredContracts.add(const SizedBox(height: 12));
    }

    // Bind Referrer Reward - 存在但不活跃（仅一次性任务，过期后只在这里显示）
    if (_bindReferrerExists && !_isBindReferrerActive) {
      expiredContracts.add(_buildBindReferrerCard());
      expiredContracts.add(const SizedBox(height: 12));
    }

    if (expiredContracts.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.inventory_2_outlined,
                size: 64,
                color: AppColors.textSecondary,
              ),
              const SizedBox(height: 16),
              Text(
                'No expired contracts',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Expired Contracts',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 20),
          ...expiredContracts,
        ],
      ),
    );
  }

  Widget _buildDailyCheckinCard() {
    final isActive = _isDailyCheckInActive && _dailyCheckInRemainingSeconds > 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.primary.withOpacity(0.3),
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          // Bitcoin Icon
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.currency_bitcoin,
              color: AppColors.primary,
              size: 28,
            ),
          ),

          const SizedBox(width: 16),

          // Contract Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '7.5Gh/s',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Daily Check-in Reward',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),

          // Status and Countdown
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Status Dot and Countdown/Status
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: isActive
                          ? const Color(0xFF4CAF50)
                          : const Color(0xFFF44336),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isActive
                        ? _formatDuration(_dailyCheckInRemainingSeconds)
                        : 'Not Active',
                    style: TextStyle(
                      color: isActive
                          ? const Color(0xFF4CAF50)
                          : AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: isActive
                          ? FontWeight.w600
                          : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAdMiningCard() {
    final isActive = _isAdRewardActive && _adRewardRemainingSeconds > 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.primary.withOpacity(0.3),
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          // Bitcoin Icon
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.currency_bitcoin,
              color: AppColors.primary,
              size: 28,
            ),
          ),

          const SizedBox(width: 16),

          // Contract Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '5.5Gh/s',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Free Ad Reward',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),

          // Status Indicator and Countdown
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Status Dot and Countdown/Status
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: isActive
                          ? const Color(0xFF4CAF50)
                          : const Color(0xFFF44336),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isActive
                        ? _formatDuration(_adRewardRemainingSeconds)
                        : 'Not Active',
                    style: TextStyle(
                      color: isActive
                          ? const Color(0xFF4CAF50)
                          : AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: isActive
                          ? FontWeight.w600
                          : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAllTab() {
    if (_isLoadingContracts) {
      return const Center(child: CircularProgressIndicator());
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // My Contract Title
          Text(
            'My Contract',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 20),

          // 3D矿机动画 - 居中显示，在任务队列上方
          Center(
            child: MiningMachineAnimation(
              isActive: _isDailyCheckInActive ||
                  _isAdRewardActive ||
                  _isInviteFriendActive ||
                  _isBindReferrerActive ||
                  _activePaidContracts.any((c) => c['status']?.toString() == 'active'),
              size: 200, // 增大尺寸至200
              userLevel: _userLevel, // 传递用户矿工等级
            ),
          ),
          const SizedBox(height: 24),

          // Daily Check-in Contract Card (Top Priority - 7.5Gh/s)
          _buildDailyCheckinCard(),

          const SizedBox(height: 12),

          // Ad Mining Contract Card (5.5Gh/s)
          _buildAdMiningCard(),

          const SizedBox(height: 12),

          // Invite Friend Reward合约（始终显示）
          _buildInviteFriendCard(),

          // Bind Referrer Reward合约（只在有合约且活跃时显示）
          if (_bindReferrerExists && _isBindReferrerActive) ...[
            const SizedBox(height: 12),
            _buildBindReferrerCard(),
          ],

          const SizedBox(height: 20),
          Text(
            'Subscription Contract Queue',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          ..._subscriptionTiers.map((tier) {
            final matches = _activePaidContracts.where(
              (c) =>
                  c['productId']?.toString() == tier['id'] &&
                  c['status']?.toString() == 'active',
            );
            final activeContract = matches.isEmpty ? null : matches.first;
            return Column(
              children: [
                _buildSubscriptionTierCard(tier, activeContract),
                const SizedBox(height: 12),
              ],
            );
          }),
        ],
      ),
    );
  }

  Widget _buildSubscriptionTierCard(
    Map<String, dynamic> tier,
    Map<String, dynamic>? activeContract,
  ) {
    final Color accentColor = tier['color'] as Color;
    final bool isActive = activeContract != null;
    final Color displayColor = isActive ? accentColor : const Color(0xFF8E8E93);
    final String statusText = isActive ? 'Mining' : 'Not Active';
    final String remainingText = isActive
        ? _formatDuration((activeContract['_remainingSeconds'] as int?) ?? 0)
        : '--';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: displayColor.withOpacity(0.65),
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: displayColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  isActive ? Icons.queue_play_next : Icons.lock_outline,
                  color: displayColor,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tier['name'] as String,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      statusText,
                      style: TextStyle(
                        color: isActive ? accentColor : AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    tier['hashrate'] as String,
                    style: TextStyle(
                      color: displayColor,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tier['price'] as String,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _buildPaidMetaItem('Status', statusText, displayColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildPaidMetaItem('Remaining', remainingText, displayColor),
              ),
            ],
          ),
          if (!isActive) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () async {
                  final result = await Navigator.push<String?>(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const PaidContractsScreen(),
                    ),
                  );
                  if (result != null && mounted) {
                    _applyOptimisticContractUpdate(result);
                    // 延迟 2 秒再 fetch，确保后端 DB 已完全写入
                    Future.delayed(const Duration(seconds: 2), () {
                      if (mounted) _loadContracts();
                    });
                  }
                },
                icon: const Icon(Icons.shopping_cart_outlined, size: 16),
                label: const Text('Buy Contract'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPaidContractCard(
    Map<String, dynamic> contract, {
    bool isExpired = false,
  }) {
    final String title = contract['planName']?.toString() ?? 'Paid Contract';
    final String statusText = contract['statusText']?.toString() ??
        (isExpired ? 'Expired' : 'Mining');
    final String hashrate =
        contract['displayHashrate']?.toString() ?? '0Gh/s';

    // cancelled 状态：在 All tab 展示，但用灰色表示 Not Active
    final bool isCancelled = contract['status']?.toString() == 'cancelled';
    final String remainingText = (isExpired || isCancelled)
        ? 'Ended ${contract['endedAtText'] ?? ''}'.trim()
        : _formatDuration((contract['_remainingSeconds'] as int?) ?? 0);
    final Color accentColor =
        (isExpired || isCancelled) ? const Color(0xFF8E8E93) : const Color(0xFF50C878);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: accentColor.withOpacity(0.65),
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  (isExpired || isCancelled) ? Icons.inventory_2_outlined : Icons.queue_play_next,
                  color: accentColor,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      statusText,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    hashrate,
                    style: TextStyle(
                      color: accentColor,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    contract['priceLabel']?.toString() ?? '',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _buildPaidMetaItem('Status', statusText, accentColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildPaidMetaItem(
                  (isExpired || isCancelled) ? 'Ended' : 'Remaining',
                  remainingText,
                  (isExpired || isCancelled) ? AppColors.textSecondary : accentColor,
                ),
              ),
            ],
          ),
          // 过期合约：显示续订按钮
          if (isExpired) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () async {
                  final productId = contract['productId']?.toString();
                  final result = await Navigator.push<String?>(
                    context,
                    MaterialPageRoute(
                      builder: (_) => PaidContractsScreen(
                        highlightProductId: productId,
                      ),
                    ),
                  );
                  if (result != null && mounted) {
                    _applyOptimisticContractUpdate(result);
                    // 延迟 2 秒再 fetch，确保后端 DB 已完全写入
                    Future.delayed(const Duration(seconds: 2), () {
                      if (mounted) _loadContracts();
                    });
                  }
                },
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Renew Subscription'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPaidMetaItem(String label, String value, Color valueColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInviteFriendCard() {
    final isActive = _isInviteFriendActive && _inviteFriendRemainingSeconds > 0;
    // 固定显示5.5Gh/s
    final hashrate = '5.5Gh/s';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.primary.withOpacity(0.3),
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          // Bitcoin Icon
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.currency_bitcoin,
              color: AppColors.primary,
              size: 28,
            ),
          ),

          const SizedBox(width: 16),

          // Contract Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hashrate,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Invite Friend Reward',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),

          // Status Indicator and Countdown
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: isActive
                          ? const Color(0xFF4CAF50)
                          : const Color(0xFFF44336),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isActive
                        ? _formatDuration(_inviteFriendRemainingSeconds)
                        : 'Not Active',
                    style: TextStyle(
                      color: isActive
                          ? const Color(0xFF4CAF50)
                          : AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: isActive
                          ? FontWeight.w600
                          : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBindReferrerCard() {
    final isActive = _isBindReferrerActive && _bindReferrerRemainingSeconds > 0;
    // 固定显示5.5Gh/s
    final hashrate = '5.5Gh/s';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.primary.withOpacity(0.3),
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          // Bitcoin Icon
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.currency_bitcoin,
              color: AppColors.primary,
              size: 28,
            ),
          ),

          const SizedBox(width: 16),

          // Contract Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hashrate,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Bind Referrer Reward',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),

          // Status Indicator and Countdown
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: isActive
                          ? const Color(0xFF4CAF50)
                          : const Color(0xFFF44336),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isActive
                        ? _formatDuration(_bindReferrerRemainingSeconds)
                        : 'Not Active',
                    style: TextStyle(
                      color: isActive
                          ? const Color(0xFF4CAF50)
                          : AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: isActive
                          ? FontWeight.w600
                          : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
