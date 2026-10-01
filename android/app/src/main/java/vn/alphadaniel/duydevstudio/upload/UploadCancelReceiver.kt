package vn.alphadaniel.duydevstudio.upload

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.WorkManager
import java.util.UUID

/**
 * BroadcastReceiver triggered by user tapping the "Hủy" (Cancel) button on the ongoing upload notification.
 */
class UploadCancelReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        val taskIdStr = intent.getStringExtra(UploadNotificationManager.EXTRA_TASK_ID) ?: return
        val notificationId = intent.getIntExtra(UploadNotificationManager.EXTRA_NOTIFICATION_ID, 0)

        try {
            val taskId = UUID.fromString(taskIdStr)
            WorkManager.getInstance(context).cancelWorkById(taskId)
        } catch (_: Exception) {}

        if (notificationId != 0) {
            UploadNotificationManager.cancelNotification(context, notificationId)
        }
    }
}
