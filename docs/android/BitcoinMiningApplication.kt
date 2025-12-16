package com.bitcoinmining

import android.app.Application
import com.bitcoinmining.data.UserManager

/**
 * Bitcoin Mining Master - Application Class
 * 
 * 应用程序入口,初始化全局单例和配置
 */
class BitcoinMiningApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        // 初始化 UserManager
        UserManager.init(this)
        
        // 可在此添加其他全局初始化逻辑
        // 例如: Firebase, Crashlytics, Analytics 等
    }
}
