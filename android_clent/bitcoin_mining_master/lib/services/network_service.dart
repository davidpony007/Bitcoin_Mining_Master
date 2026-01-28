import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import '../constants/app_constants.dart';

/// 网络连接检查服务
class NetworkService {
  static final NetworkService _instance = NetworkService._internal();
  factory NetworkService() => _instance;
  NetworkService._internal();

  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  
  // 网络状态监听器
  final List<Function(bool isConnected)> _listeners = [];

  /// 初始化网络监听
  void initialize() {
    _connectivitySubscription = _connectivity.onConnectivityChanged.listen((results) {
      final isConnected = !results.contains(ConnectivityResult.none);
      _notifyListeners(isConnected);
    });
  }

  /// 添加监听器
  void addListener(Function(bool isConnected) listener) {
    _listeners.add(listener);
  }

  /// 移除监听器
  void removeListener(Function(bool isConnected) listener) {
    _listeners.remove(listener);
  }

  /// 通知所有监听器
  void _notifyListeners(bool isConnected) {
    for (var listener in _listeners) {
      listener(isConnected);
    }
  }

  /// 检查网络连接是否可用
  Future<bool> isConnected() async {
    try {
      final results = await _connectivity.checkConnectivity();
      return !results.contains(ConnectivityResult.none);
    } catch (e) {
      print('❌ 网络检查失败: $e');
      return false;
    }
  }

  /// 检查是否能连接到后端服务器
  /// timeout: 超时时间（秒）
  Future<bool> canReachBackend({int timeout = 5}) async {
    try {
      // 先检查基础网络连接
      final hasConnection = await isConnected();
      if (!hasConnection) {
        return false;
      }

      // 尝试访问已有的公开接口
      final dio = Dio(BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: Duration(seconds: timeout),
        receiveTimeout: Duration(seconds: timeout),
      ));

      final response = await dio.get('/bitcoin/price');
      return response.statusCode == 200;
    } catch (e) {
      print('❌ 无法连接到后端服务器: $e');
      return false;
    }
  }

  /// 销毁服务
  void dispose() {
    _connectivitySubscription?.cancel();
    _listeners.clear();
  }
}
