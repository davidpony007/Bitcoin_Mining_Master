import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../services/google_play_billing_service.dart';
import '../services/storage_service.dart';

class PurchasePage extends StatefulWidget {
  const PurchasePage({super.key});

  @override
  _PurchasePageState createState() => _PurchasePageState();
}

class _PurchasePageState extends State<PurchasePage> {
  final GooglePlayBillingService _billingService = GooglePlayBillingService();
  bool _isLoading = true;
  bool _isPurchasing = false;

  // 订阅商品详情映射
  final Map<String, Map<String, String>> _subscriptionInfo = {
    'mining_starter_monthly': {
      'name': '入门订阅',
      'hashrate': '176.3 Gh/s',
      'period': '每月',
      'icon': '🌟',
    },
    'mining_standard_monthly': {
      'name': '标准订阅',
      'hashrate': '305.6 Gh/s',
      'period': '每月',
      'icon': '💎',
    },
    'mining_advanced_monthly': {
      'name': '进阶订阅',
      'hashrate': '611.2 Gh/s',
      'period': '每月',
      'icon': '🚀',
    },
    'mining_premium_monthly': {
      'name': '高级订阅',
      'hashrate': '1326.4 Gh/s',
      'period': '每月',
      'icon': '👑',
    },
  };

  @override
  void initState() {
    super.initState();
    _initBilling();
  }

  Future<void> _initBilling() async {
    setState(() => _isLoading = true);
    
    // 设置购买回调
    _billingService.onPurchaseUpdate = (success, message) {
      setState(() => _isPurchasing = false);
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: success ? Colors.green : Colors.red,
          duration: Duration(seconds: 3),
        ),
      );
      
      if (success) {
        // 购买成功，延迟返回
        Future.delayed(Duration(seconds: 2), () {
          Navigator.pop(context, true);
        });
      }
    };
    
    // 注入用户ID（billing service 发送后端请求时使用）
    final storageService = StorageService();
    await storageService.init();
    _billingService.userId = storageService.getUserId();

    await _billingService.init();
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('购买挖矿合约'),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _isLoading ? null : () async {
              setState(() => _isLoading = true);
              await _billingService.loadProducts();
              setState(() => _isLoading = false);
            },
          ),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _buildContent(),
    );
  }

  Widget _buildContent() {
    if (_billingService.subscriptionProducts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text('暂无可购买的订阅'),
            SizedBox(height: 8),
            Text('请检查网络连接或稍后重试', style: TextStyle(color: Colors.grey)),
            SizedBox(height: 24),
            ElevatedButton.icon(
              icon: Icon(Icons.refresh),
              label: Text('重新加载'),
              onPressed: () async {
                setState(() => _isLoading = true);
                await _billingService.loadProducts();
                setState(() => _isLoading = false);
              },
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        // 顶部说明
        Container(
          padding: EdgeInsets.all(16),
          color: Colors.green.shade50,
          child: Row(
            children: [
              Icon(Icons.check_circle, color: Colors.green),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  '订阅后每月自动续订，享受持续挖矿收益。可随时取消。',
                  style: TextStyle(color: Colors.green.shade900),
                ),
              ),
            ],
          ),
        ),
        
        // 订阅列表
        Expanded(
          child: ListView.builder(
            padding: EdgeInsets.all(16),
            itemCount: _billingService.subscriptionProducts.length,
            itemBuilder: (context, index) {
              final product = _billingService.subscriptionProducts[index];
              return _buildProductCard(product);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildProductCard(ProductDetails product) {
    final info = _subscriptionInfo[product.id] ?? {};
    
    return Card(
      elevation: 4,
      margin: EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: _isPurchasing ? null : () => _confirmPurchase(product),
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 标题行
              Row(
                children: [
                  Text(
                    info['icon'] ?? '💰',
                    style: TextStyle(fontSize: 32),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          info['name'] ?? product.title,
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          product.description,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              
              Divider(height: 24),
              
              // 详细信息
              Row(
                children: [
                  Expanded(
                    child: _buildInfoItem(
                      Icons.speed,
                      '算力',
                      info['hashrate'] ?? '未知',
                    ),
                  ),
                  Expanded(
                    child: _buildInfoItem(
                      Icons.schedule,
                      '周期',
                      info['period'] ?? '每月',
                    ),
                  ),
                ],
              ),
              
              SizedBox(height: 16),
              
              // 价格和订阅按钮
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '每月价格',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            product.price,
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                              color: Colors.green,
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4, left: 4),
                            child: Text(
                              '/月',
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  ElevatedButton.icon(
                    icon: _isPurchasing 
                      ? SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation(Colors.white),
                          ),
                        )
                      : Icon(Icons.autorenew),
                    label: Text(_isPurchasing ? '处理中...' : '订阅'),
                    onPressed: _isPurchasing 
                      ? null 
                      : () => _confirmPurchase(product),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      padding: EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoItem(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.grey),
        SizedBox(width: 4),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(fontSize: 10, color: Colors.grey),
            ),
            Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ],
    );
  }

  void _confirmPurchase(ProductDetails product) {
    final info = _subscriptionInfo[product.id] ?? {};
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.autorenew, color: Colors.green),
            SizedBox(width: 8),
            Text('确认订阅'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('商品：${info['name']}'),
            Text('算力：${info['hashrate']}'),
            Text('周期：每月自动续订'),
            SizedBox(height: 8),
            Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.info_outline, size: 16, color: Colors.orange),
                      SizedBox(width: 4),
                      Text(
                        '订阅说明',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.orange.shade900,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 8),
                  Text(
                    '• 订阅将在每月自动续订\n'
                    '• 可随时在Google Play取消订阅\n'
                    '• 取消后仍可使用至当期结束',
                    style: TextStyle(fontSize: 12, color: Colors.orange.shade900),
                  ),
                ],
              ),
            ),
            SizedBox(height: 8),
            Text(
              '价格：${product.price}/月',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.green,
              ),
            ),
            SizedBox(height: 16),
            Text(
              '确认后将跳转到Google Play支付页面',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('取消'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              setState(() => _isPurchasing = true);
              _billingService.buySubscription(product.id);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
            ),
            child: Text('确认订阅'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    // 注意：不要在这里dispose billingService，因为它是单例
    super.dispose();
  }
}
