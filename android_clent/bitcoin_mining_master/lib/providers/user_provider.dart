import 'package:flutter/foundation.dart';
import '../models/user_model.dart';
import '../services/user_repository.dart';

/// 用户Provider - 对应Kotlin的ViewModel
class UserProvider with ChangeNotifier {
  final UserRepository _repository = UserRepository();
  
  // 用户数据
  String? _userId;
  String _bitcoinBalance = '0.000000000000000';
  bool _isLoading = false;
  String? _errorMessage;
  List<Transaction> _transactions = [];

  // Getters
  String? get userId => _userId;
  String get bitcoinBalance => _bitcoinBalance;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<Transaction> get transactions => _transactions;

  /// 初始化用户数据
  Future<void> initializeUser() async {
    _setLoading(true);
    
    // 获取用户ID
    final userIdResult = await _repository.fetchUserId();
    if (userIdResult.isSuccess) {
      _userId = userIdResult.data;
    } else {
      _setError('Initialization failed: ${userIdResult.error}');
    }
    
    // 获取余额
    await fetchBitcoinBalance();
    
    _setLoading(false);
  }

  /// 获取比特币余额
  Future<void> fetchBitcoinBalance() async {
    _setLoading(true);
    
    final result = await _repository.fetchBitcoinBalance();
    if (result.isSuccess) {
      _bitcoinBalance = result.data!;
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
      _setError('Failed to get transaction history: ${result.error}');
    }
    
    _setLoading(false);
  }

  /// 提现
  Future<bool> withdrawBitcoin(String amount, String address) async {
    _setLoading(true);
    
    final result = await _repository.withdrawBitcoin(amount, address);
    
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
}
