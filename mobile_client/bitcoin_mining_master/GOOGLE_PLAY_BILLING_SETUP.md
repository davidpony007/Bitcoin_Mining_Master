# 🛒 Google Play Billing 付费合约系统完整接入指南

## 📋 第一步：Google Play Console配置

### 1.1 访问Google Play Console
https://play.google.com/console

### 1.2 创建应用（如果还没有）
1. 点击"创建应用"
2. 填写应用名称：Bitcoin Mining Master
3. 选择默认语言、应用类型（应用）、免费/付费（免费+应用内购买）

### 1.3 创建应用内商品（In-app products）

**路径**: 所有应用 → 选择你的应用 → 创收 → 应用内商品

**创建4个消耗型商品**：

#### 商品1：入门合约 $4.99
```
商品ID: p0499
名称: 入门合约 - 30天挖矿
说明: 176.3Gh/s算力，持续30天挖矿奖励
价格: $4.99 (Google会自动转换为其他货币)
状态: 有效
```

#### 商品2：标准合约 $6.99
```
商品ID: p0699
名称: 标准合约 - 30天挖矿
说明: 305.6Gh/s算力，持续30天挖矿奖励
价格: $6.99
状态: 有效
```

#### 商品3：进阶合约 $9.99
```
商品ID: p0999
名称: 进阶合约 - 30天挖矿
说明: 611.2Gh/s算力，持续30天挖矿奖励
价格: $9.99
状态: 有效
```

#### 商品4：高级合约 $19.99
```
商品ID: p1999
名称: 高级合约 - 30天挖矿
说明: 1326.4Gh/s算力，持续30天挖矿奖励
价格: $19.99
状态: 有效
```

**注意**：商品ID创建后不可修改，请确保与代码中一致！

---

## 📦 第二步：Flutter项目配置

### 2.1 添加依赖

编辑 `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  in_app_purchase: ^3.1.11  # 添加这一行
  in_app_purchase_android: ^0.3.0+11  # Android特定实现
```

运行安装：
```bash
flutter pub get
```

### 2.2 Android权限配置

编辑 `android/app/src/main/AndroidManifest.xml`，确保有以下权限：

```xml
<manifest>
    <!-- 应用内购买权限 -->
    <uses-permission android:name="com.android.vending.BILLING" />
    
    <!-- ...其他权限... -->
</manifest>
```

### 2.3 创建IAP服务类

创建 `lib/services/google_play_billing_service.dart`:

