package vn.alphadaniel.duydevstudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.net.URLEncoder

class IntentRoutingTest {

    private fun encode(url: String): String = URLEncoder.encode(url, "UTF-8")

    @Test
    fun testAcademiaEduRouting() {
        val input = "https://www.academia.edu/12345/Paper"
        val expected = "#tool/academia?url=" + encode(input)
        assertEquals(expected, IntentUrlRouter.resolveToolRoute(input))
    }

    @Test
    fun testAcademiaEduWithoutScheme() {
        val input = "academia.edu/12345/Paper"
        val expected = "#tool/academia?url=" + encode("https://academia.edu/12345/Paper")
        assertEquals(expected, IntentUrlRouter.resolveToolRoute(input))
    }

    @Test
    fun testResearchGateRouting() {
        val input = "https://www.researchgate.net/publication/999"
        val expected = "#tool/researchgate?url=" + encode(input)
        assertEquals(expected, IntentUrlRouter.resolveToolRoute(input))
    }

    @Test
    fun testResearchGateWithoutScheme() {
        val input = "researchgate.net/publication/999"
        val expected = "#tool/researchgate?url=" + encode("https://researchgate.net/publication/999")
        assertEquals(expected, IntentUrlRouter.resolveToolRoute(input))
    }

    @Test
    fun testExistingToolMappings() {
        // Scribd
        assertEquals(
            "#tool/scribd?url=" + encode("https://www.scribd.com/document/12345/MyDoc"),
            IntentUrlRouter.resolveToolRoute("https://www.scribd.com/document/12345/MyDoc")
        )
        // TikTok
        assertEquals(
            "#tool/tiktok?url=" + encode("https://www.tiktok.com/@user/video/12345"),
            IntentUrlRouter.resolveToolRoute("https://www.tiktok.com/@user/video/12345")
        )
        // Facebook
        assertEquals(
            "#tool/facebook?url=" + encode("https://www.facebook.com/watch/?v=12345"),
            IntentUrlRouter.resolveToolRoute("https://www.facebook.com/watch/?v=12345")
        )
        // Instagram
        assertEquals(
            "#tool/instagram?url=" + encode("https://www.instagram.com/p/C12345/"),
            IntentUrlRouter.resolveToolRoute("https://www.instagram.com/p/C12345/")
        )
        // YouTube
        assertEquals(
            "#tool/youtube?url=" + encode("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
            IntentUrlRouter.resolveToolRoute("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        )
        // Spotify
        assertEquals(
            "#tool/spotify?url=" + encode("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"),
            IntentUrlRouter.resolveToolRoute("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")
        )
        // SlideShare
        assertEquals(
            "#tool/slideshare?url=" + encode("https://www.slideshare.net/author/deck-123"),
            IntentUrlRouter.resolveToolRoute("https://www.slideshare.net/author/deck-123")
        )
    }

    @Test
    fun testWhitespaceAndSurroundingTextInExtraText() {
        val text = "Hey look at this document https://www.academia.edu/12345/Paper it's great!"
        val expected = "#tool/academia?url=" + encode("https://www.academia.edu/12345/Paper")
        assertEquals(expected, IntentUrlRouter.resolveToolRoute(text))
    }

    @Test
    fun testCaseInsensitivity() {
        val input = "HTTPS://WWW.ACADEMIA.EDU/12345/PAPER"
        val expected = "#tool/academia?url=" + encode("HTTPS://WWW.ACADEMIA.EDU/12345/PAPER")
        assertEquals(expected, IntentUrlRouter.resolveToolRoute(input))
    }

    @Test
    fun testQueryParamsPreserved() {
        val input = "https://www.researchgate.net/publication/999?source=share&channel=android"
        val expected = "#tool/researchgate?url=" + encode(input)
        assertEquals(expected, IntentUrlRouter.resolveToolRoute(input))
    }

    @Test
    fun testNonMatchingUrlsReturnNull() {
        assertNull(IntentUrlRouter.resolveToolRoute("https://google.com/search?q=test"))
        assertNull(IntentUrlRouter.resolveToolRoute("https://example.com/foo/bar"))
        assertNull(IntentUrlRouter.resolveToolRoute("Just some normal message without links"))
        assertNull(IntentUrlRouter.resolveToolRoute(""))
        assertNull(IntentUrlRouter.resolveToolRoute("   "))
        assertNull(IntentUrlRouter.resolveToolRoute(null))
    }

    @Test
    fun testRejectsSpoofedHostnames() {
        assertNull(IntentUrlRouter.resolveToolRoute("https://evil-academia.edu/12345/Paper"))
        assertNull(IntentUrlRouter.resolveToolRoute("https://academia.edu.evil.com/12345/Paper"))
        assertNull(IntentUrlRouter.resolveToolRoute("https://fake-researchgate.net/publication/123"))
        assertNull(IntentUrlRouter.resolveToolRoute("https://notfacebook.com/watch"))
    }
}
