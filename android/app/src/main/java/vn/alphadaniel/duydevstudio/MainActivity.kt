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
import android.view.ViewGroup
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
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

class MainActivity : AppCompatActivity() {

    companion object {
        @Volatile
        var currentInstance: MainActivity? = null

        const val PRIMARY_HOST = "https://duydevstudio.alphadaniel.io.vn"
        const val LAN_HOST = "http://192.168.2.171:3000"
        const val TAILSCALE_HOST = "http://100.90.62.15:3000"
        const val WIREGUARD_HOST = "http://10.7.0.1:3000"
        const val EXTRA_TARGET_ROUTE = "extra_target_route"
        const val EXTRA_TARGET_MODE = "extra_target_mode"
        const val PREF_KEY_ACTIVE_HOST = "active_host"
    }

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var offlineContainer: View
    private lateinit var customViewContainer: FrameLayout
    private lateinit var btnRetry: Button
    private lateinit var btnOpenTailscale: Button
    private lateinit var btnOpenLan: Button
    private lateinit var btnOpenCloudflare: Button

    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var lastBackPressTime = 0L

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
        for (uri in uris) {
            try {
                contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (_: Exception) {}
            val meta = getUriMetadata(uri)
            vn.alphadaniel.duydevstudio.upload.NativeFileRegistry.register(meta.first, meta.second, uri)
        }
        filePathCallback?.onReceiveValue(if (uris.isNotEmpty()) uris.toTypedArray() else null)
        filePathCallback = null
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        // Handled: POST_NOTIFICATIONS runtime permission result
    }

    fun requestNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
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
        currentInstance = this
        setContentView(R.layout.activity_main)

        initViews()
        setupWebView()
        setupBackHandler()
        pruneRedundantCache()
        requestNotificationPermission()

        handleIntent(intent)

        if (savedInstanceState == null) {
            val prefs = getSharedPreferences("ds_prefs", MODE_PRIVATE)
            val baseHost = prefs.getString(PREF_KEY_ACTIVE_HOST, PRIMARY_HOST) ?: PRIMARY_HOST
            val targetRoute = intent?.getStringExtra(EXTRA_TARGET_ROUTE)
            val launchUrl = if (!targetRoute.isNullOrBlank()) {
                val cleanRoute = if (targetRoute.startsWith("#") || targetRoute.startsWith("/")) targetRoute else "#$targetRoute"
                "$baseHost$cleanRoute"
            } else {
                baseHost
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

    override fun onPause() {
        super.onPause()
        if (::webView.isInitialized) {
            webView.onPause()
            webView.pauseTimers()
            try {
                CookieManager.getInstance().flush()
            } catch (_: Exception) {}
        }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.resumeTimers()
            webView.onResume()
        }
        currentInstance = this
        evaluateJs("if (typeof window !== 'undefined') { window.dispatchEvent(new CustomEvent('ds:native-app-resumed')); }")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        if (currentInstance == this) {
            currentInstance = null
        }
        super.onDestroy()
    }

    private fun initViews() {
        webView = findViewById(R.id.webView)
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout)
        progressBar = findViewById(R.id.progressBar)
        offlineContainer = findViewById(R.id.offlineContainer)
        customViewContainer = findViewById(R.id.customViewContainer)
        btnRetry = findViewById(R.id.btnRetry)
        btnOpenTailscale = findViewById(R.id.btnOpenTailscale)
        btnOpenLan = findViewById(R.id.btnOpenLan)
        btnOpenCloudflare = findViewById(R.id.btnOpenCloudflare)

        swipeRefreshLayout.setColorSchemeColors(Color.parseColor("#6366F1"))
        swipeRefreshLayout.setProgressBackgroundColorSchemeColor(Color.parseColor("#18181B"))
        swipeRefreshLayout.setOnRefreshListener {
            webView.reload()
        }

        btnRetry.setOnClickListener {
            showOffline(false)
            webView.reload()
        }

        btnOpenTailscale.setOnClickListener {
            showOffline(false)
            loadHost(TAILSCALE_HOST)
        }

        btnOpenLan.setOnClickListener {
            showOffline(false)
            loadHost(LAN_HOST)
        }

        btnOpenCloudflare.setOnClickListener {
            showOffline(false)
            loadHost(PRIMARY_HOST)
        }
    }

