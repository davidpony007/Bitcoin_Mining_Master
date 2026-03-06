package com.bitcoinmining.ui

import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.bitcoinmining.data.UserManager
import com.bitcoinmining.repository.AuthRepository
import com.google.android.gms.ads.identifier.AdvertisingIdClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.*

/**
 * Bitcoin Mining Master - MainActivity
 * 
 * APP 启动页面,实现自动登录逻辑
 * 
 * 功能:
 * 1. 获取设备信息 (Android ID, GAID)
 * 2. 调用 device-login API 自动登录/注册
 * 3. 保存用户信息到本地
 * 4. 跳转到主界面
 */
class MainActivity : AppCompatActivity() {
    
    private val TAG = "MainActivity"
    private val authRepository = AuthRepository()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // 启动自动登录流程
        performAutoLogin()
    }
    
    /**
     * 执行自动登录
     */
    private fun performAutoLogin() {
        lifecycleScope.launch {
            try {
                // 显示加载状态
                showLoading()
                
                // 1. 获取设备信息
                val androidId = getAndroidId()
                val gaid = getGaid()
                val country = getCountryCode()
                val deviceModel = getDeviceModel()
                
                // 保存设备信息到本地
                UserManager.saveAndroidId(androidId)
                if (gaid != null) {
                    UserManager.saveGaid(gaid)
                }
                
                // 2. 调用 device-login API
                val result = authRepository.deviceLogin(
                    androidId = androidId,
                    country = country,
                    deviceModel = deviceModel,
                    gaid = gaid,
                    referrerCode = null // 首次启动不带推荐码
                )
                
                result.onSuccess { response ->
                    // 3. 保存用户信息
                    UserManager.saveUserInfo(response.data)
                    
                    // 4. 显示登录结果
                    val message = if (response.isNewUser) {
                        "欢迎! 您的邀请码是 ${response.data.invitationCode}"
                    } else {
                        "欢迎回来! ${response.data.userId}"
                    }
                    
                    Toast.makeText(this@MainActivity, message, Toast.LENGTH_LONG).show()
                    
                    Log.d(TAG, "Login success: ${response.message}")
                    Log.d(TAG, "User ID: ${response.data.userId}")
                    Log.d(TAG, "Invitation Code: ${response.data.invitationCode}")
                    
                    // 5. 跳转到主界面
                    navigateToHomeScreen()
                }
                
                result.onFailure { exception ->
                    Log.e(TAG, "Login failed", exception)
                    Toast.makeText(
                        this@MainActivity,
                        "登录失败: ${exception.message}",
                        Toast.LENGTH_LONG
                    ).show()
                    
                    // 失败后可选择重试或显示错误页面
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Auto login error", e)
                Toast.makeText(this@MainActivity, "发生错误: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                hideLoading()
            }
        }
    }
    
    /**
     * 获取 Android ID
     * 
     * @return String 设备唯一标识
     */
    private fun getAndroidId(): String {
        return Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ANDROID_ID
        ) ?: UUID.randomUUID().toString()
    }
    
    /**
     * 获取 GAID (Google Advertising ID)
     * 
     * 需要在后台线程执行
     * 
     * @return String? GAID,获取失败返回 null
     */
    private suspend fun getGaid(): String? = withContext(Dispatchers.IO) {
        try {
            val adInfo = AdvertisingIdClient.getAdvertisingIdInfo(applicationContext)
            if (!adInfo.isLimitAdTrackingEnabled) {
                adInfo.id
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get GAID", e)
            null
        }
    }
    
    /**
     * 获取国家代码
     * 
     * @return String 国家代码 (例如: CN, US)
     */
    private fun getCountryCode(): String {
        return try {
            Locale.getDefault().country
        } catch (e: Exception) {
            "US" // 默认值
        }
    }
    
    /**
     * 获取设备型号
     * 
     * @return String 设备型号
     */
    private fun getDeviceModel(): String {
        return "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}"
    }
    
    /**
     * 显示加载状态
     */
    private fun showLoading() {
        // TODO: 显示加载动画或 ProgressBar
    }
    
    /**
     * 隐藏加载状态
     */
    private fun hideLoading() {
        // TODO: 隐藏加载动画
    }
    
    /**
     * 跳转到主界面
     */
    private fun navigateToHomeScreen() {
        // TODO: 启动主界面 Activity
        // val intent = Intent(this, HomeActivity::class.java)
        // startActivity(intent)
        // finish()
    }
}
