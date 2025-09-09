package com.cloudminingtool.bitcoinminingmaster.network

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor

object BitcoinPriceApiClient {

    // CoinGecko API 基础URL
    private const val COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3/"

    /**
     * 检查是否在预览模式下运行
     */
    private fun isInEditMode(): Boolean {
        return try {
            val currentThread = Thread.currentThread()
            currentThread.name.contains("RenderThread") ||
            currentThread.name.contains("preview") ||
            currentThread.name.contains("Layout")
        } catch (e: Exception) {
            false
        }
    }

    private val loggingInterceptor by lazy {
        HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
    }

    private val okHttpClient by lazy {
        if (isInEditMode()) {
            // 预览模式下创建一个最小的客户端，避免网络连接
            OkHttpClient.Builder().build()
        } else {
            OkHttpClient.Builder()
                .addInterceptor(loggingInterceptor)
                .build()
        }
    }

    private val retrofit by lazy {
        if (isInEditMode()) {
            // 预览模式下使用虚拟URL
            Retrofit.Builder()
                .baseUrl("http://localhost/")
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        } else {
            Retrofit.Builder()
                .baseUrl(COINGECKO_BASE_URL)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }
    }

    val apiService: ApiService by lazy {
        retrofit.create(ApiService::class.java)
    }
}
