package com.cloudminingtool.bitcoinminingmaster.ui.Contracts

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.ImageView
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import com.cloudminingtool.bitcoinminingmaster.databinding.FragmentContractsBinding
import com.cloudminingtool.bitcoinminingmaster.R
import com.cloudminingtool.bitcoinminingmaster.repository.UserRepository
import com.cloudminingtool.bitcoinminingmaster.manager.UserDataManager
import com.cloudminingtool.bitcoinminingmaster.manager.BitcoinPriceManager
import com.cloudminingtool.bitcoinminingmaster.manager.BitcoinBalanceManager
import com.cloudminingtool.bitcoinminingmaster.manager.ContractCountdownManager
import com.bumptech.glide.Glide
import kotlinx.coroutines.launch

class ContractsFragment : Fragment() {

    private var _binding: FragmentContractsBinding? = null
    private val binding get() = _binding!!

    private val userRepository = UserRepository()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val contractsViewModel =
            ViewModelProvider(this).get(ContractsViewModel::class.java)

        _binding = FragmentContractsBinding.inflate(inflater, container, false)
        val root: View = binding.root

        val textView: TextView = binding.textContracts
        contractsViewModel.text.observe(viewLifecycleOwner) {
            textView.text = it
        }

        return root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // 使用 Glide 加载 GIF 动画
        val imageView2 = binding.root.findViewById<ImageView>(R.id.gifImageView2)
        Glide.with(this)
            .asGif()
            .load(R.drawable.download2)
            .into(imageView2)

        val imageView3 = binding.root.findViewById<ImageView>(R.id.gifImageView3)
        Glide.with(this)
            .asGif()
            .load(R.drawable.download3)
            .into(imageView3)

        val imageViewkuangji = binding.root.findViewById<ImageView>(R.id.gifImageViewkuangji)
        Glide.with(this)
            .asGif()
            .load(R.drawable.kuangji)
            .into(imageViewkuangji)

        // 初始化用户ID显示
        setupUserIdObserver()

        // 初始化比特币价格显示
        setupBitcoinPriceObserver()

        // 初始化比特币余额显示
        setupBitcoinBalanceObserver()

        // 初始化合约倒计时显示
        setupContractCountdownObserver()

        // 初始化倒计时管理器
        ContractCountdownManager.initialize(requireContext())

        // 如果还没有用户ID，则从服务端获取
        if (UserDataManager.getCurrentUserId() == null) {
            fetchUserIdFromServer()
        }

        // 如果还没有比特币余额，则从服务端获取
        if (BitcoinBalanceManager.getCurrentBalance() == null) {
            fetchBitcoinBalanceFromServer()
        }
    }

    override fun onResume() {
        super.onResume()
        // 页面可见时确保价格更新正在运行
        BitcoinPriceManager.startPriceUpdates()
    }

    private fun setupUserIdObserver() {
        val userIdTextView = binding.root.findViewById<TextView>(R.id.user_id)

        // 监听用户ID状态变化
        lifecycleScope.launch {
            UserDataManager.userId.collect { userId ->
                if (userId != null) {
                    userIdTextView.text = userId
                }
            }
        }

        // 监听加载状态
        lifecycleScope.launch {
            UserDataManager.isLoading.collect { isLoading ->
                if (isLoading) {
                    userIdTextView.text = "Loading..."
                }
            }
        }
    }

    private fun setupBitcoinPriceObserver() {
        val priceTextView = binding.root.findViewById<TextView>(R.id.id_price)

        // 监听比特币价格变化，与Dashboard页面同步
        lifecycleScope.launch {
            BitcoinPriceManager.bitcoinPrice.collect { price ->
                if (price != null) {
                    priceTextView.text = price
                }
            }
        }

        // 监听价格加载状态
        lifecycleScope.launch {
            BitcoinPriceManager.isLoading.collect { isLoading ->
                if (isLoading && BitcoinPriceManager.getCurrentPrice() == null) {
                    priceTextView.text = "Loading..."
                }
            }
        }
    }

    private fun setupBitcoinBalanceObserver() {
        val balanceTextView = binding.root.findViewById<TextView>(R.id.bitcoin_balance)

        // 监听比特币余额变化，与Dashboard页面同步
        lifecycleScope.launch {
            BitcoinBalanceManager.bitcoinBalance.collect { balance ->
                if (balance != null) {
                    balanceTextView.text = balance
                }
            }
        }

        // 监听余额加载状态
        lifecycleScope.launch {
            BitcoinBalanceManager.isLoading.collect { isLoading ->
                if (isLoading && BitcoinBalanceManager.getCurrentBalance() == null) {
                    balanceTextView.text = "Loading..."
                }
            }
        }
    }

    private fun setupContractCountdownObserver() {
        val countdownTextView = binding.root.findViewById<TextView>(R.id.remaining_time_7_5Gh)

        // 监听倒计时文本变化
        lifecycleScope.launch {
            ContractCountdownManager.countdownText.collect { text ->
                countdownTextView.text = text
            }
        }

        // 监听激活状态变化，切换绿点/红点
        lifecycleScope.launch {
            ContractCountdownManager.isActive.collect { isActive ->
                // 根据激活状态切换drawable
                val drawable = if (isActive) {
                    R.drawable.green_dot // 激活状态显示绿点
                } else {
                    R.drawable.red_dot   // 非激活状态显示红点
                }
                countdownTextView.setCompoundDrawablesWithIntrinsicBounds(drawable, 0, 0, 0)
            }
        }
    }

    private fun fetchUserIdFromServer() {
        lifecycleScope.launch {
            try {
                val result = userRepository.fetchUserId()
                result.onFailure { exception ->
                    val userIdTextView = binding.root.findViewById<TextView>(R.id.user_id)
                    userIdTextView.text = "Failed to load"
                    exception.printStackTrace()
                }
            } catch (e: Exception) {
                val userIdTextView = binding.root.findViewById<TextView>(R.id.user_id)
                userIdTextView.text = "Network error"
                e.printStackTrace()
            }
        }
    }

    private fun fetchBitcoinBalanceFromServer() {
        lifecycleScope.launch {
            try {
                val result = userRepository.fetchBitcoinBalance()
                result.onFailure { exception ->
                    val balanceTextView = binding.root.findViewById<TextView>(R.id.bitcoin_balance)
                    balanceTextView.text = "Failed to load"
                    exception.printStackTrace()
                }
            } catch (e: Exception) {
                val balanceTextView = binding.root.findViewById<TextView>(R.id.bitcoin_balance)
                balanceTextView.text = "Network error"
                e.printStackTrace()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}