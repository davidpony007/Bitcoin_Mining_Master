package com.cloudminingtool.bitcoinminingmaster.ui

import android.os.Bundle
import android.widget.ImageButton
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
            // 返回按钮
            findViewById<ImageButton>(R.id.btnBack)?.let { btnBack ->
                btnBack.setOnClickListener {
                    finish()
                }
            }

            // Avatar 设置
            findViewById<LinearLayout>(R.id.avatarSetting)?.let { avatarSetting ->
                avatarSetting.setOnClickListener {
                    Toast.makeText(this, "Avatar settings", Toast.LENGTH_SHORT).show()
                }
            }

            // Name 设置
            findViewById<LinearLayout>(R.id.nameSetting)?.let { nameSetting ->
                nameSetting.setOnClickListener {
                    Toast.makeText(this, "Name settings", Toast.LENGTH_SHORT).show()
                }
            }

            // Language 设置
            findViewById<LinearLayout>(R.id.languageSetting)?.let { languageSetting ->
                languageSetting.setOnClickListener {
                    Toast.makeText(this, "Language settings", Toast.LENGTH_SHORT).show()
                }
            }

            // Google 绑定
            findViewById<LinearLayout>(R.id.googleBinding)?.let { googleBinding ->
                googleBinding.setOnClickListener {
                    Toast.makeText(this, "Google account binding", Toast.LENGTH_SHORT).show()
                }
            }

            // Sign Out
            findViewById<LinearLayout>(R.id.signOutSetting)?.let { signOutSetting ->
                signOutSetting.setOnClickListener {
                    Toast.makeText(this, "Sign out", Toast.LENGTH_SHORT).show()
                }
            }

            // Support us
            findViewById<LinearLayout>(R.id.supportUsSetting)?.let { supportUsSetting ->
                supportUsSetting.setOnClickListener {
                    Toast.makeText(this, "Support us", Toast.LENGTH_SHORT).show()
                }
            }

            // Contact Us
            findViewById<LinearLayout>(R.id.contactUsSetting)?.let { contactUsSetting ->
                contactUsSetting.setOnClickListener {
                    Toast.makeText(this, "Contact us", Toast.LENGTH_SHORT).show()
                }
            }

            // Terms & Conditions
            findViewById<LinearLayout>(R.id.termsSetting)?.let { termsSetting ->
                termsSetting.setOnClickListener {
                    Toast.makeText(this, "Terms & Conditions", Toast.LENGTH_SHORT).show()
                }
            }

            // Privacy Policy
            findViewById<LinearLayout>(R.id.privacySetting)?.let { privacySetting ->
                privacySetting.setOnClickListener {
                    Toast.makeText(this, "Privacy Policy", Toast.LENGTH_SHORT).show()
                }
            }

            // Delete account
            findViewById<LinearLayout>(R.id.deleteAccountSetting)?.let { deleteAccountSetting ->
                deleteAccountSetting.setOnClickListener {
                    Toast.makeText(this, "Delete account", Toast.LENGTH_SHORT).show()
                }
            }

        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "初始化设置页面失败", Toast.LENGTH_SHORT).show()
        }
    }
}
