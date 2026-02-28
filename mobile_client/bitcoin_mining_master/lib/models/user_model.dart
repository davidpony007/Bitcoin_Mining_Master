
/// 设备登录响应模型 - 对应后端 /api/auth/device-login
class DeviceLoginResponse {
  final bool success;
  final bool isNewUser;
  final String message;
  final UserData? data;
  final ReferrerData? referrer;
  final String? token;

  DeviceLoginResponse({
    required this.success,
    required this.isNewUser,
    required this.message,
    this.data,
    this.referrer,
    this.token,
  });

  factory DeviceLoginResponse.fromJson(Map<String, dynamic> json) {
    bool parseBool(dynamic value) {
      if (value is bool) return value;
      if (value is String) {
        final normalized = value.toLowerCase();
        return normalized == 'true' || normalized == '1';
      }
      if (value is num) return value != 0;
      return false;
    }

    return DeviceLoginResponse(
      success: parseBool(json['success']),
      isNewUser: parseBool(json['isNewUser']),
      message: json['message']?.toString() ?? '',
      data: json['data'] is Map<String, dynamic>
          ? UserData.fromJson(json['data'] as Map<String, dynamic>)
          : null,
      referrer: json['referrer'] is Map<String, dynamic>
          ? ReferrerData.fromJson(json['referrer'] as Map<String, dynamic>)
          : null,
      token: json['token']?.toString(),
    );
  }
}

/// 用户数据模型
class UserData {
  final String userId;
  final String invitationCode;
  final String? email;
  final String? googleAccount;
  final String androidId;
  final String? gaid;
  final String? registerIp;
  final String? country;
  final int? userLevel;
  final int? userPoints;
  final double? miningSpeedMultiplier;
  final double? countryMultiplier;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? lastLoginTime;
  final DateTime? userCreationTime;

  UserData({
    required this.userId,
    required this.invitationCode,
    this.email,
    this.googleAccount,
    required this.androidId,
    this.gaid,
    this.registerIp,
    this.country,
    this.userLevel,
    this.userPoints,
    this.miningSpeedMultiplier,
    this.countryMultiplier,
    this.createdAt,
    this.updatedAt,
    this.lastLoginTime,
    this.userCreationTime,
  });

  factory UserData.fromJson(Map<String, dynamic> json) {
    return UserData(
      userId: json['user_id']?.toString() ?? '',
      invitationCode: json['invitation_code']?.toString() ?? '',
      email: json['email']?.toString(),
      googleAccount: json['google_account']?.toString(),
      androidId: json['android_id']?.toString() ?? '',
      gaid: json['gaid']?.toString(),
      registerIp: json['register_ip']?.toString(),
      country: json['country']?.toString(),
      userLevel: json['user_level'] as int?,
      userPoints: json['user_points'] as int?,
      miningSpeedMultiplier: json['miner_level_multiplier'] != null 
        ? double.tryParse(json['miner_level_multiplier'].toString())
        : null,
      countryMultiplier: json['country_multiplier'] != null
        ? double.tryParse(json['country_multiplier'].toString())
        : null,
      createdAt: json['created_at'] != null 
        ? DateTime.tryParse(json['created_at'].toString()) 
        : null,
      updatedAt: json['updated_at'] != null
        ? DateTime.tryParse(json['updated_at'].toString())
        : null,
      lastLoginTime: json['last_login_time'] != null 
        ? DateTime.tryParse(json['last_login_time'].toString()) 
        : null,
      userCreationTime: json['user_creation_time'] != null
        ? DateTime.tryParse(json['user_creation_time'].toString())
        : null,
    );
  }
}

/// 邀请人数据模型
class ReferrerData {
  final String userId;
  final String invitationCode;

  ReferrerData({
    required this.userId,
    required this.invitationCode,
  });

  factory ReferrerData.fromJson(Map<String, dynamic> json) {
    return ReferrerData(
      userId: json['user_id']?.toString() ?? '',
      invitationCode: json['invitation_code']?.toString() ?? '',
    );
  }
}

/// 用户ID响应模型
class UserIdResponse {
  final bool success;
  final String userId;
  final String? message;

  UserIdResponse({
    required this.success,
    required this.userId,
    this.message,
  });

  factory UserIdResponse.fromJson(Map<String, dynamic> json) {
    return UserIdResponse(
      success: json['success'] as bool? ?? false,
      userId: json['userId'] as String? ?? '',
      message: json['message'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'userId': userId,
      'message': message,
    };
  }
}

/// 比特币余额响应模型
class BitcoinBalanceResponse {
  final bool success;
  final String balance;
  final double speedPerSecond;  // 每秒挖矿速率
  final DateTime lastUpdateTime; // 上次更新时间
  final String? message;

  BitcoinBalanceResponse({
    required this.success,
    required this.balance,
    this.speedPerSecond = 0.0,
    DateTime? lastUpdateTime,
    this.message,
  }) : lastUpdateTime = lastUpdateTime ?? DateTime.now();

  factory BitcoinBalanceResponse.fromJson(Map<String, dynamic> json) {
    // 处理实时余额API响应格式：{"success":true,"data":{"balance":0.000000139,"balanceInDb":0.0,"speedPerSecond":0.000000000000139,...}}
    if (json['data'] != null && json['data'] is Map) {
      final data = json['data'] as Map<String, dynamic>;
      // 使用 balance（实时余额，包含未持久化的挖矿收益）
      final balance = data['balance'] ?? data['currentBalance'];
      final speedPerSecond = (data['speedPerSecond'] ?? 0.0) is num 
          ? (data['speedPerSecond'] ?? 0.0).toDouble()
          : double.tryParse(data['speedPerSecond']?.toString() ?? '0') ?? 0.0;
      
      // CRITICAL: lastUpdateTime 是前端接收数据的时刻（作为本地计算的基准）
      // 后端的 balance 已经是实时计算好的值，我们以接收时刻为基准继续累加
      return BitcoinBalanceResponse(
        success: json['success'] as bool? ?? false,
        balance: balance?.toString() ?? '0.000000000000000',
        speedPerSecond: speedPerSecond,
        lastUpdateTime: DateTime.now(), // 前端接收时刻
        message: json['message'] as String?,
      );
    }
    
    // 兼容旧格式：{"success":true,"balance":"0.00000000"}
    return BitcoinBalanceResponse(
      success: json['success'] as bool? ?? false,
      balance: json['balance'] as String? ?? '0.000000000000000',
      speedPerSecond: 0.0,
      lastUpdateTime: DateTime.now(),
      message: json['message'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'balance': balance,
      'message': message,
    };
  }
}

/// 交易记录模型
class Transaction {
  final int id;
  final String userId;
  final String type;
  final double amount;
  final String typeLabel;
  final DateTime createdAt;
  final String status;

  Transaction({
    required this.id,
    required this.userId,
    required this.type,
    required this.amount,
    required this.typeLabel,
    required this.createdAt,
    required this.status,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] as int? ?? 0,
      userId: json['userId'] as String? ?? '',
      type: json['type'] as String? ?? '',
      amount: (json['amount'] is num) 
          ? (json['amount'] as num).toDouble() 
          : double.tryParse(json['amount'].toString()) ?? 0.0,
      typeLabel: json['typeLabel'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      status: json['status'] as String? ?? 'success',
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'type': type,
      'amount': amount,
      'typeLabel': typeLabel,
      'createdAt': createdAt.toIso8601String(),
      'status': status,
    };
  }
}

/// 用户模型
class User {
  final String userId;
  final String bitcoinBalance;
  final DateTime? createdAt;

  User({
    required this.userId,
    required this.bitcoinBalance,
    this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      userId: json['userId'] as String? ?? '',
      bitcoinBalance: json['bitcoinBalance'] as String? ?? '0.00000000',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'bitcoinBalance': bitcoinBalance,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  User copyWith({
    String? userId,
    String? bitcoinBalance,
    DateTime? createdAt,
  }) {
    return User(
      userId: userId ?? this.userId,
      bitcoinBalance: bitcoinBalance ?? this.bitcoinBalance,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
