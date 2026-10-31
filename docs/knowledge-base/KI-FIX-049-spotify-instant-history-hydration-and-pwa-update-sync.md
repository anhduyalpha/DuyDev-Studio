# KI-FIX-049: Khắc Phục Triệt Để Vòng Lặp Cập Nhật PWA, Đồng Bộ Lịch Sử Spotify Tức Thì & Tự Phục Hồi Nạp Âm Thanh

- **ID**: `KI-FIX-049`
- **Tiêu đề**: Khắc Phục Triệt Để Vòng Lặp Cập Nhật PWA, Đồng Bộ Lịch Sử Spotify Tức Thì & Tự Phục Hồi Nạp Âm Thanh
- **Loại**: `troubleshoot`
- **Lĩnh vực**: `fullstack`
- **Tình trạng**: `verified`
- **Ngày lập**: 2026-10-31
- **Mức độ nghiêm trọng**: High (Vòng lặp thông báo cập nhật PWA liên tục trên thiết bị di động, lịch sử Spotify không hiện ngay sau khi tải xong, và lỗi nạp âm thanh HTTP 400 trong Universal File Viewer)

---

## 1. Triệu chứng & Bối cảnh (Symptoms & Context)

1. **Triệu chứng 1 (Vòng lặp thông báo cập nhật PWA trên thiết bị di động)**:
   - Trên trình duyệt di động hoặc PWA standalone, hộp thoại "Đã có bản cập nhật mới" liên tục xuất hiện.
   - Khi người dùng bấm nút *"Làm mới"*, trang web tải lại nhưng hộp thoại cập nhật phiên bản lại lập tức hiển thị lại không dứt (Update Modal Loop).
2. **Triệu chứng 2 (Lịch sử Spotify không cập nhật tức thì)**:
   - Khi dán link và trích xuất thành công một bài hát trong Spotify Downloader, bài hát mới hoàn tất **không xuất hiện ngay** trong danh sách lịch sử (`#spotifyHistoryContainer`).
   - Người dùng bắt buộc phải chuyển tab hoặc tải lại trang thì danh sách lịch sử mới được cập nhật.
3. **Triệu chứng 3 (Thanh phát âm thanh đứng yên 0:00 & Lỗi HTTP 400)**:
   - Sau khi phân tích xong bài hát, thanh phát âm thanh trong thẻ kết quả đứng yên ở trạng thái `0:00 / 0:00`.
   - Khi bấm *"Xem chi tiết trình phát âm thanh toàn màn hình"*, modal Universal File Viewer hiển thị cảnh báo:
     > `"Máy chủ phản hồi lỗi khi nạp âm thanh (HTTP 400). HTTP 400"`

---

## 2. Nguyên nhân gốc rễ (Root Cause Analysis)

### Nguyên nhân 1: Lệch Phiên Bản Tri-Point & Cơ Chế Reload Bộ Nhớ Đệm Trình Duyệt
- **Tri-Point Drift**: Trong các commit trước, `CACHE_NAME` trong `sw.js` được nâng cấp lên `v24.31`, nhưng hằng số `CURRENT_PWA_VERSION` trong `src/utilities/pwa.js` và các thẻ import script trong `index.html` vẫn giữ nguyên ở `v24.29`.
- Khi app khởi chạy, hàm `fastCheckAppUpdate()` so sánh `serverVersion !== CURRENT_PWA_VERSION` (`'duydev-studio-v24.31' !== 'duydev-studio-v24.29'`) luôn trả về `true`! Dù người dùng có bấm "Làm mới" bao nhiêu lần, code chạy trong browser vẫn mang `CURRENT_PWA_VERSION = 'v24.29'`, dẫn đến vòng lặp vô tận.
- Thêm vào đó, `performSafeReload()` gọi `window.location.reload()`. Trên Chromium WebView và Android PWA, lệnh này thường nạp lại file HTML từ bộ nhớ đệm HTTP/disk cache của trình duyệt thay vì nạp từ service worker mới.

### Nguyên nhân 2: Bỏ Sót `this.renderHistory()` Khi Đồng Bộ Store
- Khi `resolveTrack()` hoàn tất, hàm gọi `storage.recordCompletedJob(...)` và `spotifyStore.notify()`.
- Hàm `spotifyStore.notify()` kích hoạt `this.syncFromStore()`.
- Tuy nhiên trong `this.syncFromStore()`, các hàm `updateInputActions()`, `updateSubmitBtn()`, `renderAlert()`, `renderResult()` đều được gọi, **nhưng hoàn toàn không gọi `this.renderHistory()`**!
- Vì vậy, DOM của container `#spotifyHistoryContainer` không bao giờ được vẽ lại tại thời điểm bài hát hoàn tất. Chỉ khi người dùng chuyển sang tab khác rồi quay lại, hàm `mount()` mới được gọi và vẽ lại lịch sử.

