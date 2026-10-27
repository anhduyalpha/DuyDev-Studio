# DUYDEV STUDIO - QUY CHUẨN THIẾT KẾ & PHÁT TRIỂN MODULE CHUẨN MỰC
## (Universal Tool Module Architecture & Engineering Specification)

> **Mục tiêu**: Định hình một bộ khung tiêu chuẩn kỹ thuật bất biến (Single Source of Truth) cho mọi mô-đun công cụ trong **DuyDev Studio (DS)**.  
> Đảm bảo mọi module mới khi được tạo ra đều thừa hưởng 100% tính năng cao cấp của Studio (Auto-start, Share Target, Collapsible History, Universal Clipboard, Drive sync, Global Dock, Native Android Bridge, Impeccable Design), loại bỏ triệt để các lỗi nhấp nháy, rò rỉ tài nguyên (memory leak), hoặc phân mảnh trải nghiệm.

---

## 🏛️ BẢNG 10 TRỤ CỘT KIẾN TRÚC BẮT BUỘC (The 10 Core Pillars)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DUYDEV STUDIO TOOL MODULE                        │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Cấu trúc thư mục & Phân rã đơn trách nhiệm (Directory & Modularity)  │
│ 2. Đăng ký Registry, Bố cục thẻ & Cấp bậc RPG (10-Tier Tool Card)       │
│ 3. Vòng đời Workspace: Mount, Unmount & Dọn dẹp tài nguyên triệt để     │
│ 4. Hộp thả lịch sử thu gọn tại chỗ & Thùng rác (Zero-Flicker History)   │
│ 5. Điều phối chia sẻ đa nền tảng & Auto-Start (Dual-Platform Share)    │
│ 6. Nhập liệu thông minh & Universal Clipboard (Dirty Text Sanitization) │
│ 7. Tác vụ ngầm, Dock nổi & Thông báo đẩy (TaskCoordinator & Push)      │
│ 8. Trình xem tệp Universal Viewer & Studio Drive Integration           │
│ 9. Chuẩn mực thiết kế Impeccable & Zero-Build Vanilla ES Modules       │
│ 10. Pipeline Backend Fastify, Sandbox & Python Polyglot Worker         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## TRỤ CỘT 1: CẤU TRÚC THƯ MỤC & PHÂN RÃ ĐƠN TRÁCH NHIỆM

