package com.cloudminingtool.bitcoinminingmaster.ui

import android.os.Bundle
import android.widget.ImageButton
import androidx.appcompat.widget.SwitchCompat
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.cloudminingtool.bitcoinminingmaster.R

class SettingActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setting)

        setupViews()
    }

    private fun setupViews() {
        try {
            // 返回按钮 - 添加空值检查
            findViewById<ImageButton>(R.id.btnBack)?.let { btnBack ->
                btnBack.setOnClickListener {
                    finish()
                }
            }

            // 个人资料设置 - 添加空值检查
            findViewById<LinearLayout>(R.id.profileSetting)?.let { profileSetting ->
                profileSetting.setOnClickListener {
                    Toast.makeText(this, "Profile settings", Toast.LENGTH_SHORT).show()
                }
            }

            // 修改密码设置 - 添加空值检查
            findViewById<LinearLayout>(R.id.changePasswordSetting)?.let { changePasswordSetting ->
                changePasswordSetting.setOnClickListener {
                    Toast.makeText(this, "Change password", Toast.LENGTH_SHORT).show()
                }
            }

            // 通知开关 - 添加空值检查
            findViewById<SwitchCompat>(R.id.notificationSwitch)?.let { notificationSwitch ->
                notificationSwitch.setOnCheckedChangeListener { _, isChecked ->
                    val message = if (isChecked) "Notifications enabled" else "Notifications disabled"
                    Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
                }
            }

            // 关于应用 - 添加空值检查
            findViewById<LinearLayout>(R.id.aboutSetting)?.let { aboutSetting ->
                aboutSetting.setOnClickListener {
                    Toast.makeText(this, "About Bitcoin Mining Master v1.0", Toast.LENGTH_SHORT).show()
                }
            }

            // 退出登录 - 添加空值检查
            findViewById<Button>(R.id.btnLogout)?.let { btnLogout ->
                btnLogout.setOnClickListener {
                    Toast.makeText(this, "Logout clicked", Toast.LENGTH_SHORT).show()
                    // 这里可以添加退出登录的逻辑
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "初始化设置页面失败", Toast.LENGTH_SHORT).show()
        }
    }
}
