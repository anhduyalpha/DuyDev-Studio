package vn.alphadaniel.duydevstudio

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Zero-network cold-boot interceptor and background delta sync for Studio WebView.
 * Serves app-shell HTML/JS/CSS directly from synced flash cache or APK assets (<1ms),
 * while revalidating silently off the critical path after initial render.
 */
object LocalBootCache {
    private const val PREF_NAME = "ds_fastboot_prefs"
    private const val CACHE_DIR_NAME = "fastboot_cache"
    private const val STAGING_DIR_NAME = "fastboot_cache_staging"
    private const val APK_ASSET_ROOT = "www"

    private val ALLOWED_HOSTS = setOf(
        "studio.duydev.cloud",
        "192.168.2.171",
        "100.90.62.15",
        "10.7.0.1",
        "localhost",
        "10.0.2.2"
    )

    private val syncExecutor = Executors.newSingleThreadExecutor()
    private val isSyncing = AtomicBoolean(false)

    @Volatile
    private var appContext: Context? = null

    fun ensureInitialized(context: Context) {
        if (appContext == null) {
            appContext = context.applicationContext
        }
    }

    fun clear(context: Context) {
        try {
            val ctx = context.applicationContext
            File(ctx.filesDir, CACHE_DIR_NAME).deleteRecursively()
            File(ctx.filesDir, STAGING_DIR_NAME).deleteRecursively()
            ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit().clear().apply()
        } catch (_: Exception) {}
    }

    fun isLocalBootPath(request: WebResourceRequest?): Boolean {
        return resolveRelPath(request) != null
    }

    fun intercept(context: Context, request: WebResourceRequest?): WebResourceResponse? {
        val uri = request?.url ?: return null
        val host = uri.host?.lowercase(Locale.ROOT) ?: return null
        if (host !in ALLOWED_HOSTS) return null

        val relPath = resolveRelPath(request) ?: return null
        val hostKey = sanitizeHostKey(host, uri.port)
        val mime = guessMimeType(relPath)
        val encoding = if (isTextMime(mime)) "UTF-8" else null

        val stream = openCachedOrBundledStream(context.applicationContext, hostKey, relPath) ?: return null
        val response = WebResourceResponse(mime, encoding, stream)
        response.responseHeaders = mapOf(
            "Access-Control-Allow-Origin" to "*",
            "Cache-Control" to "no-cache"
        )
        return response
    }

    private fun resolveRelPath(request: WebResourceRequest?): String? {
        if (request == null) return null
        if (!request.method.equals("GET", ignoreCase = true)) return null

        val uri = request.url ?: return null
        val host = uri.host?.lowercase(Locale.ROOT) ?: return null
        if (host !in ALLOWED_HOSTS) return null

        val headers = request.requestHeaders
        if (headers != null && headers.keys.any { it.equals("Range", ignoreCase = true) }) {
            return null
        }

        val query = uri.query ?: ""
        if (query.contains("hasFiles=") ||
            query.contains("url=") ||
            query.contains("text=") ||
            query.contains("clear=") ||
            query.contains("reset=") ||
            query.contains("_ds_fresh=") ||
            query.contains("migration")
        ) {
            return null
        }

        val rawPath = uri.path ?: "/"
        if (rawPath.startsWith("/api/") ||
            rawPath.startsWith("/downloads/") ||
            rawPath == "/sw.js" ||
            rawPath.startsWith("/__android_share_file__")
        ) {
            return null
        }

        val normalized = when (rawPath) {
            "", "/", "/index.html" -> "index.html"
            "/manifest.webmanifest" -> "manifest.webmanifest"
            else -> if (rawPath.startsWith("/src/")) rawPath.removePrefix("/") else return null
        }

        if (normalized.contains("..") || normalized.contains("\\") || normalized.contains("\u0000")) {
            return null
        }
        return normalized
    }

    private fun openCachedOrBundledStream(context: Context, hostKey: String, relPath: String): InputStream? {
        try {
            val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            if (prefs.contains("sig_$hostKey")) {
                val hostDir = File(File(context.filesDir, CACHE_DIR_NAME), hostKey)
                val targetFile = File(hostDir, relPath)
                if (targetFile.isFile && targetFile.canonicalPath.startsWith(hostDir.canonicalPath + File.separator)) {
                    return FileInputStream(targetFile)
                }
            }
        } catch (_: Exception) {}

        return try {
            context.assets.open("$APK_ASSET_ROOT/$relPath")
        } catch (_: Exception) {
            null
        }
    }

