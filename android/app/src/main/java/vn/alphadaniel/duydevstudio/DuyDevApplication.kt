package vn.alphadaniel.duydevstudio

import android.app.Application
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebStorage

/**
 * Application bootstrapper that pre-warms the Chromium WebView provider and local boot cache
 * as early as possible on cold process start.
 */
class DuyDevApplication : Application() {
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
