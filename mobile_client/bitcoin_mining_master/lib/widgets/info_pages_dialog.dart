import 'package:flutter/material.dart';
import '../constants/app_constants.dart';

/// 四合一说明弹窗：Miner Level System / Points Guide / Rebate System Info / Withdrawal Network
/// 支持左右滑动切换，默认打开第一页
///
/// 用法：
///   InfoPagesDialog.show(context);                    // 从 Miner Level 开始
///   InfoPagesDialog.show(context, initialPage: 1);    // 从 Points Guide 开始
///   InfoPagesDialog.show(context, initialPage: 2);    // 从 Rebate System 开始
///   InfoPagesDialog.show(context, initialPage: 3);    // 从 Withdrawal Network 开始
class InfoPagesDialog extends StatefulWidget {
  final int initialPage;
  const InfoPagesDialog({super.key, this.initialPage = 0});

  static void show(BuildContext context, {int initialPage = 0}) {
    showDialog(
      context: context,
      builder: (_) => InfoPagesDialog(initialPage: initialPage),
    );
  }

  @override
  State<InfoPagesDialog> createState() => _InfoPagesDialogState();
}

class _InfoPagesDialogState extends State<InfoPagesDialog> {
  late final PageController _pageController;
  late int _currentPage;

  static const _titles = [
    'Miner Level System',
    'Points Guide',
    'Rebate System Info',
    'Withdrawal Network',
  ];

  static const _icons = [
    Icons.stars,
    Icons.lightbulb_outline,
    Icons.help_outline,
    Icons.account_balance_wallet_outlined,
  ];