Mỗi module công cụ đặt trong thư mục riêng biệt tại `src/components/tools/<toolId>/` theo chuẩn **Cohesive Modularity** ([KI-CON-002](file:///docs/knowledge-base/KI-CON-002-native-zero-iframe-tool-module-integration.md)):

```
src/components/tools/<toolId>/
├── <ToolName>Workspace.js      # (150-300 dòng) Orchestrator: DOM shell, router bind, mount/unmount
├── hooks/
│   └── use<ToolName>.js        # (100-250 dòng) Singleton State Manager, Event Bus & Validation
├── components/                 # Các hạt nguyên tử UI (<150 dòng/file)
│   ├── <ToolName>InputCard.js  # Thẻ dán link / Dropzone nạp tệp
│   ├── <ToolName>ResultCard.js # Thẻ hiển thị kết quả, preview, download
│   └── <ToolName>ConfigCard.js # (Tùy chọn) Bảng cấu hình tham số
└── services/                   # (Tùy chọn nếu có REST/SSE riêng)
    └── <toolId>Api.js          # API client giao tiếp với server/api/routes/<toolId>.route.ts
```

### Quy tắc bất biến:
- ❌ **CẤM God Component**: Không dồn toàn bộ giao diện, state quản lý, và network client vào 1 file duy nhất hàng nghìn dòng.
- ❌ **CẤM `<iframe>`**: Không bao giờ nhúng web ngoại vi bằng thẻ `<iframe>`. Phải chuyển thành component DOM thuần.

---

## TRỤ CỘT 2: ĐĂNG KÝ REGISTRY, BỐ CỤC THẺ & CẤP BẬC RPG (10-TIER RARITY)

Mọi module phải được đăng ký chính thức tại `src/hooks/useToolRegistry.js`:

```javascript
{
  id: '<toolId>',                          // Kebab-case duy nhất (vd: 'facebook-downloader')
  name: '<Tên Công Cụ Tinh Gọn>',         // Ngắn gọn, chuẩn xác (vd: 'Facebook Downloader')
  desc: '<Mô tả công năng ngắn gọn>',     // 1 câu súc tích tiếng Việt, TUYỆT ĐỐI KHÔNG DÙNG TỪ TIẾP THỊ
  category: '<media|document|utility|dev>',// Phân loại hợp lệ
  tier: 'S',                               // 1 trong 10 cấp bậc: E, D, C, B, A, S, SS, UR, LR, EX
  badge: 'HD/4K',                          // Nhãn tính năng ngắn gọn (tối đa 8 ký tự)
  route: '#tool/<toolId>',                 // Hash router chuẩn
  icon: '<icon_name_or_custom>'            // Tên Lucide icon HOẶC glyph riêng trong ToolIcons.js
}
```

### Tiêu chuẩn nội dung (Anti-AI Slop - [KI-CON-001](file:///docs/knowledge-base/KI-CON-001-ui-production-minimalism.md)):
- ❌ **CẤM từ ngữ tiếp thị sáo rỗng**: "tối ưu nhất", "mạnh mẽ hàng đầu", "vượt trội", "thần thánh", "hàng đầu thế giới".
- ❌ **CẤM chú thích trong ngoặc đơn**: Cấm viết kiểu `PNG (Ảnh số)`, `MP3 (Âm thanh)`, `Mặc định (Khuyên dùng)`. Chỉ viết `PNG`, `MP3`.
- **Icon chuyên biệt**: Nếu là thương hiệu hoặc công cụ độc quyền, phải khai báo SVG 3 tầng độ sâu trong `src/components/common/ToolIcons.js` ([KI-CON-007](file:///docs/knowledge-base/KI-CON-007-tool-icon-design-philosophy.md), [KI-CON-008](file:///docs/knowledge-base/KI-CON-008-apple-grade-tool-icon-system.md)).

---

## TRỤ CỘT 3: VÒNG ĐỜI WORKSPACE: MOUNT, UNMOUNT & DỌN DẸP TRIỆT ĐỂ

Mỗi `Workspace.js` phải là một ES6 Class có đầy đủ 3 phương thức bắt buộc:

```javascript
export class ExampleWorkspace {
  constructor(containerEl) {
    this.container = containerEl;
    this.historyCleanup = null;
    this.handlePendingEvent = null;
    this.abortController = null;
    // Bound listeners để xóa an toàn
    this.boundHandleClick = this.handleClick.bind(this);
    this.boundHandleInput = this.handleInput.bind(this);
  }

  mount() {
    this.render();

    // 1. Nạp lịch sử ngầm mà KHÔNG re-render toàn workspace
    storage.fetchHistory().then(() => {
      this.renderHistory();
    }).catch(() => {});

    // 2. Tiêu thụ liên kết tự động chuyển tiếp (Auto-Start Handoff)
    const pendingUrl = consumePendingAutoStart('example-tool');
    if (pendingUrl) {
      this.url = pendingUrl;
      const inp = this.container.querySelector('#exampleUrlInput');
      if (inp) inp.value = pendingUrl;
      setTimeout(() => this.processAction(), 60);
    }

    // 3. Lắng nghe sự kiện chuyển tiếp khi hash không đổi
    this.handlePendingEvent = (e) => {
      if (e.detail?.toolId === 'example-tool' && e.detail.url) {
        this.url = e.detail.url.trim();
        const inp = this.container.querySelector('#exampleUrlInput');
        if (inp) inp.value = this.url;
        setTimeout(() => this.processAction(), 60);
      }
    };
    window.addEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
  }

  unmount() {
    // Dọn dẹp listener toàn cục
    if (this.handlePendingEvent) {
      window.removeEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
      this.handlePendingEvent = null;
    }
    // Dọn dẹp listener lịch sử
    if (this.historyCleanup) {
      this.historyCleanup();
      this.historyCleanup = null;
    }
    // Hủy pending fetch HTTP
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    // Thu hồi bộ nhớ DOM
    this.container.innerHTML = '';
  }
}
```

### Quy tắc phòng chống rò rỉ (Zero-Leak Governance):
1. **Event Listeners**: Mọi `addEventListener` trên `window` hoặc `document` phải có `removeEventListener` tương ứng trong `unmount()`.
2. **Timers**: Mọi `setTimeout` / `setInterval` phải được lưu vào biến và `clearTimeout` / `clearInterval` khi unmount.
3. **Blob URLs**: Mọi `URL.createObjectURL(blob)` phải được `URL.revokeObjectURL(url)` sau khi tải xong hoặc khi unmount.
4. **Streams & Abort**: Đóng toàn bộ `EventSource` (SSE) và hủy `fetch` qua `AbortController`.

---

## TRỤ CỘT 4: HỘP THẢ LỊCH SỬ THU GỌN TẠI CHỖ & THÙNG RÁC (ZERO-FLICKER HISTORY)

Tuân thủ nghiêm ngặt chuẩn kiến trúc **Collapsible Dropboxes** ([KI-CON-006](file:///docs/knowledge-base/KI-CON-006-collapsible-dropbox-history-state-preservation.md)) và **In-Place DOM Mutation** ([KI-FIX-040](file:///docs/knowledge-base/KI-FIX-040-media-history-isolated-container-zero-flicker-toggle.md)):

### Thiết Kế Bắt Buộc:
1. **Isolated Container**: Phải bọc toàn bộ khu vực lịch sử trong một container riêng biệt `<div id="mediaHistoryContainer">` (hoặc `<div id="<toolId>HistoryContainer">`).
2. **In-Place Toggle**: Khi người dùng click nút mở/thu gọn hộp lịch sử (`#btnToggleXxxHistory`):
   - **TUYỆT ĐỐI KHÔNG ĐƯỢC GỌI `this.render()`** (vì sẽ làm kích hoạt lại `animate-fadeIn` khiến cả trang bị nhấp nháy/chớp giật).
   - Chỉ thay đổi class `hidden` / `block` trực tiếp trên phần thân body, xoay icon chevron và cập nhật nhãn `Thu gọn` / `Xem lịch sử`.
3. **Tách biệt hàm `renderHistory()`**:
   ```javascript
   renderHistory() {
     const el = this.container.querySelector('#mediaHistoryContainer');
     if (!el) return;
     el.innerHTML = renderMediaHistorySection({ toolId: '<toolId>', ... });
     this.attachHistoryListeners();
   }
   ```
4. **Phân vùng lưu trữ Storage chuẩn mực**:
   - Tích hợp 2 tab: **Lịch sử** và **Thùng rác**.
   - Xóa 1 tệp: chuyển ngay vào thùng rác (`storage.moveToTrash(id)`), **không hiện popup xác nhận phiền hà**.
   - Dọn sạch thùng rác: bắt buộc dùng modal vuốt cử chỉ an toàn `openSlideConfirmModal()` (Slide to Confirm).
   - Tích hợp nút **Lưu vào Studio Drive** (`storage.updateItemDrivePath`) và **Xem trước** (`ViewerConnector.preview`).

---

## TRỤ CỘT 5: ĐIỀU PHỐI CHIA SẺ ĐA NỀN TẢNG & AUTO-START HANDOFF

Khi module có khả năng nhận liên kết hoặc tệp từ chia sẻ hệ thống (Android ShareSheet, Web Share Target), phải hoàn tất **6 điểm kết nối đồng bộ** ([KI-FIX-039](file:///docs/knowledge-base/KI-FIX-039-universal-share-target-multi-platform-extensibility.md)):

```
Chia sẻ ngoài thiết bị
       ├── Android APK: ShareReceiverActivity.kt (urlHandlers registry)
       │         └── MainActivity.kt (autoStartScript -> sessionStorage)
       └── Web PWA: manifest.webmanifest (share_target)
                 └── sw.js -> shareTargetHelper.js -> ShareTargetModal.js
                           ↓
             Handoff qua sessionStorage
             Key: dd_pending_autostart_url ({ toolId, url, ts })
                           ↓
             Workspace.mount() -> consumePendingAutoStart(toolId)
```

### 6 Điểm Cần Cập Nhật:
1. **`android/app/src/main/java/vn/alphadaniel/duydevstudio/ShareReceiverActivity.kt`**:  
   Thêm 1 `ShareUrlHandler` vào danh sách `urlHandlers` (bao gồm `id`, `metaLabel`, `primaryActionLabel`, `primaryRoute`, `matches`, `extractUrl`).
2. **`android/app/src/main/java/vn/alphadaniel/duydevstudio/MainActivity.kt`**:  
   Thêm host vào `isSpecializedLink` và ánh xạ `targetRoute` trong `autoStartScript`.
3. **`src/utilities/shareTargetHelper.js`**:  
   Thêm định dạng vào `SharePayloadType`, bổ sung `is<Tool>Host`, cập nhật `classifySharedPayload`.
4. **`src/utilities/smartUrlRouter.js`**:  
   Thêm regex, bổ sung phân nhánh trong `detectSmartRoute`, cập nhật `routeMap` trong `handoffSmartUrl`.
5. **`src/components/common/ShareTargetModal.js`**:  
   Thêm nhãn, icon, danh sách `isUrlType` và router switch-case trong `dispatchSharedPayloadToTool`.
6. **`<ToolName>Workspace.js`**:  
   Gọi `consumePendingAutoStart('<toolId>')` khi mount và lắng nghe sự kiện `ds:pending-autostart-ready`.

---

## TRỤ CỘT 6: NHẬP LIỆU THÔNG MINH & UNIVERSAL CLIPBOARD

Để người dùng dán liên kết mượt mà 1-chạm mà không bị lỗi quyền trình duyệt hay lỗi trên Android APK ([KI-FIX-006](file:///docs/knowledge-base/KI-FIX-006-clipboard-paste-validation-browser-permissions.md), [KI-FIX-029](file:///docs/knowledge-base/KI-FIX-029-universal-clipboard-reader-android-bridge.md), [KI-FIX-033](file:///docs/knowledge-base/KI-FIX-033-tiktok-error-object-banner-universal-clipboard.md)):

### Quy chuẩn Nhập Liệu:
1. **Nút Dán (Paste Button)**:
   - Luôn sử dụng hàm `readText()` từ `src/utilities/clipboard.js`. Hàm này tự động ưu tiên `AndroidBridge.getClipboardText()` trên APK, fallback sang `navigator.clipboard.readText()`, và xử lý mượt mà khi quyền bị từ chối.
2. **Khử Bẩn Liên Kết (Dirty Text Sanitization)**:
   - Khi người dùng sao chép cả tin nhắn văn bản chứa link (vd: `"Xem video này hay lắm https://fb.watch/xyz nhé"`):
   - Phải dùng Regex trích xuất sạch URL, loại bỏ các ký tự dấu chấm, phẩy, ngoặc đơn dính ở cuối link.
   - Loại bỏ các tham số theo dõi rác (`fbclid`, `igsh`, `si`, `utm_*`).
3. **Phím Tắt & Tương Tác**:
   - Hỗ trợ nhấn phím **Enter** trên ô input để kích hoạt xử lý ngay.
   - Cung cấp nút xóa nhanh nội dung input (icon `x` khi input có chữ).
4. **Phản Hồi Âm Thanh (SoundEngine Feedback)**:
   - Bấm nút: `soundEngine?.play?.('click')`
   - Bắt đầu tải: `soundEngine?.play?.('start')`
   - Thành công: `soundEngine?.play?.('success')` hoặc `play('bell')`
   - Thất bại: `soundEngine?.play?.('error')`
   - Toggle đóng/mở: `soundEngine?.playToggle?.()`
   - Xóa tệp: `soundEngine?.playDelete?.()`

---

## TRỤ CỘT 7: TÁC VỤ NGẦM, DOCK NỔI & THÔNG BÁO ĐẨY

Khi module thực hiện các tác vụ xử lý mất nhiều thời gian (tải video, nén PDF, trích xuất dữ liệu, chuyển đổi media), phải tích hợp với hệ thống điều phối tác vụ toàn cục ([KI-CON-003](file:///docs/knowledge-base/KI-CON-003-universal-extensible-multitasking-architecture.md), [KI-FIX-015](file:///docs/knowledge-base/KI-FIX-015-decoupling-background-tasks-spa-dom-lifecycle.md), [KI-FIX-030](file:///docs/knowledge-base/KI-FIX-030-android-responsive-push-notifications-v2.md)):

```javascript
import { taskCoordinator } from '../../../utilities/taskCoordinator.js';
import { notificationHelper } from '../../../utilities/notificationHelper.js';

// 1. Khởi tạo tác vụ ngầm (tự động xuất hiện trên GlobalTaskDock nổi)
const taskId = `<prefix>_${Date.now()}`;
taskCoordinator.createTask(taskId, {
  title: `Tải video: ${title}`,
  type: 'media-download',
  progress: 10
});

// 2. Cập nhật tiến độ
taskCoordinator.updateTask(taskId, { progress: 65, statusText: 'Đang ghép luồng âm thanh...' });

// 3. Hoàn tất & Bắn thông báo đẩy
taskCoordinator.updateTask(taskId, { status: 'completed', progress: 100 });
soundEngine?.playSuccess?.();

notificationHelper.send({
  title: 'Tải xuống hoàn tất',
  body: `Tệp ${fileName} đã sẵn sàng trong thư viện.`,
  icon: '/src/assets/logo-ds.svg'
});

// 4. Báo cho Android Sleep Governor biết để quản lý pin
if (window.AndroidBridge?.onActiveTaskCountChanged) {
  window.AndroidBridge.onActiveTaskCountChanged(activeCount);
}
```

---

## TRỤ CỘT 8: TRÌNH XEM TỆP UNIVERSAL VIEWER & STUDIO DRIVE INTEGRATION

Mọi tệp kết quả đầu ra (video, audio, tài liệu PDF, ảnh) phải hỗ trợ xem trước trực tiếp trên Universal File Viewer ([KI-FIX-024](file:///docs/knowledge-base/KI-FIX-024-universal-viewer-security-streaming-resilience.md), [KI-FIX-032](file:///docs/knowledge-base/KI-FIX-032-universal-file-viewer-cross-platform-resilience.md), [KI-FIX-038](file:///docs/knowledge-base/KI-FIX-038-universal-viewer-safe-extension-badge-overflow.md)):

```javascript
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';

ViewerConnector.preview({
  name: item.fileName,
  fileName: item.fileName,
  path: item.driveRelPath || undefined,
  category: isAudio ? 'audio' : (isImage ? 'image' : 'video'),
  mimeType: mime,
  viewUrl: streamUrl,
  downloadUrl: downloadUrl
});
```

### Tiêu Chuẩn An Toàn Cho Tệp:
1. **Phần mở rộng an toàn**: Luôn chuẩn hóa extension $\le 8$ ký tự chữ số. Không bao giờ để chuỗi có số thập phân (như `"6.7M views"`) biến thành đuôi tệp gây lỗi header badge.
2. **Byte-Range Streaming**: Khi cung cấp luồng video/audio, backend phải hỗ trợ RFC 7233 (`206 Partial Content`) để người dùng có thể tua mượt mà trên viewer.
3. **Studio Drive Save**: Cung cấp nút lưu trực tiếp vào ổ đĩa ảo Studio Drive (`/facebook`, `/tiktok`, `/youtube`, `/quiz`), tự động đánh dấu badge xanh khi tệp đã tồn tại trong Drive.

---

## TRỤ CỘT 9: CHUẨN MỰC THIẾT KẾ IMPECCABLE & ZERO-BUILD NATIVE ES MODULES

Toàn bộ frontend của DuyDev Studio hoạt động trên kiến trúc **Zero-Build Vanilla ES Modules** thuần khiết:

### 1. Không Dùng Bundler
- ❌ **CẤM chạy `vite build` hoặc `webpack`**: Tất cả file trong `src/` được trình duyệt import trực tiếp dưới dạng native ES module (`import { ... } from './...'`).
- Mọi đường dẫn import tương đối phải có đuôi `.js` rõ ràng (vd: `from './hooks/useTool.js'`).

### 2. Thiết Kế Tuân Thủ Design Tokens
- Mọi màu sắc, border, nền, shadow phải dùng biến CSS từ `src/styles/stitch-tokens.css`:
  - Nền trang: `bg-[#09090B]` (Dark) / `bg-[#F4F4F6]` (Light)
  - Thẻ Card: `linear-card bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-white/10`
  - Text chính: `text-zinc-900 dark:text-zinc-100`
  - Text phụ: `text-zinc-500 dark:text-zinc-400`
  - Accent Color: `--accent: #4F46E5` hoặc màu đại diện thương hiệu (Facebook: `#1877F2`, Spotify: `#1DB954`, Instagram: `#E1306C`).
- **Độ tương phản**: Đạt chuẩn WCAG 2.1 AA trên cả 2 chế độ Sáng và Tối.
- **Ergonomics di động**:
  - Diện tích chạm (Touch Target) $\ge 44\text{px}$ (`min-h-[44px]`).
  - Đáp ứng co giãn hoàn hảo từ màn hình nhỏ nhất $\ge 360\text{px}$, không bao giờ xuất hiện thanh cuộn ngang ngoài ý muốn.
- **Phạm vi Lucide Icon**:
  - Khi render lại component con, luôn gọi `window.lucide?.createIcons({ root: containerEl })` thay vì quét toàn bộ DOM tài liệu.

---

## TRỤ CỘT 10: PIPELINE BACKEND FASTIFY, SANDBOX & PYTHON POLYGLOT

Nếu module yêu cầu xử lý logic ở tầng Server (Fastify v4 + Python worker):

### 1. Định Nghĩa Tuyến HTTP (`server/src/api/routes/<toolId>.route.ts`)
- Mọi route phải được validate tham số đầu vào bằng **Zod Schema**:
  ```typescript
  const schema = z.object({
    url: z.string().url(),
    quality: z.enum(['hd', 'sd']).optional()
  });
  ```
- Kiểm tra tính hợp lệ và an toàn của đường dẫn tệp thông qua `StorageManager.sanitizeSafePath()` để triệt tiêu 100% lỗ hổng **Path Traversal**.

### 2. Polyglot Python Engines
- Tất cả script Python trong `engines/` **BẮT BUỘC** phải có dòng đầu tiên ([KI-FIX-021](file:///docs/knowledge-base/KI-FIX-021-python-runtime-future-annotations-polyglot-worker.md)):
  ```python
  from __future__ import annotations
  ```
  để ngăn chặn crash thời điểm runtime trên Linux do type annotations.
- Xử lý tham số dòng lệnh qua `argparse` chuẩn hóa, không phụ thuộc vào thứ tự tham số thô ([KI-FIX-013](file:///docs/knowledge-base/KI-FIX-013-polyglot-cli-subcommand-argparse-inheritance.md)).
- Xuất log tiến trình ra stdout theo định dạng JSON nguyên tử để BullMQ Worker bắt và đẩy qua SSE / Redis Pub/Sub:
  `{"step": "downloading", "progress": 45}`.

---

## 📋 BẢNG KIỂM TRA NGHIỆM THU 10 BƯỚC (Pre-Flight & Post-Flight Checklist)

Mỗi khi hoàn thành việc tạo hoặc nâng cấp một module, **BẮT BUỘC** kiểm tra lần lượt 10 bước sau trước khi công bố:

| Bước | Hạng Mục Kiểm Tra | Lệnh / Tiêu Chí Xác Nhận |
| :---: | :--- | :--- |
| **1** | Cấu trúc thư mục & Tên file | Có file `Workspace.js`, `hooks/`, phân rã dưới 300 dòng/file. |
| **2** | Đăng ký Registry & Thẻ | Đã thêm vào `useToolRegistry.js` (đủ tier, desc sạch không AI-slop). |
| **3** | Cú pháp JavaScript | `rtk err node --check <path_to_all_js_files>` **(0 errors)** |
| **4** | Typecheck Server TypeScript | `rtk npm --prefix server run build` **(Exit 0)** |
| **5** | Kiểm tra cú pháp Python | `rtk err python -m py_compile <path_to_engine.py>` (nếu có Python) |
| **6** | Bộ kiểm thử tự động | `rtk vitest run server/tests/unit/<test_file>.test.ts` **(Pass all)** |
| **7** | Không nhấp nháy lịch sử | Toggle lịch sử dùng In-Place DOM Mutation, có `<div id="...Container">`. |
| **8** | Hỗ trợ chia sẻ đa tầng | Đã đăng ký `ShareReceiverActivity.kt`, `MainActivity.kt`, `smartUrlRouter.js`. |
| **9** | Nâng cấp PWA & SW Cache | Bump version trong `sw.js` (CACHE_NAME & queries), `index.html`, `pwa.js`, `releaseNotes.js`. |
| **10** | Triển khai & Health Check | Chạy `.\scripts\deploy-prod.ps1` & kiểm tra `curl.exe -s https://studio.duydev.cloud/api/v1/health` |