    /**
     * Switch active server host and persist preference.
     */
    fun loadHost(baseUrl: String) {
        val prefs = getSharedPreferences("ds_prefs", MODE_PRIVATE)
        prefs.edit().putString(PREF_KEY_ACTIVE_HOST, baseUrl).apply()
        val currentHash = try {
            val u = Uri.parse(webView.url ?: "")
            val frag = u.fragment
            if (!frag.isNullOrBlank()) "#$frag" else ""
        } catch (_: Exception) { "" }
        val targetUrl = "$baseUrl$currentHash"
        runOnUiThread {
            webView.loadUrl(targetUrl)
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

        // Enforce viewport compliance and lock zoom/scaling
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.textZoom = 100

        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.isHorizontalScrollBarEnabled = false

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

        // Native download listener with accurate filename extraction, blob/data support, and app icon notification
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            val fileName = resolveDownloadFileName(url, contentDisposition, mimetype)
            if (url.startsWith("blob:")) {
                val safeUrl = url.replace("'", "\\'")
                val safeName = fileName.replace("'", "\\'")
                val safeMime = (mimetype ?: "application/octet-stream").replace("'", "\\'")
                val script = """
                    (function() {
                        var xhr = new XMLHttpRequest();
                        xhr.open('GET', '$safeUrl', true);
                        xhr.responseType = 'blob';
                        xhr.onload = function() {
                            var reader = new FileReader();
                            reader.onloadend = function() {
                                if (window.AndroidBridge && typeof window.AndroidBridge.saveBase64File === 'function') {
                                    window.AndroidBridge.saveBase64File(reader.result, '$safeName', '$safeMime');
                                }
                            };
                            reader.readAsDataURL(xhr.response);
                        };
                        xhr.send();
                    })();
                """.trimIndent()
                evaluateJs(script)
            } else if (url.startsWith("data:")) {
                vn.alphadaniel.duydevstudio.download.DownloadHelper.saveBase64(
                    this,
                    url,
                    fileName,
                    mimetype ?: "application/octet-stream"
                )
            } else {
                vn.alphadaniel.duydevstudio.download.DownloadHelper.download(
                    this,
                    url,
                    fileName,
                    mimetype ?: "application/octet-stream",
                    userAgent
                )
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

            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customView != null) {
                    onHideCustomView()
                    return
                }
                customView = view
                customViewCallback = callback
                customViewContainer.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                customViewContainer.visibility = View.VISIBLE
                swipeRefreshLayout.visibility = View.GONE
            }

            override fun onHideCustomView() {
                if (customView == null) return
                customViewContainer.removeView(customView)
                customView = null
                customViewContainer.visibility = View.GONE
                swipeRefreshLayout.visibility = View.VISIBLE
                customViewCallback?.onCustomViewHidden()
                customViewCallback = null
            }

            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val isMulti = fileChooserParams?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                    if (isMulti) {
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }
                    val acceptTypes = fileChooserParams?.acceptTypes?.filter { it.isNotBlank() }
                    if (!acceptTypes.isNullOrEmpty()) {
                        if (acceptTypes.size == 1) {
                            type = acceptTypes[0]
                        } else {
                            putExtra(Intent.EXTRA_MIME_TYPES, acceptTypes.toTypedArray())
                        }
                    }
                }
                try {
                    fileChooserLauncher.launch(intent)
                } catch (_: Exception) {
                    try {
                        val fallbackIntent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                            type = "*/*"
                            addCategory(Intent.CATEGORY_OPENABLE)
                        }
                        fileChooserLauncher.launch(fallbackIntent)
                    } catch (_: Exception) {
                        this@MainActivity.filePathCallback = null
                        return false
                    }
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

