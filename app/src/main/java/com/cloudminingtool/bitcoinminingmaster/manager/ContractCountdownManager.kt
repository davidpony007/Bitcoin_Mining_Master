package com.cloudminingtool.bitcoinminingmaster.manager

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.*
import java.util.concurrent.TimeUnit

/**
 * 7.5Gh/s 合约倒计时管理器
 * 用户点击广告完成后手动激活，24小时冷却期
 */
object ContractCountdownManager {

    private const val TAG = "ContractCountdownManager"
    private const val PREFS_NAME = "contract_countdown_prefs"
    private const val KEY_LAST_ACTIVATION = "last_activation_time"
    private const val KEY_IS_ACTIVE = "is_active"

    // 时间常量
    private const val CONTRACT_DURATION_MS = 2 * 60 * 60 * 1000L // 2小时
    private const val COOLDOWN_DURATION_MS = 24 * 60 * 60 * 1000L // 24小时冷却期

    // 状态管理
    private val _countdownText = MutableStateFlow("Not Active")
    val countdownText: StateFlow<String> = _countdownText.asStateFlow()

    private val _isActive = MutableStateFlow(false)
    val isActive: StateFlow<Boolean> = _isActive.asStateFlow()

    private val _canActivate = MutableStateFlow(true)
    val canActivate: StateFlow<Boolean> = _canActivate.asStateFlow()

    // 协程相关 - 使用应用级别的作用域
    private var countdownJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // SharedPreferences
    private var prefs: SharedPreferences? = null

    /**
     * 初始化倒计时管理器
     */
    fun initialize(context: Context) {
        try {
            prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            checkCurrentState()
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing ContractCountdownManager", e)
            // 设置默认状态
            _countdownText.value = "Not Active"
            _isActive.value = false
            _canActivate.value = true
        }
    }

    /**
     * 检查当前状态
     */
    private fun checkCurrentState() {
        val now = System.currentTimeMillis()
        val lastActivation = prefs?.getLong(KEY_LAST_ACTIVATION, 0L) ?: 0L
        val wasActive = prefs?.getBoolean(KEY_IS_ACTIVE, false) ?: false

        Log.d(TAG, "Current time: $now, Last activation: $lastActivation, Was active: $wasActive")

        if (wasActive && lastActivation > 0) {
            // 检查是否还在激活期内
            val elapsed = now - lastActivation
            if (elapsed < CONTRACT_DURATION_MS) {
                // 仍在激活期内，继续倒计时
                val remaining = CONTRACT_DURATION_MS - elapsed
                startActiveCountdown(remaining)
                return
            } else {
                // 激活期已过，设置为非激活状态
                setInactive()
            }
        }

        // 检查冷却状态
        updateCooldownState()
    }

    /**
     * 更新冷却状态
     */
    private fun updateCooldownState() {
        val now = System.currentTimeMillis()
        val lastActivation = prefs?.getLong(KEY_LAST_ACTIVATION, 0L) ?: 0L

        if (lastActivation == 0L) {
            // 从未激活过，可以激活
            _canActivate.value = true
            _countdownText.value = "Not Active"
        } else {
            val elapsed = now - lastActivation
            if (elapsed >= COOLDOWN_DURATION_MS) {
                // 冷却期已过，可以激活
                _canActivate.value = true
                _countdownText.value = "Not Active"
            } else {
                // 仍在冷却期，显示剩余时间
                _canActivate.value = false
                val remaining = COOLDOWN_DURATION_MS - elapsed
                startCooldownCountdown(remaining)
            }
        }
    }

    /**
     * 用户观看广告完成后激活合约
     */
    fun onAdWatchCompleted(): Boolean {
        if (!_canActivate.value) {
            Log.d(TAG, "Cannot activate: still in cooldown period")
            return false
        }

        val now = System.currentTimeMillis()
        prefs?.edit()?.apply {
            putLong(KEY_LAST_ACTIVATION, now)
            putBoolean(KEY_IS_ACTIVE, true)
            apply()
        }

        Log.d(TAG, "Contract activated after ad completion at: $now")
        _canActivate.value = false
        startActiveCountdown(CONTRACT_DURATION_MS)
        return true
    }

    /**
     * 检查是否可以激活（24小时冷却期检查）
     */
    fun canActivateContract(): Boolean {
        val now = System.currentTimeMillis()
        val lastActivation = prefs?.getLong(KEY_LAST_ACTIVATION, 0L) ?: 0L

        return lastActivation == 0L || (now - lastActivation) >= COOLDOWN_DURATION_MS
    }

