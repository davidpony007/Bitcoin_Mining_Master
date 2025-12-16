package com.bitcoinmining.network

import retrofit2.Response
import retrofit2.http.*

/**
 * Bitcoin Mining Master - API Service Interface
 * 
 * 所有 API 接口定义,使用 Retrofit 进行网络请求
 * Base URL: http://localhost:8888 (开发环境)
 * 
 * 生产环境请修改为实际服务器地址
 */
interface ApiService {
    
    // ==================== 认证相关 API ====================
    
    /**
     * 设备登录/自动注册
     * 
     * 功能:
     * - 首次使用: 自动创建账号,返回 user_id 和 invitation_code
     * - 再次使用: 直接登录,返回已有账号信息
     * 
     * @param request DeviceLoginRequest
     * @return Response<DeviceLoginResponse>
     */
    @POST("/api/auth/device-login")
    suspend fun deviceLogin(
        @Body request: DeviceLoginRequest
    ): Response<DeviceLoginResponse>
    
    /**
     * 绑定 Google 账号
     * 
     * 将当前用户与 Google 账号关联,实现多账号切换功能
     * 
     * @param request BindGoogleRequest
     * @return Response<BindGoogleResponse>
     */
    @POST("/api/auth/bind-google")
    suspend fun bindGoogleAccount(
        @Body request: BindGoogleRequest
    ): Response<BindGoogleResponse>
    
    /**
     * 通过 Google 账号切换用户
     * 
     * 使用 Google 账号登录,自动切换到对应的 user_id
     * 
     * @param request SwitchGoogleRequest
     * @return Response<SwitchGoogleResponse>
     */
    @POST("/api/auth/switch-google")
    suspend fun switchByGoogleAccount(
        @Body request: SwitchGoogleRequest
    ): Response<SwitchGoogleResponse>
    
    /**
     * 解绑 Google 账号
     * 
     * 解除 Google 账号与用户的绑定关系
     * 
     * @param request UnbindGoogleRequest
     * @return Response<UnbindGoogleResponse>
     */
    @POST("/api/auth/unbind-google")
    suspend fun unbindGoogleAccount(
        @Body request: UnbindGoogleRequest
    ): Response<UnbindGoogleResponse>
    
    /**
     * 查询邀请信息
     * 
     * 获取用户的邀请关系和被邀请用户列表
     * 
     * @param userId 用户ID
     * @return Response<InvitationInfoResponse>
     */
    @GET("/api/auth/invitation-info")
    suspend fun getInvitationInfo(
        @Query("user_id") userId: String
    ): Response<InvitationInfoResponse>
    
    /**
     * 查询用户状态
     * 
     * 获取用户的余额、挖矿收益、邀请返佣等信息
     * 
     * @param userId 用户ID
     * @return Response<UserStatusResponse>
     */
    @GET("/api/auth/user-status")
    suspend fun getUserStatus(
        @Query("user_id") userId: String
    ): Response<UserStatusResponse>
    
    // ==================== 其他 API 可在此扩展 ====================
    
    /**
     * 示例: 获取用户合约列表
     */
    @GET("/api/mining/contracts")
    suspend fun getMiningContracts(
        @Query("user_id") userId: String
    ): Response<ContractsResponse>
}
