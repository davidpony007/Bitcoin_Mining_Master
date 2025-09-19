package com.cloudminingtool.bitcoinminingmaster.ui

import android.os.Bundle
import android.widget.ImageButton
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.cloudminingtool.bitcoinminingmaster.R
import com.cloudminingtool.bitcoinminingmaster.data.WithdrawalManager

class WithdrawalHistoryActivity : AppCompatActivity() {

    private lateinit var btnBack: ImageButton
    private lateinit var titleText: TextView
    private lateinit var rvWithdrawalHistory: RecyclerView
    private lateinit var emptyStateView: androidx.constraintlayout.widget.ConstraintLayout
    private lateinit var historyAdapter: WithdrawalHistoryAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_withdrawal_history)

        initViews()
        setupViews()
        loadWithdrawalHistory()
    }

    override fun onResume() {
        super.onResume()
        // 每次页面显示时重新加载数据
        loadWithdrawalHistory()
    }

    private fun initViews() {
        btnBack = findViewById(R.id.btnBack)
        titleText = findViewById(R.id.titleText)
        rvWithdrawalHistory = findViewById(R.id.rvWithdrawalHistory)
        emptyStateView = findViewById(R.id.emptyStateView)
    }

    private fun setupViews() {
        // 设置返回按钮
        btnBack.setOnClickListener {
            finish()
        }

        // 设置标题
        titleText.text = "Withdrawal History"

        // 设置RecyclerView
        rvWithdrawalHistory.layoutManager = LinearLayoutManager(this)
        historyAdapter = WithdrawalHistoryAdapter(emptyList())
        rvWithdrawalHistory.adapter = historyAdapter
    }

    private fun loadWithdrawalHistory() {
        // 从WithdrawalManager获取历史记录
        val historyList = WithdrawalManager.getWithdrawalHistory()

        if (historyList.isEmpty()) {
            showEmptyState()
        } else {
            showHistoryList(historyList)
        }
    }

    private fun showEmptyState() {
        rvWithdrawalHistory.visibility = android.view.View.GONE
        emptyStateView.visibility = android.view.View.VISIBLE
    }

    private fun showHistoryList(historyList: List<WithdrawalHistoryItem>) {
        rvWithdrawalHistory.visibility = android.view.View.VISIBLE
        emptyStateView.visibility = android.view.View.GONE

        // 更新适配器数据
        historyAdapter.updateData(historyList)
    }
}

// 提取历史记录数据类
data class WithdrawalHistoryItem(
    val amount: String,
    val status: String,
    val date: String,
    val transactionId: String,
    val walletAddress: String = "" // 添加钱包地址字段，默认值为空字符串以保证向后兼容
)
