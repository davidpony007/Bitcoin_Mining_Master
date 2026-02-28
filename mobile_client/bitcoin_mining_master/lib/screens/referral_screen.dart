import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import '../services/user_repository.dart';

/// 推荐屏幕 - Invite with rebate earnings
class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key});

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> {
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

  @override
  void initState() {
    super.initState();
    _loadInvitationData();
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
        
        // 4. 获取邀请关系信息（被邀请人数）
        _loadInvitationInfo(userId);
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
      Clipboard.setData(ClipboardData(text: _invitationCode));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Invitation code copied!'),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  void _shareInvitationCode() {
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
      final String shareText = '''
🎁 Join Bitcoin Mining Master!

Use my invitation code to get a FREE 2-hour mining contract:

📋 Code: $_invitationCode

Start earning Bitcoin today! 💰
Download now and start mining!
''';
      
      Share.share(
        shareText,
        subject: 'Join Bitcoin Mining Master - Free Mining Contract!',
      );
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
        // 更新状态：已有推荐人
        setState(() {
          _hasReferrer = true;
        });
        
        // 创建免费广告合约
        await _createAdContract(userId);
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(response['message'] ?? 'Referrer added successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        
        // 重新加载数据
        _loadInvitationData();
        
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
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        title: const Text('Rebate System Info'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
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
      ),
    );
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
                double.tryParse(_totalRebate)?.toStringAsFixed(15) ?? '0.000000000000000',
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
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: _invitedUsersList.length,
                    itemBuilder: (context, index) {
                      final user = _invitedUsersList[index];
                      final invitationCode = user['invitation_code'] ?? 'N/A';
                      final creationTime = user['invitation_creation_time'] ?? '';
                      
                      // 格式化时间（精确到秒）
                      String formattedTime = '';
                      if (creationTime.isNotEmpty) {
                        try {
                          final dateTime = DateTime.parse(creationTime);
                          formattedTime = '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')} ${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}:${dateTime.second.toString().padLeft(2, '0')}';
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
                                    invitationCode,
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
              Text(
                'Rebate Records',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              TextButton(
                onPressed: () {},
                child: Text(
                  'View All',
                  style: TextStyle(color: AppColors.primary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
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
                  'No rebate records',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