```dart
import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class GooglePlayBillingService {
  // 单例模式
  static final GooglePlayBillingService _instance = GooglePlayBillingService._internal();
  factory GooglePlayBillingService() => _instance;
  GooglePlayBillingService._internal();

  final InAppPurchase _iap = InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _subscription;
  
  // 商品ID列表（与Google Play Console一致）
  static const Set<String> _productIds = {
    'p0499',  // $4.99
    'p0699',  // $6.99
    'p0999',  // $9.99
    'p1999',  // $19.99
  };
  
  // 商品列表
  List<ProductDetails> products = [];
  
  // 购买状态回调
  Function(bool success, String message)? onPurchaseUpdate;

  /// 初始化IAP系统
  Future<bool> init() async {
    try {
      // 检查IAP是否可用
      final available = await _iap.isAvailable();
      if (!available) {
        print('❌ Google Play Billing不可用');
        return false;
      }

      // 启用待处理购买（Android特定）
      if (Platform.isAndroid) {
        final androidPlatform = _iap.getPlatformAddition<InAppPurchaseAndroidPlatformAddition>();
        await androidPlatform.enablePendingPurchases();
      }

      // 监听购买更新
      _subscription = _iap.purchaseStream.listen(
        _onPurchaseUpdate,
        onDone: () => _subscription?.cancel(),
        onError: (error) => print('❌ 购买流错误: $error'),
      );

      // 加载商品列表
      await loadProducts();
      
      print('✅ Google Play Billing初始化成功');
      return true;
    } catch (e) {
      print('❌ IAP初始化失败: $e');
      return false;
    }
  }

  /// 加载商品列表
  Future<void> loadProducts() async {
    try {
      final ProductDetailsResponse response = await _iap.queryProductDetails(_productIds);
      
      if (response.error != null) {
        print('❌ 查询商品失败: ${response.error}');
        return;
      }

      products = response.productDetails;
      print('✅ 加载了 ${products.length} 个商品');
      
      for (var product in products) {
        print('商品: ${product.id} - ${product.price} - ${product.title}');
      }
    } catch (e) {
      print('❌ 加载商品异常: $e');
    }
  }

  /// 获取指定商品
  ProductDetails? getProduct(String productId) {
    try {
      return products.firstWhere((p) => p.id == productId);
    } catch (e) {
      print('商品 $productId 未找到');
      return null;
    }
  }

  /// 发起购买
  Future<void> buyProduct(String productId) async {
    try {
      final product = getProduct(productId);
      if (product == null) {
        onPurchaseUpdate?.call(false, '商品不存在');
        return;
      }

      print('🛒 发起购买: ${product.id} - ${product.price}');
      
      final purchaseParam = PurchaseParam(productDetails: product);
      await _iap.buyConsumable(purchaseParam: purchaseParam);
      
    } catch (e) {
      print('❌ 购买失败: $e');
      onPurchaseUpdate?.call(false, '购买失败: $e');
    }
  }

  /// 处理购买更新
  void _onPurchaseUpdate(List<PurchaseDetails> purchaseDetailsList) {
    for (var purchaseDetails in purchaseDetailsList) {
      print('📦 购买状态更新: ${purchaseDetails.productID} - ${purchaseDetails.status}');
      
      if (purchaseDetails.status == PurchaseStatus.pending) {
        // 购买待处理
        print('⏳ 购买待处理...');
        
      } else if (purchaseDetails.status == PurchaseStatus.purchased) {
        // 购买成功 - 验证收据
        _verifyAndDeliver(purchaseDetails);
        
      } else if (purchaseDetails.status == PurchaseStatus.error) {
        // 购买失败
        print('❌ 购买失败: ${purchaseDetails.error}');
        onPurchaseUpdate?.call(false, '购买失败: ${purchaseDetails.error?.message}');
        
      } else if (purchaseDetails.status == PurchaseStatus.canceled) {
        // 用户取消
        print('⚠️ 用户取消购买');
        onPurchaseUpdate?.call(false, '购买已取消');
      }

      // 标记购买已处理
      if (purchaseDetails.pendingCompletePurchase) {
        _iap.completePurchase(purchaseDetails);
      }
    }
  }

  /// 验证收据并发放奖励
  Future<void> _verifyAndDeliver(PurchaseDetails purchase) async {
    try {
      print('🔐 验证购买收据...');
      
      // 获取购买token（Android）
      String? purchaseToken;
      if (purchase is GooglePlayPurchaseDetails) {
        purchaseToken = purchase.billingClientPurchase.purchaseToken;
      }

      // 发送到后端验证
      final response = await http.post(
        Uri.parse('https://47.79.232.189:3000/api/payment/verify'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_JWT_TOKEN', // 需要用户登录token
        },
        body: jsonEncode({
          'platform': 'android',
          'productId': purchase.productID,
          'purchaseToken': purchaseToken,
          'orderId': purchase.purchaseID,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          print('✅ 购买验证成功，合约已发放');
          onPurchaseUpdate?.call(true, '购买成功！合约已激活');
        } else {
          print('❌ 验证失败: ${data['message']}');
          onPurchaseUpdate?.call(false, '验证失败');
        }
      } else {
        print('❌ 服务器验证失败: ${response.statusCode}');
        onPurchaseUpdate?.call(false, '验证失败');
      }
      
    } catch (e) {
      print('❌ 验证异常: $e');
      onPurchaseUpdate?.call(false, '验证失败: $e');
    }
  }

  /// 恢复购买（处理未完成的交易）
  Future<void> restorePurchases() async {
    try {
      print('🔄 恢复购买...');
      await _iap.restorePurchases();
    } catch (e) {
      print('❌ 恢复购买失败: $e');
    }
  }

  /// 清理资源
  void dispose() {
    _subscription?.cancel();
  }
}
```

### 2.4 创建购买UI页面

创建 `lib/pages/purchase_page.dart`:

```dart
import 'package:flutter/material.dart';
import '../services/google_play_billing_service.dart';

class PurchasePage extends StatefulWidget {
  @override
  _PurchasePageState createState() => _PurchasePageState();
}

class _PurchasePageState extends State<PurchasePage> {
  final GooglePlayBillingService _billingService = GooglePlayBillingService();
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _initBilling();
  }

  Future<void> _initBilling() async {
    setState(() => _isLoading = true);
    
    // 设置购买回调
    _billingService.onPurchaseUpdate = (success, message) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
      
      if (success) {
        // 购买成功，刷新UI或返回
        Navigator.pop(context, true);
      }
    };
    
    await _billingService.init();
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('购买挖矿合约'),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _buildProductList(),
    );
  }

  Widget _buildProductList() {
    if (_billingService.products.isEmpty) {
      return Center(
        child: Text('暂无可购买的商品'),
      );
    }

    return ListView.builder(
      padding: EdgeInsets.all(16),
      itemCount: _billingService.products.length,
      itemBuilder: (context, index) {
        final product = _billingService.products[index];
        return _buildProductCard(product);
      },
    );
  }

  Widget _buildProductCard(product) {
    // 根据productId匹配算力
    Map<String, String> hashrates = {
      'p0499': '176.3 Gh/s',
      'p0699': '305.6 Gh/s',
      'p0999': '611.2 Gh/s',
      'p1999': '1326.4 Gh/s',
    };

    return Card(
      margin: EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              product.title,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8),
            Text('算力: ${hashrates[product.id] ?? "未知"}'),
            Text('时长: 30天'),
            Text('说明: ${product.description}'),
            SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  product.price,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.green,
                  ),
                ),
                ElevatedButton(
                  onPressed: () => _billingService.buyProduct(product.id),
                  child: Text('购买'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
```

