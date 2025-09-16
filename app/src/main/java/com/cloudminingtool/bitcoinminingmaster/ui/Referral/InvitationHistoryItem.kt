package com.cloudminingtool.bitcoinminingmaster.ui.Referral

data class InvitationHistoryItem(
    val friendName: String,
    val inviteDate: String,
    val status: String, // "Success" or "Pending"
    val reward: String
)