    fun syncInBackgroundIfNeeded(context: Context, activeHost: String) {
        val ctx = context.applicationContext
        if (!isSyncing.compareAndSet(false, true)) return

        syncExecutor.execute {
            try {
                val baseUri = Uri.parse(activeHost)
                val host = baseUri.host?.lowercase(Locale.ROOT) ?: return@execute
                if (host !in ALLOWED_HOSTS) return@execute

                val hostKey = sanitizeHostKey(host, baseUri.port)
                val cleanBase = activeHost.trimEnd('/')

                val swText = fetchString("$cleanBase/sw.js?t=${System.currentTimeMillis()}") ?: return@execute
                val cacheNameMatch = Regex("""CACHE_NAME\s*=\s*['"]([^'"]+)['"]""").find(swText)
                val swVersion = cacheNameMatch?.groupValues?.get(1) ?: ""
                val swHash = sha256Short(swText)

                val indexHtml = fetchString("$cleanBase/index.html") ?: return@execute
                if (!indexHtml.contains("id=\"app\"")) return@execute
                val serverSig = "$swVersion|$swHash|${sha256Short(indexHtml)}"

                val prefs = ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                val prevSig = prefs.getString("sig_$hostKey", null)
                if (serverSig == prevSig) return@execute

                val assets = collectAssetPaths(swText, indexHtml)
                if (assets.isEmpty()) return@execute

                val stagingDir = File(File(ctx.filesDir, STAGING_DIR_NAME), hostKey)
                stagingDir.deleteRecursively()
                stagingDir.mkdirs()

                writeBytesSafe(stagingDir, "index.html", indexHtml.toByteArray(Charsets.UTF_8))

                val visited = HashSet<String>()
                val queue = ArrayDeque<String>()
                for (asset in assets) {
                    if (asset != "index.html" && !asset.contains("docx-preview") && !asset.contains("xlsx.full")) {
                        queue.add(asset)
                    }
                }

                while (queue.isNotEmpty()) {
                    val relPath = queue.removeFirst()
                    if (!visited.add(relPath)) continue
                    val bytes = fetchBytes("$cleanBase/$relPath") ?: continue
                    writeBytesSafe(stagingDir, relPath, bytes)

                    if (relPath.endsWith(".js", ignoreCase = true) || relPath.endsWith(".mjs", ignoreCase = true)) {
                        val jsText = String(bytes, Charsets.UTF_8)
                        discoverRelativeImports(relPath, jsText, queue)
                    }
                }

                val targetDir = File(File(ctx.filesDir, CACHE_DIR_NAME), hostKey)
                targetDir.deleteRecursively()
                targetDir.parentFile?.mkdirs()
                if (stagingDir.renameTo(targetDir)) {
                    prefs.edit().putString("sig_$hostKey", serverSig).apply()
                }
            } catch (_: Exception) {
            } finally {
                isSyncing.set(false)
            }
        }
    }

    private fun collectAssetPaths(swText: String, indexHtml: String): List<String> {
        val paths = LinkedHashSet<String>()
        paths.add("index.html")
        paths.add("manifest.webmanifest")

        val precacheRegex = Regex("""['"]\./([^'"?]+)(?:\?[^'"]*)?['"]""")
        for (m in precacheRegex.findAll(swText)) {
            val rel = m.groupValues[1].trim('/')
            if (rel.isNotEmpty() && !rel.contains("..")) paths.add(rel)
        }

        val htmlRefRegex = Regex("""(?:src|href)=['"](?:\./)?(src/[^'"?]+|manifest\.webmanifest)(?:\?[^'"]*)?['"]""")
        for (m in htmlRefRegex.findAll(indexHtml)) {
            val rel = m.groupValues[1].trim('/')
            if (rel.isNotEmpty() && !rel.contains("..")) paths.add(rel)
        }
        return paths.toList()
    }

    private fun discoverRelativeImports(currentRelPath: String, jsText: String, queue: ArrayDeque<String>) {
        val importRegex = Regex("""(?:from|import)\s+['"](\.[^'"?]+(?:\.js|\.mjs))['"]""")
        val baseDir = currentRelPath.substringBeforeLast('/', "")
        for (m in importRegex.findAll(jsText)) {
            val relImport = m.groupValues[1]
            val resolved = normalizeRelPath(if (baseDir.isEmpty()) relImport else "$baseDir/$relImport")
            if (resolved != null && resolved.startsWith("src/")) {
                queue.add(resolved)
            }
        }
    }

    private fun normalizeRelPath(raw: String): String? {
        val parts = ArrayList<String>()
        for (seg in raw.split('/')) {
            when (seg) {
                "", "." -> {}
                ".." -> if (parts.isNotEmpty()) parts.removeAt(parts.size - 1) else return null
                else -> parts.add(seg)
            }
        }
        return parts.joinToString("/")
    }

    private fun writeBytesSafe(rootDir: File, relPath: String, bytes: ByteArray) {
        val dest = File(rootDir, relPath)
        if (!dest.canonicalPath.startsWith(rootDir.canonicalPath + File.separator)) return
        dest.parentFile?.mkdirs()
        dest.writeBytes(bytes)
    }

    private fun fetchString(urlStr: String): String? {
        val bytes = fetchBytes(urlStr) ?: return null
        return String(bytes, Charsets.UTF_8)
    }

    private fun fetchBytes(urlStr: String): ByteArray? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                connectTimeout = 3500
                readTimeout = 4500
                useCaches = false
                setRequestProperty("Cache-Control", "no-cache")
            }
            if (conn.responseCode in 200..299) {
                conn.inputStream.use { it.readBytes() }
            } else {
                null
            }
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun sha256Short(text: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8))
        return digest.take(8).joinToString("") { "%02x".format(it) }
    }

    private fun sanitizeHostKey(host: String, port: Int): String {
        val cleanHost = host.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        return if (port > 0) "${cleanHost}_$port" else cleanHost
    }

    private fun guessMimeType(path: String): String {
        val clean = path.lowercase(Locale.ROOT)
        return when {
            clean.endsWith(".html") -> "text/html"
            clean.endsWith(".js") || clean.endsWith(".mjs") -> "application/javascript"
            clean.endsWith(".css") -> "text/css"
            clean.endsWith(".svg") -> "image/svg+xml"
            clean.endsWith(".png") -> "image/png"
            clean.endsWith(".jpg") || clean.endsWith(".jpeg") -> "image/jpeg"
            clean.endsWith(".webp") -> "image/webp"
            clean.endsWith(".wav") -> "audio/wav"
            clean.endsWith(".woff2") -> "font/woff2"
            clean.endsWith(".webmanifest") || clean.endsWith(".json") -> "application/manifest+json"
            else -> "application/octet-stream"
        }
    }

    private fun isTextMime(mime: String): Boolean {
        return mime.startsWith("text/") ||
            mime.contains("javascript") ||
            mime.contains("json") ||
            mime.contains("svg")
    }
}
