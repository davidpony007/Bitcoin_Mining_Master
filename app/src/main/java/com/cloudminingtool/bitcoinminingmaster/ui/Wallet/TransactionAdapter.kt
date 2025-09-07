package com.cloudminingtool.bitcoinminingmaster.ui.Wallet

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.cloudminingtool.bitcoinminingmaster.R

class TransactionAdapter(private val transactions: List<Transaction>) :
    RecyclerView.Adapter<TransactionAdapter.TransactionViewHolder>() {

    class TransactionViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val transactionType: TextView? = itemView.findViewById(R.id.transactionType)
        val transactionTime: TextView? = itemView.findViewById(R.id.transactionTime)
        val transactionAmount: TextView? = itemView.findViewById(R.id.transactionAmount)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TransactionViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_transaction, parent, false)
        return TransactionViewHolder(view)
    }

    override fun onBindViewHolder(holder: TransactionViewHolder, position: Int) {
        if (position < transactions.size) {
            val transaction = transactions[position]
            holder.transactionType?.text = transaction.type
            holder.transactionTime?.text = transaction.time
            holder.transactionAmount?.text = transaction.amount
        }
    }

    override fun getItemCount(): Int = transactions.size
}
