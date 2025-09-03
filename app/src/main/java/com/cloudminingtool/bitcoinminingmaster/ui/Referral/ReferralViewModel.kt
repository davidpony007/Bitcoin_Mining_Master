package com.cloudminingtool.bitcoinminingmaster.ui.Referral

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel

class ReferralViewModel : ViewModel() {

    private val _text = MutableLiveData<String>().apply {
//        value = "This is referral Fragment"
    }
    val text: LiveData<String> = _text
}