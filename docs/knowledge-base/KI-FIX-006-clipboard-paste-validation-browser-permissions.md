---
id: KI-FIX-006-clipboard-paste-validation-browser-permissions
title: "Handling Browser Clipboard Permissions and Clear Error Feedback for URL Auto-Paste"
type: troubleshoot
status: verified
domain: frontend
tags: [clipboard-api, permissions, toast, validation, security, pwa, studocu]
created_at: 2026-09-22
updated_at: 2026-09-22
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Browser blocks 'Dán link' button with permission prompt, requires HTTPS/Secure Context, or shows ambiguous feedback when pasting an invalid URL."
search_queries:
  - "Dán link tự động không hỏi quyền trình duyệt"
  - "Browser permission prompt on navigator.clipboard.readText"
  - "Lỗi không đọc được clipboard trên HTTP"
  - "Thông báo đỏ khi link dán không phải studocu hợp lệ"
  - "Bypass clipboard permission prompt with native paste event"
related_kis:
  - KI-CON-001-ui-production-minimalism
  - KI-HOWTO-002-cloudflare-tunnel-docker-homeserver-https
---

# [KI-FIX-006] Cơ Chế Xử Lý Quyền Clipboard Của Trình Duyệt & Hiển Thị Lỗi Đỏ Khi Dán Link Không Hợp Lệ

## 1. Context & Purpose
Trong mô-đun **Studocu Downloader**, người dùng thường xuyên thao tác sao chép link tài liệu từ trình duyệt và dán vào Studio để tải nhanh. 

Tài liệu này tổng hợp:
1. Bản chất bảo mật của **Async Clipboard API** trên các trình duyệt hiện đại (Chrome, Edge, Safari, Firefox).
2. Phương pháp bỏ qua hộp thoại hỏi quyền (Zero-Prompt Auto Paste).
3. Chuẩn hóa hiển thị phản hồi lỗi màu đỏ rõ ràng khi người dùng dán liên kết không phải Studocu hợp lệ.

---

## 2. Root Cause & Browser Security Constraints

### 1. Giới Hạn Bảo Mật Của Hàm `navigator.clipboard.readText()`
- Trình duyệt chủ động cô lập bộ nhớ tạm (Clipboard) để bảo vệ người dùng không bị các website độc hại đọc lén mật khẩu, thẻ tín dụng hoặc mã OTP.
- Khi một script gọi `readText()`, trình duyệt sẽ:
  - **Bắt buộc ngữ cảnh an toàn (Secure Context)**: Nếu truy cập qua HTTP thường (ví dụ: `http://192.168.2.171:3000`), hàm này lập tức quăng lỗi `DOMException: Cannot read clipboard in insecure context`.
  - **Bật hộp thoại hỏi quyền (Permission Prompt)**: Yêu cầu người dùng bấm "Allow" (Cho phép) trước khi cho phép mã JavaScript tiếp cận dữ liệu.

### 2. Sự Cố Phản Hồi UI Mập Mờ
- Khi người dùng dán một liên kết bất kỳ không phải Studocu (ví dụ: link Youtube, Google, Facebook), hệ thống trước đây gọi `showToast(...)` nhưng không truyền đối số loại (mặc định là `info`).
- Kết quả: Thông báo hiển thị trong bong bóng màu xám tối trung tính kèm icon chữ `(i)`, khiến người dùng nhầm lẫn đây chỉ là thông tin phụ thay vì nhận biết rõ ràng là liên kết đã bị từ chối tải.

---

## 3. Core Solution (Giải Pháp Kỹ Thuật)

### Cơ chế 1: Phím Tắt `Ctrl + V` — Không Bao Giờ Hỏi Quyền (Zero-Prompt Bypass)
Trình duyệt phân biệt giữa:
- **Script đọc lén clipboard**: Gọi `navigator.clipboard.readText()` thông qua code ➔ Bị trình duyệt chặn/hỏi quyền.
- **Hành động vật lý chủ động của người dùng (User-Initiated Event)**: Người dùng nhấn `Ctrl + V` (hoặc `Cmd + V` trên macOS) ➔ Trình duyệt kích hoạt sự kiện `window.addEventListener('paste')` và cung cấp dữ liệu qua `e.clipboardData.getData('text')` hoàn toàn **100% không bao giờ hỏi quyền**.

