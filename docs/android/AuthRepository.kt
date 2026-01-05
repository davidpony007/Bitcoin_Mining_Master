package com.bitcoinmining.repository

import com.bitcoinmining.models.*
import com.bitcoinmining.network.RetrofitClient
import retrofit2.Response

/**
 * Bitcoin Mining Master - Auth Repository
 * 
 * 封装所有认证相关的 API 调用
 * 提供统一的数据访问接口
 */
class AuthRepository {
    
    private val apiService = RetrofitClient.apiService
    
    // ==================== 设备登录 ====================
    
    /**
     * 设备登录/自动注册
     * 
     * @param androidId 设备 Android ID
     * @param country 国家代码
     * @param deviceModel 设备型号 (可选)
     * @param gaid Google 广告 ID (可选)
     * @param referrerCode 推荐人邀请码 (可选)
     * @return Result<DeviceLoginResponse>
     */
    suspend fun deviceLogin(
        androidId: String,
        country: String,
        deviceModel: String? = null,
        gaid: String? = null,
        referrerCode: String? = null
    ): Result<DeviceLoginResponse> {
        return try {
            val request = DeviceLoginRequest(
                androidId = androidId,
                country = country,
                deviceModel = deviceModel,
                gaid = gaid,
                referrerInvitationCode = referrerCode
            )
            
            val response = apiService.deviceLogin(request)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Login failed: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // ==================== Google 账号管理 ====================
    
    /**
     * 绑定 Google 账号
     * 
     * @param userId 用户ID
     * @param googleAccount Google 账号邮箱
     * @return Result<BindGoogleResponse>
     */
    suspend fun bindGoogleAccount(
        userId: String,
        googleAccount: String
    ): Result<BindGoogleResponse> {
        return try {
            val request = BindGoogleRequest(
                userId = userId,
                googleAccount = googleAccount
            )
            
            val response = apiService.bindGoogleAccount(request)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Bind failed: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * 通过 Google 账号切换用户
     * 
     * @param googleAccount Google 账号邮箱
     * @param androidId 当前设备 Android ID
     * @return Result<SwitchGoogleResponse>
     */
    suspend fun switchByGoogleAccount(
        googleAccount: String,
        androidId: String
    ): Result<SwitchGoogleResponse> {
        return try {
            val request = SwitchGoogleRequest(
                googleAccount = googleAccount,
                androidId = androidId
            )
            
            val response = apiService.switchByGoogleAccount(request)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Switch failed: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * 解绑 Google 账号
     * 
     * @param userId 用户ID
     * @return Result<UnbindGoogleResponse>
     */
    suspend fun unbindGoogleAccount(
        userId: String
    ): Result<UnbindGoogleResponse> {
        return try {
            val request = UnbindGoogleRequest(userId = userId)
            
            val response = apiService.unbindGoogleAccount(request)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Unbind failed: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // ==================== 邀请信息查询 ====================
    
    /**
     * 查询邀请信息
     * 
     * @param userId 用户ID
     * @return Result<InvitationInfoResponse>
     */
    suspend fun getInvitationInfo(
        userId: String
    ): Result<InvitationInfoResponse> {
        return try {
            val response = apiService.getInvitationInfo(userId)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Query failed: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // ==================== 用户状态查询 ====================
    
    /**
     * 查询用户状态
     * 
     * @param userId 用户ID
     * @return Result<UserStatusResponse>
     */
    suspend fun getUserStatus(
        userId: String
    ): Result<UserStatusResponse> {
        return try {
            val response = apiService.getUserStatus(userId)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Query failed: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
