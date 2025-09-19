package com.cloudminingtool.bitcoinminingmaster.ui

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.text.InputFilter
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.cloudminingtool.bitcoinminingmaster.R
import com.cloudminingtool.bitcoinminingmaster.data.WithdrawalManager
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.SimpleDateFormat
import java.util.*

class WithdrawActivity : AppCompatActivity() {

    private lateinit var btnBack: ImageButton
    private lateinit var btnHistory: TextView
    private lateinit var etWithdrawAmount: EditText
    private lateinit var etWalletAddress: EditText
    private lateinit var btnAll: TextView
    private lateinit var tvCurrentBalance: TextView
    private lateinit var tvAmountReceived: TextView
    private lateinit var tvNetworkFee: TextView
    private lateinit var btnWithdraw: Button

    // 网络手续费（固定值）
    private val networkFee = BigDecimal("0.0000079")
    // 当前余额 - 使用变量以便更新
    private var currentBalance = BigDecimal("0.100000000000001")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_withdraw)

        initViews()
        setupListeners()
        updateNetworkFeeDisplay()
        updateBalanceDisplay()
        setupWalletAddressValidation()
    }

    private fun initViews() {
        btnBack = findViewById(R.id.btnBack)
        btnHistory = findViewById(R.id.btnHistory)
        etWithdrawAmount = findViewById(R.id.etWithdrawAmount)
        etWalletAddress = findViewById(R.id.etWalletAddress)
        btnAll = findViewById(R.id.btnAll)
        tvCurrentBalance = findViewById(R.id.tvCurrentBalance)
        tvAmountReceived = findViewById(R.id.tvAmountReceived)
        tvNetworkFee = findViewById(R.id.tvNetworkFee)
        btnWithdraw = findViewById(R.id.btnWithdraw)

        // 设置当前余额显示
        tvCurrentBalance.text = "${currentBalance.toPlainString()} BTC"
    }

    private fun setupWalletAddressValidation() {
        // 比特币钱包地址输入过滤器
        val bitcoinAddressFilter = InputFilter { source, start, end, dest, dstart, dend ->
            val validChars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

            for (i in start until end) {
                if (!validChars.contains(source[i])) {
                    return@InputFilter ""
                }
            }
            null
        }

        etWalletAddress.filters = arrayOf(bitcoinAddressFilter, InputFilter.LengthFilter(62))

        etWalletAddress.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}

            override fun afterTextChanged(s: Editable?) {
                updateWithdrawButtonState()
            }
        })
    }

    private fun setupListeners() {
        // 返回按钮
        btnBack.setOnClickListener {
            finish()
        }

        // 历史记录按钮
        btnHistory.setOnClickListener {
            val intent = Intent(this, WithdrawalHistoryActivity::class.java)
            startActivity(intent)
        }

        // "All"按钮 - 填入比特币余额取8位小数的数值
        btnAll.setOnClickListener {
            // 将当前余额格式化为8位小数
            val balanceWith8Decimals = currentBalance.setScale(8, RoundingMode.DOWN)
            etWithdrawAmount.setText(balanceWith8Decimals.toPlainString())
        }

        // 提取金额输入监听
        etWithdrawAmount.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}

            override fun afterTextChanged(s: Editable?) {
                // 限制小数点后不超过8位
                val text = s.toString()
                if (text.contains(".")) {
                    val decimalIndex = text.indexOf(".")
                    if (text.length - decimalIndex > 9) { // 小数点 + 8位数字 = 9个字符
                        val limitedText = text.substring(0, decimalIndex + 9)
                        etWithdrawAmount.removeTextChangedListener(this)
                        etWithdrawAmount.setText(limitedText)
                        etWithdrawAmount.setSelection(limitedText.length)
                        etWithdrawAmount.addTextChangedListener(this)
                        return
                    }
                }

                calculateAmountReceived()
                updateWithdrawButtonState()
            }
        })

        // 提取按钮
        btnWithdraw.setOnClickListener {
            performWithdraw()
        }
    }

    private fun updateNetworkFeeDisplay() {
        tvNetworkFee.text = "Network Fee ${networkFee.toPlainString()} BTC"
    }

    private fun updateBalanceDisplay() {
        // 更新余额显示逻辑
        tvCurrentBalance.text = "${currentBalance.toPlainString()} BTC"
    }

    private fun calculateAmountReceived() {
        val inputText = etWithdrawAmount.text.toString().trim()

        if (inputText.isEmpty()) {
            tvAmountReceived.text = "0 BTC"
            return
        }

        try {
            val withdrawAmount = BigDecimal(inputText)

            // 计算实际到账金额 = 提取金额 - 网络手续费
            val amountReceived = withdrawAmount.subtract(networkFee)

            // 如果计算结果小于0，显示0
            val finalAmount = if (amountReceived < BigDecimal.ZERO) {
                BigDecimal.ZERO
            } else {
                amountReceived
            }

            // 保留合适的小数位数显示
            val formattedAmount = if (finalAmount == BigDecimal.ZERO) {
                "0"
            } else {
                finalAmount.setScale(12, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString()
            }

            tvAmountReceived.text = "$formattedAmount BTC"

        } catch (e: NumberFormatException) {
            tvAmountReceived.text = "0 BTC"
        }
    }

    private fun updateWithdrawButtonState() {
        val inputText = etWithdrawAmount.text.toString().trim()

        try {
            if (inputText.isEmpty()) {
                btnWithdraw.isEnabled = false
                return
            }

            val withdrawAmount = BigDecimal(inputText)

            // 只要金额有效就启用按钮，钱包地址验证在点击时处理
            val isValidAmount = withdrawAmount > BigDecimal.ZERO
            btnWithdraw.isEnabled = isValidAmount

        } catch (e: NumberFormatException) {
            btnWithdraw.isEnabled = false
        }
    }

    private fun isValidBitcoinAddress(address: String): Boolean {
        if (address.isEmpty()) return false

        return when {
            // Legacy address (P2PKH): starts with '1'
            address.startsWith("1") && address.length in 26..35 -> true
            // Script Hash address (P2SH): starts with '3'
            address.startsWith("3") && address.length in 26..35 -> true
            // Bech32 address (P2WPKH): starts with 'bc1'
            address.startsWith("bc1") && (address.length == 42 || address.length == 62) -> true
            else -> false
        }
    }

    private fun performWithdraw() {
        val inputText = etWithdrawAmount.text.toString().trim()
        val walletAddress = etWalletAddress.text.toString().trim()

        try {
            val withdrawAmount = BigDecimal(inputText)
            val minimumAmount = BigDecimal("0.000022")

            // 检查钱包地址是否有效
            if (!isValidBitcoinAddress(walletAddress)) {
                Toast.makeText(this, "Please enter a valid Bitcoin wallet address", Toast.LENGTH_SHORT).show()
                return
            }

            // 检查24小时内提现次数限制
            if (!canWithdrawWithin24Hours()) {
                Toast.makeText(this, "Daily withdrawal limit reached (3/24h)", Toast.LENGTH_LONG).show()
                return
            }

            // 检查输入金额是否小于最小金额
            if (withdrawAmount < minimumAmount) {
                Toast.makeText(this, "The amount entered is lower than the minimum amount required", Toast.LENGTH_SHORT).show()
                return
            }

            // 检查输入金额是否超过账户余额
            if (withdrawAmount > currentBalance) {
                Toast.makeText(this, "The amount entered exceeds your account balance", Toast.LENGTH_SHORT).show()
                return
            }

            // 检查是否扣除手续费后还有余额
            if (withdrawAmount <= networkFee) {
                Toast.makeText(this, "The amount entered is not sufficient to cover the network fee", Toast.LENGTH_SHORT).show()
                return
            }

            val amountReceived = withdrawAmount.subtract(networkFee)

            // 生成交易ID
            val transactionId = generateTransactionId()

            // 获取UTC时间，精确到秒
            val utcDateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
            utcDateFormat.timeZone = TimeZone.getTimeZone("UTC")
            val utcDate = utcDateFormat.format(Date())

            // 创建提取记录，包含钱包地址信息
            val withdrawalItem = WithdrawalHistoryItem(
                amount = "${amountReceived.setScale(12, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString()} BTC",
                status = "Pending",
                date = "$utcDate UTC",
                transactionId = transactionId,
                walletAddress = walletAddress
            )

            // 添加到历史记录
            WithdrawalManager.addWithdrawal(withdrawalItem)

            // 扣减比特币余额
            currentBalance = currentBalance.subtract(withdrawAmount)
            updateBalanceDisplay()

            // 清空输入框
            etWithdrawAmount.setText("")
            etWalletAddress.setText("")

            // 显示指定的成功提示
            Toast.makeText(this, "Withdrawal has been submitted", Toast.LENGTH_SHORT).show()

            // 跳转到历史页面
            val intent = Intent(this, WithdrawalHistoryActivity::class.java)
            startActivity(intent)

        } catch (e: NumberFormatException) {
            Toast.makeText(this, "Invalid amount format", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * 检查用户在24小时内是否可以提现
     * 限制：24小时内最多提现3次
     */
    private fun canWithdrawWithin24Hours(): Boolean {
        val historyList = WithdrawalManager.getWithdrawalHistory()
        val current = System.currentTimeMillis()
        val twentyFourHoursAgo = current - (24 * 60 * 60 * 1000) // 24小时前的时间戳

        var withdrawalCount = 0

        for (item in historyList) {
            try {
                // 解析提现记录的时间
                val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                dateFormat.timeZone = TimeZone.getTimeZone("UTC")

                // 移除 " UTC" 后缀来解析时间
                val dateString = item.date.replace(" UTC", "")
                val withdrawalTime = dateFormat.parse(dateString)?.time ?: continue

                // 如果提现时间在24小时内，计数加1
                if (withdrawalTime > twentyFourHoursAgo) {
                    withdrawalCount++
                }

                // 如果已经达到3次，返回false
                if (withdrawalCount >= 3) {
                    return false
                }
            } catch (e: Exception) {
                // 忽略解析错误的记录
                continue
            }
        }

        return true
    }

    private fun generateTransactionId(): String {
        // 生成随机交易ID
        val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        return (1..10)
            .map { chars.random() }
            .joinToString("")
            .let { "TX$it" }
    }
}
