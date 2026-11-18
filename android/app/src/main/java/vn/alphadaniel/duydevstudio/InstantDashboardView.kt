package vn.alphadaniel.duydevstudio

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.Editable
import android.text.TextUtils
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.util.Locale

/**
 * Tier-1 Native Instant Dashboard rendered in Frame 0 (<16ms) on Android Cold Start.
 * Eliminates the ~600-900ms Chromium cold-boot blank screen by presenting an interactive
 * native replica of the DuyDev Studio Dashboard immediately upon tapping the app icon.
 * Any tool card, search query, category filter, or bottom navigation tap made before
 * WebView finishes hydrating is captured and handed off seamlessly to the Web SPA.
 */
class InstantDashboardView(
    context: Context,
    private var isDark: Boolean,
    private val onRouteSelected: (String) -> Unit
) : FrameLayout(context) {

    data class NativeToolItem(
        val id: String,
        val title: String,
        val description: String,
        val category: String,
        val badge: String,
        val accentHex: String,
        val tier: String,
        val route: String
    )

    companion object {
        val TOOLS = listOf(
            NativeToolItem("pdf-studio", "PDF Studio", "Ghép, tách, xoay, nén, đóng dấu và đọc tài liệu PDF vector.", "pdf", "PDF", "#F59E0B", "SS", "#tool/pdf-studio"),
            NativeToolItem("quiz-generator", "Tạo Bài Tập Trắc Nghiệm", "Biên soạn đề bài và đáp án A4 chuẩn in ấn từ PDF hoặc Drive.", "pdf", "AI / A4", "#8B5CF6", "UR", "#tool/quiz-generator"),
            NativeToolItem("tiktok-downloader", "TikTok & Douyin Downloader", "Tải video, album ảnh, ảnh bìa và nhạc MP3 không logo.", "media", "NO LOGO", "#EE1D52", "EX", "#tool/tiktok-downloader"),
            NativeToolItem("instagram-downloader", "Instagram Downloader", "Tải video Reels, bài viết và Story Instagram sang MP4 Full HD.", "media", "REELS HD", "#E1306C", "LR", "#tool/instagram-downloader"),
            NativeToolItem("facebook-downloader", "Facebook Downloader", "Tải video Reel, bài viết và ảnh Facebook chất lượng gốc HD.", "media", "FB HD", "#1877F2", "UR", "#tool/facebook-downloader"),
            NativeToolItem("youtube-downloader", "YouTube Downloader", "Tải video Full HD/4K hoặc trích xuất âm thanh MP3 320kbps.", "media", "1080P / MP3", "#FF0000", "UR", "#tool/youtube-downloader"),
            NativeToolItem("spotify-downloader", "Spotify Downloader", "Tải bài hát Spotify sang MP3 320kbps kèm ảnh bìa album.", "media", "320KBPS", "#1DB954", "SS", "#tool/spotify-downloader"),
            NativeToolItem("universal-converter", "File Converter", "Chuyển đổi hình ảnh, video, âm thanh và tài liệu đa định dạng.", "convert", "65+ ĐỊNH DẠNG", "#6366F1", "SS", "#tool/universal-converter"),
            NativeToolItem("qr-multi", "QR Studio", "Tạo mã QR thanh toán VietQR Napas, Wi-Fi, liên kết và danh bạ.", "qr", "VIETQR", "#10B981", "SS", "#tool/qr-multi"),
            NativeToolItem("studocu-dl", "Studocu Downloader", "Tải giáo trình & tài liệu Studocu sang PDF rõ nét.", "system", "STUDOCU", "#6366F1", "UR", "#tool/studocu-dl"),
            NativeToolItem("scribd-archiver", "Scribd Downloader", "Tải tài liệu & slide Scribd sang file PDF rõ nét.", "system", "SCRIBD", "#EA580C", "UR", "#tool/scribd"),
            NativeToolItem("slideshare-downloader", "SlideShare Downloader", "Tải bài thuyết trình và tài liệu SlideShare sang tệp PDF HD.", "system", "SLIDES", "#0077B5", "S", "#tool/slideshare-downloader"),
            NativeToolItem("academia-downloader", "Academia Downloader", "Tải bài nghiên cứu, luận văn và giáo trình Academia.edu sang PDF.", "system", "ACADEMIA", "#4F46E5", "S", "#tool/academia-downloader"),
            NativeToolItem("researchgate-downloader", "ResearchGate Downloader", "Tải công bố khoa học, bài báo và tài liệu ResearchGate sang PDF.", "system", "DOI / PDF", "#0D9488", "S", "#tool/researchgate-downloader"),
            NativeToolItem("archive-inspect", "Soi Tệp Nén", "Duyệt cấu trúc thư mục và trích xuất không cần giải nén.", "archive", "ZIP / RAR", "#0EA5E9", "S", "#archive"),
            NativeToolItem("markdown-docs", "Văn Bản & Tài Liệu", "Chuyển đổi Markdown sang HTML, Word (.docx) và in PDF.", "convert", "MD / DOCX", "#8B5CF6", "A", "#tool/markdown-docs"),
            NativeToolItem("view-split", "ViewSplit", "So sánh hình ảnh đa khung nhìn, thanh trượt Before/After.", "advanced", "PIXEL DIFF", "#06B6D4", "A", "#tool/view-split"),
            NativeToolItem("hash-checksum", "Mã Băm & Base64", "Tính mã băm MD5, SHA-256 và mã hóa, giải mã Base64.", "advanced", "SHA-256", "#64748B", "A", "#tool/hash-checksum"),
            NativeToolItem("qr-scan", "Quét Mã QR", "Đọc nội dung mã QR từ tệp ảnh hoặc clipboard.", "qr", "QUÉT QR", "#10B981", "A", "#tool/qr-scan"),
            NativeToolItem("storage", "Bộ Nhớ Lưu Trữ", "Kho lưu trữ và truyền tải tập tin an toàn giữa các thiết bị.", "advanced", "CLOUD DRIVE", "#6366F1", "S", "#storage")
        )

        private val CATEGORIES = listOf(
            "all" to "Tất cả",
            "media" to "Tải Media",
            "pdf" to "PDF & Đề thi",
            "system" to "Học thuật",
            "convert" to "Chuyển đổi",
            "qr" to "Mã QR",
            "archive" to "Tệp nén",
            "advanced" to "Nâng cao"
        )
    }

    private var activeCategory = "all"
    private var searchQuery = ""
    private lateinit var gridContainer: LinearLayout
    private lateinit var categoryRow: LinearLayout
    private var statusBadgeView: TextView? = null

    init {
        isClickable = true
        isFocusable = true
        buildUi()
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    private fun roundedBg(fillColor: Int, strokeColor: Int = Color.TRANSPARENT, strokeWidthDp: Int = 0, radiusDp: Int = 16): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(radiusDp).toFloat()
            setColor(fillColor)
            if (strokeWidthDp > 0) {
                setStroke(dp(strokeWidthDp), strokeColor)
            }
        }
    }

    fun applyTheme(dark: Boolean) {
        if (this.isDark == dark && childCount > 0) return
        this.isDark = dark
        removeAllViews()
        buildUi()
    }

    private fun buildUi() {
        val bgPage = if (isDark) Color.parseColor("#09090B") else Color.parseColor("#F4F4F6")
        val bgHeader = if (isDark) Color.parseColor("#111115") else Color.parseColor("#FFFFFF")
        val bgCard = if (isDark) Color.parseColor("#141418") else Color.parseColor("#FFFFFF")
        val borderSubtle = if (isDark) Color.parseColor("#27272A") else Color.parseColor("#E4E4E7")
        val textPrimary = if (isDark) Color.parseColor("#F4F4F5") else Color.parseColor("#18181B")
        val textSecondary = if (isDark) Color.parseColor("#A1A1AA") else Color.parseColor("#52525B")
        val accentIndigo = Color.parseColor("#4F46E5")

        setBackgroundColor(bgPage)

        val rootLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }

        // 1. Top Header Bar
        val header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(bgHeader)
            setPadding(dp(16), dp(12), dp(16), dp(12))
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        val logoBox = TextView(context).apply {
            text = "DS"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            background = roundedBg(accentIndigo, radiusDp = 10)
            layoutParams = LinearLayout.LayoutParams(dp(36), dp(36)).apply {
                rightMargin = dp(10)
            }
        }
        header.addView(logoBox)

        val titleCol = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        val titleText = TextView(context).apply {
            text = "DuyDev Studio"
            setTextColor(textPrimary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            typeface = Typeface.DEFAULT_BOLD
        }
        val subText = TextView(context).apply {
            text = "Tổ hợp công cụ xử lý tệp & tải media"
            setTextColor(textSecondary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        }
        titleCol.addView(titleText)
        titleCol.addView(subText)
        header.addView(titleCol)

        val readyChip = TextView(context).apply {
            text = "⚡ INSTANT"
            setTextColor(Color.parseColor("#10B981"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(10), dp(5), dp(10), dp(5))
            background = roundedBg(
                if (isDark) Color.parseColor("#0D281E") else Color.parseColor("#ECFDF5"),
                Color.parseColor("#10B981"),
                1,
                999
            )
        }
        statusBadgeView = readyChip
        header.addView(readyChip)
        rootLayout.addView(header)

        // Divider
        rootLayout.addView(View(context).apply {
            setBackgroundColor(borderSubtle)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1))
        })

        // 2. Scrollable Content Area (Search + Category Filter + 2-Column Tool Cards Grid)
        val scrollView = ScrollView(context).apply {
            isVerticalScrollBarEnabled = false
            overScrollMode = OVER_SCROLL_NEVER
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }

        val contentCol = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(14), dp(14), dp(20))
            layoutParams = LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        // Search input
        val searchBox = EditText(context).apply {
            hint = "Tìm nhanh công cụ (PDF, TikTok, Instagram, QR...)"
            setHintTextColor(textSecondary)
            setTextColor(textPrimary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setSingleLine(true)
            setPadding(dp(14), dp(11), dp(14), dp(11))
            background = roundedBg(bgCard, borderSubtle, 1, 14)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(12)
            }
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                    searchQuery = s?.toString()?.trim() ?: ""
                    renderToolGrid()
                }
                override fun afterTextChanged(s: Editable?) {}
            })
        }
        contentCol.addView(searchBox)

        // Category pills horizontal scroll
        val catScroll = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            overScrollMode = OVER_SCROLL_NEVER
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(14)
            }
        }
        categoryRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        catScroll.addView(categoryRow)
        contentCol.addView(catScroll)

        // Tool Grid Container
        gridContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        contentCol.addView(gridContainer)

        scrollView.addView(contentCol)
        rootLayout.addView(scrollView)

        // 3. Bottom Navigation Bar (Matches Web SPA BottomNav 1:1)
        rootLayout.addView(View(context).apply {
            setBackgroundColor(borderSubtle)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1))
        })

        val bottomNav = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(bgHeader)
            setPadding(dp(6), dp(8), dp(6), dp(8))
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        val navItems = listOf(
            Triple("Trang chủ", "#dashboard", true),
            Triple("Lưu trữ", "#storage", false),
            Triple("PDF", "#tool/pdf-studio", false),
            Triple("File nén", "#archive", false),
            Triple("Mã QR", "#tool/qr-multi", false)
        )
        for ((label, route, isActive) in navItems) {
            val tab = TextView(context).apply {
                text = label
                gravity = Gravity.CENTER
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                typeface = if (isActive) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
                setTextColor(if (isActive) accentIndigo else textSecondary)
                setPadding(dp(4), dp(8), dp(4), dp(8))
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                setOnClickListener {
                    dispatchInstantRoute(route, label)
                }
            }
            bottomNav.addView(tab)
        }
        rootLayout.addView(bottomNav)

        addView(rootLayout)
        renderCategories()
        renderToolGrid()
    }

    private fun renderCategories() {
        categoryRow.removeAllViews()
        val bgCard = if (isDark) Color.parseColor("#18181C") else Color.parseColor("#FFFFFF")
        val borderSubtle = if (isDark) Color.parseColor("#27272A") else Color.parseColor("#E4E4E7")
        val textPrimary = if (isDark) Color.parseColor("#F4F4F5") else Color.parseColor("#18181B")
        val accentIndigo = Color.parseColor("#4F46E5")

        for ((catId, catLabel) in CATEGORIES) {
            val selected = catId == activeCategory
            val chip = TextView(context).apply {
                text = catLabel
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(if (selected) Color.WHITE else textPrimary)
                setPadding(dp(14), dp(8), dp(14), dp(8))
                background = roundedBg(
                    if (selected) accentIndigo else bgCard,
                    if (selected) accentIndigo else borderSubtle,
                    1,
                    999
                )
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    rightMargin = dp(8)
                }
                setOnClickListener {
                    activeCategory = catId
                    renderCategories()
                    renderToolGrid()
                }
            }
            categoryRow.addView(chip)
        }
    }

    private fun renderToolGrid() {
        gridContainer.removeAllViews()
        val query = searchQuery.lowercase(Locale.ROOT)
        val filtered = TOOLS.filter { item ->
            val matchCat = activeCategory == "all" || item.category == activeCategory
            val matchQuery = query.isEmpty() ||
                item.title.lowercase(Locale.ROOT).contains(query) ||
                item.description.lowercase(Locale.ROOT).contains(query) ||
                item.badge.lowercase(Locale.ROOT).contains(query)
            matchCat && matchQuery
        }

        var i = 0
        while (i < filtered.size) {
            val row = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    bottomMargin = dp(10)
                }
            }
            val leftItem = filtered[i]
            row.addView(createToolCard(leftItem, true))

            if (i + 1 < filtered.size) {
                val rightItem = filtered[i + 1]
                row.addView(createToolCard(rightItem, false))
            } else {
                row.addView(View(context).apply {
                    layoutParams = LinearLayout.LayoutParams(0, 1, 1f).apply {
                        leftMargin = dp(5)
                    }
                })
            }
            gridContainer.addView(row)
            i += 2
        }
    }

    private fun createToolCard(item: NativeToolItem, isLeft: Boolean): View {
        val bgCard = if (isDark) Color.parseColor("#141418") else Color.parseColor("#FFFFFF")
        val textPrimary = if (isDark) Color.parseColor("#F4F4F5") else Color.parseColor("#18181B")
        val textSecondary = if (isDark) Color.parseColor("#A1A1AA") else Color.parseColor("#52525B")
        val accentColor = try { Color.parseColor(item.accentHex) } catch (_: Exception) { Color.parseColor("#6366F1") }
        val borderColor = if (isDark) Color.argb(95, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor))
        else Color.argb(75, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor))

        val card = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(13), dp(13), dp(13), dp(13))
            background = roundedBg(bgCard, borderColor, 1, 16)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                if (isLeft) rightMargin = dp(5) else leftMargin = dp(5)
            }
            setOnClickListener {
                background = roundedBg(
                    Color.argb(if (isDark) 45 else 25, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor)),
                    accentColor,
                    2,
                    16
                )
                dispatchInstantRoute(item.route, item.title)
            }
        }

        // Top row: Icon pill + Tier badge
        val topRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(8)
            }
        }

        val badgePill = TextView(context).apply {
            text = item.badge
            setTextColor(accentColor)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 9.5f)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(8), dp(3), dp(8), dp(3))
            background = roundedBg(
                Color.argb(if (isDark) 38 else 24, Color.red(accentColor), Color.green(accentColor), Color.blue(accentColor)),
                Color.TRANSPARENT,
                0,
                8
            )
        }
        topRow.addView(badgePill)

        topRow.addView(View(context).apply {
            layoutParams = LinearLayout.LayoutParams(0, 1, 1f)
        })

        val tierBadge = TextView(context).apply {
            text = item.tier
            setTextColor(accentColor)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 9f)
            typeface = Typeface.DEFAULT_BOLD
        }
        topRow.addView(tierBadge)
        card.addView(topRow)

        val titleView = TextView(context).apply {
            text = item.title
            setTextColor(textPrimary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f)
            typeface = Typeface.DEFAULT_BOLD
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(4)
            }
        }
        card.addView(titleView)

        val descView = TextView(context).apply {
            text = item.description
            setTextColor(textSecondary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
        }
        card.addView(descView)

        return card
    }

    private fun dispatchInstantRoute(route: String, label: String) {
        statusBadgeView?.text = "⚡ $label"
        onRouteSelected(route)
    }
}
