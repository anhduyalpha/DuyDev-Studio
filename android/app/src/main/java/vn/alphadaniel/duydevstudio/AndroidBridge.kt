package vn.alphadaniel.duydevstudio

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Two-way JavaScript interface bridge between Android native layer and WebView.
 */
class AndroidBridge(
    private val activity: MainActivity
) {
    companion object {
        @Volatile
        var sharedPayloadJson: String? = null
        private const val UPDATE_FILE_NAME = "duydev-studio-update.apk"
    }

    /**
     * Retrieve pending shared payload JSON directly in 0ms through memory.
     */
    @JavascriptInterface
    fun getSharedPayload(): String? {
        return sharedPayloadJson
    }

    /**
     * Clear shared payload once consumed by the Web layer.
     */
    @JavascriptInterface
    fun clearSharedPayload() {
        sharedPayloadJson = null
    }

    /**
     * Signal to the web application that it is executing inside the native Android APK.
     */
    @JavascriptInterface
    fun isNativeApp(): Boolean {
        return true
    }

    /**
     * Return app version dynamically from Gradle BuildConfig.
     */
    @JavascriptInterface
    fun getAppVersion(): String {
        return BuildConfig.VERSION_NAME
    }

    /**
     * Return configured server base URL.
     */
    @JavascriptInterface
    fun getBaseUrl(): String {
        return MainActivity.PRIMARY_HOST
    }

    /**
     * Return active server host currently loaded.
     */
    @JavascriptInterface
    fun getActiveHost(): String {
        val u = activity.intent?.dataString
        return if (!u.isNullOrBlank()) {
            try {
                val uri = Uri.parse(u)
                val portStr = if (uri.port != -1 && uri.port != 80 && uri.port != 443) ":${uri.port}" else ""
                "${uri.scheme}://${uri.host}$portStr"
            } catch (_: Exception) {
                MainActivity.PRIMARY_HOST
            }
        } else {
            val prefs = activity.getSharedPreferences("ds_prefs", android.content.Context.MODE_PRIVATE)
            prefs.getString(MainActivity.PREF_KEY_ACTIVE_HOST, MainActivity.PRIMARY_HOST) ?: MainActivity.PRIMARY_HOST
        }
    }

    /**
     * Switch active server host from JavaScript.
     */
    @JavascriptInterface
    fun switchHost(url: String) {
        activity.loadHost(url)
    }

    /**
     * Probe a single highway endpoint without CORS/Mixed-Content restrictions.
     */
    @JavascriptInterface
    fun probeHighway(targetUrl: String, timeoutMs: Int): String {
        return try {
            val start = System.currentTimeMillis()
            val url = URL("$targetUrl/api/v1/health")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = timeoutMs
            conn.readTimeout = timeoutMs
            conn.requestMethod = "GET"
            conn.instanceFollowRedirects = false
            conn.connect()
            val code = conn.responseCode
            val elapsed = System.currentTimeMillis() - start
            conn.disconnect()
            val reachable = code in 200..399
            JSONObject().apply {
                put("reachable", reachable)
                put("status", code)
                put("latencyMs", elapsed)
            }.toString()
        } catch (_: Exception) {
            JSONObject().apply {
                put("reachable", false)
                put("latencyMs", -1)
            }.toString()
        }
    }

    /**
     * Probe all 4 highways in parallel without CORS/Mixed-Content restrictions.
     */
    @JavascriptInterface
    fun probeAllHighways(): String {
        val targets = listOf(
            Pair("lan", MainActivity.LAN_HOST),
            Pair("tailscale", MainActivity.TAILSCALE_HOST),
            Pair("wireguard", MainActivity.WIREGUARD_HOST),
            Pair("cloudflare", MainActivity.PRIMARY_HOST)
        )
        val results = JSONObject()
        val threads = targets.map { (key, host) ->
            Thread {
                try {
                    val start = System.currentTimeMillis()
                    val url = URL("$host/api/v1/health")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.connectTimeout = 800
                    conn.readTimeout = 800
                    conn.requestMethod = "GET"
                    conn.instanceFollowRedirects = false
                    conn.connect()
                    val code = conn.responseCode
                    val elapsed = System.currentTimeMillis() - start
                    conn.disconnect()
                    val obj = JSONObject().apply {
                        put("reachable", code in 200..399)
                        put("latencyMs", elapsed)
                        put("url", host)
                    }
                    synchronized(results) {
                        results.put(key, obj)
                    }
                } catch (_: Exception) {
                    val obj = JSONObject().apply {
                        put("reachable", false)
                        put("latencyMs", -1)
                        put("url", host)
                    }
                    synchronized(results) {
                        results.put(key, obj)
                    }
                }
            }
        }
        threads.forEach { it.start() }
        threads.forEach {
            try { it.join(1000) } catch (_: Exception) {}
        }
        return results.toString()
    }

    /**
     * Check if app has permission to install unknown packages (Android 8.0+).
     */
    @JavascriptInterface
    fun canRequestPackageInstalls(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            activity.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    /**
     * Open system settings screen to allow installing unknown apps.
     */
    @JavascriptInterface
    fun openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${activity.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
            } catch (_: Exception) {
                val genericIntent = Intent(Settings.ACTION_SECURITY_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(genericIntent)
            }
        }
    }

    /**
     * Download latest APK in background thread and trigger installation upon completion.
     */
    @JavascriptInterface
    fun downloadAndInstallApk(apkUrl: String) {
        Thread {
            var connection: HttpURLConnection? = null
            var inputStream: InputStream? = null
            var outputStream: FileOutputStream? = null

            try {
                val updatesDir = File(activity.cacheDir, "updates")
                if (!updatesDir.exists()) updatesDir.mkdirs()
                val apkFile = File(updatesDir, UPDATE_FILE_NAME)
                if (apkFile.exists()) apkFile.delete()

                var targetUrl = apkUrl
                var redirects = 0
                while (redirects < 6) {
                    val url = URL(targetUrl)
                    connection = url.openConnection() as HttpURLConnection
                    connection.instanceFollowRedirects = false
                    connection.connectTimeout = 15000
                    connection.readTimeout = 30000
                    connection.setRequestProperty("User-Agent", "DuyDevStudioAndroidUpdater/1.0")
                    connection.connect()

                    val status = connection.responseCode
                    if (status in 300..399) {
                        val redirectLocation = connection.getHeaderField("Location")
                        connection.disconnect()
                        if (!redirectLocation.isNullOrBlank()) {
                            targetUrl = redirectLocation
                            redirects++
                            continue
                        }
                    }
                    break
                }

                val finalStatus = connection?.responseCode ?: -1
                if (finalStatus != HttpURLConnection.HTTP_OK) {
                    dispatchApkDownloadError("Máy chủ trả về mã HTTP $finalStatus")
                    return@Thread
                }

                val totalBytes = connection?.contentLengthLong ?: -1L
                inputStream = connection?.inputStream
                outputStream = FileOutputStream(apkFile)

                if (inputStream == null) {
                    dispatchApkDownloadError("Không thể đọc luồng dữ liệu từ máy chủ")
                    return@Thread
                }

                val buffer = ByteArray(64 * 1024)
                var bytesRead: Int
                var totalRead: Long = 0
                var lastProgressTime = 0L

                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                    totalRead += bytesRead

                    val now = System.currentTimeMillis()
                    if (now - lastProgressTime > 120 || (totalBytes > 0 && totalRead == totalBytes)) {
                        lastProgressTime = now
                        val percent = if (totalBytes > 0) ((totalRead * 100) / totalBytes).toInt() else -1
                        dispatchApkDownloadProgress(percent, totalRead, totalBytes)
                    }
                }
                outputStream.flush()

                dispatchApkDownloadComplete(apkFile.absolutePath, totalRead)

                // Launch package installer on UI thread
                activity.runOnUiThread {
                    installApk(apkFile)
                }
            } catch (e: Exception) {
                dispatchApkDownloadError(e.message ?: "Lỗi kết nối mạng khi tải APK")
            } finally {
                try { outputStream?.close() } catch (_: Exception) {}
                try { inputStream?.close() } catch (_: Exception) {}
                try { connection?.disconnect() } catch (_: Exception) {}
            }
        }.start()
    }

    /**
     * Check if downloaded APK exists in cache.
     */
    @JavascriptInterface
    fun hasDownloadedApk(): Boolean {
        val apkFile = File(File(activity.cacheDir, "updates"), UPDATE_FILE_NAME)
        return apkFile.exists() && apkFile.length() > 0
    }

    /**
     * Install previously downloaded APK from cache.
     */
    @JavascriptInterface
    fun installDownloadedApk(): Boolean {
        val apkFile = File(File(activity.cacheDir, "updates"), UPDATE_FILE_NAME)
        if (apkFile.exists() && apkFile.length() > 0) {
            activity.runOnUiThread {
                installApk(apkFile)
            }
            return true
        }
        return false
    }

    private fun installApk(apkFile: File) {
        try {
            if (!apkFile.exists() || apkFile.length() == 0L) {
                activity.evaluateJs("if (typeof showToast === 'function') showToast('Tệp APK không tồn tại hoặc bị lỗi', 'error');")
                return
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!activity.packageManager.canRequestPackageInstalls()) {
                    openInstallPermissionSettings()
                    activity.evaluateJs("if (typeof showToast === 'function') showToast('Vui lòng bật quyền cài đặt ứng dụng cho DuyDev Studio để tiếp tục', 'warning');")
                    return
                }
            }

            val apkUri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                apkFile
            )

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or 
                        Intent.FLAG_ACTIVITY_NEW_TASK or 
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
            }

            activity.evaluateJs("if (typeof showToast === 'function') showToast('Đang mở trình cài đặt APK...', 'info');")
            activity.startActivity(installIntent)
        } catch (e: Exception) {
            val safeErr = (e.message ?: "Lỗi không xác định").replace("'", "\\'")
            activity.evaluateJs("if (typeof showToast === 'function') showToast('Không thể mở bộ cài đặt: $safeErr', 'error');")
        }
    }

    private fun dispatchApkDownloadProgress(percent: Int, bytes: Long, total: Long) {
        val payload = JSONObject().apply {
            put("percent", percent)
            put("bytes", bytes)
            put("total", total)
        }.toString()
        activity.evaluateJs("window.dispatchEvent(new CustomEvent('ds:apk-download-progress', { detail: $payload }));")
    }

    private fun dispatchApkDownloadComplete(path: String, bytes: Long) {
        val payload = JSONObject().apply {
            put("path", path)
            put("bytes", bytes)
        }.toString()
        activity.evaluateJs("window.dispatchEvent(new CustomEvent('ds:apk-download-complete', { detail: $payload }));")
    }

    private fun dispatchApkDownloadError(message: String) {
        val payload = JSONObject().apply {
            put("message", message)
        }.toString()
        activity.evaluateJs("window.dispatchEvent(new CustomEvent('ds:apk-download-error', { detail: $payload }));")
    }

    /**
     * Check if a native Content URI exists in registry for the given file name and size.
     */
    @JavascriptInterface
    fun hasNativeUri(name: String, size: Long): Boolean {
        return vn.alphadaniel.duydevstudio.upload.NativeFileRegistry.has(name, size)
    }

    /**
     * Start background upload via WorkManager and return the unique task UUID string.
     */
    @JavascriptInterface
    fun startBackgroundUpload(jsonPayload: String): String {
        return try {
            val json = JSONObject(jsonPayload)
            val fileName = json.getString("fileName")
            val fileSize = json.getLong("fileSize")
            val mimeType = json.optString("mimeType", "application/octet-stream")
            val purpose = json.optString("purpose", "general")
            val targetDir = json.optString("targetDir", "/")
            val serverUrl = json.optString("serverUrl", getActiveHost())

            val inputData = androidx.work.workDataOf(
                vn.alphadaniel.duydevstudio.upload.UploadWorker.KEY_FILE_NAME to fileName,
                vn.alphadaniel.duydevstudio.upload.UploadWorker.KEY_FILE_SIZE to fileSize,
                vn.alphadaniel.duydevstudio.upload.UploadWorker.KEY_MIME_TYPE to mimeType,
                vn.alphadaniel.duydevstudio.upload.UploadWorker.KEY_PURPOSE to purpose,
                vn.alphadaniel.duydevstudio.upload.UploadWorker.KEY_TARGET_DIR to targetDir,
                vn.alphadaniel.duydevstudio.upload.UploadWorker.KEY_SERVER_URL to serverUrl
            )

            val constraints = androidx.work.Constraints.Builder()
                .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                .build()

            val uploadWorkRequest = androidx.work.OneTimeWorkRequestBuilder<vn.alphadaniel.duydevstudio.upload.UploadWorker>()
                .setInputData(inputData)
                .setConstraints(constraints)
                .addTag(vn.alphadaniel.duydevstudio.upload.UploadWorker.TAG)
                .build()

            androidx.work.WorkManager.getInstance(activity.applicationContext).enqueue(uploadWorkRequest)
            uploadWorkRequest.id.toString()
        } catch (_: Exception) {
            ""
        }
    }

    /**
     * Cancel an active or queued background upload task.
     */
    @JavascriptInterface
    fun cancelBackgroundUpload(taskId: String) {
        try {
            val uuid = java.util.UUID.fromString(taskId)
            androidx.work.WorkManager.getInstance(activity.applicationContext).cancelWorkById(uuid)
            vn.alphadaniel.duydevstudio.upload.UploadNotificationManager.cancelNotification(
                activity.applicationContext,
                uuid.hashCode()
            )
        } catch (_: Exception) {}
    }

    /**
     * Get JSON array of currently active or enqueued upload tasks.
     */
    @JavascriptInterface
    fun getActiveUploads(): String {
        return try {
            val workInfos = androidx.work.WorkManager.getInstance(activity.applicationContext)
                .getWorkInfosByTag(vn.alphadaniel.duydevstudio.upload.UploadWorker.TAG)
                .get()
            val list = org.json.JSONArray()
            for (info in workInfos) {
                if (info.state == androidx.work.WorkInfo.State.RUNNING || info.state == androidx.work.WorkInfo.State.ENQUEUED) {
                    val item = JSONObject().apply {
                        put("id", info.id.toString())
                        put("state", info.state.name)
                    }
                    list.put(item)
                }
            }
            list.toString()
        } catch (_: Exception) {
            "[]"
        }
    }

    /**
     * Request notification permission on Android 13+ (API 33+).
     */
    @JavascriptInterface
    fun requestNotificationPermission() {
        activity.runOnUiThread {
            activity.requestNotificationPermission()
        }
    }
}
