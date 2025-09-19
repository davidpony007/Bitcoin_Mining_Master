package com.cloudminingtool.bitcoinminingmaster.ui.Referral

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.cloudminingtool.bitcoinminingmaster.R

class InvitationHistoryAdapter(
    private var historyList: List<InvitationHistoryItem>
) : RecyclerView.Adapter<InvitationHistoryAdapter.HistoryViewHolder>() {

    class HistoryViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvUsername: TextView = itemView.findViewById(R.id.tvUsername)
        val tvDate: TextView = itemView.findViewById(R.id.tvDate)
        val tvReward: TextView = itemView.findViewById(R.id.tvReward)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HistoryViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_invitation_history, parent, false)
        return HistoryViewHolder(view)
    }

    override fun onBindViewHolder(holder: HistoryViewHolder, position: Int) {
        val item = historyList[position]
        holder.tvUsername.text = item.username
        holder.tvDate.text = item.date
        holder.tvReward.text = item.reward
    }

    override fun getItemCount(): Int = historyList.size

    fun updateData(newHistoryList: List<InvitationHistoryItem>) {
        val oldSize = this.historyList.size
        val newSize = newHistoryList.size

        this.historyList = newHistoryList

        when {
            oldSize == 0 && newSize > 0 -> {
                // 从空状态添加数据
                notifyItemRangeInserted(0, newSize)
            }
            oldSize > 0 && newSize == 0 -> {
                // 清空所有数据
                notifyItemRangeRemoved(0, oldSize)
            }
            else -> {
                // 其他情况使用全量更新
                notifyDataSetChanged()
            }
        }
    }
}
