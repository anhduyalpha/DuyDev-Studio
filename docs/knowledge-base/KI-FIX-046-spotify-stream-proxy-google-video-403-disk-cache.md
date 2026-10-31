# KI-FIX-046: Khắc Phục Lỗi Không Nghe Được Âm Thanh & HTTP 400 Trong Spotify Downloader Bằng Disk-Backed Audio Cache, RFC 7233 Byte-Range Streaming & Tự Động Phục Hồi Link Hết Hạn

- **ID**: `KI-FIX-046`
- **Tiêu đề**: Khắc Phục Lỗi Không Nghe Được Âm Thanh & HTTP 400 Trong Spotify Downloader Bằng Disk-Backed Audio Cache, RFC 7233 Byte-Range Streaming & Tự Động Phục Hồi Link Hết Hạn
- **Loại**: `troubleshoot`
- **Lĩnh vực**: `fullstack`
- **Tình trạng**: `verified`
- **Ngày lập**: 2026-10-31
- **Mức độ nghiêm trọng**: High (Người dùng không thể phát thử âm thanh trong thẻ Spotify card và gặp lỗi "Máy chủ phản hồi lỗi khi nạp âm thanh (HTTP 400)" trong Universal File Viewer)

---

## 1. Triệu chứng & Bối cảnh (Symptoms & Context)

- **Triệu chứng 1**: Khi phân tích hoặc dán liên kết Spotify vào mô-đun Spotify Downloader, thanh phát âm thanh `<audio>` tại mục "Nghe thử trực tiếp" bị đứng yên ở `0:00 / 0:00` và không phát ra bất kỳ âm thanh nào.
- **Triệu chứng 2**: Khi nhấn vào liên kết *"Xem chi tiết trình phát âm thanh toàn màn hình"*, modal Universal File Viewer (`FileViewerCore`) bật lên với thông báo cảnh báo:
  > `"Máy chủ phản hồi lỗi khi nạp âm thanh (HTTP 400)."`
- **Triệu chứng 3 (Nhật ký Homeserver)**:
  ```log
  [02:46:55 UTC] WARN: Application business error
      requestId: "req-t0"
      statusCode: 400
      code: "BAD_REQUEST_PAYLOAD"
      message: "Không thể kết nối đến luồng âm thanh: HTTP 403"
      url: "/api/v1/spotify/stream?url=https%3A%2F%2Frr7---sn-8pxuuxa-nbo6l.googlevideo.com%2Fvideoplayback%3Fexpire%3D..."
  ```

---

## 2. Nguyên nhân gốc rễ (Root Cause Analysis)

1. **Hiểm họa HTTP 403 từ Google Video CDN (`googlevideo.com`)**:
   - Khi `SpotifyService.resolveTrack()` dùng `yt-dlp` tìm kiếm bản thu chuẩn trên YouTube, các format âm thanh trích xuất mang URL trực tiếp từ CDN `https://rr*.googlevideo.com/videoplayback?...`.
   - Các URL này bị ràng buộc nghiêm ngặt với thông số client (`c=VISIONOS`), IP khởi tạo request, và token thời gian sống ngắn (`expire=...`, chỉ sống 4–6 tiếng).
   - Khi Fastify chạy `proxyStream()` với Node.js `fetch(targetUrl)` sử dụng User-Agent Windows chuẩn, Google Video phát hiện chữ ký client không khớp và lập tức trả về **HTTP 403 Forbidden**.
   - `proxyStream()` ném `BadRequestError('Không thể kết nối đến luồng âm thanh: HTTP 403')`, khiến Fastify phản hồi HTTP 400 về client.
2. **URL Hết Hạn Trong Lịch Sử (Ephemeral Link Trap)**:
   - Khi lưu vào mục Lịch sử (`localStorage`), các liên kết `googlevideo.com` cũ sẽ hết hạn sau vài tiếng. Mở lại lịch sử ngày hôm sau để nghe lại sẽ luôn luôn trả về lỗi 403 / 400.
