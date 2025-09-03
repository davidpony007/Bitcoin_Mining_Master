package com.cloudminingtool.bitcoinminingmaster.ui.Referral

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import com.cloudminingtool.bitcoinminingmaster.databinding.FragmentReferralBinding
import androidx.core.text.HtmlCompat

class ReferralFragment : Fragment() {

    private var _binding: FragmentReferralBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val referralViewModel =
            ViewModelProvider(this).get(ReferralViewModel::class.java)

        _binding = FragmentReferralBinding.inflate(inflater, container, false)
        val root: View = binding.root



        val textView: TextView = binding.textReferral
        referralViewModel.text.observe(viewLifecycleOwner) {
            textView.text = it
        }

        val earningsTextView: TextView = binding.get20PercentOfFriendsEarnings
        val htmlText = "Get <font color='#FF8C00'>20%</font> of friends' earnings"
        earningsTextView.text = HtmlCompat.fromHtml(htmlText, HtmlCompat.FROM_HTML_MODE_LEGACY)
        return root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        // 复制按钮点击事件
        binding.buttonCopy.setOnClickListener {
            // 获取邀请码内容
            val code = binding.invitationCodeDefault.text.toString()
            // 复制到剪贴板
            val clipboard = requireContext().getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
            val clip = android.content.ClipData.newPlainText("Invitation Code", code)
            clipboard.setPrimaryClip(clip)
            // 显示提示
            android.widget.Toast.makeText(requireContext(), "Text copied successfully", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}