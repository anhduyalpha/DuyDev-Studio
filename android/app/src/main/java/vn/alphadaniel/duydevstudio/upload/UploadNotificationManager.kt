package vn.alphadaniel.duydevstudio.upload

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.ForegroundInfo
import vn.alphadaniel.duydevstudio.MainActivity
import java.util.Locale
import java.util.UUID

/**
 * Manages notification channels, ongoing progress notifications, and completion alerts
 * for background file uploads.
 */
object UploadNotificationManager {
    const val CHANNEL_PROGRESS_ID = "ds_upload_progress"
    const val CHANNEL_STATUS_ID = "ds_upload_status"
    const val ACTION_CANCEL_UPLOAD = "vn.alphadaniel.duydevstudio.ACTION_CANCEL_UPLOAD"
    const val EXTRA_TASK_ID = "extra_task_id"
    const val EXTRA_NOTIFICATION_ID = "extra_notification_id"

    fun createNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val progressChannel = NotificationChannel(
                CHANNEL_PROGRESS_ID,
                "Tiến trình tải lên",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Hiển thị tiến độ tải tệp lên trong nền"
                setShowBadge(false)
            }

            val statusChannel = NotificationChannel(
                CHANNEL_STATUS_ID,
                "Trạng thái tải lên",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Thông báo khi tải tệp hoàn tất hoặc thất bại"
                enableLights(true)
                enableVibration(true)
            }

            manager.createNotificationChannel(progressChannel)
            manager.createNotificationChannel(statusChannel)
        }
    }

    fun createForegroundInfo(
        context: Context,
        taskId: UUID,
        fileName: String,
        progress: Int,
        speedBytesPerSec: Long,
        uploadedBytes: Long,
        totalBytes: Long
    ): ForegroundInfo {
        createNotificationChannels(context)
        val notificationId = taskId.hashCode()

        val cancelIntent = Intent(context, UploadCancelReceiver::class.java).apply {
            action = ACTION_CANCEL_UPLOAD
            putExtra(EXTRA_TASK_ID, taskId.toString())
            putExtra(EXTRA_NOTIFICATION_ID, notificationId)
        }

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        val cancelPendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId,
            cancelIntent,
            flags
        )

        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            this.action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val openAppPendingIntent = PendingIntent.getActivity(
            context,
            0,
            openAppIntent,
            flags
        )

        val speedStr = formatSpeed(speedBytesPerSec)
        val uploadedStr = formatBytes(uploadedBytes)
        val totalStr = formatBytes(totalBytes)
        val contentText = "$progress% • $uploadedStr / $totalStr • $speedStr"

        val notification = NotificationCompat.Builder(context, CHANNEL_PROGRESS_ID)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle("Đang tải lên: $fileName")
            .setContentText(contentText)
            .setProgress(100, progress, false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openAppPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Hủy", cancelPendingIntent)
            .build()

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            ForegroundInfo(notificationId, notification)
        }
    }

    fun showCompletionNotification(
        context: Context,
        notificationId: Int,
        fileName: String,
        sizeFormatted: String,
        isSuccess: Boolean,
        errorMsg: String? = null
    ) {
        createNotificationChannels(context)

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            this.action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val openAppPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openAppIntent,
            flags
        )

        val title = if (isSuccess) "Tải lên thành công" else "Tải lên thất bại"
        val text = if (isSuccess) {
            "$fileName ($sizeFormatted) đã được nạp an toàn vào máy chủ"
        } else {
            "$fileName: ${errorMsg ?: "Lỗi không xác định"}"
        }
        val icon = if (isSuccess) android.R.drawable.stat_sys_upload_done else android.R.drawable.stat_notify_error

        val notification = NotificationCompat.Builder(context, CHANNEL_STATUS_ID)
            .setSmallIcon(icon)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setOngoing(false)
            .setContentIntent(openAppPendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
        } catch (_: SecurityException) {
            // Missing POST_NOTIFICATIONS on Android 13+
        }
    }

    fun cancelNotification(context: Context, notificationId: Int) {
        try {
            NotificationManagerCompat.from(context).cancel(notificationId)
        } catch (_: Exception) {}
    }

    fun formatBytes(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        val units = arrayOf("B", "KB", "MB", "GB", "TB")
        val digitGroups = (Math.log10(bytes.toDouble()) / Math.log10(1024.0)).toInt().coerceIn(0, units.size - 1)
        return String.format(Locale.US, "%.1f %s", bytes / Math.pow(1024.0, digitGroups.toDouble()), units[digitGroups])
    }

    fun formatSpeed(bytesPerSec: Long): String {
        if (bytesPerSec <= 0) return "0 KB/s"
        return if (bytesPerSec < 1024 * 1024) {
            String.format(Locale.US, "%.1f KB/s", bytesPerSec / 1024.0)
        } else {
            String.format(Locale.US, "%.1f MB/s", bytesPerSec / (1024.0 * 1024.0))
        }
    }
}
