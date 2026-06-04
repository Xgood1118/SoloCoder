package com.example.schedulemanager.reminder

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.example.schedulemanager.data.Schedule

class ReminderManager(private val context: Context) {
    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    fun scheduleReminders(schedule: Schedule) {
        for ((index, reminderOffset) in schedule.reminderTimes.withIndex()) {
            val reminderTime = schedule.dateTime - reminderOffset
            if (reminderTime > System.currentTimeMillis()) {
                scheduleAlarm(schedule.id, index, reminderTime, schedule)
            }
        }
    }

    private fun scheduleAlarm(scheduleId: Long, reminderIndex: Int, triggerTime: Long, schedule: Schedule) {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra(AlarmReceiver.EXTRA_SCHEDULE_ID, scheduleId)
            putExtra(AlarmReceiver.EXTRA_REMINDER_INDEX, reminderIndex)
            putExtra(AlarmReceiver.EXTRA_TITLE, schedule.title)
            putExtra(AlarmReceiver.EXTRA_DESCRIPTION, schedule.description)
            putExtra(AlarmReceiver.EXTRA_NOTIFICATION, schedule.remindWithNotification)
            putExtra(AlarmReceiver.EXTRA_VIBRATION, schedule.remindWithVibration)
            putExtra(AlarmReceiver.EXTRA_SOUND, schedule.remindWithSound)
        }

        val requestCode = (scheduleId * 100 + reminderIndex).toInt()
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerTime,
            pendingIntent
        )
    }

    fun cancelReminders(scheduleId: Long) {
        for (i in 0..99) {
            val intent = Intent(context, AlarmReceiver::class.java)
            val requestCode = (scheduleId * 100 + i).toInt()
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pendingIntent)
        }
    }
}
