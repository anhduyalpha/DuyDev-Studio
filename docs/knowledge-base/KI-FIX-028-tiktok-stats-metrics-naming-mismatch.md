# KI-FIX-028: Đồng Bộ Khóa Chỉ Số Thống Kê TikTok (Views, Likes, Comments, Shares) Triệt Tiêu Lỗi Hiển Thị 0 0 0 0

- **ID:** `KI-FIX-028`
- **Loại:** `troubleshoot`
- **Lĩnh vực:** `fullstack`
- **Tình trạng:** `verified`
- **Ngày lập:** 17/10/2026
- **Liên quan:** `KI-CON-009`, `server/src/services/tiktok.service.ts`, `server/src/schemas/tiktok.schema.ts`, `src/components/tools/tiktok/TiktokWorkspace.js`

---

## 1. Triệu chứng & Bối cảnh (Symptoms & Context)
- Khi người dùng dán liên kết video hoặc album ảnh TikTok vào công cụ tải TikTok Downloader (`#tool/tiktok`), hệ thống phân giải thành công video, âm thanh và ảnh bìa.
- Tuy nhiên, trong thẻ kết quả `renderResultCard`, hàng 4 chỉ số thống kê (Lượt xem, Lượt thích, Bình luận, Chia sẻ) luôn hiển thị cố định là `0 0 0 0` mặc dù video trên thực tế có hàng triệu view và hàng nghìn tim/bình luận.

---

## 2. Nguyên nhân gốc rễ (Root Cause Analysis)
1. **Lệch Danh Pháp Khóa Thống Kê Giữa Backend & Frontend:**
   - Tại Backend (`server/src/services/tiktok.service.ts`), phương thức `resolveVideo()` chuẩn hóa đối tượng thống kê trả về dưới dạng:
     ```ts
     stats: { views, likes, comments, shares }
     ```
   - Trong khi đó, tại Frontend (`src/components/tools/tiktok/TiktokWorkspace.js`), hàm `renderResultCard` lại đọc theo chuẩn thuộc tính gốc của TikTok API:
     ```js
     ${formatCompactNumber(video.stats?.playCount)}
     ${formatCompactNumber(video.stats?.diggCount)}
     ${formatCompactNumber(video.stats?.commentCount)}
     ${formatCompactNumber(video.stats?.shareCount)}
     ```
   - Do các trường `playCount`, `diggCount`, `commentCount`, `shareCount` đều là `undefined`, hàm `formatCompactNumber(undefined)` luôn trả về chuỗi `'0'`.
2. **Thiếu Khả Năng Tương Thích Ngược & Đa Tầng:**
   - Khi Backend chuyển đổi giữa các tầng giải mã (SSR HTML, TikWM REST API, hoặc yt-dlp CLI), mỗi tầng có tên trường khác nhau (`play_count` / `digg_count` ở TikWM, `view_count` / `like_count` ở yt-dlp).
   - Việc chỉ gán một tập tên khóa duy nhất khiến giao diện bị gãy liên kết khi một trong các tầng thay đổi.

---

## 3. Giải pháp kỹ thuật (Implementation)

### 3.1. Mở Rộng Schema & Cung Cấp Song Song Cả Hai Bộ Khóa Ở Backend
Tại `server/src/schemas/tiktok.schema.ts` và `server/src/services/tiktok.service.ts`, chuẩn hóa đối tượng `stats` chứa đồng thời cả hai bộ khóa canonical và legacy:
```ts
const stats = {
  views: statsViews,
  likes: statsLikes,
  comments: statsComments,
  shares: statsShares,
  // Cung cấp thêm bộ khóa legacy để tương thích tuyệt đối với frontend
  playCount: statsViews,
  diggCount: statsLikes,
  commentCount: statsComments,
  shareCount: statsShares
};
```
Áp dụng đồng bộ trên cả 3 tầng resolver: `trySsrExtraction`, `tryTikwmResolver`, và `tryYtdlpExtraction`.

### 3.2. Phòng Vệ Đa Tầng Tại Frontend (`TiktokWorkspace.js`)
Trong `src/components/tools/tiktok/TiktokWorkspace.js`, dùng toán tử nullish coalescing `??` để đọc trường chuẩn trước, fallback sang trường legacy:
```js
${formatCompactNumber(video.stats?.views ?? video.stats?.playCount)}
${formatCompactNumber(video.stats?.likes ?? video.stats?.diggCount)}
${formatCompactNumber(video.stats?.comments ?? video.stats?.commentCount)}
${formatCompactNumber(video.stats?.shares ?? video.stats?.shareCount)}
```

---

## 4. Kiểm chứng tự động (Automated Verification)
- Unit Test `server/tests/unit/tiktok_resolver.test.ts`:
  - Khẳng định `result.stats.views > 0`, `likes > 0`, `comments > 0`, `shares > 0`.
  - Khẳng định `result.stats.playCount === result.stats.views` và `result.stats.diggCount === result.stats.likes`.
  - Bộ kiểm thử Vitest đạt 18/18 tests pass 100%.
- Kiểm tra cú pháp JavaScript: `node --check src/components/tools/tiktok/TiktokWorkspace.js` đạt Exit 0.
- Biên dịch TypeScript: `npm --prefix server run build` (`tsc`) đạt Exit 0.
