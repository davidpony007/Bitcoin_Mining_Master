package com.cloudminingtool.bitcoinminingmaster.manager

import android.content.Context
import android.os.CountDownTimer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.text.SimpleDateFormat
import java.util.*

object WatchAdsManager {

    private const val PREFS_NAME = "WatchAdsPrefs"
    private const val KEY_END_TIME = "endTime"
    private const val KEY_ADS_WATCHED = "adsWatched"
    private const val KEY_LAST_WATCH_DATE = "lastWatchDate"
    private const val DAILY_AD_LIMIT = 50
    private const val TWO_HOURS_IN_MILLIS = 2 * 60 * 60 * 1000L

    private lateinit var context: Context
    private var countDownTimer: CountDownTimer? = null

    private val _countdownText = MutableStateFlow("Not Active")
    val countdownText: StateFlow<String> = _countdownText

    private val _isActive = MutableStateFlow(false)
    val isActive: StateFlow<Boolean> = _isActive

    private val _adsWatchedToday = MutableStateFlow(0)
    val adsWatchedToday: StateFlow<Int> = _adsWatchedToday

    fun initialize(context: Context) {
        this.context = context.applicationContext
        loadState()
    }

    private fun loadState() {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val endTime = prefs.getLong(KEY_END_TIME, 0)

        checkDate() // Check if the day has changed to reset ad count

        _adsWatchedToday.value = prefs.getInt(KEY_ADS_WATCHED, 0)

        if (endTime > System.currentTimeMillis()) {
            startCountdown(endTime - System.currentTimeMillis())
        } else {
            resetState()
        }
    }

    private fun saveState(endTime: Long, adsWatched: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        editor.putLong(KEY_END_TIME, endTime)
        editor.putInt(KEY_ADS_WATCHED, adsWatched)
        editor.putString(KEY_LAST_WATCH_DATE, getCurrentDate())
        editor.apply()
    }

    private fun startCountdown(millisInFuture: Long) {
        countDownTimer?.cancel()
        _isActive.value = true
        countDownTimer = object : CountDownTimer(millisInFuture, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val hours = millisUntilFinished / (1000 * 60 * 60)
                val minutes = (millisUntilFinished / (1000 * 60)) % 60
                val seconds = (millisUntilFinished / 1000) % 60
                _countdownText.value = String.format("%02d:%02d:%02d", hours, minutes, seconds)
            }

            override fun onFinish() {
                resetState()
            }
        }.start()
    }

    fun addTime(): Boolean {
        checkDate()
        if (_adsWatchedToday.value >= DAILY_AD_LIMIT) {
            return false // Limit reached
        }

        val currentTime = System.currentTimeMillis()
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        var endTime = prefs.getLong(KEY_END_TIME, 0)

        endTime = if (endTime > currentTime) {
            endTime + TWO_HOURS_IN_MILLIS
        } else {
            currentTime + TWO_HOURS_IN_MILLIS
        }

        _adsWatchedToday.value++
        saveState(endTime, _adsWatchedToday.value)
        startCountdown(endTime - currentTime)
        return true
    }

    private fun checkDate() {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lastWatchDate = prefs.getString(KEY_LAST_WATCH_DATE, "")
        val currentDate = getCurrentDate()

        if (lastWatchDate != currentDate) {
            // Date has changed, reset the ad count
            val editor = prefs.edit()
            editor.putInt(KEY_ADS_WATCHED, 0)
            editor.apply()
            _adsWatchedToday.value = 0
        }
    }

    private fun resetState() {
        _isActive.value = false
        _countdownText.value = "Not Active"
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        editor.putLong(KEY_END_TIME, 0)
        editor.apply()
    }

    private fun getCurrentDate(): String {
        return SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
    }
}

