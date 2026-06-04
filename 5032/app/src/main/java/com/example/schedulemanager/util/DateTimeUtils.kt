package com.example.schedulemanager.util

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

object DateTimeUtils {
    fun formatDateTime(timeInMillis: Long): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
        return formatter.format(timeInMillis)
    }

    fun formatDate(timeInMillis: Long): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        return formatter.format(timeInMillis)
    }

    fun formatTime(timeInMillis: Long): String {
        val formatter = SimpleDateFormat("HH:mm", Locale.getDefault())
        return formatter.format(timeInMillis)
    }

    fun getDayOfWeekDisplay(dayOfWeek: Int): String {
        return when (dayOfWeek) {
            Calendar.SUNDAY -> "周日"
            Calendar.MONDAY -> "周一"
            Calendar.TUESDAY -> "周二"
            Calendar.WEDNESDAY -> "周三"
            Calendar.THURSDAY -> "周四"
            Calendar.FRIDAY -> "周五"
            Calendar.SATURDAY -> "周六"
            else -> ""
        }
    }

    fun getRepeatTypeText(type: com.example.schedulemanager.data.RepeatType): String {
        return when (type) {
            com.example.schedulemanager.data.RepeatType.NONE -> "不重复"
            com.example.schedulemanager.data.RepeatType.DAILY -> "每天重复"
            com.example.schedulemanager.data.RepeatType.WEEKLY -> "每周重复"
            com.example.schedulemanager.data.RepeatType.MONTHLY -> "每月重复"
        }
    }
}