                // Allow internal app navigation across all 4 highway endpoints
                if (host == "duydevstudio.alphadaniel.io.vn" ||
                    host == "192.168.2.171" ||
                    host == "100.90.62.15" ||
                    host == "10.7.0.1" ||
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

                // Notify web application if pending shared payload is ready to be consumed
                if (AndroidBridge.sharedPayloadJson != null) {
                    evaluateJs("if (typeof window !== 'undefined') { window.dispatchEvent(new CustomEvent('ds:native-share-arrived')); }")
                }
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
                if (customView != null) {
                    webView.webChromeClient?.onHideCustomView()
                    return
                }
                if (offlineContainer.visibility == View.VISIBLE) {
                    finish()
                    return
                }
                webView.evaluateJavascript("""
                    (function() {
                        if (document.getElementById('fileViewerCoreModal')) {
                            if (window.closeFileViewer) window.closeFileViewer();
                            else window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
                            return 'true';
                        }
                        if (document.getElementById('shareTargetPanel')) {
                            var btn = document.getElementById('btnCloseShareModal') || document.querySelector('#shareTargetPanel button');
                            if (btn) btn.click();
                            else { var p = document.getElementById('shareTargetPanel'); if (p) p.remove(); }
                            return 'true';
                        }
                        var modalBackdrop = document.querySelector('.modal-backdrop, [data-modal-open="true"]');
                        if (modalBackdrop) {
                            window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
                            return 'true';
                        }
                        if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '#dashboard') {
                            window.location.hash = '';
                            return 'true';
                        }
                        return 'false';
                    })()
                """.trimIndent()) { result ->
                    val handled = result?.replace("\"", "") == "true"
                    if (!handled) {
                        if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            val now = System.currentTimeMillis()
                            if (now - lastBackPressTime < 2000L) {
                                finish()
                            } else {
                                lastBackPressTime = now
                                Toast.makeText(this@MainActivity, "Nhấn quay lại lần nữa để thoát", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                }
            }
        })
    }

    /**
     * Dynamically update system status bar and navigation bar colors and icon brightness.
     */
    fun updateSystemTheme(isDark: Boolean) {
        val color = if (isDark) Color.parseColor("#09090B") else Color.parseColor("#F4F4F6")
        window.statusBarColor = color
        window.navigationBarColor = color
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.isAppearanceLightStatusBars = !isDark
        controller.isAppearanceLightNavigationBars = !isDark
    }

    /**
     * Toggle swipe-to-refresh to prevent accidental reloads during interactive gestures.
     */
    fun setSwipeRefreshEnabled(enabled: Boolean) {
        swipeRefreshLayout.isEnabled = enabled
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

            for (u in uris) {
                try {
                    contentResolver.takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                } catch (_: Exception) {}
                val m = getUriMetadata(u)
                vn.alphadaniel.duydevstudio.upload.NativeFileRegistry.register(m.first, m.second, u)
            }

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
                    if (sizeIndex != -1 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
                }
            }
        } catch (_: Exception) {}
        if (size <= 0L) {
            try {
                contentResolver.openAssetFileDescriptor(uri, "r")?.use { afd ->
                    val len = afd.length
                    if (len > 0L) size = len
                }
            } catch (_: Exception) {}
        }
        return Pair(name, size)
    }

    /**
     * Helper to safely execute JavaScript on WebView from any thread.
     */
    fun evaluateJs(script: String) {
        runOnUiThread {
            webView.evaluateJavascript(script, null)
        }
    }

    /**
     * Resolves the true intended file name from download URL parameters,
     * Content-Disposition headers, and URL path segments.
     */
    private fun resolveDownloadFileName(url: String, contentDisposition: String?, mimeType: String?): String {
        try {
            val uri = Uri.parse(url)

            // 1. Check query parameter filename or fileName
            val queryName = uri.getQueryParameter("filename") ?: uri.getQueryParameter("fileName")
            if (!queryName.isNullOrBlank()) {
                return java.net.URLDecoder.decode(queryName, "UTF-8")
            }

            // 2. Check Content-Disposition header if present
            if (!contentDisposition.isNullOrBlank()) {
                val matchStar = Regex("filename\\*=(?:UTF-8''|utf-8'')([^;]+)", RegexOption.IGNORE_CASE).find(contentDisposition)
                if (matchStar != null) {
                    return java.net.URLDecoder.decode(matchStar.groupValues[1].trim('"', '\''), "UTF-8")
                }
                val matchNormal = Regex("filename=\"?([^\";]+)\"?", RegexOption.IGNORE_CASE).find(contentDisposition)
                if (matchNormal != null) {
                    return matchNormal.groupValues[1].trim()
                }
            }

            // 3. Check trailing path segment if it contains an extension and is not an internal ID
            val lastSegment = uri.lastPathSegment
            if (!lastSegment.isNullOrBlank() && lastSegment.contains(".") && !lastSegment.startsWith("cuid_") && !lastSegment.startsWith("fil_")) {
                return java.net.URLDecoder.decode(lastSegment, "UTF-8")
            }
        } catch (_: Exception) {}

        return android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType)
    }
}
