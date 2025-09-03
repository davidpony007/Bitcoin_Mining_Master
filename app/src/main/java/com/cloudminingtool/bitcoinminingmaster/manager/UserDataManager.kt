package com.cloudminingtool.bitcoinminingmaster.manager

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * 用户数据管理器 - 单例模式
 * 负责管理用户ID的状态和同步
 */
object UserDataManager {

    // 使用StateFlow来管理用户ID状态，支持响应式更新
    private val _userId = MutableStateFlow<String?>(null)
    val userId: StateFlow<String?> = _userId.asStateFlow()

    // 用户ID加载状态
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    /**
     * 更新用户ID
     */
    fun updateUserId(id: String?) {
        _userId.value = id
    }

    /**
     * 设置加载状态
     */
    fun setLoading(loading: Boolean) {
        _isLoading.value = loading
    }

    /**
     * 获取当前用户ID
     */
    fun getCurrentUserId(): String? {
        return _userId.value
    }

    /**
     * 清除用户ID
     */
    fun clearUserId() {
        _userId.value = null
    }
}
