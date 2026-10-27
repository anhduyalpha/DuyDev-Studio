# KI-FIX-041: Triệt Tiêu Lệch Bài Hát & Khử Hoàn Toàn Nhạc Remix Lạ Trong Spotify Downloader Bằng Multi-Factor Deterministic Match Scoring & Staged Topic Search

---
- **ID:** `KI-FIX-041`
- **Loại:** `troubleshoot`
- **Phân loại:** `fullstack`
- **Trạng thái:** `verified`
- **Ngày ghi nhận:** `27/10/2026`
- **Module liên quan:** `server/src/services/spotify.service.ts`, `server/src/schemas/spotify.schema.ts`, `server/src/api/controllers/spotify.controller.ts`, `src/components/tools/spotify/`
---

## 1. Triệu chứng & Bối cảnh phát sinh (Symptoms & Context)
Người dùng gửi liên kết bài hát từ Spotify (ví dụ: bài hát *"Định Mệnh"* của ca sĩ Noo Phước Thịnh hoặc RHYDER/Song Ngọc), tuy nhiên tệp âm thanh được tải về hoặc phát thử lại là một bản nhạc remix lạ (Vinahouse, TikTok Remix, bản live hát sân khấu lẫn tạp âm, hoặc bản AI cover) hoàn toàn không đúng với bài hát gốc trên Spotify. Đồng thời, liên kết một khi đã bị tải nhầm sẽ bị khóa cứng kết quả remix do cơ chế cache lưu giữ.

## 2. Nguyên nhân gốc rễ (Root Cause Analysis)
Qua rà soát quy trình phân giải âm thanh tại `SpotifyService.resolveTrack`:
1. **Lựa chọn candidate thuần túy theo hiệu số thời lượng (`diff < lowestDiff`)**:
   Thuật toán cũ chỉ lọc các candidate từ lệnh `ytsearch5:${cleanArtist} - ${cleanTitle}` và chọn candidate có `Math.abs(itemDuration - duration)` nhỏ nhất. Nếu một bản remix do người dùng đăng tải có thời lượng tình cờ bằng hoặc gần với bài gốc (ví dụ diff = 0s), trong khi MV/Audio chính thức có chênh lệch 2-3s (do đoạn intro/outro im lặng), hệ thống sẽ **chủ động chọn bản remix** thay vì bản nhạc gốc.
2. **Thiếu hoàn toàn bộ lọc từ khóa phản tác dụng (Negative Filtering)**:
   Không có cơ chế kiểm tra các từ khóa như `remix`, `vinahouse`, `dj`, `bass boost`, `speed up`, `slowed`, `nightcore`, `live stage`, `cover`, `ai cover`, `karaoke`, `beat`, `parody`.
3. **Chiến lược truy vấn không nhắm mục tiêu (Naive Search Query)**:
   Việc tìm kiếm chuỗi chung chung khiến YouTube ưu tiên các video viral/remix thịnh hành hơn là các bản phát hành chuẩn phòng thu (Studio Audio) của hãng đĩa trên các kênh Topic (`... - Topic`) hoặc bản Audio chính thức (`Official Audio`).
4. **Khóa kết quả trong Cache & Drive**:
   Kết quả tải nhầm được lưu vào `trackCache` (TTL 2 giờ) và không có nút hoặc cơ chế xóa cache/quét lại, khiến người dùng mở lại liên kết vẫn nhận bản remix cũ.

## 3. Giải pháp kỹ thuật toàn diện (Technical Solution)

### A. Chiến lược tìm kiếm phân tầng (Staged Multi-Query Search)
Tách nghệ sĩ chính (`primaryArtist`) và tiêu đề chuẩn hóa (`cleanTitle`), thực hiện truy vấn theo 3 tầng ưu tiên giảm dần:
1. `ytsearch8:${primaryArtist} ${cleanTitle} Topic`: Nhắm trực diện vào các kênh phát hành chính thức từ nhà phân phối nhạc số (DistroKid, TuneCore, Universal, Sony, Warner, Vie Channel, Yin Yang).
2. `ytsearch8:${primaryArtist} ${cleanTitle} Official Audio`: Nhắm vào các bản Master Audio / Audio Lyrics trên kênh chính chủ của nghệ sĩ.
3. `ytsearch10:${primaryArtist} ${cleanTitle}`: Tìm kiếm dự phòng tổng quát.

