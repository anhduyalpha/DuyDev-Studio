# KI-FIX-039: Hỗ Trợ Đầy Đủ & Nhận Diện Toàn Diện Chia Sẻ Mọi Module Trên APK & Web Bằng Pluggable ShareUrlHandler Registry

---
id: KI-FIX-039
title: Hỗ Trợ Đầy Đủ & Nhận Diện Toàn Diện Chia Sẻ Mọi Module Trên APK & Web Bằng Pluggable ShareUrlHandler Registry
type: troubleshoot
domain: mobile
status: verified
created_at: 2026-10-27
tags: [android, apk, share-target, webview, media-downloaders, smart-routing, pwa]
---

## 1. Triệu chứng & Vấn đề (Symptoms)
- Khi chia sẻ liên kết từ các ứng dụng mạng xã hội (đặc biệt là link Facebook Reels/Video dạng `https://www.facebook.com/share/r/1CSQRnwyAi/`, Instagram Reels, Spotify nhạc, YouTube) sang ứng dụng DuyDev Studio trên Android APK:
  - Hộp thoại Native BottomSheet (`ShareReceiverActivity`) không nhận diện được module tải tương ứng.
  - Liên kết bị rơi vào nhánh mặc định **"LIÊN KẾT WEB"**, chỉ hiển thị các tùy chọn cơ bản như Tạo mã QR, Quét mã QR, TikTok fallback, hoặc Kiểm tra mã băm Hash, hoàn toàn thiếu tùy chọn **"Tải Video & Reel Facebook"** hay các module downloader chuyên biệt.
  - Trên tầng Web PWA (`ShareTargetModal.js`), khi mở qua Web Share Target API hoặc Fallback URL router, hệ thống cũng thiếu phân loại `FACEBOOK_URL`, `INSTAGRAM_URL`, `SPOTIFY_URL` và không thể dispatch trực tiếp sang module.

---

## 2. Nguyên nhân gốc rễ (Root Cause Investigation)
1. **Hardcoded URL Detection & Thiếu Registry Pattern**:
   - `ShareReceiverActivity.kt` trước đây chỉ cài đặt cứng các điều kiện `when` kiểm tra riêng lẻ cho `isTikTokContent`, `isScribdContent`, và `isStudocuContent`. Bất kỳ module mới nào (như Facebook Downloader, Instagram Downloader, Spotify Downloader, YouTube Downloader) được thêm vào hệ thống web đều bị bỏ sót trên native APK.
2. **Định dạng liên kết chia sẻ di động đặc thù (Mobile App Share Links)**:
   - Ứng dụng Facebook trên Android tạo ra đường link chia sẻ dạng `https://www.facebook.com/share/r/<id>/` (Reels) hoặc `https://www.facebook.com/share/v/<id>/` (Videos). Các biểu thức chính quy (Regex) thông thường chỉ tìm `/videos/` hoặc `/reel/` hoàn toàn bỏ sót cấu trúc `/share/r/` này.
3. **Lệch pha giữa Native Android và Web PWA Router**:
   - Khi `ShareReceiverActivity` gửi `Intent` sang `MainActivity` kèm `targetRoute`, `MainActivity` chỉ map `tiktok`, `scribd`, `studocu` vào `sessionStorage` (`dd_pending_autostart_url`), khiến các công cụ Media còn lại không nhận diện được tham số tự động nạp liên kết (auto-start).
   - `YouTubeWorkspace.js` trước đây chưa lắng nghe sự kiện `ds:pending-autostart-ready` và chưa gọi `consumePendingAutoStart('youtube')`, khiến việc chuyển tiếp link YouTube từ share target bị gián đoạn.

---

## 3. Giải pháp kỹ thuật (Targeted Fix & Implementation)

