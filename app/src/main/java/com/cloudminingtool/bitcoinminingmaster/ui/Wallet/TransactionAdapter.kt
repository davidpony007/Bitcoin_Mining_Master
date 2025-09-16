package com.cloudminingtool.bitcoinminingmaster.ui.Wallet

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.cloudminingtool.bitcoinminingmaster.R

class TransactionAdapter(
    private val transactions: List<TransactionItem>
) : RecyclerView.Adapter<TransactionAdapter.ViewHolder>() {

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val iconImageView: ImageView = itemView.findViewById(R.id.transactionIcon)
        val typeTextView: TextView = itemView.findViewById(R.id.transactionType)
        val timeTextView: TextView = itemView.findViewById(R.id.transactionTime)
        val amountTextView: TextView = itemView.findViewById(R.id.transactionAmount)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_transaction, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val transaction = transactions[position]

        holder.typeTextView.text = transaction.type
        holder.timeTextView.text = transaction.time
        holder.amountTextView.text = transaction.amount

        // 根据交易类型设置图标和颜色
        when (transaction.type) {
            "Mining Reward" -> {
                holder.iconImageView.setImageResource(R.drawable.bitcoin_1)
                holder.amountTextView.setTextColor(holder.itemView.context.getColor(android.R.color.holo_green_dark))
            }
            "Withdraw" -> {
                holder.iconImageView.setImageResource(R.drawable.bitcoin_1)
                holder.amountTextView.setTextColor(holder.itemView.context.getColor(android.R.color.holo_red_dark))
            }
            else -> {
                holder.iconImageView.setImageResource(R.drawable.bitcoin_1)
                holder.amountTextView.setTextColor(holder.itemView.context.getColor(android.R.color.black))
            }
        }
    }

    override fun getItemCount(): Int = transactions.size
}
