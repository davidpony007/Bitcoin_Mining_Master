package com.cloudminingtool.bitcoinminingmaster.data

import com.cloudminingtool.bitcoinminingmaster.ui.WithdrawalHistoryItem

object WithdrawalManager {
    private val withdrawalHistory = mutableListOf<WithdrawalHistoryItem>()

    fun addWithdrawal(item: WithdrawalHistoryItem) {
        withdrawalHistory.add(0, item) // 添加到列表开头，最新的在前面
    }

    fun getWithdrawalHistory(): List<WithdrawalHistoryItem> {
        return withdrawalHistory.toList()
    }

    fun clearHistory() {
        withdrawalHistory.clear()
    }
}
