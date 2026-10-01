package vn.alphadaniel.duydevstudio.upload

import android.net.Uri
import java.util.concurrent.ConcurrentHashMap

/**
 * Thread-safe registry mapping "${fileName}_${fileSize}" to persistable Content URI.
 * Populated when user selects files via onShowFileChooser or ShareReceiverActivity.
 */
object NativeFileRegistry {
    private val registry = ConcurrentHashMap<String, Uri>()

    private fun buildKey(name: String, size: Long): String = "${name}_$size"

    fun register(name: String, size: Long, uri: Uri) {
        registry[buildKey(name, size)] = uri
    }

    fun get(name: String, size: Long): Uri? {
        return registry[buildKey(name, size)]
    }

    fun has(name: String, size: Long): Boolean {
        return registry.containsKey(buildKey(name, size))
    }

    fun remove(name: String, size: Long): Uri? {
        return registry.remove(buildKey(name, size))
    }

    fun clear() {
        registry.clear()
    }
}
