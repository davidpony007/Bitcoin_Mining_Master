package com.bitcoinmining.models

import com.google.gson.annotations.SerializedName
import java.math.BigDecimal
import java.util.Date

/**
 * Bitcoin Mining Master - Data Models
 * 
 * 所有 API 请求和响应的数据模型
 */

// ==================== 请求数据模型 ====================

/**
 * 设备登录请求
 */
data class DeviceLoginRequest(
    @SerializedName("android_id")
    val androidId: String,
    
    @SerializedName("country")
    val country: String,
    
    @SerializedName("device_model")
    val deviceModel: String? = null,
    
    @SerializedName("gaid")
    val gaid: String? = null,
    
    @SerializedName("referrer_invitation_code")
    val referrerInvitationCode: String? = null
)

/**
 * 绑定 Google 账号请求
 */
data class BindGoogleRequest(
    @SerializedName("user_id")
    val userId: String,
    
    @SerializedName("google_account")
    val googleAccount: String
)

/**
 * 切换 Google 账号请求
 */
data class SwitchGoogleRequest(
    @SerializedName("google_account")
    val googleAccount: String,
    
    @SerializedName("android_id")
    val androidId: String
)

/**
 * 解绑 Google 账号请求
 */
data class UnbindGoogleRequest(
    @SerializedName("user_id")
    val userId: String
)

// ==================== 响应数据模型 ====================

/**
 * 基础响应封装
 */
data class BaseResponse<T>(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("message")
    val message: String? = null,
    
    @SerializedName("data")
    val data: T? = null
)

/**
 * 用户信息
 */
data class UserInfo(
    @SerializedName("id")
    val id: Int,
    
    @SerializedName("user_id")
    val userId: String,
    
    @SerializedName("invitation_code")
    val invitationCode: String,
    
    @SerializedName("email")
    val email: String? = null,
    
    @SerializedName("google_account")
    val googleAccount: String? = null,
    
    @SerializedName("android_id")
    val androidId: String? = null,
    
    @SerializedName("gaid")
    val gaid: String? = null,
    
    @SerializedName("register_ip")
    val registerIp: String? = null,
    
    @SerializedName("country")
    val country: String? = null,
    
    @SerializedName("user_creation_time")
    val userCreationTime: String? = null
)

/**
 * 设备登录响应
 */
data class DeviceLoginResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("isNewUser")
    val isNewUser: Boolean,
    
    @SerializedName("message")
    val message: String,
    
    @SerializedName("data")
    val data: UserInfo,
    
    @SerializedName("referrer")
    val referrer: UserInfo? = null
)

/**
 * Google 账号绑定响应
 */
data class BindGoogleResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("message")
    val message: String,
    
    @SerializedName("user")
    val user: UserInfo
)

/**
 * Google 账号切换响应
 */
data class SwitchGoogleResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("message")
    val message: String,
    
    @SerializedName("user")
    val user: UserInfo
)

/**
 * Google 账号解绑响应
 */
data class UnbindGoogleResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("message")
    val message: String,
    
    @SerializedName("user")
    val user: UserInfo
)

/**
 * 邀请关系信息
 */
data class InvitationRelationship(
    @SerializedName("id")
    val id: Int,
    
    @SerializedName("user_id")
    val userId: String,
    
    @SerializedName("invitation_code")
    val invitationCode: String,
    
    @SerializedName("referrer_user_id")
    val referrerUserId: String,
    
    @SerializedName("referrer_invitation_code")
    val referrerInvitationCode: String,
    
    @SerializedName("relationship_established_time")
    val relationshipEstablishedTime: String
)

/**
 * 被邀请用户信息
 */
data class InvitedUser(
    @SerializedName("id")
    val id: Int,
    
    @SerializedName("user_id")
    val userId: String,
    
    @SerializedName("invitation_code")
    val invitationCode: String,
    
    @SerializedName("country")
    val country: String?,
    
    @SerializedName("user_creation_time")
    val userCreationTime: String,
    
    @SerializedName("relationship_established_time")
    val relationshipEstablishedTime: String
)

/**
 * 邀请信息响应
 */
data class InvitationInfoResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("data")
    val data: InvitationData
)

data class InvitationData(
    @SerializedName("user")
    val user: UserInfo,
    
    @SerializedName("invitationRelationship")
    val invitationRelationship: InvitationRelationship? = null,
    
    @SerializedName("referrer")
    val referrer: UserInfo? = null,
    
    @SerializedName("invitedUsers")
    val invitedUsers: List<InvitedUser>,
    
    @SerializedName("totalInvitedCount")
    val totalInvitedCount: Int
)

/**
 * 用户状态信息
 */
data class UserStatus(
    @SerializedName("id")
    val id: Int,
    
    @SerializedName("user_id")
    val userId: String,
    
    @SerializedName("bitcoin_accumulated_amount")
    val bitcoinAccumulatedAmount: String,
    
    @SerializedName("current_bitcoin_balance")
    val currentBitcoinBalance: String,
    
    @SerializedName("total_invitation_rebate")
    val totalInvitationRebate: String,
    
    @SerializedName("total_withdrawal_amount")
    val totalWithdrawalAmount: String,
    
    @SerializedName("last_login_time")
    val lastLoginTime: String,
    
    @SerializedName("user_status")
    val userStatus: String
)

/**
 * 用户状态响应
 */
data class UserStatusResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("data")
    val data: UserStatus
)

/**
 * 示例: 合约列表响应
 */
data class ContractsResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("contracts")
    val contracts: List<MiningContract>
)

data class MiningContract(
    @SerializedName("id")
    val id: Int,
    
    @SerializedName("contract_name")
    val contractName: String,
    
    @SerializedName("price")
    val price: BigDecimal,
    
    @SerializedName("duration_days")
    val durationDays: Int
)
