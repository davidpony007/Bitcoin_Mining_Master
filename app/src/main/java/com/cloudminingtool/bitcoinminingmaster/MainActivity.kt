package com.cloudminingtool.bitcoinminingmaster

import android.os.Bundle
import com.google.android.material.bottomnavigation.BottomNavigationView
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import com.cloudminingtool.bitcoinminingmaster.databinding.ActivityMainBinding
import com.cloudminingtool.bitcoinminingmaster.manager.BitcoinBalanceManager
import com.cloudminingtool.bitcoinminingmaster.repository.UserRepository

class MainActivity : AppCompatActivity() {   // 声明主 Activity 类，继承自 AppCompatActivity，用于兼容旧版 Android

    private lateinit var binding: ActivityMainBinding    // 声明视图绑定对象，延迟初始化，用于简化布局控件的访问。
    private val userRepository = UserRepository()

    override fun onCreate(savedInstanceState: Bundle?) {  //重写 Activity 的生命周期方法 onCreate，应用启动时调用。
        super.onCreate(savedInstanceState) // 调用父类的 onCreate 方法，保证 Activity 正常初始化。

        binding = ActivityMainBinding.inflate(layoutInflater)  // 使用视图绑定类 ActivityMainBinding 来绑定布局文件 activity_main.xml，获取布局的引用。
        setContentView(binding.root) // 设置当前 Activity 的内容视图为绑定的根视图。

        val navView: BottomNavigationView = binding.navView  // 获取 BottomNavigationView 的引用，用于显示底��导航栏。

        // 使用更安全的方式获取NavController
        val navHostFragment = supportFragmentManager.findFragmentById(R.id.nav_host_fragment_activity_main) as NavHostFragment
        val navController = navHostFragment.navController

        // 只设置BottomNavigationView与NavController关联，不使用ActionBar
        navView.setupWithNavController(navController)  // 将 BottomNavigationView 与 Nav Controller 关联，使得底部导航栏可以响应导航操作。

        // 初始化比特币余额管理器并从服务器获取数据
        initializeBitcoinBalance()
    }

    private fun initializeBitcoinBalance() {
        // 确保余额管理器有正确的初始值
        BitcoinBalanceManager.initializeBalance()

        // 在协程中从服务器获取最新的比特币余额
        lifecycleScope.launch {
            userRepository.fetchBitcoinBalance()
        }
    }
}