Tại [src/components/tools/studocu/StudocuWorkspace.js](file:///src/components/tools/studocu/StudocuWorkspace.js):
```javascript
function handleGlobalPaste(e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  const text = e.clipboardData?.getData('text');
  if (text && text.trim()) {
    e.preventDefault();
    handleUrlCandidate(text);
  }
}
window.addEventListener('paste', handleGlobalPaste);
```

### Cơ chế 2: Cấp Quyền 1 Lần Vĩnh Viễn Trong Cài Đặt Trang (Site Settings)
Đối với nút bấm bằng chuột (`#studocuPasteBtn`):
- Để người dùng bấm chuột một chạm mà không hiện lại thông báo xin quyền:
  - Hướng dẫn người dùng chọn biểu tượng 🔒/⚙️ bên trái thanh URL ➔ **Clipboard / Bộ nhớ tạm** ➔ Chuyển từ **"Ask (Hỏi)"** sang **"Allow (Cho phép)"**.
  - Trình duyệt lưu cài đặt này vĩnh viễn theo Origin (`https://alphadaniel.io.vn`).

### Cơ chế 3: Cấu Hình Toast Đỏ Cảnh Báo Lỗi Liên Kết
Nâng cấp hàm kiểm tra tính hợp lệ `handleUrlCandidate` trong `StudocuWorkspace.js` sang trạng thái lỗi rõ ràng:

```javascript
function handleUrlCandidate(raw) {
  const clean = String(raw || '').trim();
  if (!isValidStudocuUrl(clean)) {
    // Kích hoạt toast màu đỏ (type: 'error') với icon alert-circle
    showToast('Link vừa dán không phải link studocu hợp lệ', 'error');
    
    // Đổi nhãn nút tạm thời thành trạng thái cảnh báo trực quan
    const t = document.getElementById('studocuPasteBtnTitle');
    if (t) {
      const old = t.textContent;
      t.textContent = 'Liên kết không hợp lệ!';
      setTimeout(() => { if (t) t.textContent = old; }, 2000);
    }
    return;
  }
  studocuManager.startDownload(clean, document.getElementById('studocuCookieInput')?.value.trim() || null);
}
```

Tại [src/utilities/toast.js](file:///src/utilities/toast.js), khi `type === 'error'`:
```javascript
if (type === 'error') {
  icon = 'alert-circle';
  styles = 'bg-red-950/90 text-red-100 border-red-500/30';
}
```

### Cơ chế 4: Chiến Lược Bumping Service Worker Cache
Mỗi khi cập nhật giao diện hoặc logic xử lý sự kiện frontend, luôn nâng phiên bản cache trong `sw.js` (ví dụ: `duydev-studio-v4.2` ➔ `duydev-studio-v4.3`). Điều này kích hoạt vòng đời Service Worker `activate`, tự động dọn cache cũ và ép trình duyệt tải ngay mã nguồn mới nhất.

---

## 4. Verification (Kiểm Thử Nghiệm Thu)

1. **Kiểm thử Dán phím tắt `Ctrl + V`**:
   - Sao chép bất kỳ link hợp lệ hoặc không hợp lệ.
   - Chuyển sang tab Studio và nhấn ngay `Ctrl + V` (không click chuột).
   - *Kết quả*: Trình duyệt không hiện bất kỳ popup xin quyền nào, script nhận text và xử lý tức thì.
2. **Kiểm thử Toast Thông Báo Đỏ**:
   - Sao chép link bất kỳ (ví dụ: `https://google.com`).
   - Nhấn nút "Dán link" hoặc `Ctrl + V`.
   - *Kết quả*: Toast màu đỏ đậm (`bg-red-950/90 text-red-100 border-red-500/30`) với icon dấu chấm than xuất hiện: *"Link vừa dán không phải link studocu hợp lệ"*.

---

## 5. Changelog
- **2026-09-22 (v1.0.0)**: Tài liệu hóa cơ chế bảo mật Clipboard, phương thức bypass không hỏi quyền và chuẩn hóa toast đỏ cảnh báo link không hợp lệ (@anhduy).
