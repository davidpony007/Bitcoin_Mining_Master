package com.cloudminingtool.bitcoinminingmaster.network

import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.POST

// 比特币价格响应数据模型
data class BitcoinPriceResponse(
    val USD: Double
)

// 比特币余额响应数据模型
data class BitcoinBalanceResponse(
    val success: Boolean,
    val balance: String,  // 使用字符串保持高精度
    val message: String?
)

// CoinGecko API 响应模型
data class CoinGeckoResponse(
    val bitcoin: BitcoinPriceResponse
)

// 用户ID响应数据模型
data class UserIdResponse(
    val success: Boolean,
    val userId: String,
    val message: String?
)

// API接口定义
interface ApiService {

    // 获取用户ID的接口
    @POST("api/user/generateId")
    suspend fun generateUserId(): Response<UserIdResponse>

    // 或者使用GET请求（根据你的服务端实现选择）
    @GET("api/user/getId")
    suspend fun getUserId(): Response<UserIdResponse>

    // 获取用户比特币余额的接口
    @GET("api/user/balance")
    suspend fun getBitcoinBalance(): Response<BitcoinBalanceResponse>

    // 获取比特币价格的接口 - 使用CoinGecko免费API
    @GET("simple/price?ids=bitcoin&vs_currencies=usd")
    suspend fun getBitcoinPrice(): Response<CoinGeckoResponse>
}
