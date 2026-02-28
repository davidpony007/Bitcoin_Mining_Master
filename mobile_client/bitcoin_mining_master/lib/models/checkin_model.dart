/// 签到相关数据模型
library;

/// 签到状态
class CheckInStatus {
  final bool checkedInToday;
  final int totalDays;
  final DateTime? lastCheckInDate;
  final String? nextMilestone;
  final int? daysUntilMilestone;

  CheckInStatus({
    required this.checkedInToday,
    required this.totalDays,
    this.lastCheckInDate,
    this.nextMilestone,
    this.daysUntilMilestone,
  });

  factory CheckInStatus.fromJson(Map<String, dynamic> json) {
    // 支持多种字段名：cumulativeDays(新API), total_days, consecutive_days
    final totalDays = json['cumulativeDays'] ?? 
                     json['cumulative_days'] ?? 
                     json['total_days'] ?? 
                     json['consecutive_days'] ?? 
                     0;
    
    // 支持多种字段名：hasCheckedInToday(新API), checked_in_today
    final checkedInToday = json['hasCheckedInToday'] ?? 
                          json['has_checked_in_today'] ?? 
                          json['checked_in_today'] ?? 
                          false;
    
    print('📦 [CheckInStatus.fromJson] totalDays=$totalDays, checkedInToday=$checkedInToday, json=$json');
    
    return CheckInStatus(
      checkedInToday: checkedInToday,
      totalDays: totalDays,
      lastCheckInDate: json['last_check_in_date'] != null
          ? DateTime.parse(json['last_check_in_date'])
          : null,
      nextMilestone: json['next_milestone'] ?? json['nextMilestone'],
      daysUntilMilestone: json['days_until_milestone'] ?? json['daysUntilMilestone'],
    );
  }
}

/// 签到记录
class CheckInRecord {
  final int id;
  final String userId;
  final DateTime checkInDate;
  final int totalDays;
  final int pointsAwarded;
  final DateTime createdAt;

  CheckInRecord({
    required this.id,
    required this.userId,
    required this.checkInDate,
    required this.totalDays,
    required this.pointsAwarded,
    required this.createdAt,
  });

  factory CheckInRecord.fromJson(Map<String, dynamic> json) {
    return CheckInRecord(
      id: json['id'],
      userId: json['user_id'],
      checkInDate: DateTime.parse(json['check_in_date']),
      totalDays: json['total_days'] ?? json['cumulative_days'] ?? 0,
      pointsAwarded: json['points_awarded'],
      createdAt: DateTime.parse(json['created_at']),
    );
  }
}

/// 签到里程碑
class CheckInMilestone {
  final int days;
  final int bonusPoints;
  final bool claimed;
  final bool claimable;

  CheckInMilestone({
    required this.days,
    required this.bonusPoints,
    required this.claimed,
    required this.claimable,
  });

  factory CheckInMilestone.fromJson(Map<String, dynamic> json) {
    return CheckInMilestone(
      days: json['days'],
      bonusPoints: json['bonus_points'],
      claimed: json['claimed'] ?? false,
      claimable: json['claimable'] ?? false,
    );
  }
}

/// 签到结果
class CheckInResult {
  final bool success;
  final String message;
  final int totalDays;
  final int pointsAwarded;
  final bool milestoneReached;
  final int? milestoneBonus;

  CheckInResult({
    required this.success,
    required this.message,
    required this.totalDays,
    required this.pointsAwarded,
    required this.milestoneReached,
    this.milestoneBonus,
  });

  factory CheckInResult.fromJson(Map<String, dynamic> json) {
    return CheckInResult(
      success: json['success'] ?? false,
      message: json['message'] ?? '',
      totalDays: json['total_days'] ?? json['cumulative_days'] ?? 0,
      pointsAwarded: json['points_awarded'] ?? 0,
      milestoneReached: json['milestone_reached'] ?? false,
      milestoneBonus: json['milestone_bonus'],
    );
  }
}
