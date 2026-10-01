package vn.alphadaniel.duydevstudio.upload

import android.content.Context
import android.net.Uri
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import vn.alphadaniel.duydevstudio.MainActivity
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Background upload worker running as a foreground service with continuous notification.
 * Executes direct or Cloudflare R2 transit streaming independent of the WebView lifecycle.
 */
class UploadWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        const val TAG = "UploadWorker"
        const val KEY_FILE_NAME = "fileName"
        const val KEY_FILE_SIZE = "fileSize"
        const val KEY_MIME_TYPE = "mimeType"
        const val KEY_PURPOSE = "purpose"
        const val KEY_TARGET_DIR = "targetDir"
        const val KEY_SERVER_URL = "serverUrl"
        const val KEY_URI_STRING = "uriString"

        private val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .writeTimeout(300, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    @Volatile
    private var activeCall: Call? = null

    override suspend fun getForegroundInfo(): ForegroundInfo {
        val fileName = inputData.getString(KEY_FILE_NAME) ?: "file"
        val fileSize = inputData.getLong(KEY_FILE_SIZE, 0L)
        return UploadNotificationManager.createForegroundInfo(
            context,
            id,
            fileName,
            0,
            0,
            0,
            fileSize
        )
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val fileName = inputData.getString(KEY_FILE_NAME) ?: return@withContext Result.failure()
        val fileSize = inputData.getLong(KEY_FILE_SIZE, 0L)
        val mimeType = inputData.getString(KEY_MIME_TYPE) ?: "application/octet-stream"
        val purpose = inputData.getString(KEY_PURPOSE) ?: "general"
        val targetDir = inputData.getString(KEY_TARGET_DIR) ?: "/"
        val serverUrl = (inputData.getString(KEY_SERVER_URL) ?: MainActivity.PRIMARY_HOST).trimEnd('/')

        val uriString = inputData.getString(KEY_URI_STRING)
        val uri = if (!uriString.isNullOrBlank()) {
            Uri.parse(uriString)
        } else {
            NativeFileRegistry.get(fileName, fileSize)
        }

        if (uri == null) {
            val errorMsg = "Tệp không tồn tại trong bộ nhớ tạm Native"
            UploadNotificationManager.showCompletionNotification(
                context,
                id.hashCode(),
                fileName,
                UploadNotificationManager.formatBytes(fileSize),
                false,
                errorMsg
            )
            dispatchWebComplete(false, null, errorMsg)
            return@withContext Result.failure(workDataOf("error" to errorMsg))
        }

        // Promote to foreground service immediately
        try {
            setForeground(getForegroundInfo())
        } catch (_: Exception) {}

        var lastLoaded = 0L
        var lastTime = System.currentTimeMillis()
        var currentSpeed = 0L

        fun onProgressUpdate(bytesWritten: Long, totalBytes: Long) {
            if (isStopped) {
                activeCall?.cancel()
                return
            }
            val now = System.currentTimeMillis()
            val timeDelta = (now - lastTime) / 1000.0
            if (timeDelta >= 0.25 || bytesWritten == totalBytes) {
                val bytesDelta = bytesWritten - lastLoaded
                val instantSpeed = if (timeDelta > 0) (bytesDelta / timeDelta).toLong() else 0L
                currentSpeed = if (currentSpeed == 0L) instantSpeed else ((currentSpeed * 0.7) + (instantSpeed * 0.3)).toLong()
                lastLoaded = bytesWritten
                lastTime = now

                val percent = if (totalBytes > 0) ((bytesWritten * 100) / totalBytes).toInt().coerceIn(0, 100) else 0
                val remainingBytes = (totalBytes - bytesWritten).coerceAtLeast(0)
                val etaSeconds = if (currentSpeed > 0) (remainingBytes / currentSpeed).toInt() else 0

                val foregroundInfo = UploadNotificationManager.createForegroundInfo(
                    context,
                    id,
                    fileName,
                    percent,
                    currentSpeed,
                    bytesWritten,
                    totalBytes
                )

                try {
                    NotificationManagerCompat.from(context).notify(
                        id.hashCode(),
                        foregroundInfo.notification
                    )
                } catch (_: Exception) {}

                dispatchWebProgress(percent, bytesWritten, totalBytes, currentSpeed, etaSeconds)
            }
        }

        try {
            // Step 1: Query presign endpoint
            var presignData: JSONObject? = null
            var presignTries = 0
            while (presignTries < 3 && presignData == null) {
                if (isStopped) return@withContext Result.failure()
                try {
                    val presignBody = JSONObject().apply {
                        put("fileName", fileName)
                        put("fileSize", fileSize)
                        put("mimeType", mimeType)
                        put("purpose", purpose)
                        if (targetDir.isNotBlank()) put("targetDir", targetDir)
                    }.toString().toRequestBody("application/json; charset=utf-8".toMediaType())

                    val presignReq = Request.Builder()
                        .url("$serverUrl/api/v1/files/presign")
                        .post(presignBody)
                        .build()

                    val call = okHttpClient.newCall(presignReq)
                    activeCall = call
                    val presignRes = call.execute()
                    val resText = presignRes.body?.string() ?: ""
                    if (presignRes.isSuccessful) {
                        val json = JSONObject(resText)
                        if (json.optBoolean("success")) {
                            presignData = json.optJSONObject("data")
                        }
                    }
                } catch (_: Exception) {}

                if (presignData == null) {
                    presignTries++
                    delay(1000L * presignTries)
                }
            }

            val mode = presignData?.optString("mode", "direct") ?: "direct"
            var uploadResultData: JSONObject? = null

            if (mode == "r2" && presignData != null) {
                // Mode R2 Transit Pipe: Stream PUT to Cloudflare R2
                var presignedUrl = presignData.getString("presignedUrl")
                val fileKey = presignData.getString("fileKey")
                val fileId = presignData.getString("fileId")

                val streamingBody = ProgressRequestBody(
                    context.contentResolver,
                    uri,
                    mimeType.toMediaTypeOrNull(),
                    fileSize,
                    ::onProgressUpdate
                )

                var r2Req = Request.Builder()
                    .url(presignedUrl)
                    .put(streamingBody)
                    .addHeader("Content-Type", mimeType)
                    .build()

                var call = okHttpClient.newCall(r2Req)
                activeCall = call
                var r2Res = call.execute()

                // If 403 (presigned URL expired TTL), re-query presign once
                if (r2Res.code == 403) {
                    val retryPresignBody = JSONObject().apply {
                        put("fileName", fileName)
                        put("fileSize", fileSize)
                        put("mimeType", mimeType)
                        put("purpose", purpose)
                        if (targetDir.isNotBlank()) put("targetDir", targetDir)
                    }.toString().toRequestBody("application/json; charset=utf-8".toMediaType())

                    val retryPresignReq = Request.Builder()
                        .url("$serverUrl/api/v1/files/presign")
                        .post(retryPresignBody)
                        .build()

                    val retryCall = okHttpClient.newCall(retryPresignReq)
                    val retryPresignRes = retryCall.execute()
                    val retryPresignJson = JSONObject(retryPresignRes.body?.string() ?: "")
                    if (retryPresignJson.optBoolean("success")) {
                        presignedUrl = retryPresignJson.getJSONObject("data").getString("presignedUrl")
                        r2Req = Request.Builder()
                            .url(presignedUrl)
                            .put(streamingBody)
                            .addHeader("Content-Type", mimeType)
                            .build()
                        call = okHttpClient.newCall(r2Req)
                        activeCall = call
                        r2Res = call.execute()
                    }
                }

                if (!r2Res.isSuccessful) {
                    throw IOException("Cloudflare R2 Transit trả về mã HTTP ${r2Res.code}")
                }

                // Step 2: Complete transit with 3 exponential backoff retries
                var completeSuccess = false
                var completeTries = 0
                val completePayload = JSONObject().apply {
                    put("fileKey", fileKey)
                    put("fileId", fileId)
                    put("originalName", fileName)
                    put("mimeType", mimeType)
                    put("purpose", purpose)
                    put("targetDir", targetDir)
                    put("sizeBytes", fileSize)
                }.toString().toRequestBody("application/json; charset=utf-8".toMediaType())

                while (completeTries < 3 && !completeSuccess) {
                    if (isStopped) return@withContext Result.failure()
                    try {
                        val completeReq = Request.Builder()
                            .url("$serverUrl/api/v1/files/complete-transit")
                            .post(completePayload)
                            .build()
                        val completeCall = okHttpClient.newCall(completeReq)
                        activeCall = completeCall
                        val completeRes = completeCall.execute()
                        val completeResText = completeRes.body?.string() ?: ""
                        if (completeRes.isSuccessful) {
                            val resJson = JSONObject(completeResText)
                            if (resJson.optBoolean("success")) {
                                uploadResultData = resJson.optJSONObject("data")
                                completeSuccess = true
                            }
                        }
                    } catch (_: Exception) {}

                    if (!completeSuccess) {
                        completeTries++
                        delay(1000L * (1 shl completeTries))
                    }
                }

                if (!completeSuccess) {
                    throw IOException("Không thể hoàn tất nạp tệp từ trạm trung chuyển về máy chủ")
                }
            } else {
                // Mode Direct: Multipart POST directly to server
                val uploadUrl = presignData?.optString("uploadUrl")?.takeIf { it.isNotBlank() }
                    ?: "$serverUrl/api/v1/files/upload?purpose=$purpose"

                val streamingBody = ProgressRequestBody(
                    context.contentResolver,
                    uri,
                    mimeType.toMediaTypeOrNull(),
                    fileSize,
                    ::onProgressUpdate
                )

                val multipartBody = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("purpose", purpose)
                    .addFormDataPart("targetDir", targetDir)
                    .addFormDataPart("file", fileName, streamingBody)
                    .build()

                val directReq = Request.Builder()
                    .url(uploadUrl)
                    .post(multipartBody)
                    .build()

                val call = okHttpClient.newCall(directReq)
                activeCall = call
                val directRes = call.execute()
                val resText = directRes.body?.string() ?: ""
                if (!directRes.isSuccessful) {
                    throw IOException("Máy chủ trả về mã HTTP ${directRes.code}")
                }
                val resJson = JSONObject(resText)
                if (!resJson.optBoolean("success")) {
                    throw IOException(resJson.optJSONObject("error")?.optString("message") ?: "Lỗi tải lên trực tiếp")
                }
                uploadResultData = resJson.optJSONObject("data")
            }

            // Success
            NativeFileRegistry.remove(fileName, fileSize)
            UploadNotificationManager.cancelNotification(context, id.hashCode())
            UploadNotificationManager.showCompletionNotification(
                context,
                id.hashCode(),
                fileName,
                UploadNotificationManager.formatBytes(fileSize),
                true
            )
            dispatchWebComplete(true, uploadResultData, null)

            Result.success(workDataOf("result" to (uploadResultData?.toString() ?: "{}")))
        } catch (e: Exception) {
            UploadNotificationManager.cancelNotification(context, id.hashCode())
            if (!isStopped) {
                UploadNotificationManager.showCompletionNotification(
                    context,
                    id.hashCode(),
                    fileName,
                    UploadNotificationManager.formatBytes(fileSize),
                    false,
                    e.message
                )
                dispatchWebComplete(false, null, e.message)
            }
            Result.failure(workDataOf("error" to (e.message ?: "Upload failed")))
        } finally {
            activeCall = null
        }
    }

    private fun dispatchWebProgress(percent: Int, uploadedBytes: Long, totalBytes: Long, speed: Long, etaSeconds: Int) {
        val payload = JSONObject().apply {
            put("taskId", id.toString())
            put("percent", percent)
            put("uploadedBytes", uploadedBytes)
            put("totalBytes", totalBytes)
            put("speedBytesPerSec", speed)
            put("etaSeconds", etaSeconds)
            put("stageText", "Đang tải lên: $percent%")
        }.toString()
        val safePayload = payload.replace("\\", "\\\\").replace("'", "\\'")
        val js = "if (typeof window !== 'undefined') { window.dispatchEvent(new CustomEvent('ds:native-upload-progress', { detail: JSON.parse('$safePayload') })); }"
        MainActivity.currentInstance?.evaluateJs(js)
    }

    private fun dispatchWebComplete(success: Boolean, data: JSONObject?, error: String?) {
        val payload = JSONObject().apply {
            put("taskId", id.toString())
            put("success", success)
            if (data != null) put("data", data)
            if (error != null) put("error", error)
        }.toString()
        val safePayload = payload.replace("\\", "\\\\").replace("'", "\\'")
        val js = "if (typeof window !== 'undefined') { window.dispatchEvent(new CustomEvent('ds:native-upload-complete', { detail: JSON.parse('$safePayload') })); }"
        MainActivity.currentInstance?.evaluateJs(js)
    }
}
