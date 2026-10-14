# KI-CON-009: Kiến Trúc Xử Lý TikTok Photo Mode (Slideshow), Đóng Gói JSZip Client-Side & Tích Hợp Studio Drive

## 1. Bối cảnh & Vấn đề Kỹ thuật (Problem Statement)
TikTok hỗ trợ định dạng bài đăng ảnh trình chiếu (Photo Mode / Carousel Slideshow) kết hợp cùng nhạc nền MP3. Khác với video thông thường có luồng stream `.mp4`, các bài đăng này:
1. **Không chứa luồng video stream tiêu chuẩn**: Trình trích xuất chỉ tìm kiếm URL video sẽ trả về lỗi rỗng hoặc chỉ lấy được ảnh đầu tiên làm cover.
2. **Bị chặn CORS khi tải trực tiếp từ trình duyệt**: Các URL ảnh và âm thanh từ CDN TikTok (`p16-sign.tiktokcdn.com`, `sf16-ies-music.tiktokcdn.com`) có cơ chế bảo vệ Hotlink, cấm fetch trực tiếp từ domain khác (CORS Policy).
3. **Độ trễ và tài nguyên máy chủ**: Nếu toàn bộ quá trình nén album (có thể chứa 10-35 ảnh chất lượng cao) đều đẩy về server sẽ gây nghẽn băng thông và lãng phí RAM/CPU khi nhiều người dùng cùng tải.

---

## 2. Giải pháp Kiến trúc (Architecture Pattern)

```mermaid
graph TD
    UserURL([TikTok Slideshow URL]) --> Gateway[Fastify Gateway :3000]
    Gateway --> SsrExt[Tier 1: SSR itemStruct.imagePost & images]
    Gateway --> TikwmExt[Tier 2: TikWM API d.images]
    Gateway --> YtdlpExt[Tier 3: yt-dlp CLI fallback]
    
    SsrExt --> Normalizer[Normalize TikTokVideoData: isSlideshow=true, images, audioUrl]
    TikwmExt --> Normalizer
    YtdlpExt --> Normalizer
    
    Normalizer --> ClientUI[TiktokWorkspace 9:16 Photo Gallery Preview]
    
    subgraph Client-Side Fast-Path
        ClientUI -->|Tải Album .ZIP| ZipClient[JSZip Engine src/vendor/jszip.min.js]
        ZipClient -->|Fetch qua Stream Proxy tránh CORS| StreamProxy[GET /api/v1/tiktok/stream]
        StreamProxy -->|Stream cùng Referer| CDN[TikTok CDN Assets]
        ZipClient -->|Đóng gói slide_01.jpg .. slide_N.jpg + audio.mp3| OutZipClient([File .ZIP Tải Về Trực Tiếp])
    end
    
    subgraph Server-Side Drive Integration
        ClientUI -->|Lưu Vào Studio Drive| SaveDriveAPI[POST /api/v1/tiktok/save-drive]
        SaveDriveAPI --> PythonZip[Python zipfile Engine]
        PythonZip --> DriveStorage[Thư mục Storage /tiktok/]
        DriveStorage --> ZipFile[[TikTok]_Title_ID.zip]
        DriveStorage --> MetaFile[[TikTok]_Title_ID.meta.json]
        DriveStorage --> ThumbFile[[TikTok]_Title_ID.thumb.jpg]
        DriveStorage --> Prisma[Prisma FileRecord application/zip]
    end
```

---

## 3. Các Thành Phần Cốt Lõi

### 3.1. Phân Tầng Trích Xuất Slideshow (Multi-Tier Normalization)
- **Tier 1 (SSR)**: Trích xuất `itemStruct.imagePost?.images` hoặc `itemStruct.images` từ hydration payload của TikTok, lấy danh sách `displayImage.urlList` hoặc `urlList`.
- **Tier 2 (TikWM)**: Lấy mảng `d.images` và ánh xạ thành danh sách URL tuyệt đối.
- **Payload Chuẩn Hóa**:
  ```typescript
  export interface TikTokVideoData {
    id: string;
    title: string;
    cover: string;
    duration: number;
    videoUrl: string; // URL ảnh đầu tiên làm fallback stream
    audioUrl?: string; // Link MP3 âm thanh nền
    isSlideshow?: boolean;
    images?: string[]; // Danh sách link ảnh chất lượng cao
    ...
  }
  ```

### 3.2. Vượt Rào CORS Bằng Stream Proxy
Khi tải từng ảnh trong trình duyệt để đưa vào JSZip, mọi request đều đi qua endpoint proxy nội bộ:
```javascript
const proxiedUrl = tiktokApi.getStreamUrl(images[i], `slide_${pad}.jpg`);
const res = await fetch(proxiedUrl);
const blob = await res.blob();
zip.file(`slide_${pad}.jpg`, blob);
```
Endpoint `/api/v1/tiktok/stream` đóng vai trò reverse proxy, gắn `Referer: https://www.tiktok.com/` và stream binary data về client với đầy đủ same-origin headers.

### 3.3. Đóng Gói Kép (Dual Bundling Strategy)
1. **Client-Side (JSZip)**: Sử dụng thư viện nội bộ `src/vendor/jszip.min.js` (không cài thêm npm). Đóng gói toàn bộ `slide_01.jpg` đến `slide_N.jpg` và `audio.mp3` thành file `[TikTok]_${title}_${id}.zip` tải về ngay lập tức với 0ms server compression queue.
2. **Server-Side (Studio Drive)**: Khi người dùng chọn "Lưu Vào Studio Drive", server sử dụng module chuẩn `zipfile` của Python để tạo file zip trong `/tiktok/`, đồng thời trích xuất slide 1 làm `.thumb.jpg` và lưu metadata vào `.meta.json`. Điều này cho phép giao diện Studio Drive hiển thị thẻ thumbnail 9:16 tương tự như video thường.

### 3.4. Kiểm Tra Trùng Lặp Thông Minh (Duplicate Detection)
Hàm `checkExistingInDrive` quét cả định dạng `.mp4` và `.zip` trong thư mục `/tiktok/`:
```typescript
const match = allFiles.find(
  (f) =>
    (f.toLowerCase().endsWith('.mp4') || f.toLowerCase().endsWith('.zip')) &&
    f.includes(`_${cleanId}`)
);
```
Ngăn chặn người dùng tải trùng lặp cả video thường và album ảnh.

---

## 4. Quy Chuẩn Vận Hành & Checklist
- [x] Luôn bọc việc nạp `JSZip` qua hàm `ensureJSZip()` để tự động fallback nếu script chưa tải xong.
- [x] Không bao giờ gọi trực tiếp URL ảnh TikTok CDN từ frontend mà phải qua `/api/v1/tiktok/stream`.
- [x] Luôn tạo `.thumb.jpg` cho file zip khi lưu vào Drive để lưới video 9:16 hiển thị ảnh bìa sắc nét.
