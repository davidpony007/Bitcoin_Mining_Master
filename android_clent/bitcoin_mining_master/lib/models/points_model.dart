/// 积分相关数据模型
library;

/// 积分余额
class PointsBalance {
  final int totalPoints;
  final DateTime lastUpdated;

  PointsBalance({
    required this.totalPoints,
    required this.lastUpdated,
  });

  factory PointsBalance.fromJson(Map<String, dynamic> json) {
    return PointsBalance(
      totalPoints: json['total_points'] ?? 0,
      lastUpdated: DateTime.parse(json['last_updated']),
    );
  }
}

/// 积分交易记录
class PointsTransaction {
  final int id;
  final String userId;
  final int points;
  final String type;
  final String? description;
  final DateTime createdAt;

  PointsTransaction({
    required this.id,
    required this.userId,
    required this.points,
    required this.type,
    this.description,
    required this.createdAt,
  });

  factory PointsTransaction.fromJson(Map<String, dynamic> json) {
    return PointsTransaction(
      id: json['id'],
      userId: json['user_id'],
      points: json['points'],
      type: json['type'],
      description: json['description'],
      createdAt: DateTime.parse(json['created_at']),
    );
  }

  String get typeDisplay {
    switch (type) {
      case 'ad_view':
        return 'Watch Ads';
      case 'check_in':
        return 'Daily Check-in';
      case 'referral':
        return 'Referral Reward';
      case 'subordinate_ad':
        return 'Subordinate Ads';
      case 'milestone':
        return 'Milestone Reward';
      case 'deduct':
        return 'Points Deducted';
      default:
        return type;
    }
  }
}

/// 积分统计
class PointsStatistics {
  final Map<String, int> byType;
  final int totalEarned;

  PointsStatistics({
    required this.byType,
    required this.totalEarned,
  });

  factory PointsStatistics.fromJson(Map<String, dynamic> json) {
    final byTypeRaw = json['by_type'] as Map<String, dynamic>;
    final byType = byTypeRaw.map((key, value) => MapEntry(key, value as int));
    
    return PointsStatistics(
      byType: byType,
      totalEarned: json['total_earned'] ?? 0,
    );
  }
}

/// 排行榜用户
class LeaderboardUser {
  final String userId;
  final int totalPoints;
  final int rank;

  LeaderboardUser({
    required this.userId,
    required this.totalPoints,
    required this.rank,
  });

  factory LeaderboardUser.fromJson(Map<String, dynamic> json) {
    return LeaderboardUser(
      userId: json['user_id'],
      totalPoints: json['total_points'],
      rank: json['rank'],
    );
  }
}
