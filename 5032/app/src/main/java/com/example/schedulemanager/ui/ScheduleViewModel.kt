package com.example.schedulemanager.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.asLiveData
import androidx.lifecycle.viewModelScope
import com.example.schedulemanager.data.Schedule
import com.example.schedulemanager.data.ScheduleDatabase
import com.example.schedulemanager.data.ScheduleRepository
import com.example.schedulemanager.reminder.ReminderManager
import com.example.schedulemanager.util.RepeatScheduler
import kotlinx.coroutines.launch

class ScheduleViewModel(application: Application) : AndroidViewModel(application) {
    private val repository: ScheduleRepository
    val allSchedules: LiveData<List<Schedule>>
    private val reminderManager: ReminderManager
    private val repeatScheduler: RepeatScheduler

    init {
        val scheduleDao = ScheduleDatabase.getDatabase(application).scheduleDao()
        repository = ScheduleRepository(scheduleDao)
        allSchedules = repository.allSchedules.asLiveData()
        reminderManager = ReminderManager(application)
        repeatScheduler = RepeatScheduler(scheduleDao, application)
    }

    fun getScheduleById(id: Long, callback: (Schedule?) -> Unit) {
        viewModelScope.launch {
            val schedule = repository.getScheduleById(id)
            callback(schedule)
        }
    }

    fun insert(schedule: Schedule) {
        viewModelScope.launch {
            val id = repository.insert(schedule)
            val scheduleWithId = schedule.copy(id = id)
            reminderManager.scheduleReminders(scheduleWithId)
            if (schedule.repeatType != com.example.schedulemanager.data.RepeatType.NONE) {
                repeatScheduler.scheduleFutureInstances(scheduleWithId)
            }
        }
    }

    fun update(schedule: Schedule) {
        viewModelScope.launch {
            repository.update(schedule)
            reminderManager.cancelReminders(schedule.id)
            if (!schedule.isCompleted && !schedule.isRepeatEnded) {
                reminderManager.scheduleReminders(schedule)
            }
        }
    }

    fun delete(schedule: Schedule) {
        viewModelScope.launch {
            repository.delete(schedule)
            reminderManager.cancelReminders(schedule.id)
            if (schedule.originalScheduleId == null) {
                repository.deleteRepeatingInstances(schedule.id)
            }
        }
    }

    fun markAsCompleted(schedule: Schedule) {
        viewModelScope.launch {
            val updated = schedule.copy(isCompleted = true)
            repository.update(updated)
            reminderManager.cancelReminders(schedule.id)
        }
    }

    fun checkAndRescheduleOverdue() {
        viewModelScope.launch {
            val currentTime = System.currentTimeMillis()
            val overdueSchedules = repository.getOverdueSchedules(currentTime)
            for (schedule in overdueSchedules) {
                if (!schedule.isCompleted && schedule.dateTime < currentTime) {
                    val nextTime = schedule.dateTime + 24 * 60 * 60 * 1000
                    val updatedSchedule = schedule.copy(dateTime = nextTime)
                    repository.update(updatedSchedule)
                    reminderManager.cancelReminders(schedule.id)
                    reminderManager.scheduleReminders(updatedSchedule)
                }
            }
        }
    }
}
