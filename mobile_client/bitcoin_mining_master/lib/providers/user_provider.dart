import 'package:flutter/foundation.dart';
import 'package:fluttertoast/fluttertoast.dart';
import '../models/user_model.dart';
import '../services/user_repository.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'dart:async';

/// 用户Provider - 对应Kotlin的ViewModel
class UserProvider with ChangeNotifier {
  final UserRepository _repository = UserRepository();
  final StorageService _storageService = StorageService();
  final Connectivity _connectivity = Connectivity();
  
  // 用户数据
  String? _userId;
  String _bitcoinBalance = '0.000000000000000';
  double _miningSpeedPerSecond = 0.0;  // 每秒挖矿速率
  DateTime? _lastBalanceUpdateTime;     // 上次后端更新时间
  bool _isLoading = false;
  String? _errorMessage;
  List<Transaction> _transactions = [];
  int _transactionTotal = 0;
  bool _transactionHasMore = false;
  bool _isLoadingMoreTransactions = false;
  bool _isOfflineMode = false; // 离线模式标记
  Timer? _offlineDebounce; // 防抖：避免短暂断连立即弹 Toast
  bool _isFetchingBalance = false; // 防止余额并发请求
  
  StreamSubscription? _connectivitySubscription;

  // Getters
  String? get userId => _userId;
  double get miningSpeedPerSecond => _miningSpeedPerSecond;

  String get bitcoinBalance {
    // 如果有挖矿速率，计算实时余额（使用毫秒精度，避免整数秒的离散跳变）
    if (_miningSpeedPerSecond > 0 && _lastBalanceUpdateTime != null) {
      final baseBalance = double.tryParse(_bitcoinBalance) ?? 0.0;
      final secondsElapsed = DateTime.now().difference(_lastBalanceUpdateTime!).inMilliseconds / 1000.0;
      final minedAmount = _miningSpeedPerSecond * secondsElapsed;
      final currentBalance = baseBalance + minedAmount;
      return currentBalance.toStringAsFixed(15);
    }
    return (double.tryParse(_bitcoinBalance) ?? 0.0).toStringAsFixed(15);
  }
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<Transaction> get transactions => _transactions;
  int get transactionTotal => _transactionTotal;
  bool get transactionHasMore => _transactionHasMore;
  bool get isLoadingMoreTransactions => _isLoadingMoreTransactions;
  bool get isOfflineMode => _isOfflineMode;

  /// 初始化用户数据
  Future<void> initializeUser() async {
    _setLoading(true);
    
    // 检查是否是离线用户
    _isOfflineMode = _storageService.isOfflineUser();
    
    // 获取用户ID（有网络则通过API创建，无网络则生成离线临时ID）
    final userIdResult = await _repository.fetchUserId();
    if (userIdResult.isSuccess) {
      _userId = userIdResult.data;
      
      // 更新离线模式状态
      _isOfflineMode = _storageService.isOfflineUser();
      
      if (_isOfflineMode) {
        print('⚠️ 当前为离线模式，等待网络恢复后将自动同步');
        _setError('Offline mode: Data will be synced after network recovery');
      }
    } else {
      _setError('Initialization failed: ${userIdResult.error}');
    }
    
    // 获取余额（离线模式下使用缓存数据）
    await fetchBitcoinBalance();
    
    // 开始监听网络状态变化
    _startNetworkMonitoring();
    
    _setLoading(false);
  }

  /// 开始监听网络状态变化
  void _startNetworkMonitoring() {
    _connectivitySubscription = _connectivity.onConnectivityChanged.listen((result) {
      _onConnectivityChanged(result);
    });
  }

  /// 网络状态变化回调
  Future<void> _onConnectivityChanged(List<ConnectivityResult> results) async {
    // 检查是否有网络连接（包含 VPN 场景）
    final hasConnection = results.any((result) => 
      result == ConnectivityResult.mobile || 
      result == ConnectivityResult.wifi ||
      result == ConnectivityResult.ethernet ||
      result == ConnectivityResult.vpn
    );
    
    if (hasConnection && _isOfflineMode) {
      // 网络恢复：取消待触发的离线提示，开始同步
      _offlineDebounce?.cancel();
      _offlineDebounce = null;
      print('📡 网络已恢复，开始同步离线用户数据...');
      await _syncOfflineData();
    } else if (!hasConnection && !_isOfflineMode) {
      print('📴 检测到网络变化，等待4秒确认...');
      // 防抖 4 秒：短暂切换网络（如 VPN 重连、信号切换）不弹 Toast
      // 注意：静默窗口为 6 秒，防抖必须 < 静默窗口，否则防抖触发时窗口已过期
      _offlineDebounce?.cancel();
      _offlineDebounce = Timer(const Duration(seconds: 4), () {
        final inWindow = ApiService.isInResumeSilenceWindow;
        print('📴 [Provider] 防抖触发，inSilenceWindow=$inWindow');
        _setError('Network connection lost, using offline mode');
        // 连接变化由 Provider 状态处理，不弹 Toast 打扰用户
        // (VPN 切换 / 信号切换 / 后台恢复等场景均会触发此回调，toast 体验差)
      });
    }
  }

  /// 同步离线数据到后端
  Future<void> _syncOfflineData() async {
    try {
      // 重新获取用户ID（会触发同步逻辑）
      final userIdResult = await _repository.fetchUserId();
      if (userIdResult.isSuccess) {
        _userId = userIdResult.data;
        _isOfflineMode = _storageService.isOfflineUser();
        
        if (!_isOfflineMode) {
          print('✅ 离线数据同步成功！');
          _errorMessage = null;
          
          // 同步成功后刷新数据
          await fetchBitcoinBalance();
          
          notifyListeners();
        }
      }
    } catch (e) {
      print('❌ 同步离线数据失败: $e');
    }
  }

