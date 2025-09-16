package com.cloudminingtool.bitcoinminingmaster.ui

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.cloudminingtool.bitcoinminingmaster.databinding.ActivityWithdrawBinding
import java.math.BigDecimal
import java.math.RoundingMode

class WithdrawActivity : AppCompatActivity() {

    private lateinit var binding: ActivityWithdrawBinding
    private val networkFee = BigDecimal("0.0000079")
    private val minimumAmount = BigDecimal("0.000022")
    private val currentBalance = BigDecimal("0.000000755534684")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityWithdrawBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupViews()
        setupListeners()
    }

    private fun setupViews() {
        // 设置当前余额显示
        binding.tvCurrentBalance.text = "$currentBalance BTC"

        // 初始状态下禁用提现按钮
        binding.btnWithdraw.isEnabled = false
        binding.btnWithdraw.alpha = 0.5f

        updateAmountReceived()
    }

    private fun setupListeners() {
        // 返回按钮
        binding.btnBack.setOnClickListener {
            finish()
        }

        // History按钮
        binding.btnHistory.setOnClickListener {
            Toast.makeText(this, "History功能待实现", Toast.LENGTH_SHORT).show()
        }

        // All按钮 - 选择全部余额
        binding.btnAll.setOnClickListener {
            if (currentBalance > networkFee) {
                val maxWithdrawAmount = currentBalance.subtract(networkFee)
                // 这里应该设置到金额输入框，但当前布局中没有金额输入框
                // 可以考虑添加一个金额输入框或者直接计算
                updateAmountReceived(maxWithdrawAmount)
                validateWithdrawal()
            } else {
                Toast.makeText(this, "余额不足以支付网络费用", Toast.LENGTH_SHORT).show()
            }
        }

        // 网络选择
        binding.networkCard.setOnClickListener {
            Toast.makeText(this, "网络选择功能待实现", Toast.LENGTH_SHORT).show()
        }

        // 钱包地址输入监听
        binding.etWalletAddress.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                validateWithdrawal()
            }
        })

        // Binance广告点击
        binding.binanceCard.setOnClickListener {
            Toast.makeText(this, "跳转到Binance官网", Toast.LENGTH_SHORT).show()
            // 这里可以添加跳转到Binance官网的逻辑
        }

        // 提现按钮
        binding.btnWithdraw.setOnClickListener {
            performWithdrawal()
        }
    }

    private fun updateAmountReceived(withdrawAmount: BigDecimal = BigDecimal.ZERO) {
        val amountReceived = if (withdrawAmount > BigDecimal.ZERO) {
            withdrawAmount.max(BigDecimal.ZERO)
        } else {
            BigDecimal.ZERO
        }

        binding.tvAmountReceived.text = "${amountReceived.setScale(8, RoundingMode.HALF_UP)} BTC"
        binding.tvNetworkFee.text = "Network Fee ${networkFee.setScale(7, RoundingMode.HALF_UP)} BTC"
    }

    private fun validateWithdrawal(): Boolean {
        val walletAddress = binding.etWalletAddress.text.toString().trim()
        val hasValidAddress = walletAddress.isNotEmpty() && walletAddress.length >= 26

        // 这里应该有金额验证，但当前没有金额输入框
        // 简化为只验证钱包地址
        val isValid = hasValidAddress

        binding.btnWithdraw.isEnabled = isValid
        binding.btnWithdraw.alpha = if (isValid) 1.0f else 0.5f

        return isValid
    }

    private fun performWithdrawal() {
        val walletAddress = binding.etWalletAddress.text.toString().trim()

        if (!validateWithdrawal()) {
            Toast.makeText(this, "请检查输入信息", Toast.LENGTH_SHORT).show()
            return
        }

        // 这里添加实际的提现逻辑
        Toast.makeText(this, "提现请求已提交", Toast.LENGTH_SHORT).show()

        // 可以添加Loading状态和成功/失败回调
        // 暂时简单处理
        finish()
    }
}
