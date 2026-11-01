---
id: KI-FIX-050
title: "Khắc Phục Lỗi Vỡ Ảnh 1, Dư Ảnh Ảo, Cắt Ngắn Nội Dung Bài Viết & Nhận Diện Nhầm Reel/Video Trong Facebook Downloader Bằng Dual-Engine Comet SSR + OpenGraph Extractor"
category: troubleshoot
domain: fullstack
status: verified
updated: 2026-11-01
---

# KI-FIX-050: Khắc Phục Toàn Diện Facebook Downloader (Bài Viết, Album Ảnh, Reel & Video)

## 1. Triệu chứng (Symptoms)
1. **Vỡ hình `Ảnh 1` và xuất hiện `Ảnh 2` ảo trên bài viết chỉ có 1 ảnh (`share/p/...`)**:
   - Khi dán liên kết bài viết chia sẻ như `https://www.facebook.com/share/p/1MrDCgpkuq/` (chuyển hướng về `story.php?story_fbid=122131708863458501&id=61593755051897`), giao diện báo có 2 ảnh (`Chọn ảnh (2 ảnh)`).
   - `Ảnh 1` bị vỡ hoàn toàn (biểu tượng broken image), chỉ khi bấm sang `Ảnh 2` mới thấy hình.
2. **Nhận diện nhầm liên kết Reel / Video thành Ảnh tĩnh (`Bài viết / Ảnh`)**:
   - Khi dán liên kết Facebook Reel (`https://www.facebook.com/reel/1768843621079569/`), hệ thống chỉ trả về ảnh bìa (`og:image`) dưới dạng bài viết ảnh thay vì luồng phát video MP4 HD/SD.
3. **Nội dung bài viết bị cắt ngắn (~150 ký tự), dòng đầu bị thụt lề và nút `Lưu ảnh vào Studio Drive` bị thanh điều hướng di động che khuất**:
   - Văn bản lấy từ thẻ `<meta property="og:description">` bị Facebook cắt ở ~150 ký tự làm mất các liên kết ở cuối bài viết.
   - Khung văn bản dùng `whitespace-pre-wrap` chứa khoảng trắng của template literal làm dòng đầu bị thụt lề.

## 2. Nguyên nhân gốc rễ (Root Cause)
1. **Regex `/fbid=(\d+)/g` khớp nhầm `story_fbid=`**:
   - Trong `FacebookService.tryPostExtraction()`, biểu thức `/fbid=(\d+)/g` không có ranh giới từ nên khớp luôn `story_fbid=122131708863458501` (ID của bài viết, không phải ID ảnh).
   - Khi gọi `https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=122131708863458501`, máy chủ Facebook trả về `200 OK` nhưng `content-type: text/html` thay vì `image/jpeg`, khiến `Ảnh 1` bị lỗi.
2. **Tầng 1 (`tryPostExtraction`) chặn đứng luồng trích xuất Video/Reel**:
   - Với các liên kết Reel/Video hiện đại, phản hồi HTML cho User-Agent `facebookexternalhit/1.1` không còn chứa `og:video` hay `hd_src`, mà chỉ có `og:image` (ảnh thumbnail).
   - `tryPostExtraction` thấy có `og:image` liền trả về `mediaType: 'image'` ở Tầng 1, khiến `resolveVideo()` dừng lại và không bao giờ chạy xuống Tầng 3 (`yt-dlp`).
3. **Giới hạn của OpenGraph Crawler**:
   - `facebookexternalhit/1.1` cắt ngắn `og:description` và chỉ trả về 1 thẻ `og:image` đại diện thay vì toàn bộ danh sách ảnh hoặc payload Relay JSON.

## 3. Giải pháp (Resolution)
1. **Bộ Trích Xuất Kép Song Song (OpenGraph Crawler + Desktop Comet SSR JSON)** trong `server/src/services/facebook.service.ts`:
   - Gửi song song (`Promise.allSettled`) yêu cầu OpenGraph (`facebookexternalhit/1.1`) và yêu cầu Desktop Chrome (`Sec-Fetch-Dest: document`, `Sec-Fetch-Mode: navigate`) để bóc tách các khối `<script type="application/json">` của Facebook Comet Relay.
   - Trích xuất trọn vẹn 100% văn bản bài viết không bị cắt ngắn (`message.text`), tên tác giả (`actors[0].name`), danh sách ảnh thuộc `attachments` của bài viết chính (bỏ qua `style_type_renderer` của phần bình luận để không lấy nhầm ảnh/sticker dưới comment) và luồng video progressive (`videoDeliveryLegacyFields` / `browser_native_hd_url` / `browser_native_sd_url`).
2. **Loại trừ tuyệt đối `story_fbid` & Tự động Fallback sang `scontent` CDN**:
   - Tách riêng `story_fbid` và loại bỏ khỏi danh sách ID ảnh.
   - Lưu ánh xạ dự phòng `photoFallbackUrls` (`media_id -> scontent URI`). Trong `proxyStream()` và `saveToDrive()`, nếu `lookaside.fbsbx.com` trả về `text/html` hoặc mã lỗi, hệ thống tự động chuyển sang tải từ `scontent` CDN.
3. **Bảo vệ luồng Video/Reel**:
   - Nếu URL đầu vào hoặc URL sau chuyển hướng là Reel/Video (`/reel/`, `/videos/`, `/watch`, `/share/r/`, `/share/v/`) hoặc có đính kèm `Video` mà không có URL MP4 trực tiếp trong SSR, `tryPostExtraction()` trả về `null` để chuyển tiếp sang `tryYtdlpExtraction()`, tuyệt đối không trả về ảnh thumbnail tĩnh.
4. **Cải thiện UI/UX trong `src/components/tools/facebook/FacebookWorkspace.js`**:
   - Loại bỏ khoảng trắng thừa trong khung `whitespace-pre-wrap`, bổ sung thanh tiêu đề `"Nội dung bài viết"` kèm nút `"Sao chép"`.
   - Chuẩn hóa tên file đơn dòng (`buildSafeFileName`), tự động đánh số `_anh_2`, `_anh_3` khi tải bài viết nhiều ảnh và tăng khoảng đệm dưới (`pb-28 sm:pb-16`) trên thiết bị di động.
