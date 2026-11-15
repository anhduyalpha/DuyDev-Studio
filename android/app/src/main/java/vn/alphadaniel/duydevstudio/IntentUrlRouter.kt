package vn.alphadaniel.duydevstudio

import java.net.URI
import java.net.URLEncoder

/**
 * Pure Kotlin intent URL extractor and tool route resolver.
 * Parses incoming share intents and maps academic, social, and document links
 * to specific DuyDev Studio client-side SPA routes.
 */
object IntentUrlRouter {

    private val URL_WITH_SCHEME_REGEX = Regex("""(?i)\bhttps?://[^\s"'<>()]+""")
    private val DOMAIN_PREFIX_REGEX = Regex(
        """(?i)\b(?:academia\.edu|researchgate\.net|scribd\.com|tiktok\.com|douyin\.com|facebook\.com|fb\.watch|fb\.com|instagram\.com|instagr\.am|youtube\.com|youtu\.be|spotify\.com|spotify\.link|slideshare\.net)(?:/[^\s"'<>()]*)?"""
    )

    /**
     * Extracts and normalizes the target URL from raw text.
     * Handles surrounding whitespace, text snippets, and missing http(s) schemes.
     */
    fun extractUrl(text: String?): String? {
        if (text.isNullOrBlank()) return null
        val trimmed = text.trim()

        // 1. Try matching explicit HTTP / HTTPS URL
        val schemeMatch = URL_WITH_SCHEME_REGEX.find(trimmed)
        if (schemeMatch != null) {
            return cleanTrailingPunctuation(schemeMatch.value)
        }

        // 2. Try matching supported domain prefix without scheme
        val domainMatch = DOMAIN_PREFIX_REGEX.find(trimmed)
        if (domainMatch != null) {
            val raw = cleanTrailingPunctuation(domainMatch.value)
            return "https://$raw"
        }

        return null
    }

    /**
     * Resolves the canonical tool identifier (e.g. "academia", "researchgate", "scribd")
     * from input text or URL. Returns null if host does not match any registered service.
     */
    fun resolveToolId(text: String?): String? {
        val url = extractUrl(text) ?: return null
        val host = extractHost(url) ?: return null

        return when {
            isMatchingHost(host, "academia.edu") -> "academia"
            isMatchingHost(host, "researchgate.net") -> "researchgate"
            isMatchingHost(host, "scribd.com") -> "scribd"
            isMatchingHost(host, "tiktok.com") || isMatchingHost(host, "douyin.com") -> "tiktok"
            isMatchingHost(host, "facebook.com") || isMatchingHost(host, "fb.watch") || isMatchingHost(host, "fb.com") -> "facebook"
            isMatchingHost(host, "instagram.com") || isMatchingHost(host, "instagr.am") -> "instagram"
            isMatchingHost(host, "youtube.com") || isMatchingHost(host, "youtu.be") -> "youtube"
            isMatchingHost(host, "spotify.com") || isMatchingHost(host, "spotify.link") -> "spotify"
            isMatchingHost(host, "slideshare.net") -> "slideshare"
            else -> null
        }
    }

    /**
     * Resolves client-side SPA tool route (e.g. "#tool/academia?url=...") from incoming text.
     * Returns null if no recognized service URL is found.
     */
    fun resolveToolRoute(text: String?): String? {
        if (text.isNullOrBlank()) return null
        val toolId = resolveToolId(text) ?: return null
        val url = extractUrl(text) ?: return null
        val encodedUrl = URLEncoder.encode(url, "UTF-8")
        return "#tool/$toolId?url=$encodedUrl"
    }

    private fun extractHost(url: String): String? {
        return try {
            val normalized = if (!url.startsWith("http://", ignoreCase = true) && !url.startsWith("https://", ignoreCase = true)) {
                "https://$url"
            } else {
                url
            }
            val uri = URI(normalized)
            uri.host?.lowercase()
        } catch (_: Exception) {
            val withoutProto = url.substringAfter("://")
            val hostPart = withoutProto.substringBefore("/").substringBefore("?").substringBefore(":")
            hostPart.trim().lowercase().takeIf { it.isNotBlank() }
        }
    }

    private fun isMatchingHost(actualHost: String, expectedDomain: String): Boolean {
        return actualHost.equals(expectedDomain, ignoreCase = true) ||
            actualHost.endsWith(".$expectedDomain", ignoreCase = true)
    }

    private fun cleanTrailingPunctuation(raw: String): String {
        var result = raw
        while (result.isNotEmpty() && (result.endsWith(".") || result.endsWith(",") || result.endsWith(";") || result.endsWith("!"))) {
            result = result.dropLast(1)
        }
        return result
    }
}
