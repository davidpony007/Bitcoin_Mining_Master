package com.cloudminingtool.bitcoinminingmaster.manager

import android.widget.ImageView
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import com.cloudminingtool.bitcoinminingmaster.R

/**
 * 电池槽管理器
 * 管理40个电池格子的状态、倒计时和动画
 */
object BatterySlotManager {

    // 电池电量等级枚举
    enum class BatteryLevel {
        EMPTY,          // 空电池
        ONE_QUARTER,    // 1/4电量
        HALF,           // 1/2电量
        THREE_QUARTER,  // 3/4电量
        FULL            // 满电量
    }

    // 电池状态数据类
    data class BatteryState(
        val level: BatteryLevel = BatteryLevel.EMPTY,
        val remainingMinutes: Int = 0,  // 剩余分钟数
        val isCountingDown: Boolean = false,  // 是否正在倒计时
        val isBreathing: Boolean = false  // 是否显示呼吸动画
    )

    // 总共40个电池格子
    private const val TOTAL_BATTERIES = 40

    // 电池状态列表（私有）
    private val _batteryStates = MutableStateFlow(
        List(TOTAL_BATTERIES) { BatteryState() }
    )

    // 电池状态列表（公开）
    val batteryStates: StateFlow<List<BatteryState>> = _batteryStates.asStateFlow()

    // 活跃电池数量（私有）
    private val _activeBatteryCount = MutableStateFlow(0)

    // 活跃电池数量（公开）
    val activeBatteryCount: StateFlow<Int> = _activeBatteryCount.asStateFlow()

    // 当前呼吸电池的索引（私有）
    private var breathingBatteryIndex = -1

    /**
     * 初始化电池槽管理器
     */
    fun initialize() {
        updateActiveBatteryCount()
    }

    /**
     * 添加两个满格电池
     * 电池的增加顺序为从左往右，从上往下
     */
    fun addTwoBatteries() {
        val currentStates = _batteryStates.value.toMutableList()
        var addedCount = 0

        // 找到前两个空电池位置并填充
        for (i in currentStates.indices) {
            if (currentStates[i].level == BatteryLevel.EMPTY && addedCount < 2) {
                currentStates[i] = BatteryState(
                    level = BatteryLevel.FULL,
                    remainingMinutes = 60, // 一个小时 = 60分钟
                    isCountingDown = true
                )
                addedCount++
            }
        }

        _batteryStates.value = currentStates
        updateActiveBatteryCount()
        updateBreathingBattery()
    }

    /**
     * 更新呼吸电池
     * 只有一个电池可以呼吸，优先选择电量最少的有电电池
     */
    private fun updateBreathingBattery() {
        val currentStates = _batteryStates.value.toMutableList()

        // 重置所有电池的呼吸状态
        for (i in currentStates.indices) {
            currentStates[i] = currentStates[i].copy(isBreathing = false)
        }

        // 找到电量最少的有电电池作为呼吸电池
        var minLevel = BatteryLevel.FULL
        var breathingIndex = -1

        for (i in currentStates.indices) {
            val state = currentStates[i]
            if (state.level != BatteryLevel.EMPTY && state.isCountingDown) {
                if (state.level.ordinal <= minLevel.ordinal) {
                    minLevel = state.level
                    breathingIndex = i
                }
            }
        }

        // 设置呼吸电池
        if (breathingIndex >= 0) {
            currentStates[breathingIndex] = currentStates[breathingIndex].copy(isBreathing = true)
            breathingBatteryIndex = breathingIndex
        } else {
            breathingBatteryIndex = -1
        }

        _batteryStates.value = currentStates
    }

    /**
     * 更新电池倒计时（每分钟调用一次）
     */
    fun updateBatteryCountdown() {
        val currentStates = _batteryStates.value.toMutableList()
        var hasChanges = false

        for (i in currentStates.indices) {
            val state = currentStates[i]
            if (state.isCountingDown && state.remainingMinutes > 0) {
                val newRemainingMinutes = state.remainingMinutes - 1

                // 根据剩余时间更新电池等级
                val newLevel = when {
                    newRemainingMinutes <= 0 -> BatteryLevel.EMPTY
                    newRemainingMinutes <= 15 -> BatteryLevel.ONE_QUARTER
                    newRemainingMinutes <= 30 -> BatteryLevel.HALF
                    newRemainingMinutes <= 45 -> BatteryLevel.THREE_QUARTER
                    else -> BatteryLevel.FULL
                }

                currentStates[i] = state.copy(
                    level = newLevel,
                    remainingMinutes = newRemainingMinutes,
                    isCountingDown = newRemainingMinutes > 0
                )
                hasChanges = true
            }
        }

        if (hasChanges) {
            _batteryStates.value = currentStates
            updateActiveBatteryCount()
            updateBreathingBattery() // 重新计算呼吸电池
        }
    }

    /**
     * 获取总剩余时间（小时:分钟格式）
     */
    fun getTotalRemainingTime(): String {
        val totalMinutes = _batteryStates.value.sumOf { state ->
            if (state.isCountingDown) state.remainingMinutes else 0
        }

        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60

        return if (hours > 0) {
            "${hours}h ${minutes}m"
        } else {
            "${minutes}m"
        }
    }

    /**
     * 更新活跃电池数量
     */
    private fun updateActiveBatteryCount() {
        val count = _batteryStates.value.count { state ->
            state.level != BatteryLevel.EMPTY
        }
        _activeBatteryCount.value = count
    }

    /**
     * 获取当前活跃电池数量
     */
    fun getCurrentActiveBatteryCount(): Int {
        return _activeBatteryCount.value
    }

    /**
     * 重置所有电池状态
     */
    fun resetAllBatteries() {
        _batteryStates.value = List(TOTAL_BATTERIES) { BatteryState() }
        updateActiveBatteryCount()
    }

    /**
     * 获取电池状态的调试信息
     */
    fun getDebugInfo(): String {
        val states = _batteryStates.value
        val activeCount = states.count { it.level != BatteryLevel.EMPTY }
        val countdownCount = states.count { it.isCountingDown }
        val totalMinutes = states.sumOf { if (it.isCountingDown) it.remainingMinutes else 0 }

        return "Active: $activeCount, Countdown: $countdownCount, Total time: ${totalMinutes}min"
    }

    /**
     * 更新电池ImageView的显示
     */
    fun updateBatteryImageView(imageView: ImageView, batteryInfo: BatteryState) {
        if (batteryInfo.level == BatteryLevel.EMPTY) {
            // 空电池
            imageView.setImageResource(R.drawable.icon_battery_empty)
            return
        }

        // 根据电池等级选择图标
        val iconRes = when (batteryInfo.level) {
            BatteryLevel.FULL -> R.drawable.icon_battery_full
            BatteryLevel.THREE_QUARTER -> R.drawable.icon_battery_three_quater
            BatteryLevel.HALF -> R.drawable.icon_battery_half
            BatteryLevel.ONE_QUARTER -> R.drawable.icon_battery_one_quater
            BatteryLevel.EMPTY -> R.drawable.icon_battery_empty
        }

        imageView.setImageResource(iconRes)
    }
}
