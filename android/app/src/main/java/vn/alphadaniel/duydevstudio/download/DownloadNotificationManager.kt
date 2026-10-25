package vn.alphadaniel.duydevstudio.download

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.RingtoneManager
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
    const val CHANNEL_DOWNLOAD_ID = "ds_download_channel_v2"
    const val CHANNEL_PUSH_ID = "ds_push_channel_v2"
    private const val LEGACY_CHANNEL_DOWNLOAD = "ds_download_channel"
    private const val LEGACY_CHANNEL_PUSH = "ds_push_channel"

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Clean up legacy silent channels so they don't suppress alerts on existing devices
            try {
                manager.deleteNotificationChannel(LEGACY_CHANNEL_DOWNLOAD)
                manager.deleteNotificationChannel(LEGACY_CHANNEL_PUSH)
            } catch (_: Exception) {}

            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val downloadChannel = NotificationChannel(
                CHANNEL_DOWNLOAD_ID,
                "Tải tệp & Tác vụ nền",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Thông báo tiến trình và kết quả tải tệp tin về thiết bị"
                enableLights(true)
                lightColor = 0xFF4F46E5.toInt()
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 150, 100, 150)
                setSound(soundUri, audioAttributes)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setShowBadge(true)
            }

            val pushChannel = NotificationChannel(
                CHANNEL_PUSH_ID,
                "Thông báo tác vụ & Hoàn tất",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Thông báo kết quả xử lý tài liệu, video và tác vụ từ DuyDev Studio"
                enableLights(true)
                lightColor = 0xFF4F46E5.toInt()
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 200, 100, 200)
                setSound(soundUri, audioAttributes)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setShowBadge(true)
            }

            manager.createNotificationChannel(downloadChannel)
            manager.createNotificationChannel(pushChannel)
        }
    }

    /**
     * Cleanly formats filenames for notification displays, transforming raw numeric hashes
     * (e.g. tiktok_7700222954541508891.mp4) into elegant, human-readable labels.
     */
    fun formatDisplayFileName(fileName: String): String {
        val trimmed = fileName.trim()
        val dotIndex = trimmed.lastIndexOf('.')
        val ext = if (dotIndex != -1) trimmed.substring(dotIndex) else ""
        val nameWithoutExt = if (dotIndex != -1) trimmed.substring(0, dotIndex) else trimmed
        val isAudio = ext.equals(".mp3", ignoreCase = true) ||
            ext.equals(".m4a", ignoreCase = true) ||
            ext.equals(".wav", ignoreCase = true) ||
            ext.equals(".aac", ignoreCase = true) ||
            ext.equals(".opus", ignoreCase = true) ||
            ext.equals(".flac", ignoreCase = true) ||
            nameWithoutExt.endsWith("_audio", ignoreCase = true)
        val isImage = ext.equals(".jpg", ignoreCase = true) ||
            ext.equals(".jpeg", ignoreCase = true) ||
            ext.equals(".png", ignoreCase = true) ||
            ext.equals(".webp", ignoreCase = true)

        val digits = Regex("\\d{4,}").findAll(nameWithoutExt).map { it.value }.lastOrNull()?.takeLast(4)

        if (nameWithoutExt.startsWith("tiktok_", ignoreCase = true) && nameWithoutExt.length > 14) {
            val label = when {
                isAudio -> "TikTok Audio"
                nameWithoutExt.contains("HD", ignoreCase = true) -> "TikTok Video HD"
                isImage -> "TikTok Slide"
                else -> "TikTok Video"
            }
            return if (digits != null) "$label (..$digits)$ext" else "$label$ext"
        }

        if (nameWithoutExt.startsWith("youtube_", ignoreCase = true) && nameWithoutExt.length > 16) {
            val label = if (isAudio) "YouTube Audio" else "YouTube Video"
            return if (digits != null) "$label (..$digits)$ext" else "$label$ext"
        }

        if (nameWithoutExt.startsWith("facebook_", ignoreCase = true) && nameWithoutExt.length > 16) {
            val label = if (isAudio) "Facebook Audio" else "Facebook Video"
            return if (digits != null) "$label (..$digits)$ext" else "$label$ext"
        }

        if (nameWithoutExt.startsWith("instagram_", ignoreCase = true) && nameWithoutExt.length > 16) {
            val label = if (isImage) "Instagram Photo" else "Instagram Media"
            return if (digits != null) "$label (..$digits)$ext" else "$label$ext"
        }

        if (nameWithoutExt.startsWith("spotify_", ignoreCase = true)) {
            return if (digits != null) "Spotify Track (..$digits)$ext" else "Spotify Track$ext"
        }

        if (trimmed.length > 36) {
            val prefix = nameWithoutExt.take(20)
            val suffix = nameWithoutExt.takeLast(6)
            return "$prefix...$suffix$ext"
        }
        return trimmed
    }

    fun showDownloadProgress(context: Context, notificationId: Int, fileName: String, progress: Int) {
        createChannels(context)
        val cleanDisplayName = formatDisplayFileName(fileName)

        val notification = NotificationCompat.Builder(context, CHANNEL_DOWNLOAD_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Đang tải tệp xuống...")
            .setContentText("$cleanDisplayName • $progress%")
            .setProgress(100, progress, progress <= 0)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setColor(0xFF4F46E5.toInt())
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
        } catch (_: SecurityException) {}
    }

    fun showDownloadCompleted(
        context: Context,
        notificationId: Int,
        fileName: String,
        contentUri: Uri?,
        file: File?,
        fileSize: Long,
        mimeType: String
    ) {
        createChannels(context)

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)

        // Intent to open the downloaded file directly
        val viewIntent = Intent(Intent.ACTION_VIEW).apply {
            val resolvedUri: Uri = contentUri ?: (if (file != null) {
                FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    file
                )
            } else Uri.EMPTY)
            setDataAndType(resolvedUri, mimeType.ifBlank { "application/octet-stream" })
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            viewIntent,
            flags
        )

        val cleanDisplayName = formatDisplayFileName(fileName)
        val sizeFormatted = formatBytes(if (fileSize > 0) fileSize else (file?.length() ?: 0L))
        val shortSummary = if (sizeFormatted.isNotBlank() && sizeFormatted != "0 B") {
            "$cleanDisplayName • $sizeFormatted"
        } else {
            cleanDisplayName
        }
        val detailedText = "$shortSummary\nĐã lưu an toàn vào thiết bị. Chạm để mở."

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val notification = NotificationCompat.Builder(context, CHANNEL_DOWNLOAD_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Tải xuống hoàn tất")
            .setContentText(shortSummary)
            .setStyle(NotificationCompat.BigTextStyle().bigText(detailedText))
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_menu_view, "Mở tệp", pendingIntent)
            .setAutoCancel(true)
            .setOngoing(false)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(soundUri)
            .setVibrate(longArrayOf(0, 200, 100, 200))
            .setColor(0xFF4F46E5.toInt())
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
        } catch (_: Exception) {}
    }

    fun showDownloadCompleted(
        context: Context,
        notificationId: Int,
        fileName: String,
        file: File,
        mimeType: String
    ) {
        showDownloadCompleted(context, notificationId, fileName, null, file, file.length(), mimeType)
    }

    fun showPushNotification(context: Context, title: String, message: String, type: String = "general") {
        createChannels(context)
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

        // Strip redundant app name prefix from title
        val cleanTitle = title.removePrefix("DuyDev Studio • ")
            .removePrefix("DuyDev Studio: ")
            .removePrefix("DuyDev Studio - ")
            .trim()
            .ifBlank { "Thông báo hệ thống" }

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val notification = NotificationCompat.Builder(context, CHANNEL_PUSH_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(cleanTitle)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(soundUri)
            .setVibrate(longArrayOf(0, 200, 100, 200))
            .setColor(0xFF4F46E5.toInt())
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
        } catch (_: Exception) {}
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
