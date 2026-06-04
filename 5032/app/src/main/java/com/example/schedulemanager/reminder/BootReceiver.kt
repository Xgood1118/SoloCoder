package com.example.schedulemanager.reminder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.example.schedulemanager.data.ScheduleDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            CoroutineScope(Dispatchers.IO).launch {
                val db = ScheduleDatabase.getDatabase(context)
                val schedules = db.scheduleDao().getOverdueSchedules(Long.MAX_VALUE)
                val reminderManager = ReminderManager(context)
                val currentTime = System.currentTimeMillis()

                for (schedule in schedules) {
                    if (!schedule.isCompleted && !schedule.isRepeatEnded && schedule.dateTime > currentTime) {
                        reminderManager.scheduleReminders(schedule)
                    }
                }
            }
        }
    }
}
