---
id: KI-FIX-005-studocu-pdf-inline-preview-mime-disposition
title: "Fixing PDF Document Auto-Download on Preview Click via MIME Type and Content-Disposition Proxying"
type: troubleshoot
status: verified
domain: fullstack
tags: [studocu, pdf-preview, fastify, mime-type, content-disposition, universal-viewer, iframe, range-requests]
created_at: 2026-09-22
updated_at: 2026-09-22
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Clicking 'Xem' or 'Tab' on a downloaded PDF triggers an immediate file download into the Downloads folder instead of displaying the inline viewer modal or browser PDF tab."
search_queries:
  - "Lỗi bấm xem PDF nhưng lại tự tải file về"
  - "PDF preview triggers download instead of opening inline"
  - "Fastify proxy PDF stream Content-Type application/x-viewer-data"
  - "Universal File Viewer iframe triggers download"
  - "Content-Disposition inline vs attachment for PDF stream"
related_kis:
  - KI-HOWTO-001-studocu-downloader-docker-casaos-deployment
---

# [KI-FIX-005] Khắc Phục Lỗi Bấm Xem PDF Lại Bị Tự Động Tải File Về Máy

## 1. Context & Purpose
Trong hệ sinh thái **DuyDev Studio**, người dùng có thể xem trước nhanh các tài liệu đã tải về qua:
1. **Modal Xem trước (Universal File Viewer)**: Nhấn nút **Xem** (`.btn-view-doc`) hoặc tiêu đề file để nhúng PDF trực tiếp vào giao diện qua `<iframe>`.
2. **Tab Trình duyệt Toàn màn hình**: Nhấn nút **Tab** (`.btn-tab`) để mở tab mới hiển thị trình đọc PDF tích hợp của trình duyệt.
3. **Tải file về**: Chỉ xảy ra khi người dùng chủ động nhấn nút **Tải** (`.btn-dl`).

Sự cố xảy ra khi nhấn **Xem** hoặc **Tab**, trình duyệt không hiển thị nội dung tài liệu mà tự động tải tệp tin (`stream` hoặc `stream.bin`) về thư mục `Downloads`.

---

## 2. Root Cause Analysis (Nguyên Nhân Gốc Rễ)

Sự cố bắt nguồn từ 2 nguyên nhân độc lập:

1. **Sai lệch Header MIME Type từ Python Engine Proxy**:
   - Python backend gốc (`engines/studocu/studocu_dl/handlers.py`) phục vụ endpoint `/api/document-stream` với:
     ```python
     self.send_header("Content-Type", "application/x-viewer-data")
     self.send_header("Content-Disposition", "inline")
     ```
   - Header `application/x-viewer-data` vốn là kỹ thuật chống IDM (Internet Download Manager) bắt nhầm gói tin ArrayBuffer của Mozilla PDF.js trên bản standalone cũ.
   - Fastify Gateway (`server/src/api/routes/studocu.route.ts`) chuyển tiếp nguyên vẹn (`res.headers.forEach`) header này tới client.
   - Khi Chromium/Edge/Safari mở URL có `Content-Type: application/x-viewer-data` trong thẻ `<iframe>` hoặc tab mới, engine trình duyệt không thể kích hoạt plugin PDFium nội bộ mà coi đây là tệp nhị phân không xác định, dẫn đến hành vi tự động tải file xuống đĩa.

2. **Lỗi Runtime Method Call ở Frontend**:
   - `StudocuWorkspace.js` gọi `ViewerConnector.openViewer({ ... })`.
   - `FileViewerConnector.js` lại chỉ khai báo hàm `ViewerConnector.preview(item)`, khiến hàm `openViewer` bị `undefined`, gây ra `TypeError` trong console và làm gián đoạn luồng mở modal.

---

## 3. Core Solution (Giải Pháp Xử Lý)

