package com.cloudminingtool.bitcoinminingmaster.repository

import com.cloudminingtool.bitcoinminingmaster.network.ApiClient
import com.cloudminingtool.bitcoinminingmaster.manager.UserDataManager
import com.cloudminingtool.bitcoinminingmaster.manager.BitcoinBalanceManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class UserRepository {

    private val apiService = ApiClient.apiService

    // 从服务器获取用户ID并更新到UserDataManager
    suspend fun fetchUserId(): Result<String> {
        return withContext(Dispatchers.IO) {
            try {
                UserDataManager.setLoading(true)
                val response = apiService.generateUserId()
                if (response.isSuccessful && response.body() != null) {
                    val userIdResponse = response.body()!!
                    if (userIdResponse.success) {
                        // 更新到UserDataManager，实现同步
                        UserDataManager.updateUserId(userIdResponse.userId)
                        UserDataManager.setLoading(false)
                        Result.success(userIdResponse.userId)
                    } else {
                        UserDataManager.setLoading(false)
                        Result.failure(Exception(userIdResponse.message ?: "获取用户ID失败"))
                    }
                } else {
                    UserDataManager.setLoading(false)
                    Result.failure(Exception("网络请求失败: ${response.code()}"))
                }
            } catch (e: Exception) {
                UserDataManager.setLoading(false)
                Result.failure(e)
            }
        }
    }

    // 从服务器获取比特币余额并更新到BitcoinBalanceManager
    suspend fun fetchBitcoinBalance(): Result<String> {
        return withContext(Dispatchers.IO) {
            try {
                BitcoinBalanceManager.setLoading(true)
                val response = apiService.getBitcoinBalance()
                if (response.isSuccessful && response.body() != null) {
                    val balanceResponse = response.body()!!
                    if (balanceResponse.success) {
                        // 更新到BitcoinBalanceManager，实现同步
                        BitcoinBalanceManager.updateBalance(balanceResponse.balance)
                        BitcoinBalanceManager.setLoading(false)
                        Result.success(balanceResponse.balance)
                    } else {
                        BitcoinBalanceManager.setLoading(false)
                        Result.failure(Exception(balanceResponse.message ?: "获取比特币余额失败"))
                    }
                } else {
                    BitcoinBalanceManager.setLoading(false)
                    Result.failure(Exception("网络请求失败: ${response.code()}"))
                }
            } catch (e: Exception) {
                BitcoinBalanceManager.setLoading(false)
                Result.failure(e)
            }
        }
    }
}
