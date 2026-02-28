/// 积分相关数据模型
library;

/// 积分余额
class PointsBalance {
  final int totalPoints;
  final int availablePoints;
  final DateTime? lastUpdated;

  PointsBalance({
    required this.totalPoints,
    required this.availablePoints,
    this.lastUpdated,
  });

  factory PointsBalance.fromJson(Map<String, dynamic> json) {
    final totalPoints = json['total_points'] ?? json['totalPoints'] ?? 0;
    final availablePoints = json['available_points'] ?? json['availablePoints'] ?? totalPoints;
    return PointsBalance(
      totalPoints: totalPoints,
      availablePoints: availablePoints,
      lastUpdated: json['last_updated'] != null
          ? DateTime.tryParse(json['last_updated'])
          : null,
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
      points: json['points_change'] ?? json['points'] ?? 0,
      type: json['points_type'] ?? json['type'] ?? 'UNKNOWN',
      description: json['description'] ?? json['reason'],
      createdAt: DateTime.parse(json['created_at']),
    );
  }

  String get typeDisplay {
    switch (type) {
      case 'AD_VIEW':
        return 'Watch Ads';
      case 'DAILY_CHECKIN':
        return 'Daily Check-in';
      case 'REFERRAL_1':
        return 'Referral Reward';
      case 'REFERRAL_10':
        return 'Referral Milestone';
      case 'SUBORDINATE_AD_VIEW':
        return 'Subordinate Ads';
      case 'CUMULATIVE_CHECKIN_3':
        return '3-Day Cumulative';
      case 'CUMULATIVE_CHECKIN_7':
        return '7-Day Cumulative';
      case 'CUMULATIVE_CHECKIN_15':
        return '15-Day Cumulative';
      case 'CUMULATIVE_CHECKIN_30':
        return '30-Day Cumulative';
      case 'MANUAL_ADD':
        return 'Manual Add';
      case 'MANUAL_DEDUCT':
        return 'Points Deducted';
      default:
        return type;
    }
  }
}

/// 积分统计
class PointsStatistics {
  final int currentPoints;
  final int availablePoints;
  final int totalEarned;
  final int totalSpent;
  final List<PointsTypeStat> items;

  PointsStatistics({
    required this.currentPoints,
    required this.availablePoints,
    required this.totalEarned,
    required this.totalSpent,
    required this.items,
  });

  factory PointsStatistics.fromJson(Map<String, dynamic> json) {
    final currentPointsJson = json['currentPoints'] as Map<String, dynamic>? ?? {};
    final statistics = (json['statistics'] as List<dynamic>? ?? [])
        .map((item) => PointsTypeStat.fromJson(item as Map<String, dynamic>))
        .toList();

    final totalEarned = statistics.fold<int>(0, (sum, item) => sum + item.totalEarned);
    final totalSpent = statistics.fold<int>(0, (sum, item) => sum + item.totalSpent);

    return PointsStatistics(
      currentPoints: currentPointsJson['totalPoints'] ?? 0,
      availablePoints: currentPointsJson['availablePoints'] ?? 0,
      totalEarned: totalEarned,
      totalSpent: totalSpent,
      items: statistics,
    );
  }
}

/// 积分统计条目
class PointsTypeStat {
  final String type;
  final int totalEarned;
  final int totalSpent;
  final int transactionCount;

  PointsTypeStat({
    required this.type,
    required this.totalEarned,
    required this.totalSpent,
    required this.transactionCount,
  });

  factory PointsTypeStat.fromJson(Map<String, dynamic> json) {
    return PointsTypeStat(
      type: json['points_type'] ?? 'UNKNOWN',
      totalEarned: json['total_earned'] ?? 0,
      totalSpent: json['total_spent'] ?? 0,
      transactionCount: json['transaction_count'] ?? 0,
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
      rank: json['rank'] ?? 0,
    );
  }
}
