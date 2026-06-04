package com.example.schedulemanager.ui

import android.graphics.Paint
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.schedulemanager.data.Schedule
import com.example.schedulemanager.databinding.ItemScheduleBinding
import com.example.schedulemanager.util.DateTimeUtils

class ScheduleAdapter(
    private val onEditClick: (Schedule) -> Unit,
    private val onDeleteClick: (Schedule) -> Unit,
    private val onCompleteChange: (Schedule, Boolean) -> Unit
) : ListAdapter<Schedule, ScheduleAdapter.ScheduleViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ScheduleViewHolder {
        val binding = ItemScheduleBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ScheduleViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ScheduleViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ScheduleViewHolder(private val binding: ItemScheduleBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(schedule: Schedule) {
            binding.tvTitle.text = schedule.title
            binding.tvTime.text = DateTimeUtils.formatDateTime(schedule.dateTime)
            binding.tvLocation.text = schedule.location
            binding.tvDescription.text = schedule.description
            binding.cbComplete.isChecked = schedule.isCompleted

            if (schedule.isCompleted) {
                binding.tvTitle.paintFlags =
                    binding.tvTitle.paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
            } else {
                binding.tvTitle.paintFlags =
                    binding.tvTitle.paintFlags and Paint.STRIKE_THRU_TEXT_FLAG.inv()
            }

            if (schedule.repeatType != com.example.schedulemanager.data.RepeatType.NONE) {
                binding.tvRepeat.visibility = android.view.View.VISIBLE
                binding.tvRepeat.text = DateTimeUtils.getRepeatTypeText(schedule.repeatType)
            } else {
                binding.tvRepeat.visibility = android.view.View.GONE
            }

            binding.btnEdit.setOnClickListener { onEditClick(schedule) }
            binding.btnDelete.setOnClickListener { onDeleteClick(schedule) }
            binding.cbComplete.setOnCheckedChangeListener { _, isChecked ->
                onCompleteChange(schedule, isChecked)
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<Schedule>() {
        override fun areItemsTheSame(oldItem: Schedule, newItem: Schedule): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Schedule, newItem: Schedule): Boolean {
            return oldItem == newItem
        }
    }
}
