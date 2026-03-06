package com.bitcoinmining.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.bitcoinmining.data.UserManager
import com.bitcoinmining.repository.AuthRepository
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import kotlinx.coroutines.launch

/**
 * Bitcoin Mining Master - SettingsActivity
 * 
 * 设置页面,实现 Google 账号绑定功能
 * 
 * 功能:
 * 1. 显示当前用户信息
 * 2. Google 账号绑定/解绑
 * 3. Google 账号切换
 */
class SettingsActivity : AppCompatActivity() {
    
    private val TAG = "SettingsActivity"
    private val RC_SIGN_IN = 1001
    
    private val authRepository = AuthRepository()
    private lateinit var googleSignInClient: GoogleSignInClient
    
    // UI 组件
    private lateinit var tvUserId: TextView
    private lateinit var tvInvitationCode: TextView
    private lateinit var tvGoogleAccount: TextView
    private lateinit var btnBindGoogle: Button
    private lateinit var btnUnbindGoogle: Button
    private lateinit var btnSwitchGoogle: Button
    private lateinit var progressBar: ProgressBar
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)
        
        // 初始化 UI
        initViews()
        
        // 初始化 Google Sign-In
        initGoogleSignIn()
        
        // 显示用户信息
        displayUserInfo()
        
        // 设置按钮点击事件
        setupClickListeners()
    }
    
    /**
     * 初始化视图组件
     */
    private fun initViews() {
        tvUserId = findViewById(R.id.tv_user_id)
        tvInvitationCode = findViewById(R.id.tv_invitation_code)
        tvGoogleAccount = findViewById(R.id.tv_google_account)
        btnBindGoogle = findViewById(R.id.btn_bind_google)
        btnUnbindGoogle = findViewById(R.id.btn_unbind_google)
        btnSwitchGoogle = findViewById(R.id.btn_switch_google)
        progressBar = findViewById(R.id.progress_bar)
    }
    
    /**
     * 初始化 Google Sign-In
     */
    private fun initGoogleSignIn() {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .build()
        
        googleSignInClient = GoogleSignIn.getClient(this, gso)
    }
    
    /**
     * 显示用户信息
     */
    private fun displayUserInfo() {
        val userInfo = UserManager.getUserInfo()
        
        if (userInfo != null) {
            tvUserId.text = "用户ID: ${userInfo.userId}"
            tvInvitationCode.text = "邀请码: ${userInfo.invitationCode}"
            
            if (userInfo.googleAccount != null) {
                tvGoogleAccount.text = "Google 账号: ${userInfo.googleAccount}"
                btnBindGoogle.visibility = View.GONE
                btnUnbindGoogle.visibility = View.VISIBLE
                btnSwitchGoogle.visibility = View.VISIBLE
            } else {
                tvGoogleAccount.text = "Google 账号: 未绑定"
                btnBindGoogle.visibility = View.VISIBLE
                btnUnbindGoogle.visibility = View.GONE
                btnSwitchGoogle.visibility = View.GONE
            }
        }
    }
    
    /**
     * 设置按钮点击事件
     */
    private fun setupClickListeners() {
        // 绑定 Google 账号
        btnBindGoogle.setOnClickListener {
            signInWithGoogle()
        }
        
        // 解绑 Google 账号
        btnUnbindGoogle.setOnClickListener {
            showUnbindConfirmDialog()
        }
        
        // 切换 Google 账号
        btnSwitchGoogle.setOnClickListener {
            switchGoogleAccount()
        }
    }
    
    /**
     * 使用 Google 登录
     */
    private fun signInWithGoogle() {
        val signInIntent = googleSignInClient.signInIntent
        startActivityForResult(signInIntent, RC_SIGN_IN)
    }
    
    /**
     * 处理 Google 登录结果
     */
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        if (requestCode == RC_SIGN_IN) {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            try {
                val account = task.getResult(ApiException::class.java)
                handleGoogleSignInResult(account)
            } catch (e: ApiException) {
                Log.e(TAG, "Google sign in failed", e)
                Toast.makeText(this, "Google 登录失败: ${e.statusCode}", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    /**
     * 处理 Google 登录成功
     */
    private fun handleGoogleSignInResult(account: GoogleSignInAccount?) {
        if (account == null) {
            Toast.makeText(this, "无法获取 Google 账号信息", Toast.LENGTH_SHORT).show()
            return
        }
        
        val googleEmail = account.email
        if (googleEmail == null) {
            Toast.makeText(this, "无法获取 Google 邮箱", Toast.LENGTH_SHORT).show()
            return
        }
        
        // 绑定 Google 账号
        bindGoogleAccount(googleEmail)
    }
    
    /**
     * 绑定 Google 账号
     */
    private fun bindGoogleAccount(googleEmail: String) {
        val userId = UserManager.getUserId()
        if (userId == null) {
            Toast.makeText(this, "用户未登录", Toast.LENGTH_SHORT).show()
            return
        }
        
        lifecycleScope.launch {
            showLoading()
            
            val result = authRepository.bindGoogleAccount(userId, googleEmail)
            
            result.onSuccess { response ->
                UserManager.updateGoogleAccount(googleEmail)
                displayUserInfo()
                Toast.makeText(this@SettingsActivity, "绑定成功!", Toast.LENGTH_SHORT).show()
                Log.d(TAG, "Bind success: ${response.message}")
            }
            
            result.onFailure { exception ->
                Toast.makeText(
                    this@SettingsActivity,
                    "绑定失败: ${exception.message}",
                    Toast.LENGTH_SHORT
                ).show()
                Log.e(TAG, "Bind failed", exception)
            }
            
            hideLoading()
        }
    }
    
    /**
     * 显示解绑确认对话框
     */
    private fun showUnbindConfirmDialog() {
        AlertDialog.Builder(this)
            .setTitle("解绑 Google 账号")
            .setMessage("确定要解绑当前 Google 账号吗?")
            .setPositiveButton("确定") { _, _ ->
                unbindGoogleAccount()
            }
            .setNegativeButton("取消", null)
            .show()
    }
    
    /**
     * 解绑 Google 账号
     */
    private fun unbindGoogleAccount() {
        val userId = UserManager.getUserId()
        if (userId == null) {
            Toast.makeText(this, "用户未登录", Toast.LENGTH_SHORT).show()
            return
        }
        
        lifecycleScope.launch {
            showLoading()
            
            val result = authRepository.unbindGoogleAccount(userId)
            
            result.onSuccess { response ->
                UserManager.updateGoogleAccount("")
                
                // 登出 Google
                googleSignInClient.signOut()
                
                displayUserInfo()
                Toast.makeText(this@SettingsActivity, "解绑成功!", Toast.LENGTH_SHORT).show()
                Log.d(TAG, "Unbind success: ${response.message}")
            }
            
            result.onFailure { exception ->
                Toast.makeText(
                    this@SettingsActivity,
                    "解绑失败: ${exception.message}",
                    Toast.LENGTH_SHORT
                ).show()
                Log.e(TAG, "Unbind failed", exception)
            }
            
            hideLoading()
        }
    }
    
    /**
     * 切换 Google 账号
     */
    private fun switchGoogleAccount() {
        // 先登出当前 Google 账号
        googleSignInClient.signOut().addOnCompleteListener {
            // 然后重新登录
            signInWithGoogle()
        }
    }
    
    /**
     * 显示加载状态
     */
    private fun showLoading() {
        progressBar.visibility = View.VISIBLE
        btnBindGoogle.isEnabled = false
        btnUnbindGoogle.isEnabled = false
        btnSwitchGoogle.isEnabled = false
    }
    
    /**
     * 隐藏加载状态
     */
    private fun hideLoading() {
        progressBar.visibility = View.GONE
        btnBindGoogle.isEnabled = true
        btnUnbindGoogle.isEnabled = true
        btnSwitchGoogle.isEnabled = true
    }
}