  @override
  void initState() {
    super.initState();
    _currentPage = widget.initialPage;
    _pageController = PageController(initialPage: widget.initialPage);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _goTo(int page) {
    _pageController.animateToPage(
      page,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.82,
        ),
        decoration: BoxDecoration(
          color: AppColors.cardDark,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ─── Header ───────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Row(
                children: [
                  Icon(_icons[_currentPage], color: AppColors.primary, size: 24),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _titles[_currentPage],
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: Icon(Icons.close, color: AppColors.textSecondary, size: 20),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
            ),

            // ─── Tab indicator ────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
              child: Row(
                children: List.generate(4, (i) {
                  final active = i == _currentPage;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => _goTo(i),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        margin: EdgeInsets.only(right: i < 3 ? 6 : 0),
                        height: 4,
                        decoration: BoxDecoration(
                          color: active
                              ? AppColors.primary
                              : AppColors.primary.withOpacity(0.25),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),

            // ─── Page content ─────────────────────────────────────────
            Flexible(
              child: PageView(
                controller: _pageController,
                onPageChanged: (p) => setState(() => _currentPage = p),
                children: const [
                  _MinerLevelPage(),
                  _PointsGuidePage(),
                  _RebateSystemPage(),
                  _WithdrawalNetworkPage(),
                ],
              ),
            ),

            // ─── Footer: prev / page hint / next / got it ─────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Row(
                children: [
                  // Prev arrow
                  _NavButton(
                    icon: Icons.chevron_left,
                    enabled: _currentPage > 0,
                    onTap: () => _goTo(_currentPage - 1),
                  ),
                  // Page number hint
                  Expanded(
                    child: Center(
                      child: Text(
                        '${_currentPage + 1} / 4',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                  // Next arrow (hidden on last page)
                  if (_currentPage < 3)
                    _NavButton(
                      icon: Icons.chevron_right,
                      enabled: true,
                      onTap: () => _goTo(_currentPage + 1),
                    )
                  else
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: Text(
                        'Got it',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;
  const _NavButton({required this.icon, required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: enabled
              ? AppColors.primary.withOpacity(0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          icon,
          color: enabled ? AppColors.primary : AppColors.textSecondary.withOpacity(0.3),
          size: 22,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 0 – Miner Level System
// ─────────────────────────────────────────────────────────────────────────────
class _MinerLevelPage extends StatelessWidget {
  const _MinerLevelPage();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _levelRow('LV.1', '0~20 Points', 'Base Mining Rate'),
          const SizedBox(height: 4),
          _levelRow('LV.2', 'Need 30 Points', 'Mining Rate +10%'),
          const SizedBox(height: 4),
          _levelRow('LV.3', 'Need 50 Points', 'Mining Rate +20%'),
          const SizedBox(height: 4),
          _levelRow('LV.4', 'Need 100 Points', 'Mining Rate +35%'),
          const SizedBox(height: 4),
          _levelRow('LV.5', 'Need 200 Points', 'Mining Rate +50%'),
          const SizedBox(height: 4),
          _levelRow('LV.6', 'Need 400 Points', 'Mining Rate +70%'),
          const SizedBox(height: 4),
          _levelRow('LV.7', 'Need 800 Points', 'Mining Rate +100%'),
          const SizedBox(height: 4),
          _levelRow('LV.8', 'Need 1600 Points', 'Mining Rate +140%'),
          const SizedBox(height: 4),
          _levelRow('LV.9', 'Max Level', 'Mining Rate +200%'),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              'Note: Points reset to 0 after each level up',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontStyle: FontStyle.italic,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _levelRow(String level, String points, String reward) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            width: 52,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.15),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.primary.withOpacity(0.3)),
            ),
            child: Text(
              level,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.primary,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  points,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  reward,
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 1 – Points Guide
// ─────────────────────────────────────────────────────────────────────────────
class _PointsGuidePage extends StatelessWidget {
  const _PointsGuidePage();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          _section('Free Ad Reward', Icons.play_circle_outline, [
            _item('Watch one ad', '+1 point, daily cap 20 points, resets at UTC+00:00'),
          ]),
          _divider(),
          _section('Referral Rewards', Icons.people_outline, [
            _item('Invite 1 friend\n(must complete 5 ad views)', '+6 points, unlimited'),
            _item('Invite 10 friends\n(each must complete 5 ad views)', 'Extra +30 points, unlimited'),
            _item('Each referred friend completes\n10 ad views', 'You get +1 point, unlimited'),
          ]),
          _divider(),
          _section('Daily Check-in Reward', Icons.calendar_today, [
            _item('Complete daily check-in', '+4 points, daily'),
            _item('Check in for 3 days\n(cumulative)', 'Extra +6 points, one-time'),
            _item('Check in for 7 days\n(cumulative)', 'Extra +15 points, one-time'),
            _item('Check in for 15 days\n(cumulative)', 'Extra +30 points, one-time'),
            _item('Check in for 30 days\n(cumulative)', 'Extra +60 points, one-time'),
          ]),
          _divider(),
          _section('App Rating Reward', Icons.star_outline, [
            _item('Rate the app on App Store / Google Play', '+10 points, one-time'),
          ]),
          _divider(),
          _section('Paid Subscription Reward', Icons.workspace_premium_outlined, [
            _item('Subscribe to any paid plan', '+20 points per tier'),
            _item(
              'Subscribe to all 4 different tiers\n(Starter / Standard / Advanced / Premium)',
              'Up to +80 points total',
            ),
          ]),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _divider() => Divider(height: 24, thickness: 1, color: Colors.white12);

  Widget _section(String title, IconData icon, List<Widget> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: AppColors.primary, size: 20),
            const SizedBox(width: 8),
            Text(
              title,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ...items,
      ],
    );
  }

  Widget _item(String action, String reward) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 5),
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: AppColors.primary,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  action,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    reward,
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 2 – Rebate System Info
// ─────────────────────────────────────────────────────────────────────────────
class _RebateSystemPage extends StatelessWidget {
  const _RebateSystemPage();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _infoItem('1', 'The rebate ratio is 20%.'),
          const SizedBox(height: 12),
          _infoItem('2', 'Rebates are updated every 2 hours.'),
          const SizedBox(height: 12),
          _infoItem('3',
              "Rebate earnings don't have a corresponding mining task queue display. They are calculated automatically on a scheduled basis."),
          const SizedBox(height: 12),
          _infoItem('4',
              "Invite more friends to get more rebate earnings. All your friends' mining revenue will contribute to your rebate calculation."),
          const SizedBox(height: 12),
          _infoItem('5',
              'Successfully inviting more friends can increase your points, which can upgrade your miner level and mining speed.'),
          const SizedBox(height: 12),
          _infoItem('6',
              'How to successfully invite and bind friends: Copy and share your "My Invitation Code" with friends. After your friends install and open the app, they enter your Invitation Code, and the system will successfully bind the invitation relationship.'),
          const SizedBox(height: 12),
          _infoItem('7',
              'For each friend you successfully invite and bind, you will receive an "Invite Friend Reward" mining contract.'),
          const SizedBox(height: 12),
          _infoItem('8',
              "Enter your referrer's Invitation Code to receive a \"Bind Referrer Reward\" mining contract."),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _infoItem(String number, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.2),
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.primary, width: 1.5),
          ),
          child: Center(
            child: Text(
              number,
              style: const TextStyle(
                color: AppColors.primary,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.45,
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 3 – Withdrawal Network
// ─────────────────────────────────────────────────────────────────────────────
class _WithdrawalNetworkPage extends StatelessWidget {
  const _WithdrawalNetworkPage();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Choose the right network to receive your BTC. Wrong network selection may result in permanent loss of funds.',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          _networkItem(
            icon: Icons.account_circle_outlined,
            badge: 'DEFAULT',
            badgeColor: AppColors.primary,
            title: 'Binance UID',
            description:
                'Transfer BTC directly to your Binance account using your Binance UID. No wallet address needed. Zero network fee. Recommended for Binance users.',
          ),
          const SizedBox(height: 12),
          _networkItem(
            icon: Icons.account_balance_wallet_outlined,
            badge: 'BEP20',
            badgeColor: const Color(0xFFF0A500),
            title: 'BNB Smart Chain (BEP20)',
            description:
                'Withdraw BTC to any BEP20-compatible wallet (e.g. Trust Wallet, MetaMask). The wallet address must start with "0x" and be exactly 42 characters. A small network fee of 0.00000028 BTC applies.',
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: AppColors.primary.withOpacity(0.3), width: 1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.help_outline_rounded,
                        color: AppColors.primary, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      'How to get my Binance UID?',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  '① Open Binance account and go to your Profile\n'
                  '② Your UID is displayed on the dashboard page\n'
                  '③ Tap the UID to copy it',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    height: 1.6,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _networkItem({
    required IconData icon,
    required String badge,
    required Color badgeColor,
    required String title,
    required String description,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white10, width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: AppColors.primary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: badgeColor.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(4),
                        border:
                            Border.all(color: badgeColor.withOpacity(0.5)),
                      ),
                      child: Text(
                        badge,
                        style: TextStyle(
                          color: badgeColor,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
