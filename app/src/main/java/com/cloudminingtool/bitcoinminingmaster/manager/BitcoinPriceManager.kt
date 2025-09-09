package com.cloudminingtool.bitcoinminingmaster.manager

import android.util.Log
import com.cloudminingtool.bitcoinminingmaster.network.BitcoinPriceApiClient
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.DecimalFormat

/**
 * 比特币价格管理器 - 单例模式
 * 负责获取和管理比特币实时价格，每2小时自动刷新
 */
object BitcoinPriceManager {

    private const val TAG = "BitcoinPriceManager"
    private const val REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000L // 2小时

    // 价格状态管理
    private val _bitcoinPrice = MutableStateFlow<String?>(null)
    val bitcoinPrice: StateFlow<String?> = _bitcoinPrice.asStateFlow()

    // 加载状态
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // 协程作用域
    private var priceUpdateJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // 价格格式化器
    private val priceFormatter = DecimalFormat("#,##0.00")

    /**
     * 检查是否在预览模式下运行
     */
    private fun isInEditMode(): Boolean {
        return try {
            // 检查是否在Layout预览模式下
            val currentThread = Thread.currentThread()
            currentThread.name.contains("RenderThread") ||
            currentThread.name.contains("preview") ||
            currentThread.name.contains("Layout")
        } catch (e: Exception) {
            false
        }
    }

    /**
     * 开始定时获取比特币价格
     */
    fun startPriceUpdates() {
        // 如果在预览模式下，不启动网络更新
        if (isInEditMode()) {
            Log.d(TAG, "In preview mode, skipping price updates")
            _bitcoinPrice.value = "Preview Mode"
            return
        }

        if (priceUpdateJob?.isActive == true) {
            Log.d(TAG, "Price updates already running")
            return
        }

        priceUpdateJob = scope.launch {
            try {
                while (coroutineContext.isActive) {
                    try {
                        fetchBitcoinPrice()
                        delay(REFRESH_INTERVAL_MS)
                    } catch (e: CancellationException) {
                        Log.d(TAG, "Price update cancelled")
                        throw e
                    } catch (e: Exception) {
                        Log.e(TAG, "Error in price update loop", e)
                        delay(60000) // 出错时1分钟后重试
                    }
                }
            } catch (e: CancellationException) {
                Log.d(TAG, "Price updates stopped")
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "Fatal error in price updates", e)
            }
        }

        Log.d(TAG, "Started Bitcoin price updates")
    }

    /**
     * 停止定时更新
     */
    fun stopPriceUpdates() {
        try {
            priceUpdateJob?.cancel()
            priceUpdateJob = null
            Log.d(TAG, "Stopped Bitcoin price updates")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping price updates", e)
        }
    }

    /**
     * 立即获取一次比特币价格
     */
    fun fetchBitcoinPriceNow() {
        // 如果在预览模式下，不进行网络请求
        if (isInEditMode()) {
            Log.d(TAG, "In preview mode, skipping immediate price fetch")
            _bitcoinPrice.value = "Preview Mode"
            return
        }

        scope.launch {
            try {
                fetchBitcoinPrice()
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching price now", e)
            }
        }
    }

    /**
     * 获取比特币价格的核心方法
     */
    private suspend fun fetchBitcoinPrice() {
        try {
            // 再次检查是否在预览模式下
            if (isInEditMode()) {
                _bitcoinPrice.value = "Preview Mode"
                return
            }

            _isLoading.value = true
            Log.d(TAG, "Fetching Bitcoin price...")

            val response = BitcoinPriceApiClient.apiService.getBitcoinPrice()

            if (response.isSuccessful && response.body() != null) {
                val coinGeckoResponse = response.body()!!
                val price = coinGeckoResponse.bitcoin.USD
                val formattedPrice = priceFormatter.format(price)

                _bitcoinPrice.value = formattedPrice
                Log.d(TAG, "Bitcoin price updated: $$formattedPrice")
            } else {
                Log.e(TAG, "Failed to fetch Bitcoin price: ${response.code()}")
                if (_bitcoinPrice.value == null) {
                    _bitcoinPrice.value = "Error"
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception while fetching Bitcoin price", e)
            if (_bitcoinPrice.value == null) {
                _bitcoinPrice.value = "Error"
            }
        } finally {
            _isLoading.value = false
        }
    }

    /**
     * 获取当前价格
     */
    fun getCurrentPrice(): String? {
        return _bitcoinPrice.value
    }

    /**
     * 清理资源
     */
    fun cleanup() {
        stopPriceUpdates()
    }
}
