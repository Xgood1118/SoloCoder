package com.example.schedulemanager.reminder

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import com.example.schedulemanager.R
import com.example.schedulemanager.ui.MainActivity

class AlarmReceiver : BroadcastReceiver() {

    companion object {
        const val EXTRA_SCHEDULE_ID = "schedule_id"
        const val EXTRA_REMINDER_INDEX = "reminder_index"
        const val EXTRA_TITLE = "title"
        const val EXTRA_DESCRIPTION = "description"
        const val EXTRA_NOTIFICATION = "notification"
        const val EXTRA_VIBRATION = "vibration"
        const val EXTRA_SOUND = "sound"
        const val CHANNEL_ID = "schedule_reminder_channel"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra(EXTRA_TITLE) ?: context.getString(R.string.schedule_reminder)
        val description = intent.getStringExtra(EXTRA_DESCRIPTION) ?: ""
        val showNotification = intent.getBooleanExtra(EXTRA_NOTIFICATION, true)
        val vibrate = intent.getBooleanExtra(EXTRA_VIBRATION, true)
        val playSound = intent.getBooleanExtra(EXTRA_SOUND, true)

        if (showNotification) {
            showNotification(context, title, description)
        }

        if (vibrate) {
            triggerVibration(context)
        }

        if (playSound) {
            playSound(context)
        }
    }

    private fun showNotification(context: Context, title: String, description: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.schedule_reminder),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "日程提醒通知"
                enableVibration(true)
                enableLights(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val contentIntent = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(description)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun triggerVibration(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator.vibrate(
                android.os.VibrationEffect.createWaveform(
                    longArrayOf(0, 500, 200, 500),
                    -1
                )
            )
        } else {
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            vibrator.vibrate(longArrayOf(0, 500, 200, 500), -1)
        }
    }

    private fun playSound(context: Context) {
        try {
            val notificationUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            val ringtone = RingtoneManager.getRingtone(context, notificationUri)
            ringtone.play()
            android.os.Handler().postDelayed({
                if (ringtone.isPlaying) {
                    ringtone.stop()
                }
            }, 3000)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
