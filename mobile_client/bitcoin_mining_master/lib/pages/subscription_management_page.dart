import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../services/google_play_billing_service.dart';
import '../services/storage_service.dart';
import 'package:url_launcher/url_launcher.dart';

/// 订阅管理页面
/// 用户可以查看活跃订阅、管理订阅状态、取消订阅等
class SubscriptionManagementPage extends StatefulWidget {
  @override
  _SubscriptionManagementPageState createState() => _SubscriptionManagementPageState();
}

class _SubscriptionManagementPageState extends State<SubscriptionManagementPage> {
  final GooglePlayBillingService _billingService = GooglePlayBillingService();
  bool _isLoading = true;
  List<PurchaseDetails> _activeSubscriptions = [];

  // 订阅详情映射
  final Map<String, Map<String, dynamic>> _subscriptionDetails = {
    'mining_starter_monthly': {
      'name': '入门订阅',
      'hashrate': '176.3 Gh/s',
      'icon': '🌟',
      'color': Colors.blue,
    },
    'mining_standard_monthly': {
      'name': '标准订阅',
      'hashrate': '305.6 Gh/s',
      'icon': '💎',
      'color': Colors.purple,
    },
    'mining_advanced_monthly': {
      'name': '进阶订阅',
      'hashrate': '611.2 Gh/s',
      'icon': '🚀',
      'color': Colors.orange,
    },
    'mining_premium_monthly': {
      'name': '高级订阅',
      'hashrate': '1326.4 Gh/s',
      'icon': '👑',
      'color': Colors.amber,
    },
  };

  @override
  void initState() {
    super.initState();
    _loadSubscriptions();
  }

  Future<void> _loadSubscriptions() async {
    setState(() => _isLoading = true);
    
    try {
      final storageService = StorageService();
      await storageService.init();
      _billingService.userId = storageService.getUserId();

      await _billingService.init();
      final subscriptions = await _billingService.getActiveSubscriptions();
      setState(() {
        _activeSubscriptions = subscriptions;
        _isLoading = false;
      });
      
      print('✅ 加载了 ${subscriptions.length} 个活跃订阅');
    } catch (e) {
      print('❌ 加载订阅失败: $e');
      setState(() => _isLoading = false);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('加载订阅失败: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('订阅管理'),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _isLoading ? null : _loadSubscriptions,
          ),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _buildContent(),
    );
  }

  Widget _buildContent() {
    if (_activeSubscriptions.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.sentiment_dissatisfied,
              size: 64,
              color: Colors.grey,
            ),
            SizedBox(height: 16),
            Text(
              '暂无活跃订阅',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade700,
              ),
            ),
            SizedBox(height: 8),
            Text(
              '订阅可获得持续的挖矿收益',
              style: TextStyle(color: Colors.grey),
            ),
            SizedBox(height: 24),
            ElevatedButton.icon(
              icon: Icon(Icons.shopping_bag),
              label: Text('前往购买'),
              onPressed: () {
                Navigator.pop(context);
              },
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        // 顶部提示
        Container(
          padding: EdgeInsets.all(16),
          color: Colors.green.shade50,
          child: Row(
            children: [
              Icon(Icons.check_circle, color: Colors.green),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  '您有 ${_activeSubscriptions.length} 个活跃订阅',
                  style: TextStyle(
                    color: Colors.green.shade900,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
        
        // 订阅列表
        Expanded(
          child: ListView.builder(
            padding: EdgeInsets.all(16),
            itemCount: _activeSubscriptions.length,
            itemBuilder: (context, index) {
              final subscription = _activeSubscriptions[index];
              return _buildSubscriptionCard(subscription);
            },
          ),
        ),
        
        // 底部说明
        Container(
          padding: EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            border: Border(
              top: BorderSide(color: Colors.grey.shade300),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '订阅说明',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              SizedBox(height: 8),
              _buildInfoRow(Icons.info_outline, '订阅将在每月自动续订'),
              _buildInfoRow(Icons.cancel, '取消订阅后仍可使用至当期结束'),
              _buildInfoRow(Icons.settings, '在Google Play管理所有订阅'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSubscriptionCard(PurchaseDetails subscription) {
    final details = _subscriptionDetails[subscription.productID] ?? {};
    final productName = details['name'] ?? subscription.productID;
    final icon = details['icon'] ?? '📦';
    final color = details['color'] ?? Colors.blue;

    return Card(
      elevation: 4,
      margin: EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 标题行
            Row(
              children: [
                Container(
                  padding: EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    icon,
                    style: TextStyle(fontSize: 32),
                  ),
                ),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        productName,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(
                            Icons.check_circle,
                            size: 16,
                            color: Colors.green,
                          ),
                          SizedBox(width: 4),
                          Text(
                            '订阅活跃中',
                            style: TextStyle(
                              color: Colors.green,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            
            Divider(height: 24),
            
            // 详细信息
            if (details['hashrate'] != null)
              _buildDetailRow(
                Icons.speed,
                '算力',
                details['hashrate'],
              ),
            
            _buildDetailRow(
              Icons.calendar_today,
              '订阅ID',
              subscription.purchaseID ?? '未知',
            ),
            
            SizedBox(height: 16),
            
            // 操作按钮
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: Icon(Icons.open_in_new),
                    label: Text('在Google Play管理'),
                    onPressed: () => _openGooglePlaySubscriptions(),
                    style: OutlinedButton.styleFrom(
                      padding: EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: Colors.grey),
          SizedBox(width: 8),
          Text(
            '$label: ',
            style: TextStyle(
              color: Colors.grey.shade700,
              fontWeight: FontWeight.w500,
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(color: Colors.grey.shade600),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text) {
    return Padding(
      padding: EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: Colors.grey.shade600),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openGooglePlaySubscriptions() async {
    // Google Play订阅管理URL
    final url = Uri.parse('https://play.google.com/store/account/subscriptions');
    
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(
          url,
          mode: LaunchMode.externalApplication,
        );
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('无法打开Google Play'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      print('❌ 打开Google Play失败: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('打开失败: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    super.dispose();
  }
}
