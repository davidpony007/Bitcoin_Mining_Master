import 'package:flutter/material.dart';
import 'dart:async';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
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
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _isPageVisible) {
      // 应用恢复到前台时立即刷新
      _loadContracts();
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
    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) {
        setState(() {
          _isLoadingContracts = false;
        });
        return;
      }

      print('📝 加载合约数据 - userId: $userId');

      // 同时刷新用户等级
      _loadUserLevel();

      final response = await _apiService.getMyContracts(userId);
      print('📦 API响应: $response');

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
              ),
            )
            // 已取消的合约也显示在 All tab（Not Active），不归入 Expired
            ..addAll(
              List<Map<String, dynamic>>.from(
                data['paidContracts']?['cancelled'] ?? const [],
              ),
            );
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
        setState(() {
          _isLoadingContracts = false;
        });
      }
    } catch (e) {
      print('❌ 加载合约失败: $e');
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Contracts'),
        actions: [
          TextButton.icon(
            onPressed: () {
              Navigator.push<bool>(
                context,
                MaterialPageRoute(
                  builder: (context) => const PaidContractsScreen(),
                ),
              ).then((purchased) {
                if (purchased == true) {
                  refreshContracts();
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
    // 收集所有已过期的合约
    List<Widget> expiredContracts = [];

    for (final contract in _expiredPaidContracts) {
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
                  _activePaidContracts.isNotEmpty,
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

          if (_activePaidContracts.isNotEmpty) ...[
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
            ..._activePaidContracts.asMap().entries.expand((entry) => [
              _buildPaidContractCard(entry.value, queueIndex: entry.key + 1),
              const SizedBox(height: 12),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _buildPaidContractCard(
    Map<String, dynamic> contract, {
    int? queueIndex,
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
        : (contract['remainingFormatted']?.toString() ?? '00h 00m 00s');
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
                      queueIndex != null ? 'Queue #$queueIndex' : statusText,
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
