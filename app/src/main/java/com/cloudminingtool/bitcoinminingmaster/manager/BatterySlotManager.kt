package com.cloudminingtool.bitcoinminingmaster.manager

import android.util.Log
import android.widget.ImageView
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import com.cloudminingtool.bitcoinminingmaster.R
import kotlin.math.ceil
import kotlin.math.min

/**
 * 电池槽管理器
 * 管理48个电池格子的状态、倒计时和动画
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

    // 总共48个电池格子（与XML布局匹配）
    private const val TOTAL_BATTERIES = 48

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
        try {
            // 确保所有电池初始化为空电池状态
            resetAllBatteries()
            updateActiveBatteryCount()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * 添加两个满格电池
     * 电池的增加顺序为从左往右，从上往下
     */
    fun addTwoBatteries() {
        try {
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
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * 更新呼吸电池
     * 只有一个电池可以呼吸，优先选择电量最少的有电电池
     */
    private fun updateBreathingBattery() {
        try {
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
                    if (state.level.ordinal < minLevel.ordinal) {
                        minLevel = state.level
                        breathingIndex = i
                    }
                }
            }

            // 设置呼吸电池
            if (breathingIndex != -1) {
                currentStates[breathingIndex] = currentStates[breathingIndex].copy(isBreathing = true)
                breathingBatteryIndex = breathingIndex
            } else {
                breathingBatteryIndex = -1
            }

            _batteryStates.value = currentStates
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * 更新活跃电池数量
     */
    private fun updateActiveBatteryCount() {
        try {
            val count = _batteryStates.value.count { it.level != BatteryLevel.EMPTY }
            _activeBatteryCount.value = count
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * 根据剩余分钟数计算电池电量等级
     */
    private fun calculateBatteryLevel(remainingMinutes: Int): BatteryLevel {
        return when {
            remainingMinutes <= 0 -> BatteryLevel.EMPTY
            remainingMinutes <= 15 -> BatteryLevel.ONE_QUARTER
            remainingMinutes <= 30 -> BatteryLevel.HALF
            remainingMinutes <= 45 -> BatteryLevel.THREE_QUARTER
            else -> BatteryLevel.FULL
        }
    }

    /**
     * 更新所有电池状态（每分钟调用一次）
     */
    fun updateBatteryStates() {
        try {
            val currentStates = _batteryStates.value.toMutableList()
            var hasChanges = false

            for (i in currentStates.indices) {
                val state = currentStates[i]
                if (state.isCountingDown && state.remainingMinutes > 0) {
                    val newRemainingMinutes = state.remainingMinutes - 1
                    val newLevel = calculateBatteryLevel(newRemainingMinutes)
                    val newIsCountingDown = newRemainingMinutes > 0

                    currentStates[i] = state.copy(
                        level = newLevel,
                        remainingMinutes = newRemainingMinutes,
                        isCountingDown = newIsCountingDown
                    )
                    hasChanges = true
                }
            }

            if (hasChanges) {
                _batteryStates.value = currentStates
                updateActiveBatteryCount()
                updateBreathingBattery()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * 获取当前活跃电池数量
     */
    fun getCurrentActiveBatteryCount(): Int {
        return try {
            _activeBatteryCount.value
        } catch (e: Exception) {
            e.printStackTrace()
            0
        }
    }

    /**
     * 获取指定索引的电池状态
     */
    fun getBatteryState(index: Int): BatteryState? {
        return try {
            if (index in 0 until TOTAL_BATTERIES) {
                _batteryStates.value[index]
            } else {
                null
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * 清空所有电池
     */
    fun clearAllBatteries() {
        try {
            _batteryStates.value = List(TOTAL_BATTERIES) { BatteryState() }
            _activeBatteryCount.value = 0
            breathingBatteryIndex = -1
        } catch (e: Exception) {
            e.printStackTrace()
        }
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

    /**
     * 根据合约剩余小时数设置电池状态
     * 每个电池代表1小时，总共48个电池格
     * 不参与倒计时的满格电池靠左，参与倒计时的电池排在右边
     * @param totalRemainingHours 合约剩余的总小时数
     */
    fun updateBatteriesByRemainingHours(totalRemainingHours: Float) {
        try {
            val currentStates = _batteryStates.value.toMutableList()
            val totalMinutes = totalRemainingHours * 60

            // 计算需要点亮的电池数量
            val fullBatteries = totalMinutes.toInt() / 60
            val partialBatteryMinutes = totalMinutes.toInt() % 60

            val totalActiveBatteries = if (partialBatteryMinutes > 0) fullBatteries + 1 else fullBatteries
            val activeBatteries = min(totalActiveBatteries, TOTAL_BATTERIES)

            Log.d("BatterySlotManager", "Updating batteries: totalHours=$totalRemainingHours, totalMinutes=${totalMinutes.toInt()}, fullBatteries=$fullBatteries, partialMinutes=$partialBatteryMinutes, activeBatteries=$activeBatteries")

            // 先将所有电池设置为空电池状态
            for (i in 0 until TOTAL_BATTERIES) {
                currentStates[i] = BatteryState(
                    level = BatteryLevel.EMPTY,
                    remainingMinutes = 0,
                    isCountingDown = false
                )
            }

            // 按照从左到右，从上到下的顺序填充电池
            // 不参与倒计时的满格电池靠左，参与倒计时的电池排在右边
            val batteryPositions = generateLeftToRightBatteryPositions()

            // 计算不参与倒计时的满格电池数量（假设总共有一些静态电池）
            val staticBatteries = 0 // 暂时设为0，可以根据需要调整
            val countdownBatteries = activeBatteries

            // 先填充静态电池（不参与倒计时的满格电池）
            for (i in 0 until staticBatteries) {
                val position = batteryPositions[i]
                currentStates[position] = BatteryState(
                    level = BatteryLevel.FULL,
                    remainingMinutes = 60,
                    isCountingDown = false // 不参与倒计时
                )
            }

            // 然后填充倒计时电池（从静态电池右边开始）
            for (i in 0 until countdownBatteries) {
                val position = batteryPositions[staticBatteries + i]

                if (i < fullBatteries) {
                    // 满电电池
                    currentStates[position] = BatteryState(
                        level = BatteryLevel.FULL,
                        remainingMinutes = 60,
                        isCountingDown = true
                    )
                } else if (i == fullBatteries && partialBatteryMinutes > 0) {
                    // 部分电量的电池
                    currentStates[position] = BatteryState(
                        level = calculateBatteryLevel(partialBatteryMinutes),
                        remainingMinutes = partialBatteryMinutes,
                        isCountingDown = true
                    )
                }
            }

            _batteryStates.value = currentStates
            updateActiveBatteryCount()
            updateBreathingBattery()
        } catch (e: Exception) {
            e.printStackTrace()
            Log.e("BatterySlotManager", "Error in updateBatteriesByRemainingHours", e)
        }
    }

    /**
     * 生成电池位置序列，从左到右，从上到下
     * 排列顺序：从左到右，从上到下
     */
    private fun generateLeftToRightBatteryPositions(): List<Int> {
        val positions = mutableListOf<Int>()

        // 4行12列的布局，从左上角开始
        for (row in 0 until 4) {
            for (col in 0 until 12) {
                val position = row * 12 + col
                positions.add(position)
            }
        }

        return positions
    }
}
