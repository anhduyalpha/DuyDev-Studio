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
        val exact = registry[buildKey(name, size)]
        if (exact != null) return exact

        // Fallback: search by name if size was 0 or registry entry had size 0
        val zeroKey = buildKey(name, 0L)
        val zeroMatch = registry[zeroKey]
        if (zeroMatch != null) return zeroMatch

        // Fallback: if only one file with this name exists in registry
        val matches = registry.entries.filter { it.key.startsWith("${name}_") }
        if (matches.size == 1) return matches[0].value

        return null
    }

    fun has(name: String, size: Long): Boolean {
        return get(name, size) != null
    }

    fun remove(name: String, size: Long): Uri? {
        val exact = registry.remove(buildKey(name, size))
        if (exact != null) return exact

        val zeroKey = buildKey(name, 0L)
        val zeroMatch = registry.remove(zeroKey)
        if (zeroMatch != null) return zeroMatch

        val matchKey = registry.keys().toList().firstOrNull { it.startsWith("${name}_") }
        if (matchKey != null) {
            return registry.remove(matchKey)
        }
        return null
    }

    fun clear() {
        registry.clear()
    }
}
