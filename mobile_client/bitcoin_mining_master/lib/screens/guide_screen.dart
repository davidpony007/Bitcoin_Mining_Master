import 'package:flutter/material.dart';
import '../constants/app_constants.dart';

/// App Usage Guide Screen
/// Comprehensive walkthrough of all features for new and existing users.
class GuideScreen extends StatefulWidget {
  /// If [autoShow] is true the screen shows a "Got it" button instead of a
  /// back arrow — useful for the first-launch flow.
  final bool autoShow;

  const GuideScreen({super.key, this.autoShow = false});

  @override
  State<GuideScreen> createState() => _GuideScreenState();
}

class _GuideScreenState extends State<GuideScreen> {
  final ScrollController _scrollController = ScrollController();

  // Current highlighted section index (for the side TOC dots)
  int _activeSection = 0;

  // Section anchor keys
  final List<GlobalKey> _sectionKeys = List.generate(6, (_) => GlobalKey());

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    for (int i = _sectionKeys.length - 1; i >= 0; i--) {
      final ctx = _sectionKeys[i].currentContext;
      if (ctx == null) continue;
      final box = ctx.findRenderObject() as RenderBox?;
      if (box == null) continue;
      final pos = box.localToGlobal(Offset.zero);
      if (pos.dy < MediaQuery.of(context).size.height * 0.55) {
        if (_activeSection != i) setState(() => _activeSection = i);
        break;
      }
    }
  }

  void _scrollToSection(int index) {
    final ctx = _sectionKeys[index].currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(ctx,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOut,
        alignment: 0.05);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          // ── Main scrollable content ──────────────────────────────────────
          CustomScrollView(
            controller: _scrollController,
            slivers: [
              _buildHeroHeader(context),
              SliverPadding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    // Sections
                    _SectionContainer(
                      sectionKey: _sectionKeys[0],
                      child: _buildOverviewSection(),
                    ),
                    const SizedBox(height: 24),
                    _SectionContainer(
                      sectionKey: _sectionKeys[1],
                      child: _buildMiningSection(),
                    ),
                    const SizedBox(height: 24),
                    _SectionContainer(
                      sectionKey: _sectionKeys[2],
                      child: _buildContractsSection(),
                    ),
                    const SizedBox(height: 24),
                    _SectionContainer(
                      sectionKey: _sectionKeys[3],
                      child: _buildReferralSection(),
                    ),
                    const SizedBox(height: 24),
                    _SectionContainer(
                      sectionKey: _sectionKeys[4],
                      child: _buildWalletSection(),
                    ),
                    const SizedBox(height: 24),
                    _SectionContainer(
                      sectionKey: _sectionKeys[5],
                      child: _buildLevelSection(),
                    ),
                    const SizedBox(height: 24),
                    const SizedBox(height: 8),

                    // "Got it" / Done button
                    if (widget.autoShow)
                      _buildGotItButton(context)
                    else
                      const SizedBox(height: 8),
                    const SizedBox(height: 48),
                  ]),
                ),
              ),
            ],
          ),

          // ── Right-side TOC dots ──────────────────────────────────────────
          Positioned(
            right: 6,
            top: 0,
            bottom: 0,
            child: Center(child: _buildTocDots()),
          ),
        ],
      ),
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Hero Header
  // ────────────────────────────────────────────────────────────────────────
  Widget _buildHeroHeader(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 200,
      pinned: true,
      centerTitle: false,
      backgroundColor: AppColors.background,
      leading: widget.autoShow
          ? const SizedBox.shrink()
          : IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              onPressed: () => Navigator.of(context).pop(),
            ),
      flexibleSpace: FlexibleSpaceBar(
        centerTitle: false,
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF0D1117), Color(0xFF1A1F2E), Color(0xFF0D1117)],
            ),
          ),
          child: Stack(
            children: [
              // Decorative glowing circles
              Positioned(
                top: -30,
                right: -30,
                child: Container(
                  width: 160,
                  height: 160,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.primary.withOpacity(0.08),
                  ),
                ),
              ),
              Positioned(
                bottom: -20,
                left: -20,
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFF6366F1).withOpacity(0.08),
                  ),
                ),
              ),
              // Content
              Align(
                alignment: Alignment.center,
                child: Padding(
                  padding: const EdgeInsets.only(top: 32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [
                              AppColors.primary.withOpacity(0.9),
                              AppColors.primary.withOpacity(0.4),
                            ],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withOpacity(0.4),
                              blurRadius: 20,
                              spreadRadius: 4,
                            ),
                          ],
                        ),
                        child: const Icon(Icons.menu_book_rounded,
                            color: Colors.white, size: 30),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'How to Use',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Bitcoin Mining Master — Complete Guide',
                        style: TextStyle(
                          color: Colors.white54,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        title: const Text(
          'App Guide',
          style: TextStyle(color: Colors.white, fontSize: 17),
        ),
        titlePadding: const EdgeInsetsDirectional.only(start: 56, bottom: 14),
      ),
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // TOC dots
  // ────────────────────────────────────────────────────────────────────────
  Widget _buildTocDots() {
    final labels = ['Intro', 'Mine', 'Contracts', 'Refer', 'Wallet', 'Level'];
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(labels.length, (i) {
        final active = _activeSection == i;
        return GestureDetector(
          onTap: () => _scrollToSection(i),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: active ? 8 : 5,
              height: active ? 8 : 5,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color:
                    active ? AppColors.primary : Colors.white.withOpacity(0.25),
              ),
            ),
          ),
        );
      }),
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Got it button (first-launch)
  // ────────────────────────────────────────────────────────────────────────
  Widget _buildGotItButton(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: ElevatedButton(
        onPressed: () => Navigator.of(context).pop(),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 52),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 4,
          shadowColor: AppColors.primary.withOpacity(0.4),
        ),
        child: const Text(
          "Got it — Let's Start Mining!",
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Section 0 — Overview
  // ────────────────────────────────────────────────────────────────────────
  Widget _buildOverviewSection() {
    return _GuideSection(
      icon: Icons.rocket_launch,
      iconColor: AppColors.primary,
      title: 'Welcome to Bitcoin Mining Master',
      subtitle: 'Earn real BTC rewards through virtual cloud mining',
      children: [
        _HighlightBox(
          color: AppColors.primary.withOpacity(0.12),
          borderColor: AppColors.primary.withOpacity(0.4),
          child: const Text(
            'Bitcoin Mining Master simulates cloud mining. You allocate virtual '
            'hashrate; your active contracts generate BTC earnings every minute, and '
            'you can withdraw real Bitcoin to your wallet.',
            style: TextStyle(color: Colors.white70, fontSize: 13.5, height: 1.6),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'The app has 5 main tabs:',
          style: TextStyle(
              color: Colors.white60, fontSize: 13, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 10),
        _QuickNavRow(items: const [
          _QuickNavItem(icon: Icons.dashboard, label: 'Mining', color: Color(0xFFFF9800)),
          _QuickNavItem(icon: Icons.assignment, label: 'Contracts', color: Color(0xFF6366F1)),
          _QuickNavItem(icon: Icons.share, label: 'Referral', color: Color(0xFF22C55E)),
          _QuickNavItem(icon: Icons.account_balance_wallet, label: 'Wallet', color: Color(0xFF06B6D4)),
          _QuickNavItem(icon: Icons.settings, label: 'Settings', color: Color(0xFF94A3B8)),
        ]),
      ],
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Section 1 — Mining Dashboard
  // ────────────────────────────────────────────────────────────────────────
  Widget _buildMiningSection() {
    return _GuideSection(
      icon: Icons.dashboard,
      iconColor: const Color(0xFFFF9800),
      title: 'Mining Tab',
      subtitle: 'Your command center for real-time BTC earnings',
      children: [
        _StepList(steps: const [
          _Step(
            number: '1',
            title: 'Check your balance',
            body:
                'The top card shows your current BTC balance in real-time. '
                'It ticks upward every minute as your active contracts mine.',
          ),
          _Step(
            number: '2',
            title: 'Activate mining batteries',
            body:
                'Each battery slot represents one hour of mining time. '
                'A lit battery means it has power. '
                'The more batteries you have, the longer your mining runs.',
          ),
          _Step(
            number: '3',
            title: 'Watch Ads for Bonus Hashrate',
            body:
                'Tap the "Free Ad Mining" button to earn a temporary hashrate boost. '
                'You can watch multiple ads per day for extra rewards.',
          ),
          _Step(
            number: '4',
            title: 'Daily Check-in',
            body:
                'Tap the "Daily Check-in Reward" button to check in and activate your daily mining task. '
                'You can only check in once per day — resets at 00:00 UTC. '
                'Each check-in earns 4 points; consecutive check-ins earn additional bonus points.',
          ),
          _Step(
            number: '5',
            title: 'Monitor Bitcoin price',
            body:
                'Live BTC/USD price updates automatically. Your earnings are '
                'denominated in BTC.',

          ),
        ]),
        const SizedBox(height: 12),
        _InfoChip(
          icon: Icons.tips_and_updates,
          text: 'Tip: Keep the app running in the background — '
              'your contracts continue mining even when you lock your screen.',
        ),
      ],
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Section 2 — Contracts
  // ────────────────────────────────────────────────────────────────────────
  Widget _buildContractsSection() {
    return _GuideSection(
      icon: Icons.assignment,
      iconColor: const Color(0xFF6366F1),
      title: 'Contracts Tab',
      subtitle: 'Manage and grow your mining speed',
      children: [
        _StepList(steps: const [
          _Step(
            number: '①',
            title: 'Claim your free contract',
            body:
                'View the status and remaining time of all your free contracts.',
          ),
          _Step(
            number: '②',
            title: 'Buy a contract to speed up mining',
            body:
                'Tap "Buy Contract" to purchase a subscription plan. '
                'Multiple tiers are available — higher plans provide '
                'greater hashrate for faster BTC accumulation.',
          ),

          _Step(
            number: '③',
            title: 'Track expiry dates',
            body:
                'Each contract card shows remaining days. Renew before expiry '
                'to avoid interrupting your mining streak.',
          ),
        ]),
      ],
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Section 3 — Referral
  // ────────────────────────────────────────────────────────────────────────
  Widget _buildReferralSection() {
    return _GuideSection(
      icon: Icons.share,
      iconColor: const Color(0xFF22C55E),
      title: 'Referral Tab',
      subtitle: 'Invite friends and earn referral rebate',
      children: [
        _HighlightBox(
          color: const Color(0xFF22C55E).withOpacity(0.1),
          borderColor: const Color(0xFF22C55E).withOpacity(0.35),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.card_giftcard, color: Color(0xFF22C55E), size: 18),
                const SizedBox(width: 8),
                const Text('Referral Rewards',
                    style: TextStyle(
                        color: Color(0xFF22C55E),
                        fontWeight: FontWeight.bold,
                        fontSize: 14)),
              ]),
              const SizedBox(height: 8),
              const Text(
                'Every time a friend signs up using your invitation code, '
                'both of you receive a free mining contract as a reward.',
                style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _StepList(steps: const [
          _Step(
            number: '1',
            title: 'Get your invite code',
            body:
                'Open the Referral tab — your unique invitation code is shown at '
                'the top. Tap it to copy.',
          ),
          _Step(
            number: '2',
            title: 'Share it',
            body:
                'Tap the "Share" button to share via WhatsApp, Telegram, SMS, or '
                'any messaging app.',
          ),
          _Step(
            number: '3',
            title: 'Earn when they join',
            body:
                'When your friend registers and enters your code, a reward '
                'contract is instantly added to your account. '
                'You will continuously receive 20% of the Bitcoin earnings from their free contracts.',
          ),
          _Step(
            number: '4',
            title: 'No limit on referrals',
            body:
                'There\'s no cap — invite as many friends as you like and '
                'stack unlimited bonus contracts.',
          ),
        ]),
      ],
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Section 4 — Wallet & Withdrawal
  // ────────────────────────────────────────────────────────────────────────
  Widget _buildWalletSection() {
    return _GuideSection(
      icon: Icons.account_balance_wallet,
      iconColor: const Color(0xFF06B6D4),
      title: 'Wallet Tab',
      subtitle: 'Track earnings and withdraw BTC to your wallet',
      children: [
        _StepList(steps: const [
          _Step(
            number: '1',
            title: 'View your BTC balance',
            body:
                'The Wallet tab shows your total accumulated BTC and a full '
                'history of every transaction — earnings, rewards, and withdrawals.',
          ),
          _Step(
            number: '2',
            title: 'Reach the minimum threshold',
            body:
                'You need at least 0.00002200 BTC before you can withdraw. '
                'Keep mining to reach the threshold.',
          ),
          _Step(
            number: '3',
            title: 'Add your withdrawal address',
            body:
                'Before withdrawing, bind your BEP-20 wallet address '
                'or Binance UID in the withdrawal form.',
          ),
          _Step(
            number: '4',
            title: 'Submit withdrawal',
            body:
                'Enter the amount, confirm the network fee (0.00000028 BTC for '
                'BEP-20), and tap "Withdraw". Funds are processed within 24–72 hours.',
          ),
        ]),
        const SizedBox(height: 12),
        _HighlightBox(
          color: const Color(0xFFF59E0B).withOpacity(0.1),
          borderColor: const Color(0xFFF59E0B).withOpacity(0.4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.warning_amber_rounded,
                  color: Color(0xFFF59E0B), size: 18),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Bind your account first! You must sign in with '
                  'Google (Android) or Apple (iOS) before submitting a withdrawal. '
                  'This verifies your identity and secures your funds.',
                  style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Section 5 — User Level
  // ────────────────────────────────────────────────────────────────────────
  Widget _buildLevelSection() {
    return _GuideSection(
      icon: Icons.military_tech,
      iconColor: const Color(0xFFF59E0B),
      title: 'User Levels & Points',
      subtitle: 'Level up to unlock higher mining efficiency',
      children: [
        _LevelProgressVisual(),
        const SizedBox(height: 16),
        _StepList(steps: const [
          _Step(
            number: '✦',
            title: 'Earn points daily',
            body:
                'Check in, watch ads, purchase contracts, and invite friends — '
                'each action earns you points.',
          ),
          _Step(
            number: '✦',
            title: 'Level up automatically',
            body:
                'When your points reach the next threshold, you level up. '
                'Higher levels increase your base hashrate multiplier.',
          ),
          _Step(
            number: '✦',
            title: 'Rate the app for bonus points',
            body:
                'Go to Settings → Support Us. Leaving a 5-star review earns you '
                'a one-time points bonus.',
          ),
        ]),
      ],
    );
  }

}

// ════════════════════════════════════════════════════════════════════════════
// Reusable sub-widgets
// ════════════════════════════════════════════════════════════════════════════

class _SectionContainer extends StatelessWidget {
  final GlobalKey sectionKey;
  final Widget child;
  const _SectionContainer({required this.sectionKey, required this.child});

  @override
  Widget build(BuildContext context) {
    return KeyedSubtree(key: sectionKey, child: child);
  }
}

// ── Guide Section card ──────────────────────────────────────────────────────
class _GuideSection extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final List<Widget> children;

  const _GuideSection({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0F1624),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.07), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
            decoration: BoxDecoration(
              border: Border(
                  bottom: BorderSide(
                      color: Colors.white.withOpacity(0.06), width: 1)),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: iconColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: iconColor, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold)),
                      const SizedBox(height: 2),
                      Text(subtitle,
                          style: const TextStyle(
                              color: Colors.white54, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Body
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: children),
          ),
        ],
      ),
    );
  }
}

// ── Highlight box ───────────────────────────────────────────────────────────
class _HighlightBox extends StatelessWidget {
  final Color color;
  final Color borderColor;
  final Widget child;

  const _HighlightBox(
      {required this.color, required this.borderColor, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderColor, width: 1),
      ),
      child: child,
    );
  }
}

// ── Step list ───────────────────────────────────────────────────────────────
class _StepList extends StatelessWidget {
  final List<_Step> steps;
  const _StepList({required this.steps});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: steps
          .map((s) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _buildStep(s),
              ))
          .toList(),
    );
  }

  Widget _buildStep(_Step s) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 26,
          height: 26,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.18),
            shape: BoxShape.circle,
            border: Border.all(
                color: AppColors.primary.withOpacity(0.5), width: 1),
          ),
          child: Text(s.number,
              style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 11,
                  fontWeight: FontWeight.bold)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(s.title,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w600)),
              const SizedBox(height: 3),
              Text(s.body,
                  style: const TextStyle(
                      color: Colors.white60, fontSize: 13, height: 1.5)),
            ],
          ),
        ),
      ],
    );
  }
}

