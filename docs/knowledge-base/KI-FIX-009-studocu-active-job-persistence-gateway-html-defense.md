---
id: KI-FIX-009-studocu-active-job-persistence-gateway-html-defense
title: "Khắc Phục Lỗi Unexpected token '<' Khi Gateway Trả Về HTML & Duy Trì State Tiến Trình Tải (Active Job Persistence)"
type: troubleshoot
status: verified
domain: fullstack
tags: [studocu, fastify, gateway, cloudflare-502, active-job, state-persistence, localstorage, json-parsing]
created_at: 2026-09-22
updated_at: 2026-09-22
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Lỗi 'Unexpected token <, <!DOCTYPE ... is not valid JSON' khi dán link tải hoặc mất trạng thái tiến trình tải dở khi người dùng tải lại trang."
search_queries:
  - "Unexpected token <, <!DOCTYPE ... is not valid JSON"
  - "Studocu dán link reload web bị mất state"
  - "Active Job Persistence across page reload localStorage"
  - "Fastify proxy upstream 502 Cloudflare HTML json parse error"
  - "safeFetchJson wrapper for fetch api"
related_kis:
  - KI-CON-002-native-zero-iframe-tool-module-integration
  - KI-FIX-001-persistent-browser-session-cloudflare
  - KI-HOWTO-002-cloudflare-tunnel-docker-homeserver-https
---

# [KI-FIX-009] Khắc Phục Lỗi Unexpected token '<' Khi Gateway Trả Về HTML & Duy Trì State Tiến Trình Tải (Active Job Persistence)

## 1. Context & Purpose
Trong kiến trúc phân tán của DuyDev Studio, mô-đun **Studocu Downloader** giao tiếp qua ba tầng: Frontend PWA ➔ Node.js Fastify Gateway ➔ Python Engine (`studocu-dl` Docker trên cổng `8090`).
Hai sự cố nghiêm trọng từng xảy ra làm suy giảm trải nghiệm người dùng:
1. **Lỗi cú pháp JSON Parser**: Khi container Python gặp sự cố (ví dụ lỗi thụt lề cú pháp) hoặc Cloudflare Tunnel trả về trang lỗi `502 Bad Gateway` dạng `<!DOCTYPE html>...`, frontend gọi `res.json()` trực tiếp dẫn đến lỗi `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` làm sập tiến trình UI.
2. **Mất sạch trạng thái khi reload**: Trạng thái tải (`isDownloading`, `currentJobId`, `jobStartTime`, `logs`) trước đây lưu 100% trong RAM của hook `useStudocu.js`. Khi người dùng reload trang, giao diện bị reset về trắng dù máy chủ vẫn đang cào tài liệu ngầm.

Tài liệu này chuẩn hóa cơ chế phòng vệ phản hồi Gateway và giải pháp **Active Job Persistence** tự động kết nối lại tác vụ qua `localStorage`.

---

