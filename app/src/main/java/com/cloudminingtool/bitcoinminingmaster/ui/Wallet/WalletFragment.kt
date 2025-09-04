package com.cloudminingtool.bitcoinminingmaster.ui.Wallet

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageButton
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.cloudminingtool.bitcoinminingmaster.R
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
        val root: View = binding.root

        setupViews()
        setupTransactionList()

        return root
    }

    private fun setupViews() {
        // 设置按钮点击事件
        val btnSettings = binding.root.findViewById<ImageButton>(R.id.btnSettings)
        btnSettings.setOnClickListener {
            val intent = Intent(requireContext(), SettingActivity::class.java)
            startActivity(intent)
        }

        // Withdraw按钮点击事件
        val btnWithdraw = binding.root.findViewById<Button>(R.id.btnWithdraw)
        btnWithdraw.setOnClickListener {
            Toast.makeText(requireContext(), "Withdraw feature coming soon", Toast.LENGTH_SHORT).show()
        }
    }

    private fun setupTransactionList() {
        // 创建模拟交易数据
        val transactions = listOf(
            Transaction("Mining Contract", "2025-04-20 21:00:00", "0.000000005332448"),
            Transaction("Mining Contract", "2025-04-20 20:00:00", "0.000000005347389"),
            Transaction("Mining Contract", "2025-04-20 19:00:00", "0.000000005345507"),
            Transaction("Mining Contract", "2025-04-20 18:00:00", "0.000000005321536"),
            Transaction("Mining Contract", "2025-04-20 17:00:00", "0.000000005314699"),
            Transaction("Mining Contract", "2025-04-20 16:00:00", "0.000000005306130")
        )

        // 设置RecyclerView
        val recyclerView = binding.root.findViewById<RecyclerView>(R.id.transactionRecyclerView)
        transactionAdapter = TransactionAdapter(transactions)
        recyclerView.layoutManager = LinearLayoutManager(requireContext())
        recyclerView.adapter = transactionAdapter
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}