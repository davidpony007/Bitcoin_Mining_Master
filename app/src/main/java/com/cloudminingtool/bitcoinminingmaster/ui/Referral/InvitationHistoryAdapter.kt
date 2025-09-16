package com.cloudminingtool.bitcoinminingmaster.ui.Referral

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.cloudminingtool.bitcoinminingmaster.R

class InvitationHistoryAdapter(
    private val historyList: List<InvitationHistoryItem>
) : RecyclerView.Adapter<InvitationHistoryAdapter.ViewHolder>() {

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvFriendName: TextView = itemView.findViewById(R.id.tvFriendName)
        val tvInviteDate: TextView = itemView.findViewById(R.id.tvInviteDate)
        val tvStatus: TextView = itemView.findViewById(R.id.tvStatus)
        val tvReward: TextView = itemView.findViewById(R.id.tvReward)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_invitation_history, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = historyList[position]

        holder.tvFriendName.text = item.friendName
        holder.tvInviteDate.text = item.inviteDate
        holder.tvStatus.text = item.status
        holder.tvReward.text = item.reward

        // 根据状态设置不同的颜色
        when (item.status) {
            "Success" -> {
                holder.tvStatus.setTextColor(holder.itemView.context.getColor(android.R.color.holo_green_dark))
            }
            "Pending" -> {
                holder.tvStatus.setTextColor(holder.itemView.context.getColor(android.R.color.holo_orange_dark))
            }
            else -> {
                holder.tvStatus.setTextColor(holder.itemView.context.getColor(android.R.color.darker_gray))
            }
        }
    }

    override fun getItemCount(): Int = historyList.size
}
