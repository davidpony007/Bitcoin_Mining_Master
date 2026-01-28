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
  bool _isLoading = false;
  String? _errorMessage;
  List<Transaction> _transactions = [];
  bool _isOfflineMode = false; // 离线模式标记
  
  StreamSubscription? _connectivitySubscription;

  // Getters
  String? get userId => _userId;
  String get bitcoinBalance => _bitcoinBalance;
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
        _setError('离线模式：数据将在网络恢复后同步');
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
    // 检查是否有网络连接
    final hasConnection = results.any((result) => 
      result == ConnectivityResult.mobile || 
      result == ConnectivityResult.wifi ||
      result == ConnectivityResult.ethernet
    );
    
    if (hasConnection && _isOfflineMode) {
      print('📡 网络已恢复，开始同步离线用户数据...');
      await _syncOfflineData();
    } else if (!hasConnection && !_isOfflineMode) {
      print('📴 网络断开连接');
      _setError('网络连接已断开，使用离线模式');
      Fluttertoast.showToast(
        msg: '网络连接错误，请重试！',
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.CENTER,
      );
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
    if (result.isSuccess) {
      _bitcoinBalance = result.data!;
      print('🔍 Provider: 余额已更新为: $_bitcoinBalance');
      _errorMessage = null;
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
    super.dispose();
  }
}
