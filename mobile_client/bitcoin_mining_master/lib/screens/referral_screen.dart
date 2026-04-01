import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import '../services/user_repository.dart';
import '../services/analytics_service.dart';
import 'transaction_history_screen.dart';

/// 推荐屏幕 - Invite with rebate earnings
class ReferralScreen extends StatefulWidget {
  final VoidCallback? onContractRefreshNeeded;

  const ReferralScreen({super.key, this.onContractRefreshNeeded});

  @override
  State<ReferralScreen> createState() => ReferralScreenState();
}

class ReferralScreenState extends State<ReferralScreen> with WidgetsBindingObserver {
  final _storageService = StorageService();
  final _apiService = ApiService();
  final _userRepository = UserRepository();
  
  String _invitationCode = 'Loading...';
  String _totalRebate = '0.00000000';
  int _invitedCount = 0;
  final String _todayEarnings = '0.000000000000000';
  bool _isLoading = true;
  bool _hasReferrer = false; // 是否已有推荐人
  String? _referrerInvitationCode; // 推荐人的邀请码
  List<Map<String, dynamic>> _invitedUsersList = []; // 邀请的用户列表
  List<Map<String, dynamic>> _rebateList = []; // 返利记录列表
  int _rebateTotal = 0;
  bool _isLoadingRebate = false;
  final GlobalKey _shareButtonKey = GlobalKey(); // iOS sharePositionOrigin 定位用
  final ScrollController _invitedListScrollController = ScrollController();
  final ScrollController _rebateListScrollController = ScrollController();

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _invitedListScrollController.dispose();
    _rebateListScrollController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      refreshInvitedFriends();
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadInvitationData();
  }

  /// 供外部调用：刷新 Invited Friends 列表
  Future<void> refreshInvitedFriends() async {
    final userId = _storageService.getUserId();
    if (userId != null && userId.isNotEmpty && !userId.startsWith('OFFLINE_')) {
      // 同步刷新 Total Rebate Earnings（来自 user_status.total_invitation_rebate）
      // 必须与 rebate records 一起刷新，否则顶部总额永远显示首次加载时的旧值
      await Future.wait([
        _loadInvitationInfo(userId),
        _loadRebateRecords(userId),
        _refreshTotalRebate(userId),
      ]);
    }
  }

  /// 刷新顶部 Total Rebate Earnings 数值
  Future<void> _refreshTotalRebate(String userId) async {
    try {
      final response = await _getUserStatusWithFallback(userId);
      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];
        if (mounted) {
          setState(() {
            _totalRebate = (data['total_invitation_rebate'] ?? 0).toString();
          });
        }
      }
    } catch (e) {
      print('❌ Error refreshing total rebate: $e');
    }
  }

  Future<void> _loadInvitationData() async {
    try {
      // 1. 获取本地保存的user_id
      String? userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) {
        print('📱 No userId in storage, triggering device login...');
        final result = await _userRepository.fetchUserId();
        if (result.isSuccess && result.data != null && result.data!.isNotEmpty) {
          userId = result.data!;
          print('✅ Device login success, userId: $userId');
        } else {
          print('❌ Device login failed: ${result.error}');
          setState(() {
            _invitationCode = 'No User ID';
            _isLoading = false;
          });
          return;
        }
      }

      // 2. 首先尝试从本地存储读取邀请码（过滤 OFFLINE 前缀）
      String? cachedCode = _storageService.getInvitationCode();
      
      // 过滤 OFFLINE 前缀的邀请码
      if (cachedCode != null && cachedCode.startsWith('OFFLINE_')) {
        print('⚠️ [Referral] Detected OFFLINE invitation code, ignoring: $cachedCode');
        cachedCode = null; // 不使用离线数据
      }
      
      if (cachedCode != null && cachedCode.isNotEmpty) {
        print('✅ Loaded invitation code from cache: $cachedCode');
        setState(() {
          _invitationCode = cachedCode!;  // 添加 ! 非空断言
          _isLoading = false;
        });
      }

      // 3. 调用后端API获取完整邀请信息（包括返利统计）
      final response = await _getUserStatusWithFallback(userId);
      
      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];
        final invCode = data['invitation_code'];
        
        // 过滤 OFFLINE 前缀的邀请码
        if (invCode != null && invCode.startsWith('OFFLINE_')) {
          print('⚠️ [Referral] Backend returned OFFLINE invitation code, treating as error');
          throw Exception('Backend returned offline invitation code');
        }
        
        if (invCode != null && invCode.isNotEmpty) {
          // 保存到本地存储
          await _storageService.saveInvitationCode(invCode);
        }
        setState(() {
          _invitationCode = invCode ?? cachedCode ?? 'N/A';
          _totalRebate = (data['total_invitation_rebate'] ?? 0).toString();
          _isLoading = false;
        });
        
        // 4. 获取邀请关系信息（被邀请人数）和返利记录
        _loadInvitationInfo(userId);
        _loadRebateRecords(userId);
      } else {
        // 如果API调用失败但有缓存的邀请码，使用缓存
        if (cachedCode != null && cachedCode.isNotEmpty) {
          print('⚠️ API failed but using cached invitation code');
          setState(() {
            _invitationCode = cachedCode!;  // 添加 ! 非空断言
            _isLoading = false;
          });
        } else {
          throw Exception('Failed to load user status');
        }
      }
    } catch (e) {
      print('❌ Error loading invitation data: $e');
      // 最后尝试使用缓存（过滤 OFFLINE 前缀）
      String? cachedCode = _storageService.getInvitationCode();
      
      // 过滤 OFFLINE 前缀
      if (cachedCode != null && cachedCode.startsWith('OFFLINE_')) {
        print('⚠️ [Referral] Cached OFFLINE code detected in error handler, ignoring');
        cachedCode = null;
      }
      
      setState(() {
        _invitationCode = cachedCode ?? 'Tap to Retry';
        _isLoading = false;
      });
    }
  }

  /// 使用多地址回退机制调用user-status接口
  Future<Map<String, dynamic>> _getUserStatusWithFallback(String userId) async {
    final baseUrls = [
      ApiConstants.baseUrl, // Primary (10.0.2.2 for Android)
      'http://10.0.2.2:8888',
      'http://127.0.0.1:8888',
    ];

    Exception? lastError;
    for (final baseUrl in baseUrls.toSet()) {
      try {
        print('🔄 Trying to get user status from: $baseUrl');
        final response = await _apiService.getUserStatus(userId);
        print('✅ Successfully got user status from: $baseUrl');
        return response;
      } catch (e) {
        print('❌ Failed with $baseUrl: $e');
        lastError = e as Exception;
        continue;
      }
    }
    
    throw lastError ?? Exception('All endpoints failed');
  }

  Future<void> _loadInvitationInfo(String userId) async {
    try {
      final response = await _apiService.getInvitationInfo(userId);
      if (response['success'] == true && response['data'] != null) {
        final invitedUsers = response['data']['invitedUsers'] ?? [];
        final referrer = response['data']['referrer'];
        setState(() {
          _invitedCount = invitedUsers.length;
          _invitedUsersList = List<Map<String, dynamic>>.from(invitedUsers);
          _hasReferrer = referrer != null; // 检查是否有推荐人
          // 保存推荐人的邀请码
          if (referrer != null && referrer['invitation_code'] != null) {
            _referrerInvitationCode = referrer['invitation_code'];
            print('✅ Loaded referrer invitation code: $_referrerInvitationCode');
          }
        });
      }
    } catch (e) {
      print('Error loading invitation info: $e');
    }
  }

  Future<void> _loadRebateRecords(String userId, {int page = 1}) async {
    if (_isLoadingRebate) return;
    setState(() => _isLoadingRebate = true);
    try {
      final response = await _apiService.getInvitationRebate(userId, page: page, limit: 20);
      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];
        setState(() {
          _rebateTotal = data['total'] ?? 0;
          if (page == 1) {
            _rebateList = List<Map<String, dynamic>>.from(data['records'] ?? []);
          } else {
            _rebateList.addAll(List<Map<String, dynamic>>.from(data['records'] ?? []));
          }
        });
      }
    } catch (e) {
      print('Error loading rebate records: $e');
    } finally {
      if (mounted) setState(() => _isLoadingRebate = false);
    }
  }

  void _copyInvitationCode() {
    // 过滤无效状态（包括 OFFLINE 前缀）
    if (_invitationCode == 'Loading...' || 
        _invitationCode == 'Error' || 
        _invitationCode == 'N/A' ||
        _invitationCode == 'Tap to Retry' ||
        _invitationCode.startsWith('OFFLINE_')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('⚠️ Please wait for invitation code to load'),
          backgroundColor: Colors.orange,
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }
    
    if (_invitationCode != 'Loading...' && _invitationCode != 'Error' && _invitationCode != 'N/A') {
      const String downloadUrl = 'https://bitcoin-mining-master-legal.davidpony007.workers.dev/download.html';
      final String copyText = '🎁 Join Bitcoin Mining Master!\n\nUse my invitation code to get a FREE 2-hour mining contract:\n\n📋 Code: $_invitationCode\n\nDownload now and start earning Bitcoin! 💰\n$downloadUrl';
      Clipboard.setData(ClipboardData(text: copyText));
      AnalyticsService.instance.logShareReferral(method: 'copy');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Invitation message copied!'),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _shareInvitationCode() async {
    // 过滤无效状态（包括 OFFLINE 前缀）
    if (_invitationCode == 'Loading...' || 
        _invitationCode == 'Error' || 
        _invitationCode == 'N/A' ||
        _invitationCode == 'Tap to Retry' ||
        _invitationCode.startsWith('OFFLINE_')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('⚠️ Please wait for invitation code to load'),
          backgroundColor: Colors.orange,
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }

    // 获取 Share 按钮位置（iOS 分享面板定位）
    Rect? sharePositionOrigin;
    final renderBox = _shareButtonKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox != null) {
      final offset = renderBox.localToGlobal(Offset.zero);
      sharePositionOrigin = offset & renderBox.size;
    }

    // 下载落地页链接
    const String downloadUrl = 'https://bitcoin-mining-master-legal.davidpony007.workers.dev/download.html';

    final String shareText = '''
🎁 Join Bitcoin Mining Master!

Use my invitation code to get a FREE 2-hour mining contract:

📋 Code: $_invitationCode

Download now and start earning Bitcoin! 💰
$downloadUrl
''';

    try {
      await Share.share(
        shareText,
        subject: 'Join Bitcoin Mining Master - Free Mining Contract!',
        sharePositionOrigin: sharePositionOrigin,
      );
      AnalyticsService.instance.logShareReferral(method: 'share');
    } catch (e) {
      debugPrint('Share error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Share failed, please try again'),
            backgroundColor: Colors.red,
            duration: Duration(seconds: 2),
          ),
        );
      }
    }
  }

  void _showAddReferrerDialog() {
    final codeController = TextEditingController();
    String? errorMessage; // 用于存储错误信息
    
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          backgroundColor: AppColors.cardDark,
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Enter your referrer\'s invitation code to get a free mining contract!',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              const Text(
                'You can only bind your upline referrer once. Once successfully bound, the referrer cannot be unbound or changed.',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.orange,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: codeController,
                decoration: InputDecoration(
                  hintText: 'INV...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(
                      color: errorMessage != null ? Colors.red : AppColors.primary,
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(
                      color: errorMessage != null ? Colors.red : Colors.grey,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(
                      color: errorMessage != null ? Colors.red : AppColors.primary,
                    ),
                  ),
                  errorText: errorMessage,
                  errorMaxLines: 2,
                ),
                textCapitalization: TextCapitalization.characters,
                onChanged: (value) {
                  // 清除错误信息当用户输入时
                  if (errorMessage != null) {
                    setState(() {
                      errorMessage = null;
                    });
                  }
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final code = codeController.text.trim();
                if (code.isEmpty) {
                  setState(() {
                    errorMessage = 'Please enter invitation code';
                  });
                  return;
                }
                
                // 尝试添加推荐人
                final result = await _addReferrer(code);
                
                if (result['success'] == true) {
                  // 成功，关闭对话框
                  Navigator.pop(context);
                } else {
                  // 失败，显示错误信息但不关闭对话框
                  setState(() {
                    errorMessage = result['error'] ?? 'Failed to add referrer';
                  });
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
              ),
              child: const Text('Confirm'),
            ),
          ],
        ),
      ),
    );
  }

  Future<Map<String, dynamic>> _addReferrer(String referrerCode) async {
    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) {
        return {
          'success': false,
          'error': 'User ID not found'
        };
      }

      // 🔒 检查：不能填写自己的邀请码
      if (referrerCode.trim() == _invitationCode.trim()) {
        return {
          'success': false,
          'error': 'You cannot use your own invitation code. Please enter your upline referrer\'s code.'
        };
      }

      // 显示加载
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(child: CircularProgressIndicator()),
      );

      // 调用API绑定推荐人
      final response = await _apiService.addReferrer(
        userId: userId,
        referrerInvitationCode: referrerCode,
      );

      Navigator.pop(context); // 关闭加载

      if (response['success'] == true) {
        // 更新状态：已有推荐人，同时直接从响应中拿到推荐人邀请码，避免等待二次请求
        setState(() {
          _hasReferrer = true;
          _referrerInvitationCode =
              response['data']?['referrer_invitation_code'] as String?;
        });
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(response['message'] ?? 'Referrer added successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        
        // 重新加载数据
        _loadInvitationData();
        
        // 立即触发合约列表刷新，无需等待 30 秒定时器
        widget.onContractRefreshNeeded?.call();
        
        return {'success': true};
      } else {
        // 检查是否是邀请码不存在的错误
        String errorMsg = response['message'] ?? 'Failed to add referrer';
        if (errorMsg.toLowerCase().contains('not found') || 
            errorMsg.toLowerCase().contains('not exist') ||
            errorMsg.toLowerCase().contains('not exist') ||
            errorMsg.toLowerCase().contains('does not exist')) {
          errorMsg = 'The invitation code you entered does not exist. Please confirm and try again.';
        }
        return {
          'success': false,
          'error': errorMsg
        };
      }
    } catch (e) {
      if (Navigator.canPop(context)) {
        Navigator.pop(context);
      }
      
      String errorMsg = e.toString();
      // 检查404错误或邀请码不存在的相关错误
      if (errorMsg.contains('404') ||
          errorMsg.toLowerCase().contains('not found') || 
          errorMsg.toLowerCase().contains('not exist') ||
          errorMsg.toLowerCase().contains('does not exist')) {
        errorMsg = 'The invitation code you entered does not exist. Please confirm and try again.';
      }
      
      return {
        'success': false,
        'error': errorMsg
      };
    }
  }

  Future<void> _createAdContract(String userId) async {
    try {
      final response = await _apiService.createAdFreeContract(userId: userId);
      if (response['success'] == true) {
        // 显示激活合约提示
        _showAdContractDialog(response['data']['id']);
      }
    } catch (e) {
      print('Error creating ad contract: $e');
    }
  }

  void _showAdContractDialog(int contractId) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        title: const Row(
          children: [
            Icon(Icons.card_giftcard, color: AppColors.primary),
            SizedBox(width: 8),
            Text('Free Mining Contract!'),
          ],
        ),
        content: const Text(
          'You\'ve received a free 2-hour mining contract! Watch an ad to activate it now.',
          style: TextStyle(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Later'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _watchAdAndActivate(contractId);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
            ),
            child: const Text('Watch Ad'),
          ),
        ],
      ),
    );
  }

  Future<void> _watchAdAndActivate(int contractId) async {
    // TODO: 集成广告SDK
    // 这里模拟观看广告完成
    await Future.delayed(const Duration(seconds: 2));
    
    try {
      final userId = _storageService.getUserId();
      if (userId == null) return;

      final response = await _apiService.activateAdFreeContract(
        userId: userId,
        contractId: contractId,
      );

      if (response['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(response['message'] ?? 'Contract activated!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Activation failed: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  /// 显示帮助说明对话框
  void _showHelpDialog() {
    final scrollController = ScrollController();
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: const Text('Rebate System Info'),
          content: SizedBox(
            width: double.maxFinite,
            height: MediaQuery.of(context).size.height * 0.55,
            child: Scrollbar(
              controller: scrollController,
              thumbVisibility: true,
              thickness: 4,
              radius: const Radius.circular(4),
              child: SingleChildScrollView(
                controller: scrollController,
                padding: const EdgeInsets.only(right: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildInfoItem('1', 'The rebate ratio is 20%.'),
                    const SizedBox(height: 12),
                    _buildInfoItem('2', 'Rebates are updated every 2 hours.'),
                    const SizedBox(height: 12),
                    _buildInfoItem('3', 'Rebate earnings don\'t have a corresponding mining task queue display. They are calculated automatically on a scheduled basis.'),
                    const SizedBox(height: 12),
                    _buildInfoItem('4', 'Invite more friends to get more rebate earnings. All your friends\' mining revenue will contribute to your rebate calculation.'),
                    const SizedBox(height: 12),
                    _buildInfoItem('5', 'Successfully inviting more friends can increase your points, which can upgrade your miner level and mining speed.'),
                    const SizedBox(height: 12),
                    _buildInfoItem('6', 'How to successfully invite and bind friends: Copy and share your "My Invitation Code" with friends. After your friends install and open the app, they enter your Invitation Code, and the system will successfully bind the invitation relationship.'),
                    const SizedBox(height: 12),
                    _buildInfoItem('7', 'For each friend you successfully invite and bind, you will receive an "Invite Friend Reward" mining contract.'),
                    const SizedBox(height: 12),
                    _buildInfoItem('8', 'Enter your referrer\'s Invitation Code to receive a "Bind Referrer Reward" mining contract.'),
                  ],
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text(
                'Got it',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        );
      },
    ).then((_) => scrollController.dispose());
  }

  Widget _buildInfoItem(String number, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.2),
            shape: BoxShape.circle,
            border: Border.all(
              color: AppColors.primary,
              width: 1.5,
            ),
          ),
          child: Center(
            child: Text(
              number,
              style: const TextStyle(
                color: AppColors.primary,
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 14,
              color: Colors.white70,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Invite Friends'),
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline),
            onPressed: _showHelpDialog,
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            
            // Total Rebate Earnings Card
            _buildRebateCard(),
            
            const SizedBox(height: 16),
            
            // Invitation Code Card
            _buildInvitationCodeCard(context),
            
            const SizedBox(height: 20),
            
            // Invited Friends
            _buildInvitedFriends(),
            
            const SizedBox(height: 20),
            
            // Rebate Records
            _buildRebateRecords(),
            
            const SizedBox(height: 20),
            
            // Add Referrer Button (if no referrer yet) - Moved to bottom
            _buildAddReferrerButton(),
            
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildAddReferrerButton() {
    // 如果正在加载，不显示按钮
    if (_isLoading) {
      return const SizedBox.shrink();
    }
    
    // 如果已有推荐人，显示推荐人信息
    if (_hasReferrer) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              AppColors.primary.withOpacity(0.15),
              AppColors.secondary.withOpacity(0.15),
            ],
          ),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.primary.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.check_circle,
                  color: Colors.green,
                  size: 20,
                ),
                const SizedBox(width: 8),
                const Text(
                  'Referrer Bound',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Colors.green,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'You have already bound a referrer.\nYour referrer\'s invitation code is:',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.cardDark,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.primary.withOpacity(0.5)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      _referrerInvitationCode ?? 'Loading...',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                  if (_referrerInvitationCode != null)
                    IconButton(
                      icon: const Icon(Icons.copy, size: 20),
                      color: AppColors.primary,
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: _referrerInvitationCode!));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Referrer\'s invitation code copied!'),
                            backgroundColor: Colors.green,
                            duration: Duration(seconds: 2),
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
          ],
        ),
      );
    }
    
    // 如果没有推荐人，显示添加推荐人按钮
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              AppColors.primary.withOpacity(0.1),
              AppColors.secondary.withOpacity(0.1),
            ],
          ),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.primary.withOpacity(0.5)),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: _showAddReferrerDialog,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.card_giftcard,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Add Referrer\'s Invitation Code',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Get a FREE 2-hour mining contract!',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.arrow_forward_ios,
                    color: AppColors.primary,
                    size: 16,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRebateCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFFA500), // 橙黄色
            Color(0xFF4CAF50), // 绿色
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFA500).withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.people_alt_outlined,
                color: Colors.white.withOpacity(0.9),
                size: 24,
              ),
              const SizedBox(width: 8),
              const Text(
                'Total Rebate Earnings',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  '20%',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                double.tryParse(_totalRebate)?.toStringAsFixed(18) ?? '0.000000000000000000',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 4),
              const Text(
                'BTC',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    // Check if it's the Today's Earnings stat
    final isTodayEarnings = label == "Today's Earnings";
    
    return Flexible(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 4),
          isTodayEarnings
              ? Row(
                  children: [
                    Text(
                      value,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Text(
                      'BTC',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                )
              : Text(
                  value,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
        ],
      ),
    );
  }

  Widget _buildInvitationCodeCard(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'My Invitation Code',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: AppColors.primary,
                width: 1,
              ),
            ),
            child: Center(
              child: _isLoading
                  ? const CircularProgressIndicator(color: AppColors.primary)
                  : Text(
                      _invitationCode,
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _copyInvitationCode,
                  icon: const Icon(Icons.copy, size: 18),
                  label: const Text('Copy'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  key: _shareButtonKey,
                  onPressed: _shareInvitationCode,
                  icon: const Icon(Icons.share, size: 18),
                  label: const Text('Share'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: BorderSide(color: AppColors.primary),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInvitedFriends() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Invited Friends',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                'Total: $_invitedCount',
                style: TextStyle(
                  color: AppColors.primary, // 改成橙黄色
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _invitedUsersList.isEmpty
              ? Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 32),
                  decoration: BoxDecoration(
                    color: AppColors.cardDark,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.person_add_outlined,
                        size: 48,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'No invited friends yet',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                )
              : Container(
                  height: 140,
                  decoration: BoxDecoration(
                    color: AppColors.cardDark,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Scrollbar(
                    controller: _invitedListScrollController,
                    thumbVisibility: true,
                    child: ListView.builder(
                    controller: _invitedListScrollController,
                    itemCount: _invitedUsersList.length,
                    itemBuilder: (context, index) {
                      final user = _invitedUsersList[index];
                      final userId = user['user_id'] ?? 'N/A';
                      final creationTime = user['invitation_creation_time'] ?? '';
                      
                      // 格式化时间（精确到秒）
                      String formattedTime = '';
                      if (creationTime.isNotEmpty) {
                        try {
                          final dateTime = DateTime.parse(creationTime).toUtc();
                          formattedTime = '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')} ${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}:${dateTime.second.toString().padLeft(2, '0')} UTC';
                        } catch (e) {
                          formattedTime = creationTime;
                        }
                      }
                      
                      return Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        child: Row(
                          children: [
                            // 用户图标
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: AppColors.primary.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Icon(
                                Icons.person,
                                size: 18,
                                color: AppColors.primary,
                              ),
                            ),
                            const SizedBox(width: 12),
                            // 用户信息
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    userId,
                                    style: TextStyle(
                                      color: AppColors.textPrimary,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (formattedTime.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      formattedTime,
                                      style: TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  ),
                ),
        ],
      ),
    );
  }

  Widget _buildRebateRecords() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(
                    'Rebate Records',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'Last 3 Days',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
              TextButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const TransactionHistoryScreen(initialTab: 3),
                    ),
                  );
                },
                child: Text(
                  'View All',
                  style: TextStyle(color: AppColors.primary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_isLoadingRebate && _rebateList.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 40),
              decoration: BoxDecoration(
                color: AppColors.cardDark,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            )
          else if (_rebateList.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 32),
              decoration: BoxDecoration(
                color: AppColors.cardDark,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.receipt_long_outlined,
                    size: 48,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'No rebate records in the last 3 days',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Rebates are calculated every 2 hours\nbased on your friends\' ad mining earnings',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textSecondary.withOpacity(0.7),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            )
          else
            Container(
              height: 220,
              decoration: BoxDecoration(
                color: AppColors.cardDark,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Scrollbar(
                controller: _rebateListScrollController,
                thumbVisibility: true,
                child: ListView.builder(
                  controller: _rebateListScrollController,
                  itemCount: _rebateList.length,
                  itemBuilder: (context, index) {
                    final record = _rebateList[index];
                    final subUserId = record['subordinate_user_id'] ?? 'Unknown';
                    final amount = double.tryParse(
                            record['subordinate_rebate_amount']?.toString() ?? '0') ??
                        0.0;
                    final creationTime = record['rebate_creation_time'] ?? '';

                    String formattedTime = '';
                    if (creationTime.isNotEmpty) {
                      try {
                        final dt = DateTime.parse(creationTime).toUtc();
                        formattedTime =
                            '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} '
                            '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}:${dt.second.toString().padLeft(2, '0')} UTC';
                      } catch (_) {
                        formattedTime = creationTime;
                      }
                    }

                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        border: index < _rebateList.length - 1
                            ? Border(
                                bottom: BorderSide(
                                  color: AppColors.textSecondary.withOpacity(0.15),
                                  width: 0.5,
                                ),
                              )
                            : null,
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: Colors.orange.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Icon(
                              Icons.person,
                              size: 18,
                              color: Colors.orange,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // user_id 独占第一行，确保完整显示
                                Text(
                                  subUserId,
                                  style: TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                // 时间独占第二行
                                if (formattedTime.isNotEmpty) ...[  
                                  Text(
                                    formattedTime,
                                    style: TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 11,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                ],
                                // 金额独占第三行，避免溢出
                                Text(
                                  '+${amount.toStringAsFixed(18)} BTC',
                                  style: const TextStyle(
                                    color: Colors.orange,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
          if (_rebateTotal > _rebateList.length)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Center(
                child: TextButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const TransactionHistoryScreen(initialTab: 3),
                      ),
                    );
                  },
                  child: Text(
                    'View all $_rebateTotal records →',
                    style: TextStyle(color: AppColors.primary, fontSize: 13),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
