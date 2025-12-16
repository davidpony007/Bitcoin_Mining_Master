package com.bitcoinmining.data

import android.content.Context
import android.content.SharedPreferences
import com.bitcoinmining.models.UserInfo
import com.google.gson.Gson

/**
 * Bitcoin Mining Master - User Manager
 * 
 * 管理用户数据的本地存储和访问
 * 使用 SharedPreferences 持久化用户信息
 */
object UserManager {
    
    private const val PREF_NAME = "BitcoinMiningPrefs"
    private const val KEY_USER_INFO = "user_info"
    private const val KEY_ANDROID_ID = "android_id"
    private const val KEY_GAID = "gaid"
    private const val KEY_IS_LOGGED_IN = "is_logged_in"
    
    private lateinit var prefs: SharedPreferences
    private val gson = Gson()
    
    /**
     * 初始化 UserManager
     * 
     * 必须在 Application 的 onCreate() 中调用
     */
    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }
    
    // ==================== 用户信息管理 ====================
    
    /**
     * 保存用户信息
     * 
     * @param userInfo 用户信息对象
     */
    fun saveUserInfo(userInfo: UserInfo) {
        val json = gson.toJson(userInfo)
        prefs.edit()
            .putString(KEY_USER_INFO, json)
            .putBoolean(KEY_IS_LOGGED_IN, true)
            .apply()
    }
    
    /**
     * 获取用户信息
     * 
     * @return UserInfo? 用户信息对象,未登录返回 null
     */
    fun getUserInfo(): UserInfo? {
        val json = prefs.getString(KEY_USER_INFO, null) ?: return null
        return try {
            gson.fromJson(json, UserInfo::class.java)
        } catch (e: Exception) {
            null
        }
    }
    
    /**
     * 获取用户 ID
     * 
     * @return String? 用户ID,未登录返回 null
     */
    fun getUserId(): String? {
        return getUserInfo()?.userId
    }
    
    /**
     * 获取邀请码
     * 
     * @return String? 邀请码,未登录返回 null
     */
    fun getInvitationCode(): String? {
        return getUserInfo()?.invitationCode
    }
    
    /**
     * 更新 Google 账号
     * 
     * @param googleAccount Google 账号邮箱
     */
    fun updateGoogleAccount(googleAccount: String) {
        val userInfo = getUserInfo() ?: return
        val updatedUserInfo = userInfo.copy(googleAccount = googleAccount)
        saveUserInfo(updatedUserInfo)
    }
    
    /**
     * 检查用户是否已登录
     * 
     * @return Boolean true 表示已登录
     */
    fun isLoggedIn(): Boolean {
        return prefs.getBoolean(KEY_IS_LOGGED_IN, false) && getUserInfo() != null
    }
    
    /**
     * 清除用户信息 (登出)
     */
    fun logout() {
        prefs.edit()
            .remove(KEY_USER_INFO)
            .putBoolean(KEY_IS_LOGGED_IN, false)
            .apply()
    }
    
    // ==================== 设备信息管理 ====================
    
    /**
     * 保存 Android ID
     * 
     * @param androidId 设备的 Android ID
     */
    fun saveAndroidId(androidId: String) {
        prefs.edit()
            .putString(KEY_ANDROID_ID, androidId)
            .apply()
    }
    
    /**
     * 获取 Android ID
     * 
     * @return String? Android ID
     */
    fun getAndroidId(): String? {
        return prefs.getString(KEY_ANDROID_ID, null)
    }
    
    /**
     * 保存 GAID (Google Advertising ID)
     * 
     * @param gaid Google 广告 ID
     */
    fun saveGaid(gaid: String) {
        prefs.edit()
            .putString(KEY_GAID, gaid)
            .apply()
    }
    
    /**
     * 获取 GAID
     * 
     * @return String? GAID
     */
    fun getGaid(): String? {
        return prefs.getString(KEY_GAID, null)
    }
    
    // ==================== 辅助方法 ====================
    
    /**
     * 清除所有数据
     * 
     * 用于测试或数据重置
     */
    fun clearAll() {
        prefs.edit().clear().apply()
    }
    
    /**
     * 获取完整的用户数据摘要 (用于调试)
     * 
     * @return String 用户数据摘要字符串
     */
    fun getDebugInfo(): String {
        return """
            |User ID: ${getUserId() ?: "Not logged in"}
            |Invitation Code: ${getInvitationCode() ?: "N/A"}
            |Google Account: ${getUserInfo()?.googleAccount ?: "Not bound"}
            |Android ID: ${getAndroidId() ?: "N/A"}
            |GAID: ${getGaid() ?: "N/A"}
            |Is Logged In: ${isLoggedIn()}
        """.trimMargin()
    }
}
