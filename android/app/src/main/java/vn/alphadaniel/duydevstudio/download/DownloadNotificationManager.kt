package vn.alphadaniel.duydevstudio.download

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.FileProvider
import vn.alphadaniel.duydevstudio.MainActivity
import vn.alphadaniel.duydevstudio.R
import java.io.File
import java.util.Locale

/**
 * Manages native download notifications and push notifications for DuyDev Studio,
 * featuring the official app icon (large icon) and high-priority heads-up alerts.
 */
object DownloadNotificationManager {
    const val CHANNEL_DOWNLOAD_ID = "ds_download_channel"
    const val CHANNEL_PUSH_ID = "ds_push_channel"

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val downloadChannel = NotificationChannel(
                CHANNEL_DOWNLOAD_ID,
                "Tải tệp tin",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Thông báo tiến trình và kết quả tải tệp tin về thiết bị"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }

            val pushChannel = NotificationChannel(
                CHANNEL_PUSH_ID,
                "Thông báo ứng dụng",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Thông báo trạng thái tác vụ từ DuyDev Studio"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }

            manager.createNotificationChannel(downloadChannel)
            manager.createNotificationChannel(pushChannel)
        }
    }

    fun showDownloadProgress(context: Context, notificationId: Int, fileName: String, progress: Int) {
        createChannels(context)
        val appIcon = BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)

        val notification = NotificationCompat.Builder(context, CHANNEL_DOWNLOAD_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(appIcon)
            .setContentTitle("Đang tải: $fileName")
            .setContentText("$progress%")
            .setProgress(100, progress, progress <= 0)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
        } catch (_: SecurityException) {}
    }

    fun showDownloadCompleted(
        context: Context,
        notificationId: Int,
        fileName: String,
        file: File,
        mimeType: String
    ) {
        createChannels(context)
        val appIcon = BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)

        // Intent to open the downloaded file directly
        val viewIntent = Intent(Intent.ACTION_VIEW).apply {
            val contentUri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            setDataAndType(contentUri, mimeType.ifBlank { "application/octet-stream" })
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            viewIntent,
            flags
        )

        val sizeFormatted = formatBytes(file.length())
        val text = "$fileName ($sizeFormatted) đã được lưu vào thư mục Tải về"

        val notification = NotificationCompat.Builder(context, CHANNEL_DOWNLOAD_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(appIcon)
            .setContentTitle("DuyDev Studio • Đã tải về thành công")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setOngoing(false)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
        } catch (_: SecurityException) {}
    }

    fun showPushNotification(context: Context, title: String, message: String, type: String = "general") {
        createChannels(context)
        val appIcon = BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)
        val notificationId = (System.currentTimeMillis() % 100000).toInt()

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)

        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openAppIntent,
            flags
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_PUSH_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(appIcon)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
        } catch (_: SecurityException) {}
    }

    fun cancelNotification(context: Context, notificationId: Int) {
        try {
            NotificationManagerCompat.from(context).cancel(notificationId)
        } catch (_: Exception) {}
    }

    fun formatBytes(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        val units = arrayOf("B", "KB", "MB", "GB", "TB")
        val digitGroups = (Math.log10(bytes.toDouble()) / Math.log10(1024.0)).toInt()
        val index = digitGroups.coerceIn(0, units.size - 1)
        val value = bytes / Math.pow(1024.0, index.toDouble())
        return String.format(Locale.US, "%.1f %s", value, units[index])
    }
}