### Nguyên nhân 3: Thiếu Nạp Trước Metadata & Thiếu Nhận Diện Link Gốc Trong Stream Proxy
- Thẻ `<audio>` trong `renderResult()` thiếu thuộc tính `preload="metadata"` và không gọi `audio.load()`, khiến trình duyệt không chủ động gửi range request thăm dò thời lượng bài hát.
- Trong `server/src/services/spotify.service.ts`:
  1. Khi người dùng bấm mở toàn màn hình hoặc dán link Spotify trực tiếp vào luồng stream, nếu URL truyền vào là link Spotify (chưa qua giải mã) hoặc YouTube URL bị chặn, proxy trực tiếp ném `BadRequestError` gây mã lỗi `HTTP 400`.
  2. Hàm `ensureTrackCached` thiếu nhánh xử lý tìm kiếm tự phục hồi khi `targetUrl` rỗng hoặc bị lỗi bản quyền.

---

## 3. Giải pháp kỹ thuật (Targeted Fix & Defense-in-Depth)

### 1. Đồng Bộ Triệt Để Phiên Bản Tri-Point (v24.32) & Navigation Cưỡng Bức
- **Cân bằng tuyệt đối**: Đồng bộ đồng thời `sw.js` (`CACHE_NAME = 'duydev-studio-v24.32'`), `src/utilities/pwa.js` (`CURRENT_PWA_VERSION = 'duydev-studio-v24.32'`), và `index.html` (`src/app.js?v=24.32` cùng toàn bộ query CSS `?v=24.32`).
- **Phòng vệ chuyển tiếp**: Trong `fastCheckAppUpdate()`, kiểm tra `sessionStorage.getItem('ds_updating_to_version') === serverVersion`. Nếu đang trong phiên chuyển tiếp lên phiên bản này, triệt để chặn hiển thị lại hộp thoại thông báo.
- **Navigation Cache-Bust**: Trong `performSafeReload()`, sử dụng `window.location.replace()` với tham số `_ds_fresh=${Date.now()}` để ép Chromium WebView nạp tài liệu mới từ mạng/worker. Tham số này sau đó được `src/app.js` tự động dọn sạch trên Frame 1 bằng `window.history.replaceState`.

### 2. Phục Hồi Tính Phản Ứng Tức Thì Của Lịch Sử Spotify
- Trong `SpotifyWorkspace.js`:
  1. Thêm `this.renderHistory()` vào ngay sau `storage.recordCompletedJob(...)` trong `resolveTrack()`.
  2. Thêm `this.renderHistory()` vào trong `syncFromStore()` để bảo đảm mọi thông báo từ `spotifyStore.notify()` đều tự động cập nhật ngay lập tức danh sách lịch sử.

### 3. Nạp Trước Âm Thanh & Cơ Chế Tự Phục Hồi Luồng Stream
- Trong `SpotifyWorkspace.js`:
  1. Gắn thuộc tính `preload="metadata"` và `id="spotifyInlineAudio"` cho thẻ `<audio>`.
  2. Kích hoạt `inlineAudio.load()` ngay sau khi tạo DOM để trình duyệt lập tức tải siêu dữ liệu và hiển thị thời lượng chuẩn.
  3. Trong `previewInApp()`, ưu tiên `downloadUrl || url` và kiểm tra tồn tại trước khi mở `ViewerConnector.preview`.
- Trong `server/src/services/spotify.service.ts`:
  1. Tự động nhận diện và phân giải nếu URL truyền vào là liên kết `spotify.com/track/...`.
  2. Bổ sung cơ chế tự phục hồi: Nếu tải luồng YouTube trực tiếp thất bại, tự động trích xuất tên bài hát từ `filename` để tìm kiếm và nạp tệp đệm thay thế qua `ytsearch1:`, loại bỏ hoàn toàn lỗi `HTTP 400`.

---

## 4. Kiểm chứng (Verification)

1. **TypeScript Typecheck**:
   ```powershell
   rtk err .\server\node_modules\.bin\tsc.cmd -p server/tsconfig.json --noEmit
   # -> Exit 0 (no errors)
   ```
2. **Unit Tests (PWA & Spotify)**:
   ```powershell
   rtk npx --prefix server vitest run server/tests/unit/challenger_spotify.test.ts
   # -> 15 passed (15 tests, 100%)
   rtk npx --prefix server vitest run server/tests/unit/pwa_lifecycle.test.ts
   # -> 36 passed (36 tests, 100%)
   ```
3. **JS Syntax Check**:
   ```powershell
   rtk err node --check src/components/tools/spotify/SpotifyWorkspace.js src/utilities/pwa.js src/utilities/releaseNotes.js sw.js
   # -> Exit 0
   ```
