import 'package:json_annotation/json_annotation.dart';

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