### 3.1. Thiết kế Pluggable ShareUrlHandler Registry trong Kotlin
Tại `android/app/src/main/java/vn/alphadaniel/duydevstudio/ShareReceiverActivity.kt`, định nghĩa mô hình dữ liệu trừu tượng hóa và đăng ký danh sách tập trung:

```kotlin
data class ShareUrlHandler(
    val id: String,
    val metaLabel: String,
    val primaryActionLabel: String,
    val primaryRoute: String,
    val matches: (url: String, text: String) -> Boolean,
    val extractUrl: (url: String, text: String) -> String
)

private val urlHandlers = listOf(
    ShareUrlHandler(
        id = "facebook",
        metaLabel = "VIDEO & BÀI VIẾT FACEBOOK",
        primaryActionLabel = "Tải Video & Reel Facebook (HD/SD)",
        primaryRoute = "#tool/facebook-downloader",
        matches = { url, text ->
            val combined = "$url $text".lowercase(Locale.ROOT)
            combined.contains("facebook.com") || combined.contains("fb.watch") || combined.contains("fb.com")
        },
        extractUrl = { url, text ->
            val combined = if (url.isNotBlank()) url else text
            Regex("""https?://(?:[a-zA-Z0-9_-]+\.)?(?:facebook\.com|fb\.watch|fb\.com)/[^\s"'<>()]+""").find(combined)?.value
                ?.trimEnd('.', ',', ';', '!', '?', ')') ?: (if (url.isNotBlank()) url else text)
        }
    ),
    ShareUrlHandler(
        id = "instagram",
        metaLabel = "BÀI ĐĂNG & REEL INSTAGRAM",
        primaryActionLabel = "Tải Video & Ảnh Reel Instagram",
        primaryRoute = "#tool/instagram-downloader",
        matches = { url, text ->
            val combined = "$url $text".lowercase(Locale.ROOT)
            combined.contains("instagram.com") || combined.contains("instagr.am")
        },
        extractUrl = { url, text ->
            val combined = if (url.isNotBlank()) url else text
            Regex("""https?://(?:[a-zA-Z0-9_-]+\.)?(?:instagram\.com|instagr\.am)/[^\s"'<>()]+""").find(combined)?.value
                ?.trimEnd('.', ',', ';', '!', '?', ')') ?: (if (url.isNotBlank()) url else text)
        }
    ),
    ShareUrlHandler(
        id = "spotify",
        metaLabel = "NHẠC & BÀI HÁT SPOTIFY",
        primaryActionLabel = "Tải Bài Hát / Playlist Spotify MP3",
        primaryRoute = "#tool/spotify-downloader",
        matches = { url, text ->
            val combined = "$url $text".lowercase(Locale.ROOT)
            combined.contains("spotify.com") || combined.contains("spotify.link")
        },
        extractUrl = { url, text ->
            val combined = if (url.isNotBlank()) url else text
            Regex("""https?://(?:(?:open\.)?spotify\.com|spotify\.link)/[^\s"'<>()]+""").find(combined)?.value
                ?.trimEnd('.', ',', ';', '!', '?', ')') ?: (if (url.isNotBlank()) url else text)
        }
    ),
    ShareUrlHandler(
        id = "youtube",
        metaLabel = "VIDEO & ÂM THANH YOUTUBE",
        primaryActionLabel = "Tải Video & Nhạc YouTube (1080p/MP3)",
        primaryRoute = "#tool/youtube-downloader",
        matches = { url, text ->
            val combined = "$url $text".lowercase(Locale.ROOT)
            combined.contains("youtube.com") || combined.contains("youtu.be")
        },
        extractUrl = { url, text ->
            val combined = if (url.isNotBlank()) url else text
            Regex("""https?://(?:[a-zA-Z0-9_-]+\.)?(?:youtube\.com|youtu\.be)/[^\s"'<>()]+""").find(combined)?.value
                ?.trimEnd('.', ',', ';', '!', '?', ')') ?: (if (url.isNotBlank()) url else text)
        }
    ),
    // TikTok, Scribd, Studocu...
)
```