    /**
     * 获取剩余冷却时间
     */
    fun getRemainingCooldownTime(): Long {
        val now = System.currentTimeMillis()
        val lastActivation = prefs?.getLong(KEY_LAST_ACTIVATION, 0L) ?: 0L

        if (lastActivation == 0L) return 0L

        val elapsed = now - lastActivation
        return if (elapsed >= COOLDOWN_DURATION_MS) 0L else COOLDOWN_DURATION_MS - elapsed
    }

    /**
     * 获取剩余激活时间（毫秒）
     */
    fun getRemainingActiveTimeInMillis(): Long {
        if (!_isActive.value) {
            return 0L
        }
        val now = System.currentTimeMillis()
        val lastActivation = prefs?.getLong(KEY_LAST_ACTIVATION, 0L) ?: 0L
        if (lastActivation == 0L) {
            return 0L
        }
        val elapsed = now - lastActivation
        return if (elapsed >= CONTRACT_DURATION_MS) 0L else CONTRACT_DURATION_MS - elapsed
    }

    /**
     * 开始激活状态倒计时（2小时）
     */
    private fun startActiveCountdown(duration: Long) {
        _isActive.value = true
        countdownJob?.cancel()

        countdownJob = scope.launch {
            var remaining = duration

            try {
                while (remaining > 0 && _isActive.value) {
                    val hours = TimeUnit.MILLISECONDS.toHours(remaining)
                    val minutes = TimeUnit.MILLISECONDS.toMinutes(remaining) % 60
                    val seconds = TimeUnit.MILLISECONDS.toSeconds(remaining) % 60

                    _countdownText.value = String.format(Locale.getDefault(), "%02dh %02dm %02ds", hours, minutes, seconds)

                    delay(1000L)
                    remaining -= 1000L
                }

                if (remaining <= 0) {
                    // 倒计时结束，进入冷却期
                    onContractExpired()
                }
            } catch (e: CancellationException) {
                Log.d(TAG, "Active countdown cancelled")
                throw e // 重新抛出CancellationException以正确处理协程取消
            } catch (e: Exception) {
                Log.e(TAG, "Error in active countdown", e)
                setInactive()
            }
        }
    }

    /**
     * 开始冷却期倒计时
     */
    private fun startCooldownCountdown(duration: Long) {
        _isActive.value = false
        countdownJob?.cancel()

        countdownJob = scope.launch {
            var remaining = duration

            try {
                while (remaining > 0 && !_canActivate.value) {
                    val hours = TimeUnit.MILLISECONDS.toHours(remaining)
                    val minutes = TimeUnit.MILLISECONDS.toMinutes(remaining) % 60
                    val seconds = TimeUnit.MILLISECONDS.toSeconds(remaining) % 60

                    _countdownText.value = String.format(Locale.getDefault(), "Cooldown %02d:%02d:%02d", hours, minutes, seconds)

                    delay(1000L)
                    remaining -= 1000L
                }

                if (remaining <= 0) {
                    // 冷却期结束，可以重新激活
                    _canActivate.value = true
                    _countdownText.value = "Not Active"
                }
            } catch (e: CancellationException) {
                Log.d(TAG, "Cooldown countdown cancelled")
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "Error in cooldown countdown", e)
                _canActivate.value = true
                _countdownText.value = "Not Active"
            }
        }
    }

    /**
     * 合约到期处理
     */
    private fun onContractExpired() {
        setInactive()

        // 开始24小时冷却期
        val cooldownTime = getRemainingCooldownTime()
        if (cooldownTime > 0) {
            startCooldownCountdown(cooldownTime)
        } else {
            _canActivate.value = true
            _countdownText.value = "Not Active"
        }

        Log.d(TAG, "Contract expired, cooldown period started")
    }

    /**
     * 设置为非激活状态
     */
    private fun setInactive() {
        _isActive.value = false

        prefs?.edit()?.apply {
            putBoolean(KEY_IS_ACTIVE, false)
            apply()
        }

        countdownJob?.cancel()
    }

    /**
     * 停止倒计时
     */
    fun stop() {
        try {
            countdownJob?.cancel()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping countdown", e)
        }
    }

    /**
     * 清理资源
     */
    fun cleanup() {
        stop()
    }

    /**
     * 获取当前状态信息
     */
    fun getStatusInfo(): String {
        val lastActivation = prefs?.getLong(KEY_LAST_ACTIVATION, 0L) ?: 0L
        val isCurrentlyActive = _isActive.value
        val canCurrentlyActivate = _canActivate.value

        return "Last activation: ${Date(lastActivation)}, Active: $isCurrentlyActive, Can activate: $canCurrentlyActivate"
    }
}
