---
id: KI-CON-010-tiktok-vertical-swipe-player-storage-drive
title: "Kiến Trúc Trình Phát Video Dọc Kiểu TikTok Trong Studio Drive, Điều Hướng Vuốt Chạm & Tích Hợp Native Android Gallery"
type: concept
status: verified
domain: fullstack
tags: [tiktok, video-player, vertical-swipe, touch-gestures, storage-drive, universal-viewer, android-bridge, media-scanner]
created_at: 2026-10-14
updated_at: 2026-10-14
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Khi người dùng xem video trong thư mục TikTok (/tiktok) của Studio Drive; cần trải nghiệm xem video dọc tỷ lệ 9:16 có thể chuyển tiếp video trước/sau bằng phím mũi tên hoặc cử chỉ vuốt chạm dọc (vertical swipe) mà không chớp nháy modal, kèm overlay thông tin tác giả và tải thẳng về Android Gallery."
search_queries:
  - "TikTok vertical swipe video player in Universal Viewer"
  - "In-place modal transition slideUp slideDown zero flicker"
  - "Touch swipe up down gesture navigation mobile web"
  - "Android MediaScanner scanFile video mp4 instant gallery"
related_kis:
  - KI-CON-009-tiktok-slideshow-photo-mode-bundling
  - KI-FIX-018-android-native-bridge-background-downloads-push-notifications
  - KI-CON-001-ui-production-minimalism
---

# [KI-CON-010] Kiến Trúc Trình Phát Video Dọc Kiểu TikTok Trong Studio Drive, Điều Hướng Vuốt Chạm & Tích Hợp Native Android Gallery

## 1. Context & Động Lực Thiết Kế

Trong DuyDev Studio, video tải từ TikTok được lưu trữ lâu dài vào Studio Drive (`/tiktok`) dưới dạng video `.mp4` kèm tệp metadata `.meta.json` và ảnh bìa `.thumb.jpg`.
Khi người dùng duyệt xem các video dọc này trong Studio Drive:
1. **Thiếu trải nghiệm xem liên tục (Continuous Feed)**: Mỗi lần xem xong 1 video phải đóng modal Universal Viewer, tìm video tiếp theo rồi bấm xem lại, gây gián đoạn và mệt mỏi thao tác.
2. **Hiện tượng giật nhấp nháy backdrop (Modal Tearing/Blink)**: Nếu hủy và tạo lại modal DOM mỗi lần chuyển video, lớp phủ backdrop đen mờ sẽ chớp nháy (`animate-fadeIn`), làm mất cảm giác mượt mà của một trình phát video di động.
3. **Mất thông tin tác giả/caption gốc**: Tên file đã được sanitize an toàn trên đĩa khiến người dùng không đọc được caption gốc hoặc link nguồn TikTok.
4. **Trải nghiệm tải về trên Android APK**: Tệp video tải về bị lưu lẫn vào thư mục Downloads chung mà không xuất hiện ngay trong ứng dụng Bộ sưu tập / Google Photos.

---

## 2. Kiến Trúc Giải Pháp (Architecture)

