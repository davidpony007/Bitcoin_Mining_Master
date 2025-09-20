package com.cloudminingtool.bitcoinminingmaster.ui.Wallet

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.cloudminingtool.bitcoinminingmaster.R
import com.cloudminingtool.bitcoinminingmaster.databinding.FragmentWalletBinding
import com.cloudminingtool.bitcoinminingmaster.ui.SettingActivity
import com.cloudminingtool.bitcoinminingmaster.ui.WithdrawActivity
import com.cloudminingtool.bitcoinminingmaster.manager.BitcoinBalanceManager
import kotlinx.coroutines.launch

class WalletFragment : Fragment() {

    private var _binding: FragmentWalletBinding? = null
    private val binding get() = _binding!!
    private lateinit var walletViewModel: WalletViewModel
    private lateinit var transactionAdapter: TransactionAdapter
    private var balanceListener: com.example.bitcoinminingmaster.util.BalanceManager.BalanceListener? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        walletViewModel = ViewModelProvider(this)[WalletViewModel::class.java]
        _binding = FragmentWalletBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupViews()
        setupTransactionRecyclerView()
        observeViewModel()
        // 余额联动
        val balanceManager = com.example.bitcoinminingmaster.util.BalanceManager.instance
        balanceListener = object : com.example.bitcoinminingmaster.util.BalanceManager.BalanceListener {
            override fun onBalanceChanged(newBalance: String) {
                binding.bitcoinBalance.text = getString(R.string.btc_with_unit, newBalance)
            }
        }
        // 初始显示
        binding.bitcoinBalance.text = getString(R.string.btc_with_unit, balanceManager.getBalance())
        balanceManager.addListener(balanceListener!!)
    }

    private fun setupViews() {
        // Settings按钮点击事件
        binding.btnSettings.setOnClickListener {
            val intent = Intent(requireContext(), SettingActivity::class.java)
            startActivity(intent)
        }

        // Withdraw按钮点击事件 - 跳转到Withdrawal页面
        binding.btnWithdraw.setOnClickListener {
            val intent = Intent(requireContext(), WithdrawActivity::class.java)
            startActivity(intent)
        }
    }

    private fun setupTransactionRecyclerView() {
        // 创建模拟交易数据
        val transactions = listOf(
            TransactionItem("Mining Reward", "2025-01-15", "+0.00000012 BTC", "completed"),
            TransactionItem("Mining Reward", "2025-01-14", "+0.00000011 BTC", "completed"),
            TransactionItem("Mining Reward", "2025-01-13", "+0.00000010 BTC", "completed"),
            TransactionItem("Withdraw", "2025-01-12", "-0.00001000 BTC", "completed"),
            TransactionItem("Mining Reward", "2025-01-11", "+0.00000009 BTC", "completed")
        )

        transactionAdapter = TransactionAdapter(transactions)
        binding.transactionRecyclerView.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = transactionAdapter
        }
    }

    private fun observeViewModel() {
        // 保留原有的 ViewModel 观察，但优先使用全局余额
        // 这里可以保留其他业务逻辑
    }

    override fun onDestroyView() {
        // 移除余额监听，防止内存泄漏
        val balanceManager = com.example.bitcoinminingmaster.util.BalanceManager.instance
        balanceListener?.let { balanceManager.removeListener(it) }
        balanceListener = null
        super.onDestroyView()
        _binding = null
    }
}