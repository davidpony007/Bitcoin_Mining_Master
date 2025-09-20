package com.example.bitcoinminingmaster.util

import java.util.concurrent.CopyOnWriteArrayList

class BalanceManager private constructor() {
    interface BalanceListener {
        fun onBalanceChanged(newBalance: String)
    }

    private var balance: String = "1.000000000000001"
    private val listeners = CopyOnWriteArrayList<BalanceListener>()

    fun getBalance(): String = balance

    fun setBalance(newBalance: String) {
        if (balance != newBalance) {
            balance = newBalance
            listeners.forEach { it.onBalanceChanged(balance) }
        }
    }

    fun addListener(listener: BalanceListener) {
        listeners.add(listener)
    }

    fun removeListener(listener: BalanceListener) {
        listeners.remove(listener)
    }

    companion object {
        val instance: BalanceManager by lazy { BalanceManager() }
    }
}

