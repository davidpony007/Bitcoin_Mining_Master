package com.cloudminingtool.bitcoinminingmaster.ui.Wallet

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel

class WalletViewModel : ViewModel() {

    private val _bitcoinBalance = MutableLiveData<String>().apply {
        value = "0.000000281865919"
    }
    val bitcoinBalance: LiveData<String> = _bitcoinBalance

    private val _transactionHistory = MutableLiveData<List<TransactionItem>>()
    val transactionHistory: LiveData<List<TransactionItem>> = _transactionHistory

    fun updateBalance(newBalance: String) {
        _bitcoinBalance.value = newBalance
    }

    fun addTransaction(transaction: TransactionItem) {
        val currentList = _transactionHistory.value?.toMutableList() ?: mutableListOf()
        currentList.add(0, transaction) // 添加到列表开头
        _transactionHistory.value = currentList
    }
}