### 2.5 在主应用中初始化

编辑 `lib/main.dart`，在应用启动时初始化：

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // 初始化Google Play Billing
  await GooglePlayBillingService().init();
  
  runApp(MyApp());
}
```

---

## 🔧 第三步：后端验证服务

### 3.1 创建Google Play验证服务

创建 `backend/src/services/googlePlayVerifyService.js`:

```javascript
const { google } = require('googleapis');
const path = require('path');

class GooglePlayVerifyService {
  constructor() {
    // 加载服务账号密钥
    this.auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, '../config/google-service-account.json'),
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    
    this.androidPublisher = google.androidpublisher({
      version: 'v3',
      auth: this.auth,
    });
  }

  /**
   * 验证Google Play购买
   */
  async verifyPurchase(packageName, productId, purchaseToken) {
    try {
      const result = await this.androidPublisher.purchases.products.get({
        packageName: packageName,
        productId: productId,
        token: purchaseToken,
      });

      const purchase = result.data;
      
      // 验证购买状态
      if (purchase.purchaseState === 0) {
        // 0 = 已购买
        return {
          success: true,
          orderId: purchase.orderId,
          purchaseTime: purchase.purchaseTimeMillis,
          acknowledged: purchase.acknowledgementState === 1,
        };
      } else if (purchase.purchaseState === 1) {
        // 1 = 已取消
        return { success: false, error: '订单已取消' };
      } else {
        return { success: false, error: '未知购买状态' };
      }
      
    } catch (error) {
      console.error('Google Play验证失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 确认购买（防止退款）
   */
  async acknowledgePurchase(packageName, productId, purchaseToken) {
    try {
      await this.androidPublisher.purchases.products.acknowledge({
        packageName: packageName,
        productId: productId,
        token: purchaseToken,
      });
      return { success: true };
    } catch (error) {
      console.error('确认购买失败:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new GooglePlayVerifyService();
```

### 3.2 创建支付路由

创建 `backend/src/routes/payment.js`:

```javascript
const express = require('express');
const router = express.Router();
const googlePlayVerifyService = require('../services/googlePlayVerifyService');
const PaidContractService = require('../services/paidContractService');
const authenticateToken = require('../middleware/authenticateToken');

const PACKAGE_NAME = 'com.bitcoinmining.master'; // 你的应用包名

/**
 * 验证Google Play购买
 */
router.post('/verify', authenticateToken, async (req, res) => {
  const { platform, productId, purchaseToken, orderId } = req.body;
  const userId = req.userId;

  try {
    // 只处理Android
    if (platform !== 'android') {
      return res.status(400).json({ 
        success: false, 
        message: '仅支持Android平台' 
      });
    }

    console.log(`🔐 验证购买: 用户${userId}, 商品${productId}, Token${purchaseToken}`);

    // 1. 验证购买凭证
    const verification = await googlePlayVerifyService.verifyPurchase(
      PACKAGE_NAME,
      productId,
      purchaseToken
    );

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: '购买验证失败: ' + verification.error,
      });
    }

    // 2. 检查订单是否已处理（防止重复）
    const existingOrder = await sequelize.query(`
      SELECT * FROM payment_transactions 
      WHERE order_id = ? AND user_id = ?
    `, {
      replacements: [verification.orderId, userId],
      type: sequelize.QueryTypes.SELECT,
    });

    if (existingOrder.length > 0) {
      return res.status(400).json({
        success: false,
        message: '订单已处理，请勿重复提交',
      });
    }

    // 3. 记录交易
    await sequelize.query(`
      INSERT INTO payment_transactions 
      (user_id, platform, product_id, order_id, purchase_token, amount, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, {
      replacements: [
        userId,
        'android',
        productId,
        verification.orderId,
        purchaseToken,
        0, // 金额从商品配置获取
        'completed',
      ],
    });

    // 4. 发放付费合约
    const contract = await PaidContractService.createContract(userId, productId);

    // 5. 确认购买（告知Google已处理）
    if (!verification.acknowledged) {
      await googlePlayVerifyService.acknowledgePurchase(
        PACKAGE_NAME,
        productId,
        purchaseToken
      );
    }

    console.log(`✅ 购买验证成功，合约已发放: 用户${userId}, 订单${verification.orderId}`);

    res.json({
      success: true,
      message: '购买成功，合约已激活',
      contract: contract,
    });

  } catch (error) {
    console.error('❌ 购买验证异常:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误: ' + error.message,
    });
  }
});

module.exports = router;
```

### 3.3 创建支付交易表

```sql
CREATE TABLE IF NOT EXISTS payment_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  platform ENUM('android', 'ios') NOT NULL,
  product_id VARCHAR(50) NOT NULL,
  order_id VARCHAR(255) NOT NULL UNIQUE,
  purchase_token TEXT,
  amount DECIMAL(10,2) DEFAULT 0,
  status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付交易记录表';
```

### 3.4 注册路由

编辑 `backend/src/app.js`:

```javascript
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);
```

---

## 🔑 第四步：Google Service Account配置

### 4.1 创建服务账号

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择你的项目（或创建新项目）
3. IAM与管理 → 服务账号 → 创建服务账号
4. 名称：`google-play-billing-validator`
5. 创建并继续 → 跳过权限 → 完成
6. 点击创建的服务账号 → 密钥 → 添加密钥 → 创建新密钥 → JSON
7. 下载JSON密钥文件，重命名为 `google-service-account.json`

### 4.2 授权服务账号

1. 访问 [Google Play Console](https://play.google.com/console)
2. 设置 → API访问权限
3. 关联到Google Cloud项目（如果还没有）
4. 服务账号 → 授予访问权限
5. 找到刚创建的服务账号，授予以下权限：
   - ✅ 查看财务数据、订单和订阅取消调查回复
   - ✅ 管理订单和订阅

### 4.3 上传密钥到服务器

```bash
scp /path/to/google-service-account.json root@47.79.232.189:/root/bitcoin-docker/backend/src/config/
```

---

## 🧪 第五步：测试流程

### 5.1 使用测试账号

**添加测试用户**:
1. Google Play Console → 设置 → 许可测试
2. 添加测试邮箱（Gmail账号）
3. 保存

**测试账号特点**:
- 可以"购买"，但不会真实扣费
- 可以测试完整购买流程
- 购买后立即生效

### 5.2 本地测试步骤

```bash
# 1. 构建Release版本（Debug版本无法测试IAP）
cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/mobile_client/bitcoin_mining_master
flutter build apk --release

# 2. 安装到手机
adb install build/app/outputs/flutter-apk/app-release.apk

# 3. 登录测试账号（在手机上）
# 4. 尝试购买商品
```

### 5.3 测试检查清单

- [ ] 商品列表是否正确加载？
- [ ] 点击购买是否弹出Google Play支付界面？
- [ ] 购买后是否收到成功回调？
- [ ] 后端是否收到验证请求？
- [ ] 合约是否正确发放到用户账号？
- [ ] 数据库是否记录了交易？

### 5.4 查看测试订单

Google Play Console → 订单管理 → 可以看到测试订单（显示"测试购买"标签）

---

## ⚠️ 常见问题和解决方案

### 问题1: 商品列表为空

**原因**: 
- 商品未设置为"有效"状态
- APK未上传到内部测试轨道

**解决**:
```bash
# 上传APK到内部测试
flutter build appbundle --release
# 然后在Google Play Console上传.aab文件到内部测试轨道
```

### 问题2: 购买时提示"此商品无法购买"

**原因**: 
- 使用的是Debug版本APK
- 应用版本号与Console不一致

**解决**: 必须使用Release版本 + 上传到测试轨道

### 问题3: 后端验证失败

**检查**:
```bash
# 查看后端日志
ssh root@47.79.232.189 "docker logs bitcoin_backend_prod --tail=50"
```

**常见原因**:
- 服务账号JSON文件路径错误
- 服务账号权限未授予
- packageName不匹配

---

## 📊 监控和日志

### 添加详细日志

```dart
// Flutter端
print('🛒 商品加载: ${products.length}个');
print('💳 发起购买: ${productId}');
print('✅ 购买成功: ${orderId}');
```

```javascript
// 后端
console.log(`🔐 收到验证请求: ${productId}`);
console.log(`✅ 验证成功: ${orderId}`);
console.log(`💰 合约已发放: 用户${userId}`);
```

---

## 🚀 生产环境上线

### 上线前检查

- [ ] 移除所有测试日志和调试代码
- [ ] 将PACKAGE_NAME改为正式包名
- [ ] 上传正式版APK/AAB到生产轨道
- [ ] 所有商品状态设为"有效"
- [ ] 服务账号权限正确配置
- [ ] 后端验证服务正常运行
- [ ] 数据库表已创建

### 发布到生产

1. 构建正式版：
```bash
flutter build appbundle --release
```

2. 上传到Google Play Console生产轨道

3. 提交审核

审核通过后，真实用户就可以购买了！💰

---

需要我帮你创建具体的代码文件吗？或者有任何步骤需要详细说明的？
