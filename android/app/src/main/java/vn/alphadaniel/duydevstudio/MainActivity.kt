package vn.alphadaniel.duydevstudio

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.provider.Settings
import android.util.Base64
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
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
import androidx.core.app.NotificationManagerCompat
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

        const val PRIMARY_HOST = "https://studio.duydev.cloud"
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
    private lateinit var splashOverlay: View
    private lateinit var btnRetry: Button
    private lateinit var btnOpenTailscale: Button
    private lateinit var btnOpenLan: Button
    private lateinit var btnOpenCloudflare: Button

    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var lastBackPressTime = 0L

    private val lifecycleHandler = android.os.Handler(android.os.Looper.getMainLooper())
    @Volatile private var isAppPaused = false
    @Volatile private var isWebViewFrozen = false
    @Volatile private var activeTaskCount = 0

    private val deepFreezeRunnable = Runnable {
        if (isAppPaused && !isWebViewFrozen) {
            executeDeepFreeze()
        }
    }

    private val taskSafetyTimeoutRunnable = Runnable {
        if (isAppPaused && !isWebViewFrozen) {
            executeDeepFreeze()
        }
    }

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingPermissionRequest: PermissionRequest? = null
    private val sharedUrisList = mutableListOf<Uri>()
    private var pendingAutoStartScript: String? = null

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

    fun hasNotificationPermission(): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else {
            NotificationManagerCompat.from(this).areNotificationsEnabled()
        }
    }

    fun openNotificationSettings() {
        try {
            val intent = Intent().apply {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    action = Settings.ACTION_APP_NOTIFICATION_SETTINGS
                    putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                } else {
                    action = Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                    data = Uri.fromParts("package", packageName, null)
                }
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        } catch (_: Exception) {}
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
        unlockHighRefreshRate()
        setupBackHandler()
        pruneRedundantCache()
        requestNotificationPermission()

        handleIntent(intent)

        if (savedInstanceState == null) {
            splashOverlay.visibility = View.VISIBLE
            val baseHost = getActiveHost()
            val targetRoute = intent?.getStringExtra(EXTRA_TARGET_ROUTE)
            val launchUrl = if (!targetRoute.isNullOrBlank()) {
                val cleanRoute = if (targetRoute.startsWith("#") || targetRoute.startsWith("/")) targetRoute else "#$targetRoute"
                "$baseHost$cleanRoute"
            } else {
                baseHost
            }
            webView.loadUrl(launchUrl)
        } else {
            splashOverlay.visibility = View.GONE
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
        ensureWebViewActive()
        handleIntent(intent)

        val targetRoute = intent?.getStringExtra(EXTRA_TARGET_ROUTE)
        if (!targetRoute.isNullOrBlank()) {
            val cleanRoute = if (targetRoute.startsWith("#") || targetRoute.startsWith("/")) targetRoute else "#$targetRoute"
            val jsRoute = cleanRoute.replace("'", "\\'")
            val currentUrl = webView.url ?: ""
            val isAppLoaded = currentUrl.isNotBlank() && currentUrl != "about:blank" && (
                currentUrl.startsWith(PRIMARY_HOST) ||
                currentUrl.startsWith(LAN_HOST) ||
                currentUrl.startsWith(TAILSCALE_HOST) ||
                currentUrl.startsWith(WIREGUARD_HOST) ||
                currentUrl.contains("192.168.") ||
                currentUrl.contains("100.90.") ||
                currentUrl.contains("10.7.") ||
                currentUrl.contains("duydevstudio") ||
                currentUrl.contains("studio.duydev.cloud") ||
                currentUrl.startsWith("http://localhost") ||
                currentUrl.startsWith("http://10.0.2.2")
            )

            if (isAppLoaded) {
                // Instantly navigate via hash in 0ms without full-page teardown or black flash
                webView.evaluateJavascript("window.location.hash = '$jsRoute';", null)
            } else {
                val activeHost = getActiveHost()
                val destUrl = "$activeHost$cleanRoute"
                webView.loadUrl(destUrl)
            }
        }
    }

    fun ensureWebViewActive() {
        lifecycleHandler.removeCallbacks(deepFreezeRunnable)
        lifecycleHandler.removeCallbacks(taskSafetyTimeoutRunnable)
        if (::webView.isInitialized && isWebViewFrozen) {
            try {
                webView.resumeTimers()
                webView.onResume()
            } catch (_: Exception) {}
            isWebViewFrozen = false
        }
    }

    fun executeDeepFreeze() {
        if (!::webView.isInitialized || isWebViewFrozen) return
        isWebViewFrozen = true
        lifecycleHandler.removeCallbacks(deepFreezeRunnable)
        lifecycleHandler.removeCallbacks(taskSafetyTimeoutRunnable)
        try {
            webView.onPause()
            webView.pauseTimers()
            CookieManager.getInstance().flush()
        } catch (_: Exception) {}
    }

    fun onActiveTaskCountChanged(count: Int) {
        val safeCount = if (count < 0) 0 else count
        activeTaskCount = safeCount
        if (isAppPaused) {
            if (safeCount == 0) {
                executeDeepFreeze()
            } else if (isWebViewFrozen) {
                try {
                    webView.resumeTimers()
                    webView.onResume()
                    isWebViewFrozen = false
                    lifecycleHandler.removeCallbacks(deepFreezeRunnable)
                    lifecycleHandler.postDelayed(taskSafetyTimeoutRunnable, 75000L)
                } catch (_: Exception) {}
            }
        }
    }

    override fun onPause() {
        super.onPause()
        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        isAppPaused = true

        if (::webView.isInitialized) {
            evaluateJs("if (typeof window !== 'undefined') { window.dispatchEvent(new CustomEvent('ds:native-app-paused')); }")
            try {
                CookieManager.getInstance().flush()
            } catch (_: Exception) {}
        }

        lifecycleHandler.removeCallbacks(deepFreezeRunnable)
        lifecycleHandler.removeCallbacks(taskSafetyTimeoutRunnable)

        if (activeTaskCount > 0) {
            // Background tasks running (e.g. download or conversion): allow background execution with 75s safety cap
            lifecycleHandler.postDelayed(taskSafetyTimeoutRunnable, 75000L)
        } else {
            // Grant a 5,000ms grace window for quick app switching (e.g. copying URL from Chrome/Telegram)
            lifecycleHandler.postDelayed(deepFreezeRunnable, 5000L)
        }
    }

    override fun onStop() {
        super.onStop()
        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (activeTaskCount == 0 && !isWebViewFrozen) {
            executeDeepFreeze()
        }
    }

    override fun onResume() {
        super.onResume()
        isAppPaused = false
        ensureWebViewActive()
        unlockHighRefreshRate()
        currentInstance = this
        evaluateJs("if (typeof window !== 'undefined') { window.dispatchEvent(new CustomEvent('ds:native-app-resumed')); }")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        lifecycleHandler.removeCallbacks(deepFreezeRunnable)
        lifecycleHandler.removeCallbacks(taskSafetyTimeoutRunnable)
        if (currentInstance == this) {
            currentInstance = null
        }
        if (::webView.isInitialized) {
            try {
                (webView.parent as? ViewGroup)?.removeView(webView)
                webView.stopLoading()
                webView.clearHistory()
                webView.destroy()
            } catch (_: Exception) {}
        }
        super.onDestroy()
    }

    private fun initViews() {
        webView = findViewById(R.id.webView)
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout)
        progressBar = findViewById(R.id.progressBar)
        offlineContainer = findViewById(R.id.offlineContainer)
        customViewContainer = findViewById(R.id.customViewContainer)
        splashOverlay = findViewById(R.id.splashOverlay)
        btnRetry = findViewById(R.id.btnRetry)
        btnOpenTailscale = findViewById(R.id.btnOpenTailscale)
        btnOpenLan = findViewById(R.id.btnOpenLan)
        btnOpenCloudflare = findViewById(R.id.btnOpenCloudflare)

        swipeRefreshLayout.setColorSchemeColors(Color.parseColor("#6366F1"))
        swipeRefreshLayout.setProgressBackgroundColorSchemeColor(Color.parseColor("#18181B"))
        // Disable swipe-to-refresh pull gesture completely to eliminate accidental page reloads
        swipeRefreshLayout.isEnabled = false
        swipeRefreshLayout.setOnChildScrollUpCallback { _, _ -> true }
        swipeRefreshLayout.setOnRefreshListener {
            swipeRefreshLayout.isRefreshing = false
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

    private fun hideSplashOverlay() {
        if (!::splashOverlay.isInitialized || splashOverlay.visibility == View.GONE) return
        splashOverlay.animate()
            .alpha(0f)
            .setDuration(160L)
            .withEndAction {
                splashOverlay.visibility = View.GONE
                splashOverlay.alpha = 1f
            }
            .start()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
        val isConnected = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            val net = cm?.activeNetwork
            val caps = cm?.getNetworkCapabilities(net)
            caps != null && caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION")
            cm?.activeNetworkInfo?.isConnected == true
        }
        settings.cacheMode = if (isConnected) WebSettings.LOAD_DEFAULT else WebSettings.LOAD_CACHE_ELSE_NETWORK
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.mediaPlaybackRequiresUserGesture = false
        settings.safeBrowsingEnabled = false
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
        // Default LAYER_TYPE_NONE enables Chromium multi-threaded tiled GPU compositor without offscreen FBO thrashing
        webView.setLayerType(View.LAYER_TYPE_NONE, null)
        webView.setBackgroundColor(Color.parseColor("#09090B"))

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
            val fullUrl = if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
                url
            } else {
                val currentBase = try {
                    val u = Uri.parse(webView.url ?: "")
                    if (!u.scheme.isNullOrBlank() && !u.authority.isNullOrBlank()) {
                        "${u.scheme}://${u.authority}"
                    } else PRIMARY_HOST
                } catch (_: Exception) { PRIMARY_HOST }
                val path = if (url.startsWith('/')) url else "/$url"
                "${currentBase.trimEnd('/')}$path"
            }

            if (fullUrl.startsWith("blob:")) {
                val safeUrl = fullUrl.replace("'", "\\'")
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
            } else if (fullUrl.startsWith("data:")) {
                vn.alphadaniel.duydevstudio.download.DownloadHelper.saveBase64(
                    this,
                    fullUrl,
                    fileName,
                    mimetype ?: "application/octet-stream"
                )
            } else {
                vn.alphadaniel.duydevstudio.download.DownloadHelper.download(
                    this,
                    fullUrl,
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
                val mimeTypes = fileChooserParams?.acceptTypes
                    ?.flatMap { it.split(",") }
                    ?.map { it.trim() }
                    ?.filter { it.isNotBlank() }
                    ?.map { rawType ->
                        if (rawType.contains("/")) {
                            rawType
                        } else {
                            val cleanExt = rawType.removePrefix(".")
                            android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(cleanExt) ?: rawType
                        }
                    }
                    ?.filter { it.contains("/") }
                    ?.distinct()

                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                    if (isMulti) {
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }
                    if (!mimeTypes.isNullOrEmpty()) {
                        if (mimeTypes.size == 1) {
                            type = mimeTypes[0]
                        } else {
                            type = "*/*"
                            putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
                        }
                    } else {
                        type = "*/*"
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
                        if (isMulti) {
                            fallbackIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                        }
                        if (!mimeTypes.isNullOrEmpty()) {
                            if (mimeTypes.size == 1) {
                                fallbackIntent.type = mimeTypes[0]
                            } else {
                                fallbackIntent.type = "*/*"
                                fallbackIntent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
                            }
                        }
                        fileChooserLauncher.launch(fallbackIntent)
                    } catch (_: Exception) {
                        this@MainActivity.filePathCallback?.onReceiveValue(null)
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
                if (host == "studio.duydev.cloud" ||
                    host == "duydevstudio.alphadaniel.io.vn" ||
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

            override fun onPageCommitVisible(view: WebView?, url: String?) {
                super.onPageCommitVisible(view, url)
                hideSplashOverlay()
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                showOffline(false)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                hideSplashOverlay()
                swipeRefreshLayout.isRefreshing = false
                progressBar.visibility = View.GONE

                // Notify web application if pending shared payload is ready to be consumed
                if (AndroidBridge.sharedPayloadJson != null) {
                    evaluateJs("if (typeof window !== 'undefined') { window.dispatchEvent(new CustomEvent('ds:native-share-arrived')); }")
                }

                pendingAutoStartScript?.let { script ->
                    evaluateJs(script)
                    pendingAutoStartScript = null
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

            override fun onRenderProcessGone(
                view: WebView?,
                detail: RenderProcessGoneDetail?
            ): Boolean {
                try {
                    (view?.parent as? ViewGroup)?.removeView(view)
                    view?.destroy()
                } catch (_: Exception) {}
                runOnUiThread {
                    recreate()
                }
                return true
            }
        }
    }

    /**
     * Enables adaptive high refresh rate (90Hz / 120Hz / 144Hz) for the WebView window.
     * Uses preferredDisplayModeId = 0 (system adaptive mode) rather than locking to a fixed frequency,
     * allowing Android SurfaceFlinger & LTPO display hardware to downscale on static scenes (saving battery)
     * and ramp up dynamically during active scrolling and touch gestures.
     */
    private fun unlockHighRefreshRate() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            try {
                val params = window.attributes
                // Set preferredDisplayModeId = 0 to allow native adaptive refresh rate (LTPO power saving)
                params.preferredDisplayModeId = 0
                window.attributes = params
            } catch (_: Exception) {}
        }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            try {
                // Eliminate display pipeline buffering for instant 120Hz touch response
                window.setPreferMinimalPostProcessing(true)
            } catch (_: Exception) {}
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
                        if (window.__ddFileViewerOpen === true || document.getElementById('fileViewerCoreModal')) {
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
        if (!enabled) {
            swipeRefreshLayout.isRefreshing = false
        }
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

        val text = (intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
            ?: intent.getStringExtra(Intent.EXTRA_TEXT)
            ?: "").trim()
        val subject = (intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT)?.toString()
            ?: intent.getStringExtra(Intent.EXTRA_SUBJECT)
            ?: "").trim()

        val explicitUrl = intent.getStringExtra("explicitUrl")
        val detectedUrl = when {
            !explicitUrl.isNullOrBlank() -> explicitUrl
            intent.dataString?.startsWith("http://") == true || intent.dataString?.startsWith("https://") == true -> intent.dataString
            text.startsWith("http://") || text.startsWith("https://") -> text
            else -> Regex("""https?://[^\s"'<>()]+""").find(text)?.value
        }

        val intentType = intent.type?.lowercase(Locale.ROOT) ?: ""
        val isExplicitTextShare = intentType.startsWith("text/") || intentType.isBlank()
        val hasStreamExtra = intent.hasExtra(Intent.EXTRA_STREAM)
        val isSpecializedLink = !detectedUrl.isNullOrBlank() && (
            detectedUrl.contains("studocu.", ignoreCase = true) ||
            detectedUrl.contains("scribd.com", ignoreCase = true) ||
            detectedUrl.contains("tiktok.com", ignoreCase = true) ||
            detectedUrl.contains("douyin.com", ignoreCase = true) ||
            detectedUrl.contains("youtube.com", ignoreCase = true) ||
            detectedUrl.contains("youtu.be", ignoreCase = true) ||
            detectedUrl.contains("facebook.com", ignoreCase = true) ||
            detectedUrl.contains("fb.watch", ignoreCase = true) ||
            detectedUrl.contains("fb.com", ignoreCase = true) ||
            detectedUrl.contains("instagram.com", ignoreCase = true) ||
            detectedUrl.contains("instagr.am", ignoreCase = true) ||
            detectedUrl.contains("spotify.com", ignoreCase = true) ||
            detectedUrl.contains("spotify.link", ignoreCase = true)
        )
        // In Android 10+, browsers (like Chrome) share links as text/plain and populate ClipData with a tiny
        // preview thumbnail image for the system ShareSheet preview header. If this is a web link share,
        // do not treat the preview thumbnail in ClipData as an attached file!
        val isWebLinkShare = !detectedUrl.isNullOrBlank() && (isSpecializedLink || isExplicitTextShare || !hasStreamExtra)

        val uris = mutableListOf<Uri>()
        if (intent.action == Intent.ACTION_SEND) {
            if (!isWebLinkShare) {
                val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                    ?: intent.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.uri
                    ?: intent.data
                if (uri != null) uris.add(uri)
            }
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

                    // Embed Base64 ONLY for tiny lightweight previews (<= 128 KB) to guarantee 0ms Main-Thread responsiveness
                    if (meta.second in 1..131_072) {
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

            val autoStartScript = if (uris.isEmpty() && !detectedUrl.isNullOrBlank()) {
                val cleanUrl = detectedUrl.replace("\\", "\\\\").replace("'", "\\'")
                val toolId = when {
                    targetRoute?.contains("facebook") == true || cleanUrl.contains("facebook.com", ignoreCase = true) || cleanUrl.contains("fb.watch", ignoreCase = true) || cleanUrl.contains("fb.com", ignoreCase = true) -> "facebook"
                    targetRoute?.contains("instagram") == true || cleanUrl.contains("instagram.com", ignoreCase = true) || cleanUrl.contains("instagr.am", ignoreCase = true) -> "instagram"
                    targetRoute?.contains("spotify") == true || cleanUrl.contains("spotify.com", ignoreCase = true) || cleanUrl.contains("spotify.link", ignoreCase = true) -> "spotify"
                    targetRoute?.contains("youtube") == true || cleanUrl.contains("youtube.com", ignoreCase = true) || cleanUrl.contains("youtu.be", ignoreCase = true) -> "youtube"
                    targetRoute?.contains("tiktok") == true || cleanUrl.contains("tiktok.com", ignoreCase = true) || cleanUrl.contains("douyin.com", ignoreCase = true) -> "tiktok"
                    targetRoute?.contains("scribd") == true || cleanUrl.contains("scribd.com", ignoreCase = true) -> "scribd"
                    targetRoute?.contains("studocu") == true || cleanUrl.contains("studocu.", ignoreCase = true) -> "studocu"
                    targetRoute?.contains("qr") == true -> "qr"
                    targetRoute?.contains("hash") == true -> "hash"
                    else -> "share"
                }
                """
                    try {
                        sessionStorage.setItem('dd_pending_autostart_url', JSON.stringify({ toolId: '$toolId', url: '$cleanUrl', ts: Date.now() }));
                    } catch (_) {}
                """.trimIndent()
            } else ""

            if (autoStartScript.isNotBlank()) {
                pendingAutoStartScript = autoStartScript
            }

            // Notify web application if already loaded
            webView.evaluateJavascript("""
                if (typeof window !== 'undefined') {
                    $autoStartScript
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