3. **Thiếu Bộ Đệm Đĩa & Range Request Chuẩn RFC 7233**:
   - Thẻ `<audio>` trên các trình duyệt WebKit/Chromium/Safari luôn gửi yêu cầu byte-range (`Range: bytes=0-` hoặc `bytes=32768-`). Việc chuyển tiếp thô qua `fetch` không thể tua nhanh tức thì và tiêu tốn băng thông lặp lại nhiều lần.

---

## 3. Giải pháp kỹ thuật (Targeted Fix & Architecture)

1. **Chuyển `downloadUrl` sang URL YouTube Ổn Định Vĩnh Cửu**:
   - Trong `SpotifyService.resolveTrack()`, ưu tiên `bestCandidate.webpage_url` (ví dụ `https://www.youtube.com/watch?v=...`) thay vì truyền link raw CDN `googlevideo.com`.
   - Link YouTube gốc không bao giờ hết hạn theo thời gian và không bị giới hạn IP client.
2. **Hệ Thống Đệm Âm Thanh Đĩa Cục Bộ (`ensureTrackCached`)**:
   - Tải và chuyển mã âm thanh thành tệp MP3 320kbps nguyên bản bằng `yt-dlp` lưu vào `data/storage/temp/spotify/${cacheKey}.mp3`.
   - Sử dụng **In-flight Download Promise Map** (`activeDownloads = new Map()`) để triệt tiêu tải trùng lặp khi trình duyệt gửi nhiều byte-range probe đồng thời.
   - Khi người dùng bấm lưu vào DD Studio Drive (`saveToDrive`), chỉ cần copy hoặc chuyển mã trực tiếp từ tệp đệm trong 0ms thay vì tải lại từ đầu!
3. **Phát Stream Chuẩn RFC 7233 (`streamLocalFile`)**:
   - Phục vụ trực tiếp từ tệp đĩa với mã trạng thái `206 Partial Content`, các header `Accept-Ranges: bytes`, `Content-Range: bytes ${start}-${end}/${fileSize}`, `Content-Type: audio/mpeg`.
   - Hỗ trợ tua âm thanh mượt mà trên toàn bộ các nền tảng (Android WebView, Chrome, Safari, iOS).
4. **Cơ Chế Tự Phục Hồi Link Lịch Sử Hết Hạn (Self-Healing Fallback)**:
   - Đối với các liên kết `googlevideo.com` cũ trong lịch sử của người dùng, nếu `fetch()` thất bại hoặc 403, hệ thống tự động bóc tách từ khóa tên bài hát (`filename` / `title`) để tự động tìm kiếm và nạp lại bằng `yt-dlp "ytsearch1:<tên bài hát>"`, đảm bảo không bao giờ làm gián đoạn trải nghiệm của người dùng.

---

## 4. Kiểm chứng (Verification)

1. **Typecheck & Unit Test**:
   - `rtk err node server/node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit` -> **Exit 0**.
   - `rtk vitest run server/tests/unit/challenger_spotify.test.ts server/tests/unit/media_downloaders.test.ts server/tests/e2e/media_downloaders_e2e.test.ts` -> **Pass 100% (Exit 0)**.
2. **Production Verification (`https://studio.duydev.cloud`)**:
   - `GET /api/v1/spotify/stream?url=https://www.youtube.com/watch?v=3BFTio5296w`: Trả về `HTTP 200 OK`, `accept-ranges: bytes`, `content-type: audio/mpeg`.
   - `GET /api/v1/spotify/stream` kèm header `Range: bytes=0-1024`: Trả về `HTTP 206 Partial Content`, `content-range: bytes 0-1024/...`.
   - Thử nghiệm với URL expired `googlevideo.com`: Tự phục hồi qua tìm kiếm bài hát và trả về `HTTP 200 OK` dung lượng đầy đủ.