class _Step {
  final String number;
  final String title;
  final String body;
  const _Step({required this.number, required this.title, required this.body});
}

// ── Quick nav row ────────────────────────────────────────────────────────────
class _QuickNavRow extends StatelessWidget {
  final List<_QuickNavItem> items;
  const _QuickNavRow({required this.items});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: items
          .map((item) => Column(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: item.color.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: item.color.withOpacity(0.4), width: 1),
                    ),
                    child: Icon(item.icon, color: item.color, size: 22),
                  ),
                  const SizedBox(height: 5),
                  Text(item.label,
                      style: const TextStyle(
                          color: Colors.white54, fontSize: 10)),
                ],
              ))
          .toList(),
    );
  }
}

class _QuickNavItem {
  final IconData icon;
  final String label;
  final Color color;
  const _QuickNavItem(
      {required this.icon, required this.label, required this.color});
}

// ── Info chip ────────────────────────────────────────────────────────────────
class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoChip({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: const Color(0xFF06B6D4), size: 16),
        const SizedBox(width: 6),
        Expanded(
          child: Text(text,
              style: const TextStyle(
                  color: Color(0xFF06B6D4), fontSize: 12, height: 1.5)),
        ),
      ],
    );
  }
}

// ── Level progress visual ────────────────────────────────────────────────────
class _LevelProgressVisual extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final levels = [
      ('Lv.1', 'Novice',    const Color(0xFF94A3B8)),
      ('Lv.2', 'Junior',    const Color(0xFF22C55E)),
      ('Lv.3', 'Interm.',   const Color(0xFF06B6D4)),
      ('Lv.4', 'Senior',    const Color(0xFF3B82F6)),
      ('Lv.5', 'Expert',    const Color(0xFFFF9800)),
      ('Lv.6', 'Master',    const Color(0xFFF59E0B)),
      ('Lv.7', 'Legendary', const Color(0xFFEC4899)),
      ('Lv.8', 'Epic',      const Color(0xFFEF4444)),
      ('Lv.9', 'Mythic',    const Color(0xFFFFD700)),
    ];
    Widget item((String, String, Color) l) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: l.$3.withOpacity(0.15),
              border: Border.all(color: l.$3.withOpacity(0.5), width: 1.5),
            ),
            child: Center(
              child: Text(l.$1,
                  style: TextStyle(
                      color: l.$3,
                      fontSize: 10,
                      fontWeight: FontWeight.bold)),
            ),
          ),
          const SizedBox(height: 5),
          Text(l.$2,
              style: const TextStyle(color: Colors.white38, fontSize: 9.5)),
        ],
      );
    }

    final rows = <Widget>[];
    for (int i = 0; i < levels.length; i += 3) {
      final slice = levels.sublist(i, (i + 3).clamp(0, levels.length));
      rows.add(Row(
        children: slice
            .map((l) => Expanded(child: Center(child: item(l))))
            .toList(),
      ));
      if (i + 3 < levels.length) rows.add(const SizedBox(height: 10));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: rows,
    );
  }
}