## 2. Prerequisites
- Quyền truy cập các file frontend: [`src/components/tools/studocu/hooks/studocuApi.js`](file:///src/components/tools/studocu/hooks/studocuApi.js) và [`useStudocu.js`](file:///src/components/tools/studocu/hooks/useStudocu.js).
- Quyền kiểm tra container Docker `studocu-dl` trên homeserver `192.168.2.171`.

---

## 3. Root Cause Analysis
1. **Tại sao xuất hiện `Unexpected token '<'`**:
   - `fetch().then(res => res.json())` giả định phản hồi luôn là JSON hợp lệ.
   - Khi upstream service chết hoặc quá tải, Cloudflare Edge hoặc Nginx/Fastify tự động trả về body là tài liệu HTML thông báo lỗi 502/504 kèm doctype `<!DOCTYPE html>`.
   - Hàm `JSON.parse` đọc ký tự đầu tiên `<` và lập tức quăng lỗi không thể bắt kịp nếu thiếu wrapper phòng vệ.
2. **Tại sao reload lại mất state**:
   - Khác với module QR hay Hash dùng `moduleState.js`, Studocu quản lý luồng tải bằng biến instance class (`this.isDownloading = true`).
   - Khi refresh trình duyệt (F5), RAM bị giải phóng, biến instance khởi tạo lại từ đầu, ngắt kết nối vòng lặp polling với ID công việc đang chạy.

---

## 4. Core Instructions / Solution

### Bước 1: Thiết lập Helper `safeFetchJson` Phòng Vệ Gateway
Tại [`studocuApi.js`](file:///src/components/tools/studocu/hooks/studocuApi.js), đọc nội dung dạng chuỗi thô bằng `res.text()` trước khi parse:

```javascript
export async function safeFetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error(
      res.status >= 500
        ? 'Máy chủ đang khởi động lại hoặc tạm bận, vui lòng thử lại.'
        : 'Phản hồi không đúng định dạng'
    );
  }
  if (!res.ok || data?.error) {
    throw new Error(data?.error || `Lỗi máy chủ (${res.status})`);
  }
  return data;
}
```

### Bước 2: Tích Hợp Active Job Persistence Với `localStorage`
Lưu vết metadata tác vụ đang chạy vào key `ds_studocu_active_job`:

```javascript
const ACTIVE_JOB_KEY = 'ds_studocu_active_job';

export function saveActiveJob(data) {
  try {
    if (data) localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(data));
    else localStorage.removeItem(ACTIVE_JOB_KEY);
  } catch (_) {}
}

export function loadActiveJob() {
  try {
    const raw = localStorage.getItem(ACTIVE_JOB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}
```

### Bước 3: Tự Động Re-attach Tiến Trình Khi Khởi Động (`init`)
Trong `useStudocu.js`, hàm `init()` gọi `resumeActiveJob()` để phục hồi kết nối:

```javascript
async resumeActiveJob() {
  const saved = loadActiveJob();
  if (!saved?.jobId) return;

  try {
    const job = await safeFetchJson(`/api/v1/studocu/status/${saved.jobId}`);
    // Nếu job đã kết thúc từ trước, xóa cache và dừng lại
    if (['completed', 'success', 'error', 'failed', 'cancelled'].includes(job?.status)) {
      saveActiveJob(null);
      return;
    }

    // Tự động khôi phục giao diện tải trực tiếp
    this.isDownloading = true;
    this.currentJobId = saved.jobId;
    this.jobStartTime = saved.jobStartTime || Date.now();
    if (Array.isArray(job?.logs)) {
      this.logs = job.logs;
      const last = job.logs[job.logs.length - 1] || '';
      this.stepLabel = last.replace(/^[^a-zA-Z0-9À-ỹ]+/, '').trim() || 'Đang tiếp tục tải...';
    }
    this.startTimer();
    this.startThinkingOrbs();
    this.startPolling(saved.jobId);
    this.notify();
  } catch (_) {
    saveActiveJob(null);
  }
}
```

---

## 5. Gotchas & Edge Cases
- **Xóa cache khi tác vụ kết thúc**: Bắt buộc phải gọi `saveActiveJob(null)` trong hàm `finishJob()` và `cancelJob()` để tránh tình trạng reload lại lần sau lại cố gắng kết nối vào một job đã hoàn tất từ lâu.
- **Xác thực trạng thái job**: Nếu API trả về `status: 'completed'` hoặc `'failed'`, phải dọn sạch cache ngay lập tức thay vì đưa giao diện vào trạng thái downloading.

---

## 6. Verification
1. **Kiểm tra chịu lỗi HTML 502**:
   - Giả lập upstream trả về HTML: `safeFetchJson('/api/v1/fake-502')`.
   - Kết quả: Không xuất hiện lỗi cú pháp `Unexpected token '<'`, toast hiển thị thông báo lỗi thân thiện.
2. **Kiểm tra duy trì trạng thái tải**:
   - Dán một liên kết Studocu và bấm tải.
   - Khi thanh tiến độ và terminal logs đang chạy, nhấn F5 (Reload trang).
   - Kết quả: Giao diện tự động mở lại Live Terminal Card, tiếp tục đếm giây từ mốc ban đầu và tiếp tục nhận logs từ server mà không bị ngắt quãng.

---

## 7. Changelog
- **2026-09-22 (v1.0.0)**: Khởi tạo Knowledge Item giải quyết dứt điểm lỗi HTML parse và hoàn thành tính năng lưu state tải dở cho Studocu (@anhduy).
