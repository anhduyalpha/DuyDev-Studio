---
id: KI-FIX-015-decoupling-background-tasks-spa-dom-lifecycle
title: "Decoupling Background Task & Upload Lifecycles from SPA DOM Route Teardown"
type: troubleshoot
status: verified
domain: frontend
tags: [spa-lifecycle, background-upload, resumable-uploader, memory-leak, listener-teardown, archive-inspector]
created_at: 2026-09-25
updated_at: 2026-09-25
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Active file uploads, archive inspections, or processing jobs abruptly canceling or resetting whenever the user switches SPA routes / tabs."
search_queries:
  - "Upload file nén bị hủy khi chuyển tab DuyDev Studio"
  - "Decoupling background uploads from SPA DOM unmount"
  - "ResumableUploader cancel on route change fix"
  - "Re-hydrating active background tasks on tab return"
  - "Preventing duplicate subscribers in SPA router"
related_kis:
  - KI-CON-002-native-zero-iframe-tool-module-integration
  - KI-CON-003-universal-extensible-multitasking-architecture
  - KI-FIX-007-esmodule-circular-dependency-tdz-crash-pwa
---

# [KI-FIX-015] Tách Rời Vòng Đời Tác Vụ Ngầm & Tải Lên Khỏi Vòng Đời Hủy DOM Của Router SPA (Decoupling Background Tasks from SPA DOM Teardown)

## 1. Problem Statement & Root Cause

### Triệu chứng (Symptom)
Khi người dùng tải lên một tệp nén dung lượng lớn (100MB - 1GB+) trong module **Xem Tệp Nén** (`#archive`), sau đó chuyển sang module khác (như **PDF Studio**, **File Converter** hoặc **Dashboard**) để tiếp tục công việc, tiến trình tải lên lập tức bị ngắt quãng và hủy bỏ hoàn toàn. Khi quay lại `#archive`, giao diện bị đặt lại về trạng thái ban đầu (Dropzone trống rỗng), buộc người dùng phải tải lên lại từ đầu.

### Nguyên nhân gốc rễ (Root Cause)
1. **Đồng nhất sai lầm giữa Vòng đời Giao diện (View Lifecycle) và Vòng đời Tác vụ (Task Lifecycle)**:
   Trong mã nguồn cũ của `src/pages/ArchivePage.js`:
   ```javascript
   // Mã nguồn cũ (LỖI)
   return () => {
     isTeardown = true;
     if (activeUploader) {
       activeUploader.cancel(); // <-- Tự động hủy upload khi người dùng rời route!
       activeUploader = null;
     }
     archiveState.isUploading = false;
     closeMediaPreview();
   };
   ```
   Hàm teardown của router dọn dẹp biến cục bộ đã kích hoạt `activeUploader.cancel()`.
2. **Thiếu cơ chế Re-hydration khi quay lại**:
   Toàn bộ trạng thái tải dở (`uploadTelemetry`, `uploadStage`, `uploadingFileName`) chỉ lưu trong biến module của `ArchivePage.js`. Khi router unmount và mount lại, view không thể tự động bắt nhịp với tiến trình đang chạy.
3. **Tích tụ Subscriber rò rỉ (Listener Accumulation)**:
   Tại một số module như `usePdfDom.js`, hàm `attachPdfConverterListeners` gọi `queueManager.subscribe()` nhưng không trả về hàm hủy đăng ký (`unsubscribe`), dẫn đến việc mỗi lần người dùng chuyển tab và quay lại, một subscriber mới lại được tạo thêm gây lặp sự kiện và lãng phí RAM.

---

## 2. Technical Solution & Implementation

### 1. Tách Rời State & Tiến Trình Ra Singleton Manager (`useArchive.js`)
Tạo singleton `archiveManager` độc lập hoàn toàn với DOM:
- Lưu trữ `activeUploader`, `isUploading`, `uploadTelemetry`, `archiveData` trong bộ nhớ ứng dụng.
- Cung cấp phương thức `startUpload(file)` và `cancelUpload()` chủ động.
- Chỉ hủy tác vụ khi **người dùng bấm nút Hủy trực tiếp**, không bao giờ hủy ngầm khi đổi route.

