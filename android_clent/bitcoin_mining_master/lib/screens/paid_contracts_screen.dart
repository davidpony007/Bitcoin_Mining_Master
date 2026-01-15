import 'package:flutter/material.dart';

class PaidContractsScreen extends StatefulWidget {
  const PaidContractsScreen({super.key});

  @override
  State<PaidContractsScreen> createState() => _PaidContractsScreenState();
}

class _PaidContractsScreenState extends State<PaidContractsScreen> {
  // 付费合约档位配置
  final List<Map<String, dynamic>> _contractTiers = [
    {
      'id': 'p0499',
      'price': 4.99,
      'name': 'Starter Plan',
      'duration': 30,
      'hashrate': '176.3 Gh/s',
      'dailyOutput': '0.00039398 BTC',
      'totalOutput': '0.01181952 BTC',
      'description': 'Perfect for beginners',
      'color': Color(0xFF4A90E2),
      'popular': false,
    },
    {
      'id': 'p0699',
      'price': 6.99,
      'name': 'Standard Plan',
      'duration': 30,
      'hashrate': '305.6 Gh/s',
      'dailyOutput': '0.00066661 BTC',
      'totalOutput': '0.01999872 BTC',
      'description': 'Most popular choice',
      'color': Color(0xFF50C878),
      'popular': true,
    },
    {
      'id': 'p0999',
      'price': 9.99,
      'name': 'Advanced Plan',
      'duration': 30,
      'hashrate': '611.2 Gh/s',
      'dailyOutput': '0.00133056 BTC',
      'totalOutput': '0.03991680 BTC',
      'description': 'For serious miners',
      'color': Color(0xFFFF6B35),
      'popular': false,
    },
    {
      'id': 'p1999',
      'price': 19.99,
      'name': 'Premium Plan',
      'duration': 30,
      'hashrate': '1326.4 Gh/s',
      'dailyOutput': '0.00289440 BTC',
      'totalOutput': '0.08683200 BTC',
      'description': 'Maximum hashrate power',
      'color': Color(0xFFFFD700),
      'popular': false,
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF16213E),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Mining Contracts',
          style: TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 页面标题和说明
            _buildHeaderSection(),
            const SizedBox(height: 24),

            // 合约列表
            ..._contractTiers.map((tier) => _buildContractCard(tier)),

            const SizedBox(height: 24),

            // 底部说明
            _buildFooterInfo(),
          ],
        ),
      ),
    );
  }

  // 顶部标题区域
  Widget _buildHeaderSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.rocket_launch,
                color: Colors.white,
                size: 32,
              ),
              const SizedBox(width: 12),
              const Text(
                'Boost Your Mining',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Choose a mining contract to increase your hashrate and maximize Bitcoin earnings',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 14,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  // 合约卡片
  Widget _buildContractCard(Map<String, dynamic> tier) {
    final bool isPopular = tier['popular'] ?? false;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F1624),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isPopular ? tier['color'] : Colors.transparent,
          width: 2,
        ),
        boxShadow: isPopular
            ? [
                BoxShadow(
                  color: (tier['color'] as Color).withOpacity(0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : [],
      ),
      child: Stack(
        children: [
          // 热门标签
          if (isPopular)
            Positioned(
              top: 0,
              right: 20,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: tier['color'],
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(8),
                    bottomRight: Radius.circular(8),
                  ),
                ),
                child: const Text(
                  '🔥 POPULAR',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),

          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 标题和价格
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tier['name'],
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            tier['description'],
                            style: const TextStyle(
                              color: Colors.white60,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '\$${tier['price'].toStringAsFixed(2)}',
                          style: TextStyle(
                            color: tier['color'],
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const Text(
                          '30 Days',
                          style: TextStyle(
                            color: Colors.white60,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // 算力信息
                _buildInfoRow(
                  icon: Icons.speed,
                  label: 'Hashrate',
                  value: tier['hashrate'],
                  color: tier['color'],
                ),
                const SizedBox(height: 12),

                // 每日产出
                _buildInfoRow(
                  icon: Icons.today,
                  label: 'Daily Output',
                  value: tier['dailyOutput'],
                  color: tier['color'],
                ),
                const SizedBox(height: 12),

                // 总产出
                _buildInfoRow(
                  icon: Icons.account_balance_wallet,
                  label: 'Total Output (30d)',
                  value: tier['totalOutput'],
                  color: tier['color'],
                ),

                const SizedBox(height: 20),

                // 购买按钮
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () => _handlePurchase(tier),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: tier['color'],
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: const Text(
                      'Purchase Contract',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
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

  // 信息行
  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Row(
      children: [
        Icon(
          icon,
          color: color,
          size: 20,
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 14,
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  // 底部说明信息
  Widget _buildFooterInfo() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F1624),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(
                Icons.info_outline,
                color: Color(0xFF6366F1),
                size: 20,
              ),
              SizedBox(width: 8),
              Text(
                'How it works',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildBulletPoint('Contract activates immediately after purchase'),
          _buildBulletPoint('Mining runs automatically for 30 days'),
          _buildBulletPoint('Daily earnings are added to your balance'),
          _buildBulletPoint('Withdraw anytime once balance reaches minimum'),
          _buildBulletPoint('No additional fees or hidden costs'),
        ],
      ),
    );
  }

  // 说明要点
  Widget _buildBulletPoint(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '• ',
            style: TextStyle(
              color: Color(0xFF6366F1),
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // 处理购买
  void _handlePurchase(Map<String, dynamic> tier) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF0F1624),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Row(
          children: [
            Icon(
              Icons.shopping_cart,
              color: tier['color'],
            ),
            const SizedBox(width: 12),
            const Text(
              'Confirm Purchase',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'You are about to purchase:',
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A2E),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tier['name'],
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Price: \$${tier['price'].toStringAsFixed(2)}',
                    style: TextStyle(
                      color: tier['color'],
                      fontSize: 14,
                    ),
                  ),
                  Text(
                    'Hashrate: ${tier['hashrate']}',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    'Duration: 30 days',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text(
              'Cancel',
              style: TextStyle(color: Colors.white60),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _processPurchase(tier);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: tier['color'],
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: const Text(
              'Confirm',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  // 处理支付流程
  void _processPurchase(Map<String, dynamic> tier) {
    // TODO: 实现支付逻辑
    // 1. 调用支付网关（Google Play, Stripe等）
    // 2. 支付成功后调用后端API创建合约
    // 3. 显示购买成功提示
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF0F1624),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Row(
          children: const [
            Icon(Icons.info_outline, color: Color(0xFF6366F1)),
            SizedBox(width: 12),
            Text(
              'Payment Integration',
              style: TextStyle(color: Colors.white, fontSize: 16),
            ),
          ],
        ),
        content: const Text(
          'Payment gateway integration will be added here.\n\nSupported methods:\n• Google Play Billing\n• Credit Card (Stripe)\n• Cryptocurrency',
          style: TextStyle(
            color: Colors.white70,
            fontSize: 14,
            height: 1.5,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text(
              'OK',
              style: TextStyle(color: Color(0xFF6366F1)),
            ),
          ),
        ],
      ),
    );
  }
}
