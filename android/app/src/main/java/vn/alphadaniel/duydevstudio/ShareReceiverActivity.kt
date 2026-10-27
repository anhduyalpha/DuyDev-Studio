package vn.alphadaniel.duydevstudio

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.LayoutInflater
import android.view.View
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.bottomsheet.BottomSheetDialog
import java.util.Locale

/**
 * Translucent activity that intercepts ACTION_SEND and ACTION_SEND_MULTIPLE.
 * Displays a lightweight, dark-themed native BottomSheetDialog in <80ms with 0ms splash screen.
 */
class ShareReceiverActivity : AppCompatActivity() {

    data class ShareAction(
        val label: String,
        val route: String,
        val mode: String? = null
    )

    data class ShareUrlHandler(
        val id: String,
        val metaLabel: String,
        val primaryActionLabel: String,
        val primaryRoute: String,
        val matches: (url: String, text: String) -> Boolean,
        val extractUrl: ((url: String, text: String) -> String)? = null
    )

    private val urlHandlers = listOf(
        ShareUrlHandler(
            id = "facebook",
            metaLabel = "VIDEO & BÀI VIẾT FACEBOOK",
            primaryActionLabel = "Tải Video & Reel Facebook (HD/SD)",
            primaryRoute = "#tool/facebook-downloader",
            matches = { url, text ->
                val combined = "$url $text".lowercase(Locale.ROOT)
                combined.contains("facebook.com") || combined.contains("fb.watch") || combined.contains("fb.com")
            },
            extractUrl = { url, text ->
                val combined = if (url.isNotBlank()) url else text
                Regex("""https?://(?:[a-zA-Z0-9_-]+\.)?(?:facebook\.com|fb\.watch|fb\.com)/[^\s"'<>()]+""").find(combined)?.value
                    ?.trimEnd('.', ',', ';', '!', '?', ')') ?: (if (url.isNotBlank()) url else text)
            }
        ),
        ShareUrlHandler(
            id = "instagram",
            metaLabel = "BÀI ĐĂNG & REEL INSTAGRAM",
            primaryActionLabel = "Tải Video & Ảnh Reel Instagram",
            primaryRoute = "#tool/instagram-downloader",
            matches = { url, text ->
                val combined = "$url $text".lowercase(Locale.ROOT)
                combined.contains("instagram.com") || combined.contains("instagr.am")
            },
            extractUrl = { url, text ->
                val combined = if (url.isNotBlank()) url else text
                Regex("""https?://(?:[a-zA-Z0-9_-]+\.)?(?:instagram\.com|instagr\.am)/[^\s"'<>()]+""").find(combined)?.value
                    ?.trimEnd('.', ',', ';', '!', '?', ')') ?: (if (url.isNotBlank()) url else text)
            }
        ),
        ShareUrlHandler(
            id = "spotify",
            metaLabel = "NHẠC & BÀI HÁT SPOTIFY",
            primaryActionLabel = "Tải Bài Hát / Playlist Spotify MP3",
            primaryRoute = "#tool/spotify-downloader",
            matches = { url, text ->
                val combined = "$url $text".lowercase(Locale.ROOT)
                combined.contains("spotify.com") || combined.contains("spotify.link")
            },
            extractUrl = { url, text ->
                val combined = if (url.isNotBlank()) url else text
                Regex("""https?://(?:(?:open\.)?spotify\.com|spotify\.link)/[^\s"'<>()]+""").find(combined)?.value
                    ?.trimEnd('.', ',', ';', '!', '?', ')') ?: (if (url.isNotBlank()) url else text)
            }
        ),
        ShareUrlHandler(
            id = "youtube",
            metaLabel = "VIDEO & ÂM THANH YOUTUBE",
            primaryActionLabel = "Tải Video & Nhạc YouTube (1080p/MP3)",
            primaryRoute = "#tool/youtube-downloader",
            matches = { url, text ->
                val combined = "$url $text".lowercase(Locale.ROOT)
                combined.contains("youtube.com") || combined.contains("youtu.be")
            },
            extractUrl = { url, text ->
                val combined = if (url.isNotBlank()) url else text
                Regex("""https?://(?:[a-zA-Z0-9_-]+\.)?(?:youtube\.com|youtu\.be)/[^\s"'<>()]+""").find(combined)?.value
                    ?.trimEnd('.', ',', ';', '!', '?', ')') ?: (if (url.isNotBlank()) url else text)
            }
        ),
        ShareUrlHandler(
            id = "tiktok",
            metaLabel = "VIDEO / ALBUM ẢNH TIKTOK",
            primaryActionLabel = "Tải Video & Album Ảnh TikTok Không Logo",
            primaryRoute = "#tool/tiktok",
            matches = { url, text ->
                val combined = "$url $text".lowercase(Locale.ROOT)
                combined.contains("tiktok.com") || combined.contains("douyin.com")
            },
            extractUrl = { url, text ->
                val combined = if (url.isNotBlank()) url else text
                Regex("""https?://(?:(?:vt|vm|m|www|v)\.)?(?:tiktok\.com|douyin\.com)/[^\s"'<>()]+""").find(combined)?.value
                    ?.trimEnd('.', ',', ';', '!', '?', ')') ?: (if (url.isNotBlank()) url else text)
            }
        ),
        ShareUrlHandler(
            id = "scribd",
            metaLabel = "TÀI LIỆU SCRIBD",
            primaryActionLabel = "Tải tài liệu Scribd",
            primaryRoute = "#tool/scribd",
            matches = { url, text ->
                val combined = "$url $text".lowercase(Locale.ROOT)
                combined.contains("scribd.com")
            },
            extractUrl = { url, text ->
                val combined = if (url.isNotBlank()) url else text
                Regex("""https?://(?:www\.)?scribd\.com/(?:document|doc|presentation|embeds)/\d+[^\s"'<>()]*""").find(combined)?.value
                    ?.trimEnd('.', ',', ';', '!', '?', ')') ?: (if (url.isNotBlank()) url else text)
            }
        ),
        ShareUrlHandler(
            id = "studocu",
            metaLabel = "TÀI LIỆU STUDOCU",
            primaryActionLabel = "Tải tài liệu Studocu",
            primaryRoute = "#tool/studocu-dl",
            matches = { url, text ->
                val combined = "$url $text".lowercase(Locale.ROOT)
                combined.contains("studocu.com") || combined.contains("studocu.vn")
            },
            extractUrl = { url, text ->
                val combined = if (url.isNotBlank()) url else text
                Regex("""https?://(?:www\.)?studocu\.(?:com|vn)/[^\s"'<>()]+""").find(combined)?.value
                    ?.trimEnd('.', ',', ';', '!', '?', ')') ?: (if (url.isNotBlank()) url else text)
            }
        )
    )

