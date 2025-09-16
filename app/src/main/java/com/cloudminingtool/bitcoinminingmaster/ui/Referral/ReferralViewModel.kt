package com.cloudminingtool.bitcoinminingmaster.ui.Referral

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel

class ReferralViewModel : ViewModel() {

    private val _text = MutableLiveData<String>().apply {
        value = "Referral"
    }
    val text: LiveData<String> = _text

    private val _invitationCode = MutableLiveData<String>().apply {
        value = "28024253"
    }
    val invitationCode: LiveData<String> = _invitationCode

    private val _referralReward = MutableLiveData<String>().apply {
        value = "0.0000000000000000"
    }
    val referralReward: LiveData<String> = _referralReward
}