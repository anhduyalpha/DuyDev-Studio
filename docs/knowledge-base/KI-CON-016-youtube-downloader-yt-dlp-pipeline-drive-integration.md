---
id: KI-CON-016
title: Kiến Trúc Mô-Đun YouTube Downloader Pro, Pipeline yt-dlp Ghép Nối Đa Luồng & Tích Hợp DD Studio Drive
type: concept
domain: fullstack
status: verified
tags: [youtube, yt-dlp, ffmpeg, audio-extraction, mp3, mp4, drive-integration, production]
created_at: 2026-10-18
updated_at: 2026-10-18
---

# KI-CON-016: Kiến Trúc Mô-Đun YouTube Downloader Pro, Pipeline yt-dlp Ghép Nối Đa Luồng & Tích Hợp DD Studio Drive

## 1. Bối cảnh & Yêu cầu nghiệp vụ
Người dùng yêu cầu bổ sung mô-đun **YouTube Downloader Pro** cho DD Studio, cho phép:
1. Tải video Full HD/4K (1080p, 720p, 480p, 360p) với cơ chế tự động ghép luồng hình ảnh tốt nhất và luồng âm thanh tốt nhất bằng FFmpeg.
2. Trích xuất âm thanh chất lượng cao: **MP3 320kbps** (nén phổ biến tương thích mọi thiết bị) và **M4A AAC** (nguyên bản không nén lại).
3. Hỗ trợ xem trước trực tuyến (HTTP 206 Partial Content / Byte-Range Streaming) qua Universal File Viewer mà không làm đơ trình duyệt.
4. Tích hợp 1-click lưu trữ lâu dài vào Personal Storage Drive tại thư mục `drive/YouTube/`.
5. Tự động nhận diện liên kết YouTube từ clipboard, thanh địa chỉ hashtag, và Web Share Target (chia sẻ từ app YouTube trên Android/iOS).

---

## 2. Kiến trúc Kỹ thuật (Technical Architecture)

```
[User Paste / Web Share Target]
          │
          ▼
[Frontend: YoutubeWorkspace.js & useYoutube.js]
          │ (POST /api/v1/youtube/resolve)
          ▼
[Fastify Gateway :3000 / :3001]
          │
          ▼
[YouTubeService.resolve]
  ├── In-Memory LRU/TTL Cache (10 phút)
  └── yt-dlp --dump-json --no-playlist
          │
          ▼
[User Selects Format & Quality (MP4 1080p or MP3 320k)]
          │ (POST /api/v1/youtube/download or /save-drive)
          ▼
[YouTubeService.download]
  ├── Format Map:
  │   ├── Video 1080p: "bestvideo[height<=1080]+bestaudio/best[height<=1080]" (--merge-output-format mp4)
  │   ├── Video 720p:  "bestvideo[height<=720]+bestaudio/best[height<=720]"
  │   ├── Audio MP3:   "-x --audio-format mp3 --audio-quality 320k"
  │   └── Audio M4A:   "-x --audio-format m4a"
  ├── Execution: yt-dlp child process with timeout protection
  └── Storage Dispatcher:
      ├── Temporary: server/data/storage/temp/youtube/
      └── Personal Drive: server/data/storage/drive/YouTube/ + FileRecord SQLite
```

---

## 3. Cạm bẫy Kỹ thuật & Bài học thực nghiệm (Gotchas & Fixes)

### 3.1. Phiên bản `yt-dlp` trên Linux Homeserver
- **Triệu chứng:** Lệnh `yt-dlp --dump-json` báo lỗi `ERROR: [youtube] jNQXAC9IVRw: No video formats found!`.
- **Nguyên nhân:** Gói `yt-dlp` cài mặc định từ Ubuntu apt là phiên bản cũ (`2024.04.09`). YouTube định kỳ thay đổi thuật toán giải mã chữ ký (nsig) và PO Token, yêu cầu bản phát hành mới nhất (`2026.08.19` hoặc mới hơn).
- **Khắc phục:** Không dùng bản apt. Tải trực tiếp binary độc lập từ GitHub releases:
  ```bash
  sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  sudo chmod a+rx /usr/local/bin/yt-dlp
  sudo cp /usr/local/bin/yt-dlp /usr/bin/yt-dlp
  ```

### 3.2. Byte-Range Streaming cho Video & Âm thanh
- **Vấn đề:** Khi mở tệp tải về trên Universal File Viewer hoặc thẻ `<video>`, trình duyệt gửi header `Range: bytes=0-`.
- **Giải pháp:** `streamYouTubeHandler` trong `youtube.controller.ts` xử lý mã HTTP `206 Partial Content`, phân tích `bytes=start-end` và tạo `fs.createReadStream(filePath, { start, end })` với `Content-Range: bytes ${start}-${end}/${stat.size}`.

---

## 4. Xác minh (Verification Evidence)
- Kiểm thử đơn vị: `server/tests/unit/youtube_downloader.test.ts` (13/13 tests pass).
- TypeScript Typecheck: `rtk tsc --noEmit` đạt 0 lỗi (Exit 0).
- Khởi động dịch vụ homeserver: `dd-studio.service` chạy với uptime ổn định.
- Smoke Test API Endpoint:
  - `POST https://studio.duydev.cloud/api/v1/youtube/resolve`: trả về metadata chuẩn xác.
  - `POST https://studio.duydev.cloud/api/v1/youtube/download`: trích xuất âm thanh MP3 320kbps / M4A và video thành công.
  - `POST https://studio.duydev.cloud/api/v1/youtube/save-drive`: lưu trữ vào `drive/YouTube/` với `savedToDrive: true`.
  - `GET https://studio.duydev.cloud/api/v1/youtube/stream/...`: trả về HTTP 200/206 streaming.
