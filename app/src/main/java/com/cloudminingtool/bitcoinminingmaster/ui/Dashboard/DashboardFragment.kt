package com.cloudminingtool.bitcoinminingmaster.ui.Dashboard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import com.cloudminingtool.bitcoinminingmaster.databinding.FragmentDashboardBinding
import com.cloudminingtool.bitcoinminingmaster.manager.UserDataManager
import com.cloudminingtool.bitcoinminingmaster.manager.BitcoinPriceManager
import com.cloudminingtool.bitcoinminingmaster.manager.BitcoinBalanceManager
import com.cloudminingtool.bitcoinminingmaster.manager.ContractCountdownManager
import com.cloudminingtool.bitcoinminingmaster.manager.Contract5_5GhManager
import com.cloudminingtool.bitcoinminingmaster.repository.UserRepository
import com.cloudminingtool.bitcoinminingmaster.R
import android.widget.Toast
import kotlinx.coroutines.launch

class DashboardFragment : Fragment() {

    private var _binding: FragmentDashboardBinding? = null
    // 修复：使用安全的binding访问方式
    private val binding get() = _binding

    private val userRepository = UserRepository()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        val root: View = _binding?.root ?: return null

        // ViewModel 相关代码
        val dashboardViewModel = ViewModelProvider(this).get(DashboardViewModel::class.java)
        _binding?.let { binding ->
            val textView: TextView = binding.textDashboard
            dashboardViewModel.text.observe(viewLifecycleOwner) {
                textView.text = it
            }
        }

        return root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // 初始化用户ID显示
        setupUserIdObserver()

        // 初始化比特币价格显示
        setupBitcoinPriceObserver()

        // 初始化比特币余额显示
        setupBitcoinBalanceObserver()

        // 初始化合约倒计时显示
        setupContractCountdownObserver()

        // 设置7.5Gh/s按钮点击事件
        setupButton7_5GhClickListener()

        // 设置5.5Gh/s按钮点击事件
        setupButton5_5GhClickListener()

        // 初始化倒计时管理器
        ContractCountdownManager.initialize(requireContext())
        Contract5_5GhManager.initialize(requireContext())

