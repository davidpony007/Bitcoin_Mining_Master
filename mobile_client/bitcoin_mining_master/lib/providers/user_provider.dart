import 'package:flutter/foundation.dart';
import 'package:fluttertoast/fluttertoast.dart';
import '../models/user_model.dart';
import '../services/user_repository.dart';
import '../services/storage_service.dart';
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
  bool _isOfflineMode = false; // 离线模式标记
  Timer? _offlineDebounce; // 防抖：避免短暂断连立即弹 Toast
  
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
      print('📴 检测到网络变化，等待3秒确认...');
      // 防抖 3 秒：短暂切换网络（如 VPN 重连、信号切换）不弹 Toast
      _offlineDebounce?.cancel();
      _offlineDebounce = Timer(const Duration(seconds: 3), () {
        _setError('Network connection lost, using offline mode');
        Fluttertoast.showToast(
          msg: 'Network connection error, please try again!',
          toastLength: Toast.LENGTH_SHORT,
          gravity: ToastGravity.CENTER,
        );
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
    _setLoading(true);
    
    print('🔍 Provider: 开始获取余额...');
    final result = await _repository.fetchBitcoinBalance();
    print('🔍 Provider: 获取结果: ${result.isSuccess}, data=${result.data}');
    if (result.isSuccess && result.data != null) {
      // 从响应中提取完整信息
      final response = result.data as BitcoinBalanceResponse;
      _bitcoinBalance = response.balance;
      _miningSpeedPerSecond = response.speedPerSecond;
      _lastBalanceUpdateTime = response.lastUpdateTime;
      
      print('🔍 Provider: 余额已更新为: $_bitcoinBalance');
      print('🔍 Provider: 挖矿速率: $_miningSpeedPerSecond BTC/秒');
      _errorMessage = null;
      notifyListeners(); // 通知UI更新
    } else {
      _setError('Failed to get balance: ${result.error}');
    }
    
    _setLoading(false);
  }

  /// 获取交易记录
  Future<void> fetchTransactions() async {
    _setLoading(true);
    
    final result = await _repository.fetchTransactions();
    if (result.isSuccess) {
      _transactions = result.data!;
      _errorMessage = null;
    } else {
      _setError('Failed to get transaction records: ${result.error}');
    }
    
    _setLoading(false);
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
      _setError('Withdrawal failed: ${result.error}');
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
