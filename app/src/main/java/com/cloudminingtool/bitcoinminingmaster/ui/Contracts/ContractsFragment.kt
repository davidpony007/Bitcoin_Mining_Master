package com.cloudminingtool.bitcoinminingmaster.ui.Contracts

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.ImageView
import android.widget.Button
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
import com.cloudminingtool.bitcoinminingmaster.manager.Contract5_5GhManager
import com.bumptech.glide.Glide
import kotlinx.coroutines.launch

class ContractsFragment : Fragment() {

    private var _binding: FragmentContractsBinding? = null
    // 修复binding的get方法，添加安全检查
    private val binding get() = _binding ?: throw IllegalStateException("Fragment binding is null")

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

        // 使用安全的binding访问
        _binding?.let { binding ->
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
        }

        // 初始化各种观察者
        setupUserIdObserver()
        setupBitcoinPriceObserver()
        setupBitcoinBalanceObserver()
        setupContractCountdownObserver()
        setup5_5GhContractObserver()

        // 初始化倒计时管理器
        ContractCountdownManager.initialize(requireContext())
        Contract5_5GhManager.initialize(requireContext())

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
        viewLifecycleOwner.lifecycleScope.launch {
            UserDataManager.userId.collect { userId ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                // 安全地访问binding和视图
                _binding?.let { binding ->
                    val userIdTextView = binding.root.findViewById<TextView>(R.id.user_id)
                    if (userId != null) {
                        userIdTextView?.text = userId
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            UserDataManager.isLoading.collect { isLoading ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                // 安全地访问binding和视图
                _binding?.let { binding ->
                    val userIdTextView = binding.root.findViewById<TextView>(R.id.user_id)
                    if (isLoading) {
                        userIdTextView?.text = "Loading..."
                    }
                }
            }
        }
    }

    private fun setupBitcoinPriceObserver() {
        viewLifecycleOwner.lifecycleScope.launch {
            BitcoinPriceManager.bitcoinPrice.collect { price ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                // 安全地访问binding和视图
                _binding?.let { binding ->
                    val priceTextView = binding.root.findViewById<TextView>(R.id.id_price)
                    if (price != null) {
                        priceTextView?.text = price
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            BitcoinPriceManager.isLoading.collect { isLoading ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                // 安全地访问binding和视图
                _binding?.let { binding ->
                    val priceTextView = binding.root.findViewById<TextView>(R.id.id_price)
                    if (isLoading && BitcoinPriceManager.getCurrentPrice() == null) {
                        priceTextView?.text = "Loading..."
                    }
                }
            }
        }
    }

    private fun setupBitcoinBalanceObserver() {
        viewLifecycleOwner.lifecycleScope.launch {
            BitcoinBalanceManager.bitcoinBalance.collect { balance ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                // 安全地访问binding和视图
                _binding?.let { binding ->
                    val balanceTextView = binding.root.findViewById<TextView>(R.id.bitcoin_balance)
                    if (balance != null) {
                        balanceTextView?.text = balance
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            BitcoinBalanceManager.isLoading.collect { isLoading ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                // 安全地访问binding和视图
                _binding?.let { binding ->
                    val balanceTextView = binding.root.findViewById<TextView>(R.id.bitcoin_balance)
                    if (isLoading && BitcoinBalanceManager.getCurrentBalance() == null) {
                        balanceTextView?.text = "Loading..."
                    }
                }
            }
        }
    }

    private fun setupContractCountdownObserver() {
        viewLifecycleOwner.lifecycleScope.launch {
            ContractCountdownManager.countdownText.collect { text ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                // 安全地访问binding和视图
                _binding?.let { binding ->
                    val countdownTextView = binding.root.findViewById<TextView>(R.id.remaining_time_7_5Gh)
                    countdownTextView?.text = text
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            ContractCountdownManager.isActive.collect { isActive ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                // 安全地访问binding和视图
                _binding?.let { binding ->
                    val countdownTextView = binding.root.findViewById<TextView>(R.id.remaining_time_7_5Gh)
                    countdownTextView?.let { textView ->
                        val drawable = if (isActive) {
                            R.drawable.green_dot // 激活状态显示绿点
                        } else {
                            R.drawable.red_dot   // 非激活状态显示红点
                        }
                        textView.setCompoundDrawablesWithIntrinsicBounds(drawable, 0, 0, 0)
                    }
                }
            }
        }
    }

    /**
     * 设置5.5Gh合约观察者
     */
    private fun setup5_5GhContractObserver() {
        viewLifecycleOwner.lifecycleScope.launch {
            Contract5_5GhManager.countdownText.collect { text ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                // 安全地访问binding和视图
                _binding?.let { binding ->
                    val countdownTextView = binding.root.findViewById<TextView>(R.id.remaining_time_5_5Gh)
                    countdownTextView?.text = text
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            Contract5_5GhManager.isActive.collect { isActive ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                // 安全地访问binding和视图
                _binding?.let { binding ->
                    val countdownTextView = binding.root.findViewById<TextView>(R.id.remaining_time_5_5Gh)
                    countdownTextView?.let { textView ->
                        val drawable = if (isActive) {
                            R.drawable.green_dot // 激活状态显示绿点
                        } else {
                            R.drawable.red_dot   // 非激活状态显示红点
                        }
                        textView.setCompoundDrawablesWithIntrinsicBounds(drawable, 0, 0, 0)
                    }
                }
            }
        }
    }

    private fun fetchUserIdFromServer() {
        lifecycleScope.launch {
            try {
                val result = userRepository.fetchUserId()
                result.onFailure { exception ->
                    // 添加安全的binding检查
                    _binding?.let { binding ->
                        val userIdTextView = binding.root.findViewById<TextView>(R.id.user_id)
                        userIdTextView?.text = "Failed to load"
                    }
                    exception.printStackTrace()
                }
            } catch (e: Exception) {
                // 添加安全的binding检查
                _binding?.let { binding ->
                    val userIdTextView = binding.root.findViewById<TextView>(R.id.user_id)
                    userIdTextView?.text = "Network error"
                }
                e.printStackTrace()
            }
        }
    }

    private fun fetchBitcoinBalanceFromServer() {
        lifecycleScope.launch {
            try {
                val result = userRepository.fetchBitcoinBalance()
                result.onFailure { exception ->
                    // 添加安全的binding检查
                    _binding?.let { binding ->
                        val balanceTextView = binding.root.findViewById<TextView>(R.id.bitcoin_balance)
                        balanceTextView?.text = "Failed to load"
                    }
                    exception.printStackTrace()
                }
            } catch (e: Exception) {
                // 添加安全的binding检查
                _binding?.let { binding ->
                    val balanceTextView = binding.root.findViewById<TextView>(R.id.bitcoin_balance)
                    balanceTextView?.text = "Network error"
                }
                e.printStackTrace()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}