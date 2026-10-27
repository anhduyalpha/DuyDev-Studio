---
id: KI-CON-019-universal-tool-module-specification-standard
title: "Kiến Trúc Quy Chuẩn Thiết Kế & Phát Triển Module Chuẩn Mực Trong DuyDev Studio (Universal Tool Module Standard)"
type: concept
status: verified
domain: fullstack
tags: [architecture, module-standard, blueprint, zero-flicker, auto-start, share-target, universal-clipboard, zero-leak, lifecycle]
created_at: 2026-10-27
updated_at: 2026-10-27
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Khi thiết kế, tạo mới, nâng cấp, kiểm định hoặc tái cấu trúc bất kỳ mô-đun công cụ nào trong DuyDev Studio (src/components/tools/**); ngăn chặn hoàn toàn các lỗi nhấp nháy, rò rỉ tài nguyên, thiếu sót tích hợp chia sẻ, hoặc sai lệch giao diện so với các module còn lại."
search_queries:
  - "Quy chuẩn tạo module mới DuyDev Studio"
  - "Universal Tool Module Engineering Standard"
  - "Template Workspace module chuẩn mực không lỗi"
  - "Khung kiến trúc 10 trụ cột module DS"
  - "Audit module compliance DuyDev Studio"
related_kis:
  - KI-CON-001-ui-production-minimalism
  - KI-CON-002-native-zero-iframe-tool-module-integration
  - KI-CON-003-universal-extensible-multitasking-architecture
  - KI-CON-006-collapsible-dropbox-history-state-preservation
  - KI-FIX-039-universal-share-target-multi-platform-extensibility
  - KI-FIX-040-media-history-isolated-container-zero-flicker-toggle
---

# [KI-CON-019] Kiến Trúc Quy Chuẩn Thiết Kế & Phát Triển Module Chuẩn Mực Trong DuyDev Studio (Universal Tool Module Standard)

## 1. Bối cảnh & Vấn đề (Context & Motivation)
Trong quá trình mở rộng hệ sinh thái **DuyDev Studio (DS)** từ các công cụ tài liệu (PDF Studio, Quiz Generator, Converter) sang các công cụ truyền thông xã hội (TikTok, Facebook, Instagram, Spotify Downloader) và các tiện ích đa phương thức:
- Nhiều module được tạo mới thường bị **thiếu sót các điểm tích hợp hệ thống quan trọng**:
  1. Thiếu cơ chế Auto-Start Handoff từ Android ShareSheet hoặc Web Share Target khiến người dùng chia sẻ link vào app nhưng không tự động nạp liên kết ([KI-FIX-039](file:///docs/knowledge-base/KI-FIX-039-universal-share-target-multi-platform-extensibility.md)).
  2. Không bọc lịch sử vào Isolated Container và gọi re-render toàn workspace khi toggle dropbox, kích hoạt lại `animate-fadeIn` gây nhấp nháy toàn màn hình ([KI-FIX-040](file:///docs/knowledge-base/KI-FIX-040-media-history-isolated-container-zero-flicker-toggle.md)).
  3. Dùng trực tiếp `navigator.clipboard.readText()` gây lỗi từ chối quyền hoặc lỗi trên Android APK thay vì dùng `readText()` của Studio ([KI-FIX-029](file:///docs/knowledge-base/KI-FIX-029-universal-clipboard-reader-android-bridge.md)).
  4. Quên dọn dẹp event listeners toàn cục (`ds:pending-autostart-ready`, `window.addEventListener`) trong `unmount()`, gây rò rỉ bộ nhớ và xung đột sự kiện.
  5. Vi phạm quy chuẩn copywriting (dùng từ tiếp thị sáo rỗng hoặc chú thích trong ngoặc đơn như `(Ảnh số)`) ([KI-CON-001](file:///docs/knowledge-base/KI-CON-001-ui-production-minimalism.md)).

**Giải pháp**: Thiết lập một bộ khung quy chuẩn bất biến gồm **10 Trụ Cột Kỹ Thuật (The 10 Core Pillars)**, mã nguồn mẫu turnkey (`TemplateWorkspace.js`), và bộ công cụ kiểm định tự động (`audit_module_compliance.py`).

---

## 2. Bản Đồ 10 Trụ Cột Kỹ Thuật (10-Pillar Technical Matrix)

| Trụ Cột | Tên Tiêu Chuẩn | File Tham Chiếu / API | Quy Tắc Bất Biến (Iron Law) |
| :---: | :--- | :--- | :--- |
| **1** | **Cấu trúc thư mục** | `src/components/tools/<toolId>/` | Phân rã `<Tool>Workspace.js`, `hooks/`, `components/`. File $<300$ dòng. Cấm `<iframe>` ([KI-CON-002](file:///docs/knowledge-base/KI-CON-002-native-zero-iframe-tool-module-integration.md)). |
| **2** | **Đăng ký Registry** | `src/hooks/useToolRegistry.js` | Định danh kebab-case, 10 Tiers (E $\to$ EX). Mô tả sạch không chú thích ngoặc đơn `(...)` ([KI-CON-001](file:///docs/knowledge-base/KI-CON-001-ui-production-minimalism.md)). |
| **3** | **Vòng đời & Teardown** | `Workspace.mount()` & `unmount()` | Gỡ 100% listeners, hủy `AbortController`, xóa timers, thu hồi Object URL khi unmount. |
| **4** | **Lịch sử Không Nhấp Nháy** | `MediaHistorySection.js` / Container | **Cấm gọi `render()` khi toggle lịch sử**. Phải bọc `<div id="*HistoryContainer">` và toggle body tại chỗ ([KI-FIX-040](file:///docs/knowledge-base/KI-FIX-040-media-history-isolated-container-zero-flicker-toggle.md)). |
| **5** | **Chia Sẻ Đa Tầng & Auto-Start** | `ShareReceiverActivity.kt`, `smartUrlRouter.js` | Đăng ký 6 điểm: Android handler, Domain whitelist, PWA classify, URL regex, Modal router, `consumePendingAutoStart` ([KI-FIX-039](file:///docs/knowledge-base/KI-FIX-039-universal-share-target-multi-platform-extensibility.md)). |
| **6** | **Universal Clipboard** | `src/utilities/clipboard.js` | Luôn gọi `readText()`. Khử bẩn URL (xóa `fbclid`, `igsh`, `si`, `utm_*`). Enter kích hoạt xử lý. Âm thanh `soundEngine`. |
| **7** | **Tác Vụ Ngầm & Push** | `taskCoordinator`, `notificationHelper` | Đăng ký task ngầm hiện trên dock nổi. Bắn thông báo đẩy chuẩn kênh Android `ds_push_channel_v2` ([KI-FIX-030](file:///docs/knowledge-base/KI-FIX-030-android-responsive-push-notifications-v2.md)). |
| **8** | **Universal File Viewer** | `ViewerConnector.preview()` | Chuẩn hóa đuôi tệp $\le 8$ ký tự ([KI-FIX-038](file:///docs/knowledge-base/KI-FIX-038-universal-viewer-safe-extension-badge-overflow.md)), stream 206 Partial Content, nút Lưu Studio Drive. |
| **9** | **Impeccable Design** | `src/styles/stitch-tokens.css` | Touch targets $\ge 44\text{px}$, responsive $\ge 360\text{px}$, Light/Dark parity, `lucide.createIcons({ root: container })`. Không dùng Vite/Webpack build. |
| **10** | **Backend Polyglot** | Fastify v4 + Python Worker | Fastify validate bằng Zod, sanitize path traversal. Python bắt buộc dòng 1: `from __future__ import annotations` ([KI-FIX-021](file:///docs/knowledge-base/KI-FIX-021-python-runtime-future-annotations-polyglot-worker.md)). |

---

## 3. Mã Nguồn Mẫu Chuẩn (Turnkey Template Scaffold)

Mã nguồn mẫu hoàn chỉnh cho mọi module mới được lưu trữ cố định tại:  
[`src/components/tools/_template/TemplateWorkspace.js`](file:///src/components/tools/_template/TemplateWorkspace.js).

Tất cả các module mới chỉ cần nhân bản file này và điền các trường logic nghiệp vụ tương ứng:

```javascript
import { storage } from '../../../utilities/storage.js';
import { readText } from '../../../utilities/clipboard.js';
import { soundEngine } from '../../../utilities/soundEngine.js';
import { consumePendingAutoStart } from '../../../utilities/smartUrlRouter.js';
import { renderMediaHistorySection, attachMediaHistoryListeners } from '../common/MediaHistorySection.js';

export class MyNewWorkspace {
  constructor(containerEl) {
    this.container = containerEl;
    this.toolId = 'my-new-tool';
    this.historyCleanup = null;
    this.handlePendingEvent = null;
  }

  mount() {
    this.render();
    storage.fetchHistory().then(() => this.renderHistory()).catch(() => {});

    const pendingUrl = consumePendingAutoStart(this.toolId);
    if (pendingUrl) {
      this.url = pendingUrl;
      const inp = this.container.querySelector('#myUrlInput');
      if (inp) inp.value = pendingUrl;
      setTimeout(() => this.processAction(), 60);
    }

    this.handlePendingEvent = (e) => {
      if (e.detail?.toolId === this.toolId && e.detail.url) {
        this.url = e.detail.url.trim();
        const inp = this.container.querySelector('#myUrlInput');
        if (inp) inp.value = this.url;
        setTimeout(() => this.processAction(), 60);
      }
    };
    window.addEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
  }

  unmount() {
    if (this.handlePendingEvent) {
      window.removeEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
      this.handlePendingEvent = null;
    }
    if (this.historyCleanup) {
      this.historyCleanup();
      this.historyCleanup = null;
    }
    this.container.innerHTML = '';
  }

  render() {
    this.container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
        <!-- Breadcrumbs & Input ... -->
        <!-- Isolated History Container -->
        <div id="myHistoryContainer">
          ${renderMediaHistorySection({ toolId: this.toolId, ... })}
        </div>
      </div>
    `;
    this.attachHistoryListeners();
    if (window.lucide?.createIcons) window.lucide.createIcons({ root: this.container });
  }

  attachHistoryListeners() {
    const el = this.container.querySelector('#myHistoryContainer');
    if (!el) return;
    if (this.historyCleanup) this.historyCleanup();
    this.historyCleanup = attachMediaHistoryListeners({
      container: el,
      toolId: this.toolId,
      onTabChange: (tab) => { this.historyTab = tab; this.renderHistory(); },
      onHistoryChange: () => { this.renderHistory(); }
    });
    if (window.lucide?.createIcons) window.lucide.createIcons({ root: el });
  }

  renderHistory() {
    const el = this.container.querySelector('#myHistoryContainer');
    if (!el) return;
    el.innerHTML = renderMediaHistorySection({ toolId: this.toolId, ... });
    this.attachHistoryListeners();
  }
}
```

---

## 4. Công Cụ Kiểm Định Tự Động (Automated Compliance Auditor)

Script kiểm định tự động được lưu tại:  
[`scripts/audit_module_compliance.py`](file:///scripts/audit_module_compliance.py).

### Lệnh chạy kiểm định:
```bash
# Kiểm tra 1 module cụ thể:
python scripts/audit_module_compliance.py src/components/tools/facebook

# Quét kiểm định toàn bộ module trong hệ thống:
python scripts/audit_module_compliance.py
```

### Kết quả chuẩn mực:
```
=================================================================
 🛠️  DUYDEV STUDIO - TRÌNH KIỂM ĐỊNH QUY CHUẨN MODULE (MODULE AUDITOR)
=================================================================
📦 Module: facebook [🟢 ĐẠT]
   ✅ Cú pháp JavaScript: FacebookWorkspace.js hợp lệ
   ✅ Vòng đời Workspace: Có đầy đủ phương thức mount() và unmount()
   ✅ Dọn dẹp tài nguyên: Có cơ chế gỡ listener hoặc giải phóng DOM
   ✅ Auto-Start Handoff: Đã tích hợp consumePendingAutoStart hoặc lắng nghe sự kiện chuyển tiếp
   ✅ Universal Clipboard: Sử dụng readText() chuẩn mực từ clipboard utility
   ✅ Isolated History Container: Lịch sử được bọc trong container độc lập: id="mediaHistoryContainer"
   ✅ Đăng ký useToolRegistry: Khớp id 'facebook-downloader', Tier: UR
   ✅ Anti-AI Slop: Mô tả thẻ công cụ sạch sẽ, súc tích, không chứa chú thích thừa
=================================================================
🎉 TẤT CẢ CÁC MODULE ĐƯỢC KIỂM TRA ĐỀU ĐẠT TIÊU CHUẨN KIẾN TRÚC!
=================================================================
```

---

## 5. Tài Liệu Liên Quan
- Quy chuẩn chi tiết đầy đủ: [`docs/MODULE_STANDARD.md`](file:///docs/MODULE_STANDARD.md)
- Quy tắc Agent: [`.agents/rules/module-standard-protocol.md`](file:///.agents/rules/module-standard-protocol.md)
- Vòng đời Dropbox không nhấp nháy: [`KI-CON-006`](file:///docs/knowledge-base/KI-CON-006-collapsible-dropbox-history-state-preservation.md) & [`KI-FIX-040`](file:///docs/knowledge-base/KI-FIX-040-media-history-isolated-container-zero-flicker-toggle.md)
- Điều phối chia sẻ mở rộng: [`KI-FIX-039`](file:///docs/knowledge-base/KI-FIX-039-universal-share-target-multi-platform-extensibility.md)
