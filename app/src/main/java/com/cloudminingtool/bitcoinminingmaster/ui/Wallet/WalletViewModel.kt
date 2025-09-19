package com.cloudminingtool.bitcoinminingmaster.ui.Wallet

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.asLiveData
import com.cloudminingtool.bitcoinminingmaster.manager.BitcoinBalanceManager

class WalletViewModel : ViewModel() {

    // 使用全局的比特币余额管理器
    val bitcoinBalance: LiveData<String?> = BitcoinBalanceManager.bitcoinBalance.asLiveData()

    private val _transactionHistory = MutableLiveData<List<TransactionItem>>()
    val transactionHistory: LiveData<List<TransactionItem>> = _transactionHistory

    fun addTransaction(transaction: TransactionItem) {
        val currentList = _transactionHistory.value?.toMutableList() ?: mutableListOf()
        currentList.add(0, transaction) // 添加到列表开头
        _transactionHistory.value = currentList
    }
}
