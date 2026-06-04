package com.example.schedulemanager.util

import android.content.Context
import com.example.schedulemanager.data.Schedule
import com.example.schedulemanager.data.ScheduleDao
import com.example.schedulemanager.data.RepeatType
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.Calendar

class RepeatScheduler(
    private val scheduleDao: ScheduleDao,
    private val context: Context
) {
    private val coroutineScope = CoroutineScope(Dispatchers.IO)

    fun scheduleFutureInstances(schedule: Schedule) {
        coroutineScope.launch {
            val calendar = Calendar.getInstance()
            calendar.timeInMillis = schedule.dateTime

            when (schedule.repeatType) {
                RepeatType.DAILY -> scheduleDaily(schedule, calendar)
                RepeatType.WEEKLY -> scheduleWeekly(schedule, calendar)
                RepeatType.MONTHLY -> scheduleMonthly(schedule, calendar)
                RepeatType.NONE -> return@launch
            }
        }
    }

    private suspend fun scheduleDaily(schedule: Schedule, calendar: Calendar) {
        val currentTime = System.currentTimeMillis()
        val oneYearLater = currentTime + 365 * 24 * 60 * 60 * 1000L

        for (i in 1..365) {
            calendar.add(Calendar.DAY_OF_YEAR, 1)
            if (calendar.timeInMillis > oneYearLater) break
            if (calendar.timeInMillis > currentTime) {
                val newSchedule = schedule.copy(
                    id = 0,
                    dateTime = calendar.timeInMillis,
                    originalScheduleId = schedule.id
                )
                scheduleDao.insertSchedule(newSchedule)
            }
        }
    }

    private suspend fun scheduleWeekly(schedule: Schedule, calendar: Calendar) {
        val currentTime = System.currentTimeMillis()
        val oneYearLater = currentTime + 365 * 24 * 60 * 60 * 1000L
        val selectedDays = schedule.repeatDaysOfWeek

        if (selectedDays.isEmpty()) return

        for (week in 1..52) {
            calendar.add(Calendar.WEEK_OF_YEAR, 1)
            for (dayOfWeek in selectedDays) {
                val tempCal = calendar.clone() as Calendar
                tempCal.set(Calendar.DAY_OF_WEEK, dayOfWeek)
                if (tempCal.timeInMillis > oneYearLater) break
                if (tempCal.timeInMillis > currentTime) {
                    val newSchedule = schedule.copy(
                        id = 0,
                        dateTime = tempCal.timeInMillis,
                        originalScheduleId = schedule.id
                    )
                    scheduleDao.insertSchedule(newSchedule)
                }
            }
        }
    }

    private suspend fun scheduleMonthly(schedule: Schedule, calendar: Calendar) {
        val currentTime = System.currentTimeMillis()
        val oneYearLater = currentTime + 365 * 24 * 60 * 60 * 1000L
        val targetDay = schedule.repeatDayOfMonth

        for (month in 1..12) {
            calendar.add(Calendar.MONTH, 1)
            val tempCal = calendar.clone() as Calendar
            val maxDay = tempCal.getActualMaximum(Calendar.DAY_OF_MONTH)
            tempCal.set(Calendar.DAY_OF_MONTH, minOf(targetDay, maxDay))
            if (tempCal.timeInMillis > oneYearLater) break
            if (tempCal.timeInMillis > currentTime) {
                val newSchedule = schedule.copy(
                    id = 0,
                    dateTime = tempCal.timeInMillis,
                    originalScheduleId = schedule.id
                )
                scheduleDao.insertSchedule(newSchedule)
            }
        }
    }
}