### 2. Chuẩn Hóa Hàm Teardown Trong View Controller (`ArchivePage.js`)
Hàm dọn dẹp của view controller chỉ hủy việc lắng nghe DOM (`unsub()`) và đóng các modal xem trước, **tuyệt đối không can thiệp vào tiến trình upload**:

```javascript
export function attachArchivePageListeners(rerender) {
  let isMounted = true;

  // Lắng nghe cập nhật từ archiveManager
  const unsub = archiveManager.subscribe((event, data) => {
    if (!isMounted) return; // Bảo vệ: không đụng vào DOM nếu component đã unmount
    if (event === 'upload-progress') {
      updateUploadProgressUI(data);
      return;
    }
    rerender?.();
  });

  // HÀM DỌN DẸP AN TOÀN:
  return () => {
    isMounted = false;
    unsub();              // Gỡ listener, chống memory leak
    closeMediaPreview();  // Đóng modal xem trước nếu đang mở
    // KHÔNG gọi activeUploader.cancel()!
  };
}
```

### 3. Tự Động Tái Nạp Trạng Thái (Live Re-hydration)
Khi người dùng quay trở lại route `#archive`:
- `renderArchivePage()` gọi `archiveManager.getState()`.
- **Nếu đang upload dở**: Tự động render `renderUploadProgressCard(uploadTelemetry, uploadingFileName, uploadStage)`, gắn lại các nút điều khiển hủy/tiếp tục.
- **Nếu upload và phân tích đã xong trong lúc người dùng ở tab khác**: Tự động render cây thư mục `renderArchiveTreePane` và bảng tệp `renderFileTablePane`.

### 4. Đảm Bảo Mọi Module Trả Về Teardown Unsubscribe
Chuẩn hóa `usePdfDom.js`, `useConverterDom.js`, `useStudocu.js`:
```javascript
export function attachPdfConverterListeners(queueManager) {
  // Gắn các sự kiện click, dropzone...
  return queueManager.subscribe((state, eventType) => {
    // Cập nhật DOM in-place
  }); // Trả về chính xác () => listeners.delete(listener)
}
```

---

## 3. Gotchas & Edge Cases

> [!CAUTION]
> **Cờ `isMounted` là bắt buộc khi cập nhật DOM từ Singleton**:
> Do Singleton Manager tiếp tục phát sự kiện ngay cả khi người dùng đã chuyển trang, nếu callback `subscribe` cố gắng truy vấn `document.getElementById(...)` trên một DOM đã bị unmount, nó có thể gây ra lỗi runtime hoặc làm sai lệch layout của module mới. Luôn đặt cờ `let isMounted = true` và `if (!isMounted) return;` bên trong callback.

---

## 4. Verification

1. Mở công cụ **Xem Tệp Nén** (`#archive`), chọn một file zip lớn (~50MB - 200MB).
2. Khi thanh tiến trình đang chạy (khoảng 30%), nhấn chuyển sang tab **PDF Studio** (`#tool/pdf-studio`) hoặc **Dashboard**.
3. **Xác nhận**:
   - `GlobalTaskDock` hiển thị chip tiến trình `[Xem Tệp Nén: XX%]`.
   - Mạng (DevTools Network tab) tiếp tục truyền dữ liệu liên tục không bị `net::ERR_ABORTED`.
4. Nhấn quay lại tab `#archive`:
   - Giao diện lập tức kết nối lại thanh tiến trình thực tế, không bị giật lag hay bắt tải lại.
5. Chờ hoàn tất:
   - Thông báo Actionable Toast xuất hiện kèm nút `[Mở ngay]`.
   - Cây thư mục tệp nén hiển thị đầy đủ 100%.

---

## 5. Changelog
- **2026-09-25 (v1.0.0)**: Khắc phục triệt để lỗi ngắt upload tệp nén khi chuyển tab và tái cấu trúc lifecycle đa nhiệm bền vững (@anhduy).