    private val collectedUris = mutableListOf<Uri>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val intent = intent ?: run {
            finish()
            return
        }

        val action = intent.action
        if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) {
            finish()
            return
        }

        // Collect incoming shared URIs or plain text
        collectedUris.clear()
        if (action == Intent.ACTION_SEND) {
            val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                ?: intent.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.uri
                ?: intent.data
            if (uri != null) collectedUris.add(uri)
        } else if (action == Intent.ACTION_SEND_MULTIPLE) {
            val uris = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
            if (uris != null) {
                collectedUris.addAll(uris)
            } else if (intent.clipData != null) {
                for (i in 0 until intent.clipData!!.itemCount) {
                    val u = intent.clipData!!.getItemAt(i).uri
                    if (u != null) collectedUris.add(u)
                }
            }
        }

        val text = (intent.getCharSequenceExtra(Intent.EXTRA_TEXT)
            ?: intent.getStringExtra(Intent.EXTRA_TEXT)
            ?: intent.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.text
            ?: intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT)
            ?: intent.dataString
            ?: "").toString().trim()

        val urlRegex = Regex("""https?://[^\s"'<>()]+""")
        val url = when {
            intent.dataString?.startsWith("http://") == true || intent.dataString?.startsWith("https://") == true ->
                intent.dataString!!.trim()
            text.startsWith("http://") || text.startsWith("https://") ->
                urlRegex.find(text)?.value?.trimEnd('.', ',', ';', '!', '?', ')') ?: text
            else ->
                urlRegex.find(text)?.value?.trimEnd('.', ',', ';', '!', '?', ')') ?: ""
        }

        if (collectedUris.isEmpty() && text.isBlank() && url.isBlank()) {
            finish()
            return
        }

        showNativeShareDialog(collectedUris, text, url)
    }

    private fun showNativeShareDialog(sharedUris: List<Uri>, text: String, url: String) {
        val dialog = BottomSheetDialog(this, R.style.Theme_DuyDevStudio_BottomSheetDialog)
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_share_receiver, null)
        dialog.setContentView(dialogView)

        val btnClose = dialogView.findViewById<ImageButton>(R.id.btnCloseShare)
        val tvFileName = dialogView.findViewById<TextView>(R.id.tvFileName)
        val tvFileMeta = dialogView.findViewById<TextView>(R.id.tvFileMeta)
        val imgFileType = dialogView.findViewById<ImageView>(R.id.imgFileType)
        val actionsContainer = dialogView.findViewById<LinearLayout>(R.id.actionsContainer)

        btnClose.setOnClickListener {
            dialog.dismiss()
        }

        dialog.setOnDismissListener {
            finish()
        }

        val actions = mutableListOf<ShareAction>()

        if (sharedUris.isNotEmpty()) {
            val primaryUri = sharedUris[0]
            val meta = getUriMetadata(primaryUri)
            val name = meta.first
            val size = meta.second
            val mime = contentResolver.getType(primaryUri)?.lowercase(Locale.ROOT)
                ?: getMimeFromExtension(name)

            val countText = if (sharedUris.size > 1) " (+${sharedUris.size - 1} tệp khác)" else ""
            tvFileName.text = "$name$countText"
            tvFileMeta.text = "${formatFileSize(size)} • ${mime.uppercase(Locale.ROOT)}"

            // Classify file and suggest tool actions
            if (mime == "application/pdf" || name.lowercase(Locale.ROOT).endsWith(".pdf")) {
                if (sharedUris.size > 1) {
                    actions.add(ShareAction("Gộp ${sharedUris.size} tệp PDF", "#tool/pdf-studio", "merge"))
                }
                actions.add(ShareAction("Nén PDF", "#tool/pdf-studio", "compress"))
                actions.add(ShareAction("PDF sang Word", "#tool/pdf-studio", "pdf_to_docx"))
                actions.add(ShareAction("Tách trang", "#tool/pdf-studio", "split"))
                actions.add(ShareAction("Xem tài liệu PDF", "#tool/pdf-studio", "view"))
            } else if (mime.startsWith("image/") || isImageExtension(name)) {
                if (sharedUris.size > 1) {
                    actions.add(ShareAction("Ghép ${sharedUris.size} ảnh thành PDF", "#tool/pdf-studio", "images_to_pdf"))
                } else {
                    actions.add(ShareAction("Quét mã QR từ ảnh", "#tool/qr-scan"))
                    actions.add(ShareAction("Chuyển ảnh thành PDF", "#tool/pdf-studio", "images_to_pdf"))
                }
                actions.add(ShareAction("Đổi định dạng ảnh", "#tool/universal-converter"))
                actions.add(ShareAction("Tính mã băm toàn vẹn", "#tool/hash-checksum"))
            } else if (isArchive(name, mime)) {
                actions.add(ShareAction("Soi tệp nén trực tuyến", "#tool/archive-inspect"))
                actions.add(ShareAction("Chuyển đổi định dạng tệp", "#tool/universal-converter"))
            } else {
                actions.add(ShareAction("Chuyển đổi định dạng", "#tool/universal-converter"))
                actions.add(ShareAction("Tính mã băm", "#tool/hash-checksum"))
            }
        } else {
            // Text or URL
            val isLink = url.isNotEmpty()
            tvFileName.text = if (isLink) url else text

            val matchedHandler = if (isLink) urlHandlers.firstOrNull { it.matches(url, text) } else null

            if (matchedHandler != null) {
                tvFileMeta.text = matchedHandler.metaLabel
                actions.add(ShareAction(matchedHandler.primaryActionLabel, matchedHandler.primaryRoute))
                actions.add(ShareAction("Tạo mã QR cho liên kết", "#tool/qr-multi"))
                actions.add(ShareAction("Tính mã băm toàn vẹn", "#tool/hash-checksum"))
            } else if (isImageExtension(url)) {
                tvFileMeta.text = "LIÊN KẾT HÌNH ẢNH"
                actions.add(ShareAction("Quét mã QR từ ảnh", "#tool/qr-scan"))
                actions.add(ShareAction("Đổi định dạng ảnh (Converter)", "#tool/universal-converter"))
                actions.add(ShareAction("Chuyển ảnh thành PDF", "#tool/pdf-studio", "images_to_pdf"))
                actions.add(ShareAction("Tạo mã QR cho liên kết", "#tool/qr-multi"))
            } else if (isLink) {
                tvFileMeta.text = "LIÊN KẾT WEB"
                actions.add(ShareAction("Tạo mã QR cho liên kết", "#tool/qr-multi"))
                actions.add(ShareAction("Quét mã QR từ trang web", "#tool/qr-scan"))
                actions.add(ShareAction("Thử tải Video Facebook / TikTok / Instagram", "#tool/facebook-downloader"))
                actions.add(ShareAction("Thử tải Video & Nhạc YouTube", "#tool/youtube-downloader"))
                actions.add(ShareAction("Thử tải Nhạc Spotify", "#tool/spotify-downloader"))
                actions.add(ShareAction("Tính mã băm toàn vẹn", "#tool/hash-checksum"))
            } else {
                tvFileMeta.text = "VĂN BẢN THUẦN"
                actions.add(ShareAction("Tạo mã QR cho văn bản", "#tool/qr-multi"))
                actions.add(ShareAction("Tính mã băm chuỗi", "#tool/hash-checksum"))
            }

            // Render action items
            val inflater = LayoutInflater.from(this)
            for (item in actions) {
                val itemView = inflater.inflate(R.layout.item_share_action, actionsContainer, false)
                val tvLabel = itemView.findViewById<TextView>(R.id.tvActionLabel)
                tvLabel.text = item.label

                itemView.setOnClickListener {
                    dialog.dismiss()
                    val targetUrl = matchedHandler?.extractUrl?.invoke(url, text) ?: if (url.isNotBlank()) url else text
                    forwardToMainActivity(item, targetUrl)
                }
                actionsContainer.addView(itemView)
            }
        }

        if (sharedUris.isNotEmpty()) {
            val inflater = LayoutInflater.from(this)
            for (item in actions) {
                val itemView = inflater.inflate(R.layout.item_share_action, actionsContainer, false)
                val tvLabel = itemView.findViewById<TextView>(R.id.tvActionLabel)
                tvLabel.text = item.label

                itemView.setOnClickListener {
                    dialog.dismiss()
                    forwardToMainActivity(item, null)
                }
                actionsContainer.addView(itemView)
            }
        }

        dialog.show()
    }

    private fun forwardToMainActivity(action: ShareAction, explicitUrl: String? = null) {
        val targetIntent = Intent(this, MainActivity::class.java).apply {
            this.action = intent.action
            this.type = intent.type
            this.data = intent.data
            intent.extras?.let { putExtras(it) }

            if (!explicitUrl.isNullOrBlank()) {
                putExtra(Intent.EXTRA_TEXT, explicitUrl)
            }

            // Ensure all collected URIs are in ClipData so FLAG_GRANT_READ_URI_PERMISSION applies
            if (collectedUris.isNotEmpty()) {
                val clip = ClipData.newUri(contentResolver, "shared_file", collectedUris[0])
                for (i in 1 until collectedUris.size) {
                    clip.addItem(ClipData.Item(collectedUris[i]))
                }
                this.clipData = clip
            } else if (intent.clipData != null) {
                this.clipData = intent.clipData
            }

            putExtra(MainActivity.EXTRA_TARGET_ROUTE, action.route)
            if (action.mode != null) {
                putExtra(MainActivity.EXTRA_TARGET_MODE, action.mode)
            }

            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        startActivity(targetIntent)
        finish()
    }

    private fun getUriMetadata(uri: Uri): Pair<String, Long> {
        var name = uri.lastPathSegment ?: "shared_file"
        var size: Long = 0
        try {
            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (cursor.moveToFirst()) {
                    if (nameIndex != -1) name = cursor.getString(nameIndex) ?: name
                    if (sizeIndex != -1) size = cursor.getLong(sizeIndex)
                }
            }
        } catch (_: Exception) {}
        return Pair(name, size)
    }

    private fun formatFileSize(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        if (bytes < 1024) return "$bytes B"
        val kb = bytes / 1024.0
        if (kb < 1024) return String.format(Locale.US, "%.1f KB", kb)
        val mb = kb / 1024.0
        return String.format(Locale.US, "%.1f MB", mb)
    }

    private fun getMimeFromExtension(name: String): String {
        val ext = name.substringAfterLast('.', "").lowercase(Locale.ROOT)
        return when (ext) {
            "pdf" -> "application/pdf"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "webp" -> "image/webp"
            "gif" -> "image/gif"
            "zip" -> "application/zip"
            "rar" -> "application/x-rar-compressed"
            "7z" -> "application/x-7z-compressed"
            else -> "application/octet-stream"
        }
    }

    private fun isImageExtension(name: String): Boolean {
        val ext = name.substringAfterLast('.', "").lowercase(Locale.ROOT)
        return ext in listOf("png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "avif")
    }

    private fun isArchive(name: String, mime: String): Boolean {
        val ext = name.substringAfterLast('.', "").lowercase(Locale.ROOT)
        val archiveExts = listOf("zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz")
        return ext in archiveExts || mime.contains("zip") || mime.contains("rar") || mime.contains("7z") || mime.contains("tar")
    }
}