Khi hiển thị BottomSheet, chỉ cần tìm `val matchedHandler = urlHandlers.firstOrNull { it.matches(url, text) }`. Để mở rộng thêm bất kỳ module nào sau này, nhà phát triển chỉ cần thêm 1 phần tử vào `urlHandlers`.

### 3.2. Đồng bộ hóa Tầng Điều Hướng Web & PWA
1. **`src/utilities/shareTargetHelper.js`**:
   - Khai báo các hằng số phân loại: `FACEBOOK_URL`, `INSTAGRAM_URL`, `SPOTIFY_URL`.
   - Bổ sung các hàm kiểm tra host chuyên dụng: `isFacebookHost`, `isInstagramHost`, `isSpotifyHost`.
   - Ưu tiên phân loại liên kết và loại bỏ ảnh thu nhỏ tạm của Chrome Android (`isBrowserThumbnailFile`).
2. **`src/utilities/smartUrlRouter.js`**:
   - Cập nhật biểu thức chính quy nhận diện toàn bộ định dạng chia sẻ:
     - `FACEBOOK_REGEX`: `/(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?(?:facebook\.com|fb\.watch|fb\.com)\/[^\s"'>]*/i`
     - `INSTAGRAM_REGEX`: `/(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?(?:instagram\.com|instagr\.am)\/[^\s"'>]*/i`
     - `SPOTIFY_REGEX`: `/(?:https?:\/\/)?(?:(?:open\.)?spotify\.com|spotify\.link)\/[^\s"'>]*/i`
     - `YOUTUBE_REGEX`: `/(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?(?:youtube\.com|youtu\.be)\/[^\s"'>]*/i`
   - Cập nhật bản đồ tuyến đường `routeMap` trong `handoffSmartUrl`.
3. **`src/components/common/ShareTargetModal.js`**:
   - Thêm `TYPE_LABELS`, `TYPE_ICONS` và danh sách `isUrlType`.
   - Bổ sung điều hướng `dispatchSharedPayloadToTool` cho các route `#tool/facebook-downloader`, `#tool/instagram-downloader`, `#tool/spotify-downloader`, `#tool/youtube-downloader`.
4. **`src/components/tools/youtube/YoutubeWorkspace.js`**:
   - Tích hợp `consumePendingAutoStart('youtube')` khi mount và lắng nghe sự kiện `ds:pending-autostart-ready`.

---

## 4. Kiểm chứng thực tế (Verification)
1. **Unit Test Suite**:
   - Thêm kiểm thử toàn diện trong `server/tests/unit/share_target.test.ts` cho các trường hợp:
     - Chia sẻ link Facebook (`https://www.facebook.com/share/r/1CSQRnwyAi/`, `https://fb.watch/vBxyz123/`, `https://facebook.com/reel/987654321`).
     - Chia sẻ link Instagram (`https://www.instagram.com/reel/C-123456789/`, `https://instagram.com/p/DFxyz123/`, `https://instagr.am/reel/12345`).
     - Chia sẻ link Spotify (`https://open.spotify.com/track/...`, `https://spotify.link/...`).
     - Vượt qua kiểm tra loại bỏ thumbnail link preview của trình duyệt Chrome (`isBrowserThumbnailFile`).
   - Kết quả: `10 passed` trong test suite, toàn bộ assertions pass với Exit code 0.
2. **Kiểm tra cú pháp & TypeScript Build**:
   - `rtk npm --prefix server run build` (`tsc`): **Exit 0**.
   - `rtk err node --check` trên tất cả file JS sửa đổi: **0 errors**.
3. **Đồng bộ phiên bản**:
   - Bump PWA cache lên `v24.16` (`sw.js`, `index.html`, `pwa.js`, `releaseNotes.js`).
   - Bump APK version: `versionCode = 2408`, `versionName = "24.8.0"`.
