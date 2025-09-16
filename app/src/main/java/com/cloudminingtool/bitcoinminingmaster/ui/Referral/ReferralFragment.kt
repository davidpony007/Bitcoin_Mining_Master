package com.cloudminingtool.bitcoinminingmaster.ui.Referral

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.cloudminingtool.bitcoinminingmaster.databinding.FragmentReferralBinding

class ReferralFragment : Fragment() {

    private var _binding: FragmentReferralBinding? = null
    private val binding get() = _binding!!
    private lateinit var referralViewModel: ReferralViewModel
    private lateinit var historyAdapter: InvitationHistoryAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        referralViewModel = ViewModelProvider(this)[ReferralViewModel::class.java]
        _binding = FragmentReferralBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupViews()
        setupInvitationHistory()
    }

    private fun setupViews() {
        // 邀请按钮点击事件
        binding.btnInviteNow.setOnClickListener {
            shareInvitation()
        }

        binding.btnInviteNowBottom.setOnClickListener {
            shareInvitation()
        }

        // 复制邀请码功能
        binding.btnCopyCode.setOnClickListener {
            copyInvitationCode()
        }
    }

    private fun setupInvitationHistory() {
        // 初始状态下没有邀请历史记录
        val historyList = emptyList<InvitationHistoryItem>()

        // 设置RecyclerView
        historyAdapter = InvitationHistoryAdapter(historyList)
        binding.rvInvitationHistory.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = historyAdapter
        }

        // 检查是否有邀请记录，如果没有则显示空状态
        updateInvitationHistoryView(historyList.isEmpty())
    }

    private fun updateInvitationHistoryView(isEmpty: Boolean) {
        if (isEmpty) {
            // 隐藏RecyclerView，显示空状态
            binding.rvInvitationHistory.visibility = View.GONE
        } else {
            // 显示RecyclerView，隐藏空状态
            binding.rvInvitationHistory.visibility = View.VISIBLE
        }
    }

    private fun shareInvitation() {
        val invitationCode = binding.tvInvitationCode.text.toString()
        val shareText = "Join me on Bitcoin Mining Master and start earning BTC! Use my invitation code: $invitationCode"

        val shareIntent = Intent().apply {
            action = Intent.ACTION_SEND
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, shareText)
        }

        try {
            startActivity(Intent.createChooser(shareIntent, "Share invitation"))
        } catch (e: Exception) {
            Toast.makeText(requireContext(), "Unable to share invitation", Toast.LENGTH_SHORT).show()
        }
    }

    private fun copyInvitationCode() {
        val invitationCode = binding.tvInvitationCode.text.toString()
        val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("Invitation Code", invitationCode)
        clipboard.setPrimaryClip(clip)

        Toast.makeText(requireContext(), "Invitation code copied to clipboard", Toast.LENGTH_SHORT).show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}