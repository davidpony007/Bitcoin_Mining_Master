package com.bitcoinmining.network

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Bitcoin Mining Master - Retrofit Client
 * 
 * 统一管理 Retrofit 实例和网络配置
 */
object RetrofitClient {
    
    // ==================== 配置项 ====================
    
    /**
     * API Base URL
     * 
     * 开发环境: http://10.0.2.2:8888 (Android 模拟器访问本机)
     * 生产环境: http://47.79.232.189:8888 (实际服务器地址)
     */
    private const val BASE_URL_DEV = "http://10.0.2.2:8888"
    private const val BASE_URL_PROD = "http://47.79.232.189:8888"
    
    // 当前使用的 Base URL (根据 BuildConfig 自动切换)
    private val BASE_URL = if (BuildConfig.DEBUG) BASE_URL_DEV else BASE_URL_PROD
    
    // 超时配置
    private const val CONNECT_TIMEOUT = 30L
    private const val READ_TIMEOUT = 30L
    private const val WRITE_TIMEOUT = 30L
    
    // ==================== OkHttpClient 配置 ====================
    
    /**
     * 创建 OkHttpClient
     * 
     * 功能:
     * - 添加日志拦截器 (Debug 模式下显示完整请求/响应)
     * - 设置超时时间
     * - 可扩展添加其他拦截器 (如 Token 认证)
     */
    private val okHttpClient: OkHttpClient by lazy {
        val builder = OkHttpClient.Builder()
            .connectTimeout(CONNECT_TIMEOUT, TimeUnit.SECONDS)
            .readTimeout(READ_TIMEOUT, TimeUnit.SECONDS)
            .writeTimeout(WRITE_TIMEOUT, TimeUnit.SECONDS)
        
        // Debug 模式下添加日志拦截器
        if (BuildConfig.DEBUG) {
            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
            builder.addInterceptor(loggingInterceptor)
        }
        
        // 可添加其他拦截器
        // builder.addInterceptor(AuthInterceptor())
        
        builder.build()
    }
    
    // ==================== Retrofit 实例 ====================
    
    /**
     * Retrofit 实例 (单例)
     */
    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
    
    /**
     * API Service 实例 (单例)
     */
    val apiService: ApiService by lazy {
        retrofit.create(ApiService::class.java)
    }
}

/**
 * 自定义拦截器示例: Token 认证
 * 
 * 如果未来需要在请求头中添加 Token,可取消注释并使用
 */
/*
class AuthInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        
        // 从 SharedPreferences 或其他地方获取 Token
        val token = UserManager.getToken()
        
        val newRequest = if (token != null) {
            originalRequest.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            originalRequest
        }
        
        return chain.proceed(newRequest)
    }
}
*/
