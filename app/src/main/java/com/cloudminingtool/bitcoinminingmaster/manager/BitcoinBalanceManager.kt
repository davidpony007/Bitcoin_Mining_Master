package com.cloudminingtool.bitcoinminingmaster.manager

import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.DecimalFormat

/**
 * 比特币余额管理器 - 单例模式
 * 负责管理用户比特币账户余额的状态和同步
 */
object BitcoinBalanceManager {

    private const val TAG = "BitcoinBalanceManager"

    // 比特币余额状态管理
    private val _bitcoinBalance = MutableStateFlow<String?>(null)
    val bitcoinBalance: StateFlow<String?> = _bitcoinBalance.asStateFlow()

    // 加载状态
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // 余额格式化器 - 显示更高精度
    private val balanceFormatter = DecimalFormat("0.000000000000000")

    /**
     * 更新比特币余额
     */
    fun updateBalance(balance: Double) {
        val formattedBalance = balanceFormatter.format(balance)
        _bitcoinBalance.value = formattedBalance
        Log.d(TAG, "Bitcoin balance updated: $formattedBalance")
    }

    /**
     * 更新比特币余额（字符串格式）
     */
    fun updateBalance(balance: String) {
        _bitcoinBalance.value = balance
        Log.d(TAG, "Bitcoin balance updated: $balance")
    }

    /**
     * 设置加载状态
     */
    fun setLoading(loading: Boolean) {
        _isLoading.value = loading
    }

    /**
     * 获取当前余额
     */
    fun getCurrentBalance(): String? {
        return _bitcoinBalance.value
    }

    /**
     * 清除余额
     */
    fun clearBalance() {
        _bitcoinBalance.value = null
    }
}
