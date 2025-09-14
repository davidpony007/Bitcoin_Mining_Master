package com.cloudminingtool.bitcoinminingmaster.ui.Contracts

import android.content.Context
import android.graphics.BitmapFactory
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
import com.cloudminingtool.bitcoinminingmaster.manager.Contract5_5GhManager
import com.bumptech.glide.Glide
import kotlinx.coroutines.launch
import java.io.File

class ContractsFragment : Fragment() {

    private var _binding: FragmentContractsBinding? = null
    private val binding get() = _binding!!

    private val userRepository = UserRepository()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        try {
            val contractsViewModel = ViewModelProvider(this).get(ContractsViewModel::class.java)

            _binding = FragmentContractsBinding.inflate(inflater, container, false)
            val root: View = _binding?.root ?: return null

            val textView: TextView = binding.textContracts
            contractsViewModel.text.observe(viewLifecycleOwner) {
                textView.text = it
            }

            loadAvatar()
            loadNickname() // Load nickname when fragment is created

            return root
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        try {
            // 检查是否在预览模式下
            if (isInEditMode()) {
                setupPreviewMode()
                return
            }

            // 使用安全的binding访问
            setupGifAnimations()

            // 初始化各种观察者
            setupUserIdObserver()
            setupBitcoinPriceObserver()
            setupBitcoinBalanceObserver()
            setupContractCountdownObserver()
            setup5_5GhContractObserver()

            // 初始化倒计时管理器
            if (context != null) {
                ContractCountdownManager.initialize(requireContext())
                Contract5_5GhManager.initialize(requireContext())
            }

            // 如果还没有用户ID，则从服务端获取
            if (UserDataManager.getCurrentUserId() == null) {
                fetchUserIdFromServer()
            }

            // 如果还没有比特币余额，则从服务端获取
            if (BitcoinBalanceManager.getCurrentBalance() == null) {
                fetchBitcoinBalanceFromServer()
            }

            // 启动比特币价格更新
            BitcoinPriceManager.startPriceUpdates()
            BitcoinPriceManager.fetchBitcoinPriceNow()

        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * 检查是否在预览模式下运行
     */
    private fun isInEditMode(): Boolean {
        return try {
            val currentThread = Thread.currentThread()
            currentThread.name.contains("RenderThread") ||
                    currentThread.name.contains("preview") ||
                    currentThread.name.contains("Layout") ||
                    view?.isInEditMode == true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * 设置预览模式的模拟数据
     */
    private fun setupPreviewMode() {
        try {
            _binding?.let { binding ->
                // 设置模拟的用户ID
                binding.root.findViewById<TextView>(R.id.user_id)?.text = "PREVIEW_USER_123"

                // 设置模拟的比特币价格
                binding.root.findViewById<TextView>(R.id.id_price)?.text = "$65,432.10"

                // 设置模拟的比特币余额
                binding.root.findViewById<TextView>(R.id.bitcoin_balance)?.text = "0.00123456"

                // 设置模拟的倒计时显示
                binding.root.findViewById<TextView>(R.id.remaining_time_7_5Gh)?.text = "02h 30m 45s"
                binding.root.findViewById<TextView>(R.id.remaining_time_5_5Gh)?.text = "01h 15m 30s"
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * 设置GIF动画
     */
    private fun setupGifAnimations() {
        try {
            _binding?.let { binding ->
                // 使用 Glide 加载 GIF 动画
                val imageView2 = binding.root.findViewById<ImageView>(R.id.gifImageView2)
                imageView2?.let {
                    Glide.with(this)
                        .asGif()
                        .load(R.drawable.download2)
                        .into(it)
                }

                val imageView3 = binding.root.findViewById<ImageView>(R.id.gifImageView3)
                imageView3?.let {
                    Glide.with(this)
                        .asGif()
                        .load(R.drawable.download3)
                        .into(it)
                }

                val imageViewkuangji = binding.root.findViewById<ImageView>(R.id.gifImageViewkuangji)
                imageViewkuangji?.let {
                    Glide.with(this)
                        .asGif()
                        .load(R.drawable.kuangji)
                        .into(it)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onResume() {
        super.onResume()
        // 页面可见时确保价格更新正在运行
        BitcoinPriceManager.startPriceUpdates()
        loadAvatar() // Reload avatar when fragment is resumed
        loadNickname() // Load nickname when fragment is resumed
    }

    private fun loadAvatar() {
        val sharedPref = activity?.getSharedPreferences("user_settings", Context.MODE_PRIVATE)
        val savedPath = sharedPref?.getString("avatar_path", null)

        savedPath?.let { path ->
            val file = File(path)
            if (file.exists()) {
                val bitmap = BitmapFactory.decodeFile(file.absolutePath)
                binding.circleImageView.setImageBitmap(bitmap)
            }
        }
    }

    private fun loadNickname() {
        try {
            val sharedPref = activity?.getSharedPreferences("user_settings", Context.MODE_PRIVATE)
            val savedNickname = sharedPref?.getString("nickname", "Bitcoin Mining Master")

            _binding?.let { binding ->
                val nicknameTextView = binding.root.findViewById<TextView>(R.id.nickname)
                nicknameTextView?.text = savedNickname
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupUserIdObserver() {
        try {
            viewLifecycleOwner.lifecycleScope.launch {
                UserDataManager.userId.collect { userId ->
                    if (!isAdded || _binding == null) return@collect

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
                    if (!isAdded || _binding == null) return@collect

                    _binding?.let { binding ->
                        val userIdTextView = binding.root.findViewById<TextView>(R.id.user_id)
                        if (isLoading) {
                            userIdTextView?.text = "Loading..."
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupBitcoinPriceObserver() {
        try {
            viewLifecycleOwner.lifecycleScope.launch {
                BitcoinPriceManager.bitcoinPrice.collect { price ->
                    if (!isAdded || _binding == null) return@collect

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
                    if (!isAdded || _binding == null) return@collect

                    _binding?.let { binding ->
                        val priceTextView = binding.root.findViewById<TextView>(R.id.id_price)
                        if (isLoading && BitcoinPriceManager.getCurrentPrice() == null) {
                            priceTextView?.text = "Loading..."
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupBitcoinBalanceObserver() {
        try {
            viewLifecycleOwner.lifecycleScope.launch {
                BitcoinBalanceManager.bitcoinBalance.collect { balance ->
                    if (!isAdded || _binding == null) return@collect

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
                    if (!isAdded || _binding == null) return@collect

                    _binding?.let { binding ->
                        val balanceTextView = binding.root.findViewById<TextView>(R.id.bitcoin_balance)
                        if (isLoading && BitcoinBalanceManager.getCurrentBalance() == null) {
                            balanceTextView?.text = "Loading..."
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupContractCountdownObserver() {
        try {
            viewLifecycleOwner.lifecycleScope.launch {
                ContractCountdownManager.countdownText.collect { text ->
                    if (!isAdded || _binding == null) return@collect

                    _binding?.let { binding ->
                        val countdownTextView = binding.root.findViewById<TextView>(R.id.remaining_time_7_5Gh)
                        countdownTextView?.text = text
                    }
                }
            }

            viewLifecycleOwner.lifecycleScope.launch {
                ContractCountdownManager.isActive.collect { isActive ->
                    if (!isAdded || _binding == null) return@collect

                    _binding?.let { binding ->
                        val countdownTextView = binding.root.findViewById<TextView>(R.id.remaining_time_7_5Gh)
                        countdownTextView?.let { textView ->
                            val drawable = if (isActive) {
                                R.drawable.green_dot
                            } else {
                                R.drawable.red_dot
                            }
                            textView.setCompoundDrawablesWithIntrinsicBounds(drawable, 0, 0, 0)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setup5_5GhContractObserver() {
        try {
            viewLifecycleOwner.lifecycleScope.launch {
                Contract5_5GhManager.countdownText.collect { text ->
                    if (!isAdded || _binding == null) return@collect

                    _binding?.let { binding ->
                        val countdownTextView = binding.root.findViewById<TextView>(R.id.remaining_time_5_5Gh)
                        countdownTextView?.text = text
                    }
                }
            }

            viewLifecycleOwner.lifecycleScope.launch {
                Contract5_5GhManager.isActive.collect { isActive ->
                    if (!isAdded || _binding == null) return@collect

                    _binding?.let { binding ->
                        val countdownTextView = binding.root.findViewById<TextView>(R.id.remaining_time_5_5Gh)
                        countdownTextView?.let { textView ->
                            val drawable = if (isActive) {
                                R.drawable.green_dot
                            } else {
                                R.drawable.red_dot
                            }
                            textView.setCompoundDrawablesWithIntrinsicBounds(drawable, 0, 0, 0)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun fetchUserIdFromServer() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val result = userRepository.fetchUserId()
                result.onFailure { exception ->
                    if (!isAdded || _binding == null) return@onFailure

                    _binding?.let { binding ->
                        val userIdTextView = binding.root.findViewById<TextView>(R.id.user_id)
                        userIdTextView?.text = "Failed to load"
                    }
                    exception.printStackTrace()
                }
            } catch (e: Exception) {
                if (!isAdded || _binding == null) return@launch

                _binding?.let { binding ->
                    val userIdTextView = binding.root.findViewById<TextView>(R.id.user_id)
                    userIdTextView?.text = "Network error"
                }
                e.printStackTrace()
            }
        }
    }

    private fun fetchBitcoinBalanceFromServer() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val result = userRepository.fetchBitcoinBalance()
                result.onFailure { exception ->
                    if (!isAdded || _binding == null) return@onFailure

                    _binding?.let { binding ->
                        val balanceTextView = binding.root.findViewById<TextView>(R.id.bitcoin_balance)
                        balanceTextView?.text = "Failed to load"
                    }
                    exception.printStackTrace()
                }
            } catch (e: Exception) {
                if (!isAdded || _binding == null) return@launch

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
