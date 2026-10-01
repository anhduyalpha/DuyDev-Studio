package vn.alphadaniel.duydevstudio.upload

import android.content.ContentResolver
import android.net.Uri
import okhttp3.MediaType
import okhttp3.RequestBody
import okio.BufferedSink
import java.io.IOException

/**
 * Custom OkHttp RequestBody that streams binary content directly from ContentResolver
 * in 64KB buffers without reading the entire file into RAM, throttling progress updates
 * to at most twice per second (500ms).
 */
class ProgressRequestBody(
    private val contentResolver: ContentResolver,
    private val uri: Uri,
    private val contentType: MediaType?,
    private val contentLength: Long,
    private val onProgress: (bytesWritten: Long, totalBytes: Long) -> Unit
) : RequestBody() {

    override fun contentType(): MediaType? = contentType

    override fun contentLength(): Long = contentLength

    @Throws(IOException::class)
    override fun writeTo(sink: BufferedSink) {
        val inputStream = contentResolver.openInputStream(uri)
            ?: throw IOException("Không thể mở luồng dữ liệu cho URI: $uri")

        inputStream.use { stream ->
            val buffer = ByteArray(64 * 1024) // 64KB chunk buffer
            var totalWritten = 0L
            var lastProgressTime = 0L
            val intervalMs = 500L

            var bytesRead: Int
            while (stream.read(buffer).also { bytesRead = it } != -1) {
                sink.write(buffer, 0, bytesRead)
                sink.flush()
                totalWritten += bytesRead

                val now = System.currentTimeMillis()
                if (now - lastProgressTime >= intervalMs || (contentLength > 0 && totalWritten == contentLength)) {
                    lastProgressTime = now
                    onProgress(totalWritten, if (contentLength > 0) contentLength else totalWritten)
                }
            }
            onProgress(totalWritten, if (contentLength > 0) contentLength else totalWritten)
        }
    }
}
