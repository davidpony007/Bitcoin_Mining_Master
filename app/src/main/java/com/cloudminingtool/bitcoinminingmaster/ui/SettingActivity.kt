package com.cloudminingtool.bitcoinminingmaster.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.cloudminingtool.bitcoinminingmaster.R
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream

class SettingActivity : AppCompatActivity() {

    private lateinit var userAvatarImage: ImageView
    private lateinit var nicknameTextView: TextView
    private lateinit var googleAccountTextView: TextView

    private val pickMedia = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let {
            loadImageFromUri(it)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setting)

        initViews()
        loadSavedAvatar()
        loadSavedNickname()
        loadSavedGoogleAccount()
        setupViews()
    }

    private fun initViews() {
        userAvatarImage = findViewById(R.id.userAvatarImage)
        nicknameTextView = findViewById(R.id.nicknameDisplay)
        googleAccountTextView = findViewById(R.id.googleAccountDisplay)
    }

    private fun setupViews() {
        try {
            // 返回按钮
            findViewById<ImageButton>(R.id.btnBack)?.setOnClickListener {
                finish()
            }

            // Avatar 设置 - 添加点击功能选择相册
            findViewById<LinearLayout>(R.id.avatarSetting)?.setOnClickListener {
                openImagePicker()
            }

            // 用户头像点击事件
            userAvatarImage.setOnClickListener {
                openImagePicker()
            }

            // Name 设置
            findViewById<LinearLayout>(R.id.nameSetting)?.setOnClickListener {
                showNicknameDialog()
            }

            // Language 设置
            findViewById<LinearLayout>(R.id.languageSetting)?.setOnClickListener {
                Toast.makeText(this, "Language settings", Toast.LENGTH_SHORT).show()
            }

            // Google 绑定
            findViewById<LinearLayout>(R.id.googleBinding)?.setOnClickListener {
                // 只有在未绑定时才响应点击
                val sharedPref = getSharedPreferences("user_settings", MODE_PRIVATE)
                if (sharedPref.getString("google_account", null) == null) {
                    showBindGoogleDialog()
                }
            }

            // Sign Out
            findViewById<LinearLayout>(R.id.signOutSetting)?.setOnClickListener {
                showSignOutConfirmationDialog()
            }

            // Support us
            findViewById<LinearLayout>(R.id.supportUsSetting)?.setOnClickListener {
                Toast.makeText(this, "Support us", Toast.LENGTH_SHORT).show()
            }

            // Contact Us
            findViewById<LinearLayout>(R.id.contactUsSetting)?.setOnClickListener {
                Toast.makeText(this, "Contact us", Toast.LENGTH_SHORT).show()
            }

            // Terms & Conditions
            findViewById<LinearLayout>(R.id.termsSetting)?.setOnClickListener {
                Toast.makeText(this, "Terms & Conditions", Toast.LENGTH_SHORT).show()
            }

            // Privacy Policy
            findViewById<LinearLayout>(R.id.privacySetting)?.setOnClickListener {
                Toast.makeText(this, "Privacy Policy", Toast.LENGTH_SHORT).show()
            }

            // Delete account
            findViewById<LinearLayout>(R.id.deleteAccountSetting)?.setOnClickListener {
                showDeleteAccountConfirmationDialog()
            }

        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "初始化设置页面失败", Toast.LENGTH_SHORT).show()
        }
    }

    private fun openImagePicker() {
        pickMedia.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
    }

    private fun loadImageFromUri(uri: Uri) {
        try {
            val inputStream: InputStream? = contentResolver.openInputStream(uri)
            val bitmap = BitmapFactory.decodeStream(inputStream)
            userAvatarImage.setImageBitmap(bitmap)

            // Save the avatar to internal storage and store the path in SharedPreferences
            val filePath = saveImageToInternalStorage(bitmap)
            saveAvatarPathToPreferences(filePath)

            Toast.makeText(this, "Avatar updated successfully", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Failed to load image", Toast.LENGTH_SHORT).show()
        }
    }

    private fun saveImageToInternalStorage(bitmap: Bitmap): String? {
        val file = File(filesDir, "avatar.png")
        try {
            FileOutputStream(file).use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            }
            return file.absolutePath
        } catch (e: IOException) {
            e.printStackTrace()
        }
        return null
    }

    private fun saveAvatarPathToPreferences(filePath: String?) {
        val sharedPref = getSharedPreferences("user_settings", MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString("avatar_path", filePath)
            apply()
        }
    }

    private fun loadSavedAvatar() {
        val sharedPref = getSharedPreferences("user_settings", MODE_PRIVATE)
        val savedPath = sharedPref.getString("avatar_path", null)

        savedPath?.let { path ->
            val file = File(path)
            if (file.exists()) {
                val bitmap = BitmapFactory.decodeFile(file.absolutePath)
                userAvatarImage.setImageBitmap(bitmap)
            }
        }
    }

    private fun showNicknameDialog() {
        // 获取当前昵称
        val currentNickname = nicknameTextView.text.toString()

        // 创建 EditText 用于输入昵称
        val editText = EditText(this).apply {
            setText(currentNickname)
            hint = "Enter your nickname"
        }

        // 创建对话框
        AlertDialog.Builder(this)
            .setTitle("Change nickname")
            .setView(editText)
            .setPositiveButton("DONE") { _, _ ->
                val newNickname = editText.text.toString().trim()
                if (newNickname.isNotEmpty()) {
                    // 更新昵称显示
                    nicknameTextView.text = newNickname
                    // 保存新昵称
                    saveNicknameToPreferences(newNickname)
                    Toast.makeText(this, "Nickname updated", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "Nickname cannot be empty", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("CANCEL", null)
            .show()
    }

    private fun saveNicknameToPreferences(nickname: String) {
        val sharedPref = getSharedPreferences("user_settings", MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString("nickname", nickname)
            apply()
        }
    }

    private fun loadSavedNickname() {
        val sharedPref = getSharedPreferences("user_settings", MODE_PRIVATE)
        val savedNickname = sharedPref.getString("nickname", "Bitcoin Mining Master")
        nicknameTextView.text = savedNickname
    }

    private fun loadSavedGoogleAccount() {
        updateGoogleBindingUI()
    }

    private fun updateGoogleBindingUI() {
        val sharedPref = getSharedPreferences("user_settings", MODE_PRIVATE)
        val savedGoogleAccount = sharedPref.getString("google_account", null)
        val googleBindingLayout = findViewById<LinearLayout>(R.id.googleBinding)
        val googleBindingArrow = findViewById<ImageView>(R.id.googleBindingArrow)

        if (savedGoogleAccount != null) {
            // 已绑定
            googleAccountTextView.text = savedGoogleAccount
            googleBindingArrow.visibility = android.view.View.GONE
            googleBindingLayout.isClickable = false
        } else {
            // 未绑定
            googleAccountTextView.text = "Binding"
            googleBindingArrow.visibility = android.view.View.VISIBLE
            googleBindingLayout.isClickable = true
        }
    }

    private fun showGoogleBindingDialog() {
        // 此方法现在只用于显示绑定对话框
        showBindGoogleDialog()
    }

    private fun showBindGoogleDialog() {
        // 创建对话框
        val dialog = AlertDialog.Builder(this)
            .setTitle("Account Security")
            .setMessage("In order to protect the security of your assets,\nplease bind your account first")
            .setCancelable(true)
            .create()

        // 设置Google按钮点击事件
        dialog.setButton(AlertDialog.BUTTON_POSITIVE, "Google") { _, _ ->
            // 模拟Google账号绑定过程
            simulateGoogleBinding()
        }

        dialog.setButton(AlertDialog.BUTTON_NEGATIVE, "Cancel") { dialogInterface, _ ->
            dialogInterface.dismiss()
        }

        dialog.show()
    }

    private fun showUnbindGoogleDialog(googleAccount: String) {
        AlertDialog.Builder(this)
            .setTitle("Google Account")
            .setMessage("Current bound account: $googleAccount\n\nDo you want to unbind this account?")
            .setPositiveButton("Unbind") { _, _ ->
                unbindGoogleAccount()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun simulateGoogleBinding() {
        // 模拟Google登录过程
        Toast.makeText(this, "Connecting to Google...", Toast.LENGTH_SHORT).show()

        // 模拟网络延迟
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            // 模拟获取到的Google账号信息
            val mockGoogleAccounts = listOf(
                "user.example@gmail.com",
                "johnsmith@gmail.com",
                "alice.wang@gmail.com"
            )

            // 随机选择一个模拟账号
            val selectedAccount = mockGoogleAccounts.random()

            // 保存Google账号
            saveGoogleAccountToPreferences(selectedAccount)

            // 更新UI显示
            updateGoogleBindingUI()

            Toast.makeText(this, "Google account bound successfully!", Toast.LENGTH_LONG).show()
        }, 1500)
    }

    private fun unbindGoogleAccount() {
        // 清除保存的Google账号
        val sharedPref = getSharedPreferences("user_settings", MODE_PRIVATE)
        with(sharedPref.edit()) {
            remove("google_account")
            apply()
        }

        // 更新UI
        updateGoogleBindingUI()

        Toast.makeText(this, "Google account unbound", Toast.LENGTH_SHORT).show()
    }

    private fun saveGoogleAccountToPreferences(googleAccount: String) {
        val sharedPref = getSharedPreferences("user_settings", MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString("google_account", googleAccount)
            apply()
        }
    }

    private fun showSignOutConfirmationDialog() {
        // 创建确认对话框
        AlertDialog.Builder(this)
            .setTitle("Sign Out")
            .setMessage("Are you sure you want to sign out?")
            .setPositiveButton("Yes") { dialog, which ->
                // 执行登出操作
                performSignOut()
            }
            .setNegativeButton("No", null)
            .show()
    }

    private fun performSignOut() {
        // 登出Google账号
        unbindGoogleAccount()

        // 可以选择在这里添加其他登出逻辑，例如返回登录页
        // finish()
    }

    private fun showDeleteAccountConfirmationDialog() {
        AlertDialog.Builder(this)
            .setTitle("Delete account")
            .setMessage("Destroying an account will delete all information and cannot be restored. Do you confirm the destruction?")
            .setPositiveButton("Delete") { _, _ ->
                performAccountDeletion()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun performAccountDeletion() {
        // Clear all user data from SharedPreferences
        val sharedPref = getSharedPreferences("user_settings", MODE_PRIVATE)
        with(sharedPref.edit()) {
            clear()
            apply()
        }

        // Optionally, delete the avatar file from internal storage
        val avatarFile = File(filesDir, "avatar.png")
        if (avatarFile.exists()) {
            avatarFile.delete()
        }

        Toast.makeText(this, "Account deleted successfully", Toast.LENGTH_SHORT).show()

        // Update UI to reflect the deletion
        updateGoogleBindingUI()
        loadSavedNickname()
        loadSavedAvatar()

        // Optionally, navigate the user away from the settings screen
        // finish()
    }
}
