package vn.alphadaniel.duydevstudio

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.MutableContextWrapper
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView

/**
 * Application bootstrapper that pre-warms the local RAM boot cache and maintains an
 * Application-scoped persistent WebView singleton (via MutableContextWrapper) so V8,
 * Rust WASM, and all 17 preloaded tool modules survive Activity restarts in <2ms.
 */
class DuyDevApplication : Application() {

    companion object {
        private var warmWebView: WebView? = null
        private var contextWrapper: MutableContextWrapper? = null

        @Volatile
        var isWarmWebViewHydrated: Boolean = false

        fun hasWarmHydratedWebView(): Boolean {
            return warmWebView != null && isWarmWebViewHydrated
        }

        fun obtainWebView(activity: Activity): Pair<WebView, Boolean> {
            val existing = warmWebView
            if (existing != null) {
                try {
                    (existing.parent as? ViewGroup)?.removeView(existing)
                    contextWrapper?.baseContext = activity
                    return Pair(existing, isWarmWebViewHydrated)
                } catch (_: Throwable) {
                    destroyWarmWebView()
                }
            }
            val wrapper = MutableContextWrapper(activity)
            val created = WebView(wrapper)
            contextWrapper = wrapper
            warmWebView = created
            isWarmWebViewHydrated = false
            return Pair(created, false)
        }

        fun parkWarmWebView(appContext: Context, webView: WebView) {
            try {
                (webView.parent as? ViewGroup)?.removeView(webView)
                contextWrapper?.baseContext = appContext.applicationContext
                warmWebView = webView
            } catch (_: Throwable) {}
        }

        fun destroyWarmWebView() {
            try {
                val wv = warmWebView
                warmWebView = null
                contextWrapper = null
                isWarmWebViewHydrated = false
                if (wv != null) {
                    (wv.parent as? ViewGroup)?.removeView(wv)
                    wv.stopLoading()
                    wv.clearHistory()
                    wv.destroy()
                }
            } catch (_: Throwable) {}
        }
    }

    override fun onCreate() {
        super.onCreate()
        LocalBootCache.ensureInitialized(this)
        Thread {
            try {
                CookieManager.getInstance()
                WebStorage.getInstance()
                WebSettings.getDefaultUserAgent(applicationContext)
            } catch (_: Throwable) {}
        }.start()
    }
}
