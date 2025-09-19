package com.cloudminingtool.bitcoinminingmaster.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.cloudminingtool.bitcoinminingmaster.R

class WithdrawalHistoryAdapter(
    private var historyList: List<WithdrawalHistoryItem>
) : RecyclerView.Adapter<WithdrawalHistoryAdapter.ViewHolder>() {

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvAmount: TextView = itemView.findViewById(R.id.tvAmount)
        val tvStatus: TextView = itemView.findViewById(R.id.tvStatus)
        val tvDate: TextView = itemView.findViewById(R.id.tvDate)
        val tvTransactionId: TextView = itemView.findViewById(R.id.tvTransactionId)
        val tvWalletAddress: TextView = itemView.findViewById(R.id.tvWalletAddress)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_withdrawal_history, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = historyList[position]

        holder.tvAmount.text = item.amount
        holder.tvStatus.text = item.status
        holder.tvDate.text = item.date
        holder.tvTransactionId.text = "Withdrawal_ID: ${item.transactionId}"

        // 显示钱包地址，如果为空则隐藏
        if (item.walletAddress.isNotEmpty()) {
            holder.tvWalletAddress.text = "Address: ${item.walletAddress}"
            holder.tvWalletAddress.visibility = View.VISIBLE
        } else {
            holder.tvWalletAddress.visibility = View.GONE
        }

        // 根据状态设置不同的颜色
        when (item.status.lowercase()) {
            "pending" -> {
                holder.tvStatus.setTextColor(holder.itemView.context.getColor(android.R.color.holo_orange_dark))
            }
            "completed", "success" -> {
                holder.tvStatus.setTextColor(holder.itemView.context.getColor(android.R.color.holo_green_dark))
            }
            "failed", "error" -> {
                holder.tvStatus.setTextColor(holder.itemView.context.getColor(android.R.color.holo_red_dark))
            }
            else -> {
                holder.tvStatus.setTextColor(holder.itemView.context.getColor(android.R.color.darker_gray))
            }
        }
    }

    override fun getItemCount(): Int {
        return historyList.size
    }

    fun updateData(newHistoryList: List<WithdrawalHistoryItem>) {
        historyList = newHistoryList
        notifyDataSetChanged()
    }
}
