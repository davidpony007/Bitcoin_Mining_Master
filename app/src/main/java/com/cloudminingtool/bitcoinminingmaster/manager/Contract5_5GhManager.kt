package com.cloudminingtool.bitcoinminingmaster.manager

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

/**
 * 5.5Gh/s 合约倒计时管理器
 * 用户点击广告完成后激活，每次增加2小时，每天最多50次
 */
object Contract5_5GhManager {

    private const val TAG = "Contract5_5GhManager"
    private const val PREFS_NAME = "contract_5_5gh_prefs"
    private const val KEY_REMAINING_TIME = "remaining_time"
    private const val KEY_DAILY_AD_COUNT = "daily_ad_count"
    private const val KEY_LAST_AD_DATE = "last_ad_date"

    // 常量
    private const val AD_REWARD_DURATION_MS = 2 * 60 * 60 * 1000L // 2小时
    private const val MAX_DAILY_ADS = 50

    // 状态管理
    private val _countdownText = MutableStateFlow("Not Active")
    val countdownText: StateFlow<String> = _countdownText.asStateFlow()

    private val _isActive = MutableStateFlow(false)
    val isActive: StateFlow<Boolean> = _isActive.asStateFlow()

    private val _dailyAdCount = MutableStateFlow(0)
    val dailyAdCount: StateFlow<Int> = _dailyAdCount.asStateFlow()

    private val _canWatchAd = MutableStateFlow(true)
    val canWatchAd: StateFlow<Boolean> = _canWatchAd.asStateFlow()

    // 协程相关
    private var countdownJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // SharedPreferences
    private var prefs: SharedPreferences? = null

    /**
     * 初始化管理器
     */
    fun initialize(context: Context) {
        try {
            prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            checkCurrentState()
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing Contract5_5GhManager", e)
            // 设置默认状态
            _countdownText.value = "Not Active"
            _isActive.value = false
            _dailyAdCount.value = 0
            _canWatchAd.value = true
        }
    }

    /**
     * 检查当前状态
     */
    private fun checkCurrentState() {
        val remainingTime = prefs?.getLong(KEY_REMAINING_TIME, 0L) ?: 0L

        // 检查是否需要重置每日广告计数
        checkAndResetDailyAdCount()

        if (remainingTime > 0) {
            // 有剩余时间，继续倒计时
            startCountdown(remainingTime)
        } else {
            // 没有剩余时间，设置为未激活状态
            setInactive()
        }
    }

    /**
     * 检查并重置每日广告计数
     */
    private fun checkAndResetDailyAdCount() {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val lastAdDate = prefs?.getString(KEY_LAST_AD_DATE, "") ?: ""

        if (lastAdDate != today) {
            // 新的一天，重置广告计数
            prefs?.edit()?.apply {
                putInt(KEY_DAILY_AD_COUNT, 0)
                putString(KEY_LAST_AD_DATE, today)
                apply()
            }
            _dailyAdCount.value = 0
        } else {
            // 同一天，读取当前计数
            val count = prefs?.getInt(KEY_DAILY_AD_COUNT, 0) ?: 0
            _dailyAdCount.value = count
        }

        updateCanWatchAdStatus()
    }

    /**
     * 更新是否可以观看广告的状态
     */
    private fun updateCanWatchAdStatus() {
        _canWatchAd.value = _dailyAdCount.value < MAX_DAILY_ADS
    }

    /**
     * 用户观看广告完成后调用
     */
    fun onAdWatchCompleted(): Boolean {
        if (!_canWatchAd.value) {
            Log.d(TAG, "Cannot watch ad: daily limit reached")
            return false
        }

        // 增加广告计数
        val newCount = _dailyAdCount.value + 1
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

        prefs?.edit()?.apply {
            putInt(KEY_DAILY_AD_COUNT, newCount)
            putString(KEY_LAST_AD_DATE, today)
            apply()
        }

        _dailyAdCount.value = newCount
        updateCanWatchAdStatus()

        // 增加2小时倒计时
        addCountdownTime(AD_REWARD_DURATION_MS)

        Log.d(TAG, "Ad watch completed. Daily count: $newCount")
        return true
    }

    /**
     * 增加倒计时时间
     */
    private fun addCountdownTime(additionalTime: Long) {
        val currentRemaining = getRemainingTimeInMillis()
        // 确保总时间不超过48小时
        val newRemaining = minOf(currentRemaining + additionalTime, 48 * 60 * 60 * 1000L)

        prefs?.edit()?.apply {
            putLong(KEY_REMAINING_TIME, newRemaining)
            apply()
        }

        startCountdown(newRemaining)
    }

    /**
     * 获取当前剩余时间
     */
    fun getRemainingTimeInMillis(): Long {
        return prefs?.getLong(KEY_REMAINING_TIME, 0L) ?: 0L
    }

    /**
     * 开始倒计时
     */
    private fun startCountdown(duration: Long) {
        _isActive.value = true
        countdownJob?.cancel()

        countdownJob = scope.launch {
            var remaining = duration

            try {
                while (remaining > 0 && _isActive.value) {
                    // 保存当前剩余时间
                    prefs?.edit()?.apply {
                        putLong(KEY_REMAINING_TIME, remaining)
                        apply()
                    }

                    val hours = TimeUnit.MILLISECONDS.toHours(remaining)
                    val minutes = TimeUnit.MILLISECONDS.toMinutes(remaining) % 60
                    val seconds = TimeUnit.MILLISECONDS.toSeconds(remaining) % 60

                    _countdownText.value = String.format(Locale.getDefault(), "%02dh %02dm %02ds", hours, minutes, seconds)

                    delay(1000L)
                    remaining -= 1000L
                }

                if (remaining <= 0) {
                    // 倒计时结束
                    onCountdownExpired()
                }
            } catch (e: CancellationException) {
                Log.d(TAG, "5.5Gh countdown cancelled")
                throw e // 重新抛出CancellationException以正确处理协程取消
            } catch (e: Exception) {
                Log.e(TAG, "Error in 5.5Gh countdown", e)
                setInactive()
            }
        }
    }

    /**
     * 倒计时结束处理
     */
    private fun onCountdownExpired() {
        prefs?.edit()?.apply {
            putLong(KEY_REMAINING_TIME, 0L)
            apply()
        }
        setInactive()
        Log.d(TAG, "5.5Gh contract countdown expired")
    }

    /**
     * 设置为未激活状态
     */
    private fun setInactive() {
        _isActive.value = false
        _countdownText.value = "Not Active"
        countdownJob?.cancel()
    }

    /**
     * 获取今日剩余可观看广告次数
     */
    fun getRemainingDailyAds(): Int {
        return MAX_DAILY_ADS - _dailyAdCount.value
    }

    /**
     * 清理资源
     */
    fun cleanup() {
        try {
            countdownJob?.cancel()
        } catch (e: Exception) {
            Log.e(TAG, "Error cleaning up Contract5_5GhManager", e)
        }
    }
}