```mermaid
flowchart TD
    StoragePage["StoragePage.js (/tiktok)"] -->|previewStorageItem| Connector["FileViewerConnector.preview(item, { playlist, playlistIndex })"]
    Connector -->|openFileViewer(state)| Core["FileViewerCore.js"]
    
    subgraph Universal Viewer Modal
        Core -->|existingModal && state.direction| InPlace["cleanupCurrentView() -> In-Place Body Update (.animate-slideUp / .animate-slideDown)"]
        Core -->|Full Open| ModalInit["Create #fileViewerCoreModal + Backdrop"]
        ModalInit --> VideoRenderer["VideoRenderer.js"]
        InPlace --> VideoRenderer
        
        VideoRenderer --> Player["HTML5 Video (9:16 aspect container)"]
        VideoRenderer --> CaptionOverlay["Collapsible Bottom-Left Caption Overlay (@author, title, link)"]
        VideoRenderer --> NavHUD["Vertical Chevron HUD (Up/Down + Index 1/N)"]
        VideoRenderer --> Gestures["Touch Swipe Up/Down + ArrowUp/ArrowDown + j/k"]
    end
    
    Gestures -->|state.onSwitchItem(nextIdx, dir)| Connector
    
    subgraph Android APK Integration
        TiktokWS["TiktokWorkspace.js / Action Buttons"] -->|window.AndroidBridge.downloadFile| NativeBridge["AndroidBridge.kt"]
        NativeBridge --> Helper["DownloadHelper.kt"]
        Helper --> MoviesDir["Environment.DIRECTORY_MOVIES/DuyDevStudio (*.mp4)"]
        Helper --> MusicDir["Environment.DIRECTORY_MUSIC/DuyDevStudio (*.mp3)"]
        Helper --> Scanner["MediaScannerConnection.scanFile(video/mp4)"]
        Scanner --> SystemGallery[("Android System Gallery / Google Photos")]
    end
```

### 2.1. In-Place Directional Modal Update (Triệt tiêu Nhấp nháy Modal)
Khi chuyển video trong playlist, `FileViewerCore.js` không phá hủy modal hiện có mà thực thi cập nhật tại chỗ:
```javascript
// FileViewerCore.js
const existingModal = document.getElementById('fileViewerCoreModal');
if (existingModal && state.direction) {
  cleanupCurrentView(); // Giải phóng native audio/video decoder & iframe

  // Cập nhật Header text
  document.getElementById('viewerFileName').textContent = state.name;
  
  // Render body với animation trượt dọc
  const viewerBody = document.getElementById('fileViewerBody');
  viewerBody.innerHTML = renderVideoViewer(state);
  const animClass = state.direction === 'prev' ? 'animate-slideDown' : 'animate-slideUp';
  viewerBody.classList.remove('animate-slideUp', 'animate-slideDown');
  void viewerBody.offsetWidth; // Buộc reflow trình duyệt
  viewerBody.classList.add(animClass);

  attachVideoListeners(state, registerCleanup);
  return;
}
```

### 2.2. Nhận Diện Cử Chỉ Vuốt Dọc & Phím Điều Hướng
`VideoRenderer.js` quản lý touch gestures công thái học:
- **Vuốt lên** (`diffY < -45px`): Chuyển video kế tiếp (`next`).
- **Vuốt xuống** (`diffY > 45px`): Chuyển video phía trước (`prev`).
- **Bàn phím Desktop**: Phím `ArrowDown` / `j` (tiếp) và `ArrowUp` / `k` (trước).
- **Vòng lặp chỉ mục (Circular Wrapping)**: Chuyển lùi tại video đầu tiên sẽ quay lại cuối danh sách và ngược lại.

### 2.3. Tích Hợp Native Android APK Gallery
Trong `DownloadHelper.kt`, luồng tải file tự động phân loại MIME type và đích lưu:
1. Video `.mp4` được lưu vào `Environment.DIRECTORY_MOVIES + "/DuyDevStudio"`.
2. Audio `.mp3` được lưu vào `Environment.DIRECTORY_MUSIC + "/DuyDevStudio"`.
3. Kích hoạt `MediaScannerConnection.scanFile` với MIME `video/mp4` hoặc `audio/mpeg` giúp file xuất hiện tức thì trong album `DuyDevStudio` trên app Thư viện mà không cần reboot thiết bị.

---

## 3. Verification & Compliance
- **Zero-Blink**: Chuyển video không làm chớp backdrop mờ hay cuộn lại vị trí trang.
- **Resource Cleanup**: `cleanupCurrentView()` giải phóng thẻ `<video>`, gọi `pause()`, xóa `src`, gọi `load()` để giải phóng native hardware decoder pipeline trên GPU/VPU thiết bị di động.
- **UI Minimalism**: Overlay caption có `line-clamp-2`, bấm để mở rộng/thu gọn, phím điều hướng chevron bán trong suốt tự ẩn gọn gàng.
