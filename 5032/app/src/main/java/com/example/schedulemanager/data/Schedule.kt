package com.example.schedulemanager.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverters

enum class RepeatType {
    NONE, DAILY, WEEKLY, MONTHLY
}

@Entity(tableName = "schedules")
@TypeConverters(Converters::class)
data class Schedule(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val description: String = "",
    val location: String = "",
    val dateTime: Long,
    val isCompleted: Boolean = false,
    val repeatType: RepeatType = RepeatType.NONE,
    val repeatDaysOfWeek: List<Int> = emptyList(),
    val repeatDayOfMonth: Int = 1,
    val reminderTimes: List<Long> = emptyList(),
    val remindWithNotification: Boolean = true,
    val remindWithVibration: Boolean = true,
    val remindWithSound: Boolean = true,
    val isRepeatEnded: Boolean = false,
    val originalScheduleId: Long? = null,
    val createdAt: Long = System.currentTimeMillis()
)