### B. Công thức chấm điểm chuẩn xác (Multi-Factor Deterministic Match Scoring)
Xây dựng hàm `SpotifyService.calculateMatchScore(candidate, expected)` tính điểm từ 0 đến 100+:
- **Độ dài (Tối đa 30 điểm)**:
  - Chênh lệch $\le 2\text{s}$: +30 điểm; $\le 4\text{s}$: +25 điểm; $\le 7\text{s}$: +18 điểm; $\le 11\text{s}$: +10 điểm; $> 15\text{s}$: Loại bỏ hoàn toàn (`-999` điểm).
- **Trùng khớp tên bài hát (Tối đa 35 điểm)**:
  - Khớp thẻ `item.track` (YouTube Music metadata): +35 điểm.
  - Khớp toàn bộ từ khóa trong tiêu đề: +25 đến +30 điểm.
- **Trùng khớp nghệ sĩ & Kênh phát hành (Tối đa 25 điểm)**:
  - Kênh Topic chính thức (`- Topic`) hoặc thẻ `item.artist` trùng khớp: +25 điểm.
  - Kênh chính chủ của nghệ sĩ: +20 điểm.
- **Huy hiệu âm thanh phòng thu (Tối đa 10 điểm)**:
  - Tiêu đề chứa `Official Audio`, `Master Audio`, `Audio Lyrics`: +10 điểm.
- **Lưới lọc tiêu cực cực đoan (Shield Penalties)**:
  - Nếu bài Spotify gốc **KHÔNG** chứa từ `remix`: candidate chứa `remix`, `vinahouse`, `dj`, `bass boost`, `speed up` $\rightarrow$ **Trừ 100 điểm**.
  - Nếu bài gốc **KHÔNG** chứa từ `live`: candidate chứa `live`, `stage`, `concert`, `fancam` $\rightarrow$ **Trừ 60 điểm**.
  - Nếu bài gốc **KHÔNG** chứa từ `cover`: candidate chứa `cover`, `ai cover` $\rightarrow$ **Trừ 80 điểm**.
  - Nếu bài gốc **KHÔNG** chứa từ `karaoke`/`beat`: candidate chứa `karaoke`, `beat`, `instrumental` $\rightarrow$ **Trừ 80 điểm**.
  - Candidate chứa `parody`, `nhac che`, `reaction`, `review`, `tap \d+` $\rightarrow$ **Trừ 100 điểm**.

### C. Cơ chế làm mới Cache & Quét lại tại chỗ
- Bổ sung tham số `refresh?: boolean` trong `spotifyResolveBodySchema` và `SpotifyService.resolveTrack(rawInput, refresh)`.
- Cung cấp phương thức `SpotifyService.clearCache()` để giải phóng toàn bộ bộ nhớ đệm.
- Bổ sung nút **"Quét lại"** 1-chạm trên giao diện `SpotifyWorkspace.js` kèm huy hiệu kênh nguồn (`sourceChannel`) giúp người dùng xác minh độ chuẩn xác.

### D. Chuẩn hóa âm thanh 320kbps CBR & ID3 Tags với FFmpeg
Trong `saveToDrive`: Luồng âm thanh được tải về tệp tạm và chuyển mã sạch qua FFmpeg (`-ar 44100 -b:a 320k -metadata title=... -metadata artist=...`), nhúng metadata ID3 và bìa album vào tệp `.mp3` trước khi lưu vào Studio Drive.

## 4. Bằng chứng kiểm chứng (Verification Evidence)
1. **Kiểm tra Unit Test Suite**:
   ```powershell
   rtk vitest run server/tests/unit/media_downloaders.test.ts
   # Kết quả: 19/19 tests passed (100% PASS, Exit code 0)
   ```
2. **Kiểm tra thuật toán thực tế trên các ca khúc "Định Mệnh"**:
   - `Noo Phước Thịnh - Định Mệnh` (296s) $\rightarrow$ Khớp chính xác bản thu phòng thu trên kênh Noo Phước Thịnh (Điểm: 90, diff: 0s). Loại bỏ toàn bộ các bản Vinahouse Remix, Karaoke và AI Cover.
   - `RHYDER - Định Mệnh` (196s) $\rightarrow$ Khớp chính xác bản Topic từ nhà phát hành (Điểm: 100, diff: 0s).
   - `Tuấn Ngọc - Định Mệnh` (310s) $\rightarrow$ Khớp chính xác kênh TUẤN NGỌC MUSIC (Điểm: 80).
   - `Rick Astley - Never Gonna Give You Up` (214s) $\rightarrow$ Khớp chính xác bản 2022 Remaster chính thức (Điểm: 90, diff: 0s).
3. **Module Compliance Audit**:
   ```powershell
   python scripts/audit_module_compliance.py src/components/tools/spotify
   # Kết quả: [🟢 ĐẠT] (8/8 tiêu chuẩn)
   ```