### Bước 1: Cưỡng chế Header PDF Chuẩn tại Fastify Gateway
Tại [server/src/api/routes/studocu.route.ts](file:///server/src/api/routes/studocu.route.ts), lọc bỏ các header MIME của Python backend và thiết lập cố định chuẩn PDF hiển thị inline:

```typescript
// server/src/api/routes/studocu.route.ts
app.get('/api/v1/studocu/stream', async (req: FastifyRequest<{ Querystring: { id?: string; file?: string } }>, reply: FastifyReply) => {
  try {
    const query = new URLSearchParams();
    if (req.query.id) query.set('id', req.query.id);
    if (req.query.file) query.set('file', req.query.file);
    if (req.query.id && !req.query.file && !/^[0-9a-f]{16}$/i.test(req.query.id)) {
      query.set('file', req.query.id);
    }

    const headers: Record<string, string> = {};
    if (req.headers.range) headers['Range'] = req.headers.range;

    const res = await fetch(`${BACKEND_URL}/api/document-stream?${query.toString()}`, { headers });
    if (!res.ok && res.status !== 206) {
      return reply.status(res.status).send('Document not found');
    }

    reply.status(res.status);
    res.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      // Loại bỏ Content-Type lạ và Content-Disposition cũ từ engine con
      if (!['transfer-encoding', 'connection', 'content-type', 'content-disposition'].includes(lower)) {
        reply.header(key, val);
      }
    });

    // Ép buộc chuẩn PDF inline cho iframe và browser tab
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', 'inline');

    if (res.body) {
      const stream = Readable.fromWeb(res.body as any);
      return reply.send(stream);
    }
    return reply.send();
  } catch (err: any) {
    return reply.status(502).send('Studocu stream error: ' + err.message);
  }
});
```

### Bước 2: Bổ sung Alias Tương Thích & Chuẩn Hóa URL Viewer
Tại [src/components/common/viewer/FileViewerConnector.js](file:///src/components/common/viewer/FileViewerConnector.js):

```javascript
// Bổ sung alias openViewer song song với preview
export const ViewerConnector = {
  preview(item) {
    // Logic mở FileViewerCore...
  },

  openViewer(item) {
    return this.preview(item);
  },
  
  previewBlob(blob, fileName = 'Tệp tin') { ... }
};
```

Tránh trùng lặp query param `inline=true` trong `resolveViewerUrls`:
```javascript
} else if (!viewUrl.startsWith('blob:') && !viewUrl.startsWith('data:') && !viewUrl.includes('inline=')) {
  viewUrl = viewUrl.includes('?') ? `${viewUrl}&inline=true` : `${viewUrl}?inline=true`;
}
```

### Bước 3: Đấu Nối Sự Kiện Click tại Frontend
Tại [src/components/tools/studocu/StudocuWorkspace.js](file:///src/components/tools/studocu/StudocuWorkspace.js):

```javascript
document.querySelectorAll('.btn-view-doc').forEach(btn => {
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const id = btn.getAttribute('data-doc-id');
    const name = btn.getAttribute('data-doc-name');
    ViewerConnector.preview({
      id,
      name,
      fileName: name,
      category: 'pdf',
      mimeType: 'application/pdf',
      url: `/api/v1/studocu/stream?id=${encodeURIComponent(id)}&file=${encodeURIComponent(name)}`,
      downloadUrl: `/api/v1/studocu/download/${encodeURIComponent(name)}`
    });
  };
});
```

---

## 4. Gotchas & Edge Cases

1. **Hỗ trợ HTTP Range Requests (`206 Partial Content`)**:
   - Khi xem PDF nhiều trang (> 50 trang), Chromium không tải toàn bộ file một lần mà gửi header `Range: bytes=0-1023` để đọc cấu trúc xref table trước.
   - Fastify bắt buộc phải chuyển tiếp header `Range` tới Python engine và giữ nguyên header `Accept-Ranges: bytes` cùng `Content-Range` trả về.
2. **Khác biệt giữa endpoint Stream và Download**:
   - `/api/v1/studocu/stream`: Bắt buộc dùng `Content-Disposition: inline`.
   - `/api/v1/studocu/download/*`: Bắt buộc dùng `Content-Disposition: attachment; filename=...`.

---

## 5. Verification (Kiểm Thử Nghiệm Thu)

1. **Kiểm tra Header Stream Trực tiếp**:
   ```bash
   curl -I "http://192.168.2.171:3000/api/v1/studocu/stream?id=875b0757136a0796"
   ```
   *Kết quả mong đợi:*
   ```http
   HTTP/1.1 200 OK
   content-type: application/pdf
   content-disposition: inline
   accept-ranges: bytes
   ```

2. **Kiểm tra Phân đoạn Range Seeking**:
   ```bash
   curl -I -H "Range: bytes=0-1023" "http://192.168.2.171:3000/api/v1/studocu/stream?id=875b0757136a0796"
   ```
   *Kết quả mong đợi:*
   ```http
   HTTP/1.1 206 Partial Content
   content-range: bytes 0-1023/7032434
   content-type: application/pdf
   content-disposition: inline
   ```

3. **Kiểm tra UI**:
   - Nhấn nút **Xem**: Modal Universal File Viewer mở lên, hiển thị toàn bộ trang PDF qua iframe, không có file nào tải về.
   - Nhấn nút **Tab**: Mở tab mới với URL stream, giao diện PDFium của trình duyệt kích hoạt.
   - Nhấn nút **Tải**: Trình duyệt mở hộp thoại lưu tệp đúng tên gốc.

---

## 6. Changelog
- **2026-09-24 (v2.0.0)**: Khóa cứng toàn diện 4 tầng (Python Engine, Fastify Gateway, Frontend Connector, Frontend Router):
  - Loại bỏ hoàn toàn tham số `filename=` trong `Content-Disposition: inline` tại Fastify Gateway (ngăn IDM và trình duyệt bắt nhầm lệnh tải tệp).
  - Khóa cứng `Content-Type: application/pdf` tại `engines/studocu/studocu_dl/handlers.py`, triệt tiêu `application/x-viewer-data`.
  - Khắc phục `ReferenceError: qMatch is not defined` tại `src/app.js` cho deep-link `#view/pdf?file=...`.
  - Bổ sung automated integration test `server/tests/integration/studocu-stream.test.ts` chống hồi quy (@anhduy).
- **2026-09-22 (v1.0.0)**: Khởi tạo KI tài liệu hóa việc fix lỗi MIME type stream và chuẩn hóa Universal File Viewer (@anhduy).
