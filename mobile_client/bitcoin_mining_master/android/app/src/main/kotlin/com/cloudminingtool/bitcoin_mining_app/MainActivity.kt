package com.cloudminingtool.bitcoin_mining_app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        flutterEngine.plugins.add(DeviceIdPlugin())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java) ?: return

            // 主要挖矿通知频道（与后端 FCM payload 中 channel_id 一致）
            val miningChannel = NotificationChannel(
                "mining_alerts",
                "Mining Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Bitcoin mining contract and reward notifications"
                enableLights(true)
                enableVibration(true)
            }
            manager.createNotificationChannel(miningChannel)

            // 默认频道（兜底）
            val defaultChannel = NotificationChannel(
                "default",
                "General Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "General app notifications"
            }
            manager.createNotificationChannel(defaultChannel)
        }
    }
}