  /// 获取比特币余额
  Future<void> fetchBitcoinBalance() async {
    if (_isFetchingBalance) return; // 防止并发请求
    _isFetchingBalance = true;
    _setLoading(true);
    try {
    
    print('🔍 Provider: 开始获取余额...');
    // 记录上次的余额和时间，用于在 speedPerSecond=0 时推导本地速率
    final prevBalance = double.tryParse(_bitcoinBalance) ?? 0.0;
    final prevFetchTime = _lastBalanceUpdateTime;
    
    final result = await _repository.fetchBitcoinBalance();
    print('🔍 Provider: 获取结果: ${result.isSuccess}, data=${result.data}');
    if (result.isSuccess && result.data != null) {
      // 从响应中提取完整信息
      final response = result.data as BitcoinBalanceResponse;
      final newBalance = double.tryParse(response.balance) ?? 0.0;
      _bitcoinBalance = response.balance;
      
      // 关键修复：用本地 DateTime.now() 作为基准时间点。
      // 服务端返回的 balance 是"服务端 lastUpdateTime + elapsedSeconds"的累计值。
      // 若用服务端 lastUpdateTime 做基准，getter 会把已计算的 elapsedSeconds 再重算一遍，导致
      // 余额虚高，并在下次 fetch 时出现"跳降"现象。
      _lastBalanceUpdateTime = DateTime.now();
      
      if (response.speedPerSecond > 0) {
        _miningSpeedPerSecond = response.speedPerSecond;
      } else if (prevFetchTime != null && newBalance > prevBalance) {
        // 后端暂时返回 speedPerSecond=0（激活后约 30-45 秒内常见），
        // 但余额已在增加 → 从增量推导本地速率，保持 100ms 平滑动画连续。
        // 
        // ⚠️ 关键约束：elapsedSec 必须 >= 3 秒，否则不进行推导。
        // 原因：_refreshBalanceAfterMiningStart 每 800ms 重试一次，当余额从 0 首次跳变时
        // elapsedSec ≈ 0.8s，此时 derivedSpeed = delta / 0.8 ≫ 真实速率，
        // 会导致 100ms timer 快速累加使显示值超出真实余额，下次 fetch 时发生"回退"。
        // elapsedSec >= 3s 确保只有常规 10s 周期的 fetch 才执行推导，速率计算准确。
        final elapsedSec =
            DateTime.now().difference(prevFetchTime).inMilliseconds / 1000.0;
        if (elapsedSec >= 3.0) {
          _miningSpeedPerSecond = (newBalance - prevBalance) / elapsedSec;
          print('🔍 Provider: 速率推导: ($newBalance - $prevBalance) / ${elapsedSec}s = $_miningSpeedPerSecond BTC/秒');
        }
        // elapsedSec < 3s（属于 800ms 重试期间）：不更新速率，保持 0 或上次值
      } else {
        _miningSpeedPerSecond = 0.0;
      }
      
      print('🔍 Provider: 余额已更新为: $_bitcoinBalance');
      print('🔍 Provider: 挖矿速率: $_miningSpeedPerSecond BTC/秒');
      _errorMessage = null;
      notifyListeners(); // 通知UI更新
    } else {
      _setError('Failed to get balance: ${result.error}');
    }
    
    } finally {
      _isFetchingBalance = false;
      _setLoading(false);
    }
  }

  /// 获取交易记录（第一页，替换现有数据）
  Future<void> fetchTransactions() async {
    _setLoading(true);
    
    final result = await _repository.fetchTransactions(limit: 20, offset: 0);
    if (result.isSuccess) {
      final data = result.data!;
      _transactions = (data['records'] as List).cast<Transaction>();
      _transactionTotal = (data['total'] as int?) ?? 0;
      _transactionHasMore = (data['hasMore'] as bool?) ?? false;
      _errorMessage = null;
    } else {
      _setError('Failed to get transaction records: ${result.error}');
    }
    
    _setLoading(false);
  }

  /// 加载更多交易记录（追加到现有数据）
  Future<void> loadMoreTransactions() async {
    if (_isLoadingMoreTransactions || !_transactionHasMore) return;
    _isLoadingMoreTransactions = true;
    notifyListeners();

    final result = await _repository.fetchTransactions(
      limit: 20,
      offset: _transactions.length,
    );
    if (result.isSuccess) {
      final data = result.data!;
      _transactions = List.from(_transactions)
        ..addAll((data['records'] as List).cast<Transaction>());
      _transactionTotal = (data['total'] as int?) ?? _transactionTotal;
      _transactionHasMore = (data['hasMore'] as bool?) ?? false;
    }

    _isLoadingMoreTransactions = false;
    notifyListeners();
  }

  /// 提现
  Future<bool> withdrawBitcoin(
    String amount, 
    String address,
    String network,
    String networkFee,
  ) async {
    _setLoading(true);
    
    final result = await _repository.withdrawBitcoin(
      amount, 
      address,
      network,
      networkFee,
    );
    
    _setLoading(false);
    
    if (result.isSuccess) {
      _errorMessage = null;
      // 刷新余额
      await fetchBitcoinBalance();
      return true;
    } else {
      final raw = result.error?.toString() ?? 'Withdrawal failed';
      final msg = raw.startsWith('Exception: ') ? raw.substring(11) : raw;
      _setError(msg);
      return false;
    }
  }

  /// 设置加载状态
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  /// 设置错误信息
  void _setError(String error) {
    _errorMessage = error;
    notifyListeners();
  }

  /// 清除错误信息
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  /// 释放资源
  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    _offlineDebounce?.cancel();
    super.dispose();
  }
}
