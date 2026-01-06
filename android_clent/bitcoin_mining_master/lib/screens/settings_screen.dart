import 'package:flutter/material.dart';
import '../constants/app_constants.dart';

/// 设置页面 - Settings Screen
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _pushNotifications = true;
  bool _biometricAuth = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Settings'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            
            // User Info
            _buildUserCard(),
            
            const SizedBox(height: 20),
            
            // 通用Settings
            _buildSectionTitle('通用Settings'),
            _buildSettingsCard([
              _buildNavigationItem(
                icon: Icons.language,
                iconColor: AppColors.primary,
                title: 'Language',
                subtitle: '简体Chinese',
                onTap: () {},
              ),
              _buildDivider(),
              _buildNavigationItem(
                icon: Icons.palette,
                iconColor: AppColors.primary,
                title: 'Theme',
                subtitle: 'System',
                onTap: () {},
              ),
              _buildDivider(),
              _buildSwitchItem(
                icon: Icons.notifications,
                iconColor: AppColors.primary,
                title: 'Push Notifications',
                subtitle: 'Receive important message notifications',
                value: _pushNotifications,
                onChanged: (value) {
                  setState(() {
                    _pushNotifications = value;
                  });
                },
              ),
            ]),
            
            const SizedBox(height: 20),
            
            // 安全Settings
            _buildSectionTitle('安全Settings'),
            _buildSettingsCard([
              _buildSwitchItem(
                icon: Icons.fingerprint,
                iconColor: AppColors.primary,
                title: 'Biometric Auth',
                subtitle: 'Use fingerprint or face login',
                value: _biometricAuth,
                onChanged: (value) {
                  setState(() {
                    _biometricAuth = value;
                  });
                },
              ),
              _buildDivider(),
              _buildNavigationItem(
                icon: Icons.lock,
                iconColor: AppColors.primary,
                title: 'Change Password',
                subtitle: '定期Change Password保护账号安全',
                onTap: () {},
              ),
              _buildDivider(),
              _buildStatusItem(
                icon: Icons.shield,
                iconColor: AppColors.primary,
                title: 'Two-Factor Authentication',
                subtitle: 'Requires secondary confirmation for withdrawal',
                status: 'Enabled',
                statusColor: const Color(0xFF4CAF50),
              ),
            ]),
            
            const SizedBox(height: 20),
            
            // About
            _buildSectionTitle('About'),
            _buildSettingsCard([
              _buildNavigationItem(
                icon: Icons.info_outline,
                iconColor: AppColors.primary,
                title: 'About我们',
                subtitle: 'Bitcoin Mining Master',
                onTap: () {},
              ),
              _buildDivider(),
              _buildNavigationItem(
                icon: Icons.description,
                iconColor: AppColors.primary,
                title: 'User协议',
                onTap: () {},
              ),
              _buildDivider(),
              _buildNavigationItem(
                icon: Icons.privacy_tip,
                iconColor: AppColors.primary,
                title: 'Privacy Policy',
                onTap: () {},
              ),
              _buildDivider(),
              _buildNavigationItem(
                icon: Icons.help_outline,
                iconColor: AppColors.primary,
                title: 'Help Center',
                onTap: () {},
              ),
              _buildDivider(),
              _buildNavigationItem(
                icon: Icons.delete_sweep,
                iconColor: AppColors.primary,
                title: 'Clear Cache',
                subtitle: '约 12.5 MB',
                onTap: () {},
              ),
            ]),
            
            const SizedBox(height: 32),
            
            // Deactivate Account
            _buildDeactivateButton(),
            
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildUserCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.person,
              size: 32,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'User',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'ID: N/A',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    'Lv.1',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Icon(
            Icons.chevron_right,
            color: AppColors.textSecondary,
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Text(
        title,
        style: TextStyle(
          color: AppColors.textSecondary,
          fontSize: 14,
        ),
      ),
    );
  }

  Widget _buildSettingsCard(List<Widget> children) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: children,
      ),
    );
  }

  Widget _buildNavigationItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: AppColors.textSecondary,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSwitchItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: iconColor, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: AppColors.primary,
          ),
        ],
      ),
    );
  }

  Widget _buildStatusItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    required String status,
    required Color statusColor,
  }) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: iconColor, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Text(
            status,
            style: TextStyle(
              color: statusColor,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return Padding(
      padding: const EdgeInsets.only(left: 72),
      child: Divider(
        height: 1,
        color: AppColors.divider,
      ),
    );
  }

  Widget _buildDeactivateButton() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: TextButton(
        onPressed: () {
          // TODO: Show deactivate confirmation dialog
        },
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
        child: const Text(
          'Deactivate Account',
          style: TextStyle(
            color: Colors.white70,
            fontSize: 16,
          ),
        ),
      ),
    );
  }
}
