package vn.alphadaniel.duydevstudio

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Base64
import android.view.View
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

class MainActivity : AppCompatActivity() {

    companion object {
        const val PRIMARY_HOST = "https://duydevstudio.alphadaniel.io.vn"
        const val LAN_HOST = "http://192.168.2.171:3000"
        const val EXTRA_TARGET_ROUTE = "extra_target_route"
        const val EXTRA_TARGET_MODE = "extra_target_mode"
    }

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var offlineContainer: View
    private lateinit var btnRetry: Button
    private lateinit var btnOpenLan: Button

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingPermissionRequest: PermissionRequest? = null
    private val sharedUrisList = mutableListOf<Uri>()

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = mutableListOf<Uri>()
        if (result.resultCode == Activity.RESULT_OK) {
            val intentData = result.data
            if (intentData != null) {
                val clipData = intentData.clipData
                if (clipData != null) {
                    for (i in 0 until clipData.itemCount) {
                        uris.add(clipData.getItemAt(i).uri)
                    }
                } else if (intentData.data != null) {
                    uris.add(intentData.data!!)
                }
            }
        }
        filePathCallback?.onReceiveValue(if (uris.isNotEmpty()) uris.toTypedArray() else null)
        filePathCallback = null
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            pendingPermissionRequest?.grant(pendingPermissionRequest?.resources)
        } else {
            pendingPermissionRequest?.deny()
        }
        pendingPermissionRequest = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        initViews()
        setupWebView()
        setupBackHandler()
        pruneRedundantCache()

        handleIntent(intent)

        if (savedInstanceState == null) {
            val targetRoute = intent?.getStringExtra(EXTRA_TARGET_ROUTE)
            val launchUrl = if (!targetRoute.isNullOrBlank()) {
                val cleanRoute = if (targetRoute.startsWith("#") || targetRoute.startsWith("/")) targetRoute else "#$targetRoute"
                "$PRIMARY_HOST$cleanRoute"
            } else {
                PRIMARY_HOST
            }
            webView.loadUrl(launchUrl)
        } else {
            webView.restoreState(savedInstanceState)
            val targetRoute = intent?.getStringExtra(EXTRA_TARGET_ROUTE)
            if (!targetRoute.isNullOrBlank()) {
                val cleanRoute = if (targetRoute.startsWith("#") || targetRoute.startsWith("/")) targetRoute else "#$targetRoute"
                val jsRoute = cleanRoute.replace("'", "\\'")
                webView.post {
                    webView.evaluateJavascript("window.location.hash = '$jsRoute';", null)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)

        val targetRoute = intent?.getStringExtra(EXTRA_TARGET_ROUTE)
        if (!targetRoute.isNullOrBlank()) {
            val cleanRoute = if (targetRoute.startsWith("#") || targetRoute.startsWith("/")) targetRoute else "#$targetRoute"
            val destUrl = "$PRIMARY_HOST$cleanRoute"
            if (webView.url?.startsWith(PRIMARY_HOST) == true) {
                val jsRoute = cleanRoute.replace("'", "\\'")
                webView.evaluateJavascript("window.location.hash = '$jsRoute';", null)
            } else {
                webView.loadUrl(destUrl)
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    private fun initViews() {
        webView = findViewById(R.id.webView)
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout)
        progressBar = findViewById(R.id.progressBar)
        offlineContainer = findViewById(R.id.offlineContainer)
        btnRetry = findViewById(R.id.btnRetry)
        btnOpenLan = findViewById(R.id.btnOpenLan)

        swipeRefreshLayout.setColorSchemeColors(Color.parseColor("#6366F1"))
        swipeRefreshLayout.setProgressBackgroundColorSchemeColor(Color.parseColor("#18181B"))
        swipeRefreshLayout.setOnRefreshListener {
            webView.reload()
        }

        btnRetry.setOnClickListener {
            showOffline(false)
            webView.reload()
        }

        btnOpenLan.setOnClickListener {
            showOffline(false)
            webView.loadUrl(LAN_HOST)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.mediaPlaybackRequiresUserGesture = false
        settings.userAgentString = "${settings.userAgentString} DuyDevStudioNative/1.0"

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        // Initialize ServiceWorkerController for offline-first PWA caching
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
            val swController = android.webkit.ServiceWorkerController.getInstance()
            swController.setServiceWorkerClient(object : android.webkit.ServiceWorkerClient() {
                override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? {
                    val uri = request.url
                    if (uri?.path?.contains("/__android_share_file__/") == true) {
                        val index = uri.lastPathSegment?.toIntOrNull() ?: 0
                        val fileUri = sharedUrisList.getOrNull(index)
                        if (fileUri != null) {
                            try {
                                val mime = contentResolver.getType(fileUri) ?: "application/octet-stream"
                                val stream = contentResolver.openInputStream(fileUri)
                                if (stream != null) {
                                    val encoding = if (mime.startsWith("text/") || mime.contains("json") || mime.contains("javascript")) "UTF-8" else null
                                    val response = WebResourceResponse(mime, encoding, stream)
                                    response.responseHeaders = mapOf(
                                        "Access-Control-Allow-Origin" to "*",
                                        "Access-Control-Allow-Methods" to "GET, OPTIONS",
                                        "Access-Control-Allow-Headers" to "*",
                                        "Cache-Control" to "no-cache, no-store"
                                    )
                                    return response
                                }
                            } catch (_: Exception) {}
                        }
                    }
                    return super.shouldInterceptRequest(request)
                }
            })
        }

        // Native download listener for file conversion outputs
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            try {
                val request = android.app.DownloadManager.Request(Uri.parse(url)).apply {
                    setMimeType(mimetype)
                    addRequestHeader("User-Agent", userAgent)
                    setDescription("Downloading file...")
                    setTitle(android.webkit.URLUtil.guessFileName(url, contentDisposition, mimetype))
                    setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(
                        android.os.Environment.DIRECTORY_DOWNLOADS,
                        android.webkit.URLUtil.guessFileName(url, contentDisposition, mimetype)
                    )
                }
                val dm = getSystemService(DOWNLOAD_SERVICE) as? android.app.DownloadManager
                dm?.enqueue(request)
            } catch (_: Exception) {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                } catch (_: Exception) {}
            }
        }

        // Inject Native Javascript Interface
        webView.addJavascriptInterface(AndroidBridge(this), "AndroidBridge")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                    swipeRefreshLayout.isRefreshing = false
                }
            }

            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                try {
                    fileChooserLauncher.launch(intent)
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    return false
                }
                return true
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return
                val resources = request.resources
                for (resource in resources) {
                    if (resource == PermissionRequest.RESOURCE_VIDEO_CAPTURE) {
                        if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            request.grant(request.resources)
                        } else {
                            pendingPermissionRequest = request
                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                        return
                    }
                }
                request.deny()
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                val scheme = uri.scheme?.lowercase(Locale.ROOT) ?: ""

                // Allow internal schemes (blob downloads, data URIs, javascript, about)
                if (scheme == "blob" || scheme == "data" || scheme == "javascript" || scheme == "about") {
                    return false
                }

                val host = uri.host?.lowercase(Locale.ROOT) ?: ""

                // Allow internal app navigation
                if (host == "duydevstudio.alphadaniel.io.vn" ||
                    host == "192.168.2.171" ||
                    host == "localhost" ||
                    host == "10.0.2.2") {
                    return false
                }

                // External links open in system browser
                try {
                    val browserIntent = Intent(Intent.ACTION_VIEW, uri)
                    startActivity(browserIntent)
                } catch (_: Exception) {}
                return true
            }

            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                val uri = request?.url ?: return super.shouldInterceptRequest(view, request)
                if (uri.path?.contains("/__android_share_file__/") == true) {
                    val index = uri.lastPathSegment?.toIntOrNull() ?: 0
                    val fileUri = sharedUrisList.getOrNull(index)
                    if (fileUri != null) {
                        try {
                            val mime = contentResolver.getType(fileUri) ?: "application/octet-stream"
                            val stream = contentResolver.openInputStream(fileUri)
                            if (stream != null) {
                                val encoding = if (mime.startsWith("text/") || mime.contains("json") || mime.contains("javascript")) "UTF-8" else null
                                val response = WebResourceResponse(mime, encoding, stream)
                                response.responseHeaders = mapOf(
                                    "Access-Control-Allow-Origin" to "*",
                                    "Access-Control-Allow-Methods" to "GET, OPTIONS",
                                    "Access-Control-Allow-Headers" to "*",
                                    "Cache-Control" to "no-cache, no-store"
                                )
                                return response
                            }
                        } catch (_: Exception) {}
                    }
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                showOffline(false)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefreshLayout.isRefreshing = false
                progressBar.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    showOffline(true)
                }
            }
        }
    }

    private fun setupBackHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (offlineContainer.visibility == View.VISIBLE) {
                    finish()
                } else if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    private fun showOffline(show: Boolean) {
        offlineContainer.visibility = if (show) View.VISIBLE else View.GONE
        swipeRefreshLayout.visibility = if (show) View.GONE else View.VISIBLE
    }

    private fun pruneRedundantCache() {
        Thread {
            try {
                val maxAgeMs = 24 * 3600 * 1000L
                val now = System.currentTimeMillis()
                cacheDir?.listFiles()?.forEach { file ->
                    if (file.isFile && (now - file.lastModified() > maxAgeMs)) {
                        file.delete()
                    }
                }
                externalCacheDir?.listFiles()?.forEach { file ->
                    if (file.isFile && (now - file.lastModified() > maxAgeMs)) {
                        file.delete()
                    }
                }
            } catch (_: Exception) {}
        }.start()
    }

    private fun handleIntent(intent: Intent?) {
        if (intent == null) return
        val targetRoute = intent.getStringExtra(EXTRA_TARGET_ROUTE)
        val targetMode = intent.getStringExtra(EXTRA_TARGET_MODE)

        val uris = mutableListOf<Uri>()
        if (intent.action == Intent.ACTION_SEND) {
            val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                ?: intent.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.uri
                ?: intent.data
            if (uri != null) uris.add(uri)
        } else if (intent.action == Intent.ACTION_SEND_MULTIPLE) {
            val list = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
            if (list != null) {
                uris.addAll(list)
            } else if (intent.clipData != null) {
                for (i in 0 until intent.clipData!!.itemCount) {
                    val u = intent.clipData!!.getItemAt(i).uri
                    if (u != null) uris.add(u)
                }
            }
        }

        val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: ""
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: ""

        val detectedUrl = when {
            intent.dataString?.startsWith("http://") == true || intent.dataString?.startsWith("https://") == true -> intent.dataString
            text.startsWith("http://") || text.startsWith("https://") -> text
            else -> Regex("""https?://[^\s]+""").find(text)?.value
        }

        if (uris.isNotEmpty() || text.isNotBlank() || !detectedUrl.isNullOrBlank()) {
            sharedUrisList.clear()
            sharedUrisList.addAll(uris)

            val fileListJson = JSONArray()
            for (i in uris.indices) {
                val uri = uris[i]
                val meta = getUriMetadata(uri)
                val fileObj = JSONObject().apply {
                    put("name", meta.first)
                    put("size", meta.second)
                    put("type", contentResolver.getType(uri) ?: "application/octet-stream")
                    put("fetchUrl", "/__android_share_file__/$i")

                    // Embed Base64 for files up to 10MB for instant zero-fetch memory transfer
                    if (meta.second in 1..10_485_760) {
                        try {
                            contentResolver.openInputStream(uri)?.use { stream ->
                                val bytes = stream.readBytes()
                                put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
                            }
                        } catch (_: Exception) {}
                    }
                }
                fileListJson.put(fileObj)
            }

            val payload = JSONObject().apply {
                if (subject.isNotBlank()) put("title", subject)
                if (text.isNotBlank()) put("text", text)
                if (!detectedUrl.isNullOrBlank()) put("url", detectedUrl)
                if (targetRoute != null) put("targetRoute", targetRoute)
                if (targetMode != null) put("targetMode", targetMode)
                put("files", fileListJson)
            }

            AndroidBridge.sharedPayloadJson = payload.toString()

            // Notify web application if already loaded
            webView.evaluateJavascript("""
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('ds:native-share-arrived'));
                }
            """.trimIndent(), null)
        }
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
}
