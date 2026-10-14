package vn.alphadaniel.duydevstudio.download

import android.content.Context
import android.media.MediaScannerConnection
import android.os.Environment
import android.webkit.MimeTypeMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

object DownloadHelper {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    fun saveBase64(
        context: Context,
        base64Data: String,
        suggestedFileName: String,
        mimeType: String
    ) {
        val notificationId = (System.currentTimeMillis() % 100000).toInt()
        val cleanName = sanitizeFileName(suggestedFileName, mimeType)
        val finalMime = normalizeMimeType(cleanName, mimeType)

        DownloadNotificationManager.showDownloadProgress(context, notificationId, cleanName, 0)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val targetDir = getDestinationDirectory(finalMime, cleanName)
                val destinationFile = resolveUniqueFile(targetDir, cleanName)
                val rawBase64 = if (base64Data.contains(",")) {
                    base64Data.substringAfter(",")
                } else {
                    base64Data
                }

                val bytes = android.util.Base64.decode(rawBase64.trim(), android.util.Base64.DEFAULT)
                FileOutputStream(destinationFile).use { it.write(bytes) }

                // Scan file so it appears in the Android system Gallery / Photos app immediately
                MediaScannerConnection.scanFile(
                    context,
                    arrayOf(destinationFile.absolutePath),
                    arrayOf(finalMime)
                ) { _, _ -> }

                // Post completed push notification with app icon
                DownloadNotificationManager.showDownloadCompleted(
                    context,
                    notificationId,
                    destinationFile.name,
                    destinationFile,
                    finalMime
                )
            } catch (_: Exception) {
                DownloadNotificationManager.cancelNotification(context, notificationId)
            }
        }
    }

    fun download(
        context: Context,
        url: String,
        suggestedFileName: String,
        mimeType: String,
        userAgent: String? = null
    ) {
        if (url.startsWith("data:")) {
            saveBase64(context, url, suggestedFileName, mimeType)
            return
        }

        val notificationId = (System.currentTimeMillis() % 100000).toInt()
        var cleanName = sanitizeFileName(suggestedFileName, mimeType)

        DownloadNotificationManager.showDownloadProgress(context, notificationId, cleanName, 0)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val requestBuilder = Request.Builder().url(url)
                if (!userAgent.isNullOrBlank()) {
                    requestBuilder.addHeader("User-Agent", userAgent)
                }

                val response = client.newCall(requestBuilder.build()).execute()
                if (!response.isSuccessful) {
                    DownloadNotificationManager.cancelNotification(context, notificationId)
                    return@launch
                }

                val body = response.body ?: run {
                    DownloadNotificationManager.cancelNotification(context, notificationId)
                    return@launch
                }

                // Extract server-assigned file name from Content-Disposition if available
                val serverDisposition = response.header("Content-Disposition")
                val serverMime = response.header("Content-Type")?.substringBefore(';') ?: mimeType
                if (!serverDisposition.isNullOrBlank()) {
                    val resolvedFromServer = resolveContentDispositionFileName(serverDisposition)
                    if (!resolvedFromServer.isNullOrBlank()) {
                        cleanName = sanitizeFileName(resolvedFromServer, serverMime)
                    }
                }

                val finalMime = normalizeMimeType(cleanName, serverMime)
                val targetDir = getDestinationDirectory(finalMime, cleanName)
                val destinationFile = resolveUniqueFile(targetDir, cleanName)
                val totalBytes = body.contentLength()
                var downloadedBytes = 0L

                val inputStream = body.byteStream()
                val outputStream = FileOutputStream(destinationFile)

                val buffer = ByteArray(64 * 1024)
                var bytesRead: Int
                var lastProgressUpdate = System.currentTimeMillis()

                outputStream.use { out ->
                    inputStream.use { input ->
                        while (input.read(buffer).also { bytesRead = it } != -1) {
                            out.write(buffer, 0, bytesRead)
                            downloadedBytes += bytesRead

                            val now = System.currentTimeMillis()
                            if (now - lastProgressUpdate > 600 && totalBytes > 0) {
                                val progress = ((downloadedBytes * 100) / totalBytes).toInt()
                                DownloadNotificationManager.showDownloadProgress(context, notificationId, cleanName, progress)
                                lastProgressUpdate = now
                            }
                        }
                        out.flush()
                    }
                }

                // Scan file so it appears in the Android system Gallery / Photos app immediately
                MediaScannerConnection.scanFile(
                    context,
                    arrayOf(destinationFile.absolutePath),
                    arrayOf(finalMime)
                ) { _, _ -> }

                // Post completed push notification with app icon
                DownloadNotificationManager.showDownloadCompleted(
                    context,
                    notificationId,
                    destinationFile.name,
                    destinationFile,
                    finalMime
                )
            } catch (_: Exception) {
                DownloadNotificationManager.cancelNotification(context, notificationId)
            }
        }
    }

    private fun resolveContentDispositionFileName(contentDisposition: String): String? {
        try {
            val matchStar = Regex("filename\\*=(?:UTF-8''|utf-8'')([^;]+)", RegexOption.IGNORE_CASE).find(contentDisposition)
            if (matchStar != null) {
                return java.net.URLDecoder.decode(matchStar.groupValues[1].trim('"', '\''), "UTF-8")
            }
            val matchNormal = Regex("filename=\"?([^\";]+)\"?", RegexOption.IGNORE_CASE).find(contentDisposition)
            if (matchNormal != null) {
                return java.net.URLDecoder.decode(matchNormal.groupValues[1].trim(), "UTF-8")
            }
        } catch (_: Exception) {}
        return null
    }

    private fun sanitizeFileName(rawName: String, mimeType: String): String {
        var name = rawName.trim().replace(Regex("[\\\\/:*?\"<>|]"), "_")
        if (name.isBlank()) {
            name = "file_${System.currentTimeMillis()}"
        }

        // Ensure extension is present
        if (!name.contains(".")) {
            val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)
            if (!ext.isNullOrBlank()) {
                name = "$name.$ext"
            }
        }
        return name
    }

    private fun resolveUniqueFile(dir: File, fileName: String): File {
        var file = File(dir, fileName)
        if (!file.exists()) return file

        val dotIndex = fileName.lastIndexOf('.')
        val baseName = if (dotIndex != -1) fileName.substring(0, dotIndex) else fileName
        val ext = if (dotIndex != -1) fileName.substring(dotIndex) else ""

        var counter = 1
        while (file.exists()) {
            file = File(dir, "$baseName ($counter)$ext")
            counter++
        }
        return file
    }

    private fun getDestinationDirectory(mimeType: String, fileName: String): File {
        try {
            val isVideo = mimeType.startsWith("video/", ignoreCase = true) ||
                          fileName.endsWith(".mp4", ignoreCase = true) ||
                          fileName.endsWith(".webm", ignoreCase = true) ||
                          fileName.endsWith(".mov", ignoreCase = true) ||
                          fileName.endsWith(".mkv", ignoreCase = true)

            val isAudio = mimeType.startsWith("audio/", ignoreCase = true) ||
                          fileName.endsWith(".mp3", ignoreCase = true) ||
                          fileName.endsWith(".m4a", ignoreCase = true) ||
                          fileName.endsWith(".wav", ignoreCase = true) ||
                          fileName.endsWith(".aac", ignoreCase = true)

            if (isVideo) {
                val moviesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES)
                val appMovies = File(moviesDir, "DuyDevStudio")
                if (appMovies.exists() || appMovies.mkdirs()) {
                    return appMovies
                }
                if (moviesDir.exists() || moviesDir.mkdirs()) {
                    return moviesDir
                }
            } else if (isAudio) {
                val musicDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC)
                val appMusic = File(musicDir, "DuyDevStudio")
                if (appMusic.exists() || appMusic.mkdirs()) {
                    return appMusic
                }
                if (musicDir.exists() || musicDir.mkdirs()) {
                    return musicDir
                }
            }
        } catch (_: Exception) {}

        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs()
        }
        return downloadsDir
    }

    private fun normalizeMimeType(fileName: String, rawMime: String?): String {
        val mime = (rawMime ?: "").substringBefore(';').trim()
        if (fileName.endsWith(".mp4", ignoreCase = true)) return "video/mp4"
        if (fileName.endsWith(".webm", ignoreCase = true)) return "video/webm"
        if (fileName.endsWith(".mp3", ignoreCase = true)) return "audio/mpeg"
        if (fileName.endsWith(".m4a", ignoreCase = true)) return "audio/mp4"
        if (fileName.endsWith(".pdf", ignoreCase = true)) return "application/pdf"
        if (fileName.endsWith(".zip", ignoreCase = true)) return "application/zip"
        if (fileName.endsWith(".jpg", ignoreCase = true) || fileName.endsWith(".jpeg", ignoreCase = true)) return "image/jpeg"
        if (fileName.endsWith(".png", ignoreCase = true)) return "image/png"
        return if (mime.isNotBlank() && mime != "application/octet-stream") mime else "application/octet-stream"
    }
}
