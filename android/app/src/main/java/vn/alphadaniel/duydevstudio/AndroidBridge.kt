package vn.alphadaniel.duydevstudio

import android.webkit.JavascriptInterface

/**
 * Two-way JavaScript interface bridge between Android native layer and WebView.
 */
class AndroidBridge(
    private val activity: MainActivity
) {
    companion object {
        @Volatile
        var sharedPayloadJson: String? = null
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
     * Return app version.
     */
    @JavascriptInterface
    fun getAppVersion(): String {
        return "1.0.0"
    }

    /**
     * Return configured server base URL.
     */
    @JavascriptInterface
    fun getBaseUrl(): String {
        return MainActivity.PRIMARY_HOST
    }
}