        // 如果还没有比特币余额，则从服务端获取
        if (BitcoinBalanceManager.getCurrentBalance() == null) {
            fetchBitcoinBalanceFromServer()
        }
    }

    override fun onResume() {
        super.onResume()
        // 页面可见时开始价格更新
        BitcoinPriceManager.startPriceUpdates()
        // 立即获取一次价格
        BitcoinPriceManager.fetchBitcoinPriceNow()
    }

    override fun onPause() {
        super.onPause()
        // 页面不可见时停止更新（节省资源）
        BitcoinPriceManager.stopPriceUpdates()
    }

    private fun setupUserIdObserver() {
        // 监听用户ID状态变化，与Contract页面同步
        viewLifecycleOwner.lifecycleScope.launch {
            UserDataManager.userId.collect { userId ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                _binding?.let { binding ->
                    val userIdTextView = binding.root.findViewById<TextView>(R.id.user_id)
                    if (userId != null) {
                        userIdTextView?.text = userId
                    } else {
                        // 如果用户ID为空，显示默认文本
                        userIdTextView?.text = "Not loaded"
                    }
                }
            }
        }

        // 监听加载状态
        viewLifecycleOwner.lifecycleScope.launch {
            UserDataManager.isLoading.collect { isLoading ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

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
        // 监听比特币价格变化
        viewLifecycleOwner.lifecycleScope.launch {
            BitcoinPriceManager.bitcoinPrice.collect { price ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                _binding?.let { binding ->
                    val priceTextView = binding.root.findViewById<TextView>(R.id.id_price)
                    if (price != null) {
                        priceTextView?.text = price
                    }
                }
            }
        }

        // 监听价格加载状态
        viewLifecycleOwner.lifecycleScope.launch {
            BitcoinPriceManager.isLoading.collect { isLoading ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

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
        // 监听比特币余额变化，与Contract页面同步
        viewLifecycleOwner.lifecycleScope.launch {
            BitcoinBalanceManager.bitcoinBalance.collect { balance ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                _binding?.let { binding ->
                    val balanceTextView = binding.root.findViewById<TextView>(R.id.bitcoin_balance)
                    if (balance != null) {
                        balanceTextView?.text = balance
                    } else {
                        // 如果余额为空，显示默认文本
                        balanceTextView?.text = "Not loaded"
                    }
                }
            }
        }

        // 监听余额加载状态
        viewLifecycleOwner.lifecycleScope.launch {
            BitcoinBalanceManager.isLoading.collect { isLoading ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

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
        // 监听倒计时文本变化
        viewLifecycleOwner.lifecycleScope.launch {
            ContractCountdownManager.countdownText.collect { text ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                // 可以将状态信息显示在按钮上或附近
                // 这里暂时用Toast显示，你可以根据UI需求调整
            }
        }

        // 监听激活状态变化
        viewLifecycleOwner.lifecycleScope.launch {
            ContractCountdownManager.isActive.collect { isActive ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                _binding?.let { binding ->
                    val button7_5Gh = binding.root.findViewById<Button>(R.id.button_7_5Gh)
                    // 根据激活状态更新按钮样式
                    button7_5Gh?.alpha = if (isActive) 0.5f else 1.0f
                }
            }
        }

        // 监听是否可以激活
        viewLifecycleOwner.lifecycleScope.launch {
            ContractCountdownManager.canActivate.collect { canActivate ->
                // 检查Fragment是否仍然活跃
                if (!isAdded || _binding == null) return@collect

                _binding?.let { binding ->
                    val button7_5Gh = binding.root.findViewById<Button>(R.id.button_7_5Gh)
                    // 根据冷却状态启用/禁用按钮
                    button7_5Gh?.isEnabled = canActivate
                }
            }
        }
    }

    private fun setupButton7_5GhClickListener() {
        // 使用安全的binding访问
        _binding?.let { binding ->
            val button7_5Gh = binding.root.findViewById<Button>(R.id.button_7_5Gh)
            button7_5Gh?.setOnClickListener {
                if (ContractCountdownManager.canActivateContract()) {
                    // 检查是否可以激活
                    showAdAndActivateContract()
                } else {
                    // 仍在冷却期
                    val remainingTime = ContractCountdownManager.getRemainingCooldownTime()
                    val hours = remainingTime / (1000 * 60 * 60)
                    val minutes = (remainingTime % (1000 * 60 * 60)) / (1000 * 60)
                    Toast.makeText(
                        requireContext(),
                        "Cooldown active. Try again in ${hours}h ${minutes}m",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    /**
     * 设置5.5Gh/s按钮点击事件
     */
    private fun setupButton5_5GhClickListener() {
        // 使用安全的binding访问
        _binding?.let { binding ->
            val button5_5Gh = binding.root.findViewById<Button>(R.id.button_5_5Gh)
            button5_5Gh?.setOnClickListener {
                if (Contract5_5GhManager.getRemainingDailyAds() > 0) {
                    // 还有剩余广告次数，可以观看
                    showAdForContract5_5Gh()
                } else {
                    // 今日广告次数已用完
                    Toast.makeText(
                        requireContext(),
                        "Daily ad limit reached (50/50). Try again tomorrow!",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    /**
     * 显示广告并激活5.5Gh合约
     */
    private fun showAdForContract5_5Gh() {
        // 检查Fragment是否仍然活跃
        if (!isAdded) return

        // 显示广告的逻辑
        Toast.makeText(requireContext(), "Starting ad for 5.5Gh mining...", Toast.LENGTH_SHORT).show()

        // 模拟广告观看完成 - 实际项目中这里应该是广告SDK的回调
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                // 模拟广告播放时间（实际应该是广告SDK的回调）
                kotlinx.coroutines.delay(2000) // 2秒模拟广告时间

                // 检查Fragment是否仍然活跃
                if (!isAdded) return@launch

                // 广告观看完成，激活合约
                val activated = Contract5_5GhManager.onAdWatchCompleted()
                if (activated) {
                    val remaining = Contract5_5GhManager.getRemainingDailyAds()
                    Toast.makeText(
                        requireContext(),
                        "5.5Gh mining +2 hours! Remaining ads today: $remaining",
                        Toast.LENGTH_LONG
                    ).show()
                } else {
                    Toast.makeText(requireContext(), "Failed to activate 5.5Gh contract", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                if (isAdded) {
                    Toast.makeText(requireContext(), "Ad failed", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun showAdAndActivateContract() {
        // 检查Fragment是否仍然活跃
        if (!isAdded) return

        // 显示广告的逻辑
        Toast.makeText(requireContext(), "Starting ad...", Toast.LENGTH_SHORT).show()

        // 模拟广告观看完成 - 实际项目中这里应该是广告SDK的回调
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                // 模拟广告播放时间（实际应该是广告SDK的回调）
                kotlinx.coroutines.delay(2000) // 2秒模拟广告时间

                // 检查Fragment是否仍然活跃
                if (!isAdded) return@launch

                // 广告观看完成，激活合约
                val activated = ContractCountdownManager.onAdWatchCompleted()
                if (activated) {
                    Toast.makeText(requireContext(), "Contract activated! 2-hour mining started!", Toast.LENGTH_LONG).show()
                } else {
                    Toast.makeText(requireContext(), "Failed to activate contract", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                if (isAdded) {
                    Toast.makeText(requireContext(), "Ad failed", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun fetchBitcoinBalanceFromServer() {
        // 使用viewLifecycleOwner来确保协程在Fragment销毁时停止
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val result = userRepository.fetchBitcoinBalance()
                result.onFailure { exception ->
                    // 检查Fragment是否仍然活跃
                    if (!isAdded || _binding == null) return@onFailure

                    _binding?.let { binding ->
                        val balanceTextView = binding.root.findViewById<TextView>(R.id.bitcoin_balance)
                        balanceTextView?.text = "Failed to load"
                    }
                    exception.printStackTrace()
                }
            } catch (e: Exception) {
                // 检查Fragment是否仍然活跃
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
        // 确保在视图销毁时停止价格更新
        BitcoinPriceManager.stopPriceUpdates()
        _binding = null
    }
}