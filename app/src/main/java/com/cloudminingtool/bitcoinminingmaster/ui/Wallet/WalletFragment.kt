package com.cloudminingtool.bitcoinminingmaster.ui.Wallet

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import com.cloudminingtool.bitcoinminingmaster.databinding.FragmentWalletBinding
import com.cloudminingtool.bitcoinminingmaster.ui.SettingActivity

class WalletFragment : Fragment() {

    private var _binding: FragmentWalletBinding? = null
    private val binding get() = _binding!!
    private lateinit var transactionAdapter: TransactionAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentWalletBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupViews()
        setupTransactionList()
    }

    private fun setupViews() {
        // 使用安全的方式获取视图引用
        _binding?.let { binding ->
            // 设置按钮点击事件 - 添加空值检查
            binding.root.findViewById<android.widget.ImageButton>(com.cloudminingtool.bitcoinminingmaster.R.id.btnSettings)?.let { btnSettings ->
                btnSettings.setOnClickListener {
                    try {
                        val intent = Intent(requireContext(), SettingActivity::class.java)
                        startActivity(intent)
                    } catch (e: Exception) {
                        e.printStackTrace()
                        Toast.makeText(context, "无法打开设置页面", Toast.LENGTH_SHORT).show()
                    }
                }
            }

            // Withdraw按钮点击事件 - 添加空值检查
            binding.root.findViewById<android.widget.Button>(com.cloudminingtool.bitcoinminingmaster.R.id.btnWithdraw)?.let { btnWithdraw ->
                btnWithdraw.setOnClickListener {
                    Toast.makeText(requireContext(), "Withdraw feature coming soon", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun setupTransactionList() {
        // 使用安全的方式设置RecyclerView
        _binding?.let { binding ->
            try {
                // 创建模拟交易数据
                val transactions = listOf(
                    Transaction("Mining Contract", "2025-04-20 21:00:00", "0.000000005332448"),
                    Transaction("Mining Contract", "2025-04-20 20:00:00", "0.000000005347389"),
                    Transaction("Mining Contract", "2025-04-20 19:00:00", "0.000000005345507"),
                    Transaction("Mining Contract", "2025-04-20 18:00:00", "0.000000005321536"),
                    Transaction("Mining Contract", "2025-04-20 17:00:00", "0.000000005314699"),
                    Transaction("Mining Contract", "2025-04-20 16:00:00", "0.000000005306130")
                )

                // 设置RecyclerView - 添加空值检查
                binding.root.findViewById<androidx.recyclerview.widget.RecyclerView>(com.cloudminingtool.bitcoinminingmaster.R.id.transactionRecyclerView)?.let { recyclerView ->
                    transactionAdapter = TransactionAdapter(transactions)
                    recyclerView.layoutManager = LinearLayoutManager(requireContext())
                    recyclerView.adapter = transactionAdapter
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(context, "初始化交易列表失败", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}