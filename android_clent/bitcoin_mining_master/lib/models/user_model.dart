
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
    return DeviceLoginResponse(
      success: json['success'] as bool? ?? false,
      isNewUser: json['isNewUser'] as bool? ?? false,
      message: json['message'] as String? ?? '',
      data: json['data'] != null ? UserData.fromJson(json['data']) : null,
      referrer: json['referrer'] != null ? ReferrerData.fromJson(json['referrer']) : null,
      token: json['token'] as String?,
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
      userId: json['user_id'] as String,
      invitationCode: json['invitation_code'] as String,
      email: json['email'] as String?,
      googleAccount: json['google_account'] as String?,
      androidId: json['android_id'] as String,
      gaid: json['gaid'] as String?,
      registerIp: json['register_ip'] as String?,
      country: json['country'] as String?,
      userLevel: json['user_level'] as int?,
      userPoints: json['user_points'] as int?,
      miningSpeedMultiplier: json['mining_speed_multiplier'] != null 
        ? double.tryParse(json['mining_speed_multiplier'].toString())
        : null,
      countryMultiplier: json['country_multiplier'] != null
        ? double.tryParse(json['country_multiplier'].toString())
        : null,
      createdAt: json['created_at'] != null 
        ? DateTime.tryParse(json['created_at'] as String) 
        : null,
      updatedAt: json['updated_at'] != null
        ? DateTime.tryParse(json['updated_at'] as String)
        : null,
      lastLoginTime: json['last_login_time'] != null 
        ? DateTime.tryParse(json['last_login_time'] as String) 
        : null,
      userCreationTime: json['user_creation_time'] != null
        ? DateTime.tryParse(json['user_creation_time'] as String)
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
      userId: json['user_id'] as String,
      invitationCode: json['invitation_code'] as String,
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
  final String? message;

  BitcoinBalanceResponse({
    required this.success,
    required this.balance,
    this.message,
  });

  factory BitcoinBalanceResponse.fromJson(Map<String, dynamic> json) {
    return BitcoinBalanceResponse(
      success: json['success'] as bool? ?? false,
      balance: json['balance'] as String? ?? '0.00000000',
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
  final String id;
  final String userId;
  final String type;
  final String amount;
  final String description;
  final DateTime createdAt;

  Transaction({
    required this.id,
    required this.userId,
    required this.type,
    required this.amount,
    required this.description,
    required this.createdAt,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      type: json['type'] as String? ?? 'income',
      amount: json['amount'] as String? ?? '0.00000000',
      description: json['description'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'type': type,
      'amount': amount,
      'description': description,
      'createdAt': createdAt.toIso8601String(),
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
