# DuyDev Studio - Knowledge Base

Tài liệu quản lý tri thức kỹ thuật (Knowledge Items - KIs) chuẩn hóa cho toàn bộ hệ thống **DuyDev Studio (DS)** và các mô-đun tiện ích, tuân thủ nghiêm ngặt tiêu chuẩn `knowledge-item-manager`.

---

## 1. Danh mục Knowledge Items (Master Index)

| ID | Tiêu đề (Title) | Loại (Type) | Lĩnh vực (Domain) | Tình trạng | Mô tả triệu chứng / Trigger |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [`KI-CON-001`](file:///docs/knowledge-base/KI-CON-001-ui-production-minimalism.md) | [Quy Chuẩn Thiết Kế Giao Diện Tối Giản Chuẩn Production & Cấm Chú Thích Thừa](file:///docs/knowledge-base/KI-CON-001-ui-production-minimalism.md) | `concept` | `frontend` | `verified` | Khi thiết kế hoặc chỉnh sửa giao diện; loại bỏ câu từ tiếp thị, chú thích giải thích hiển nhiên, giữ phong cách Linear/Vercel. |
| [`KI-CON-002`](file:///docs/knowledge-base/KI-CON-002-native-zero-iframe-tool-module-integration.md) | [Kiến Trúc Tích Hợp Mô-Đun Thuần Native (Zero-Iframe) & Tính Mô-Đun Gắn Kết (Cohesive Modularity)](file:///docs/knowledge-base/KI-CON-002-native-zero-iframe-tool-module-integration.md) | `concept` | `frontend` | `verified` | Đưa web tool độc lập vào Studio dưới dạng native component thuần DOM, phân rã theo Single Responsibility & Cohesive Modularity. |
| [`KI-CON-003`](file:///docs/knowledge-base/KI-CON-003-universal-extensible-multitasking-architecture.md) | [Kiến Trúc Đa Nhiệm Độc Lập Toàn Diện & Mở Rộng Tương Lai (Universal Extensible Multitasking)](file:///docs/knowledge-base/KI-CON-003-universal-extensible-multitasking-architecture.md) | `concept` | `frontend` | `verified` | Khi thiết kế hoặc thêm module mới cần chạy tác vụ ngầm bền vững, giám sát qua GlobalTaskDock và bắn thông báo hoàn tất mà không sửa router. |
| [`KI-FIX-001`](file:///docs/knowledge-base/KI-FIX-001-persistent-browser-session-cloudflare.md) | [Fixing Cloudflare Turnstile Re-challenging and Concurrency Deadlocks](file:///docs/knowledge-base/KI-FIX-001-persistent-browser-session-cloudflare.md) | `troubleshoot` | `backend` | `verified` | Mỗi lần tải tài liệu bị bắt giải lại Turnstile (15-30s), xung đột kết nối CDP, hoặc bị Cloudflare chặn "Access Blocked". |
| [`KI-FIX-002`](file:///docs/knowledge-base/KI-FIX-002-studocu-blank-pages-virtual-scroll.md) | [Fixing Blank White Page 1 and Offscreen Page Renders in Studocu Virtual DOM](file:///docs/knowledge-base/KI-FIX-002-studocu-blank-pages-virtual-scroll.md) | `troubleshoot` | `frontend` | `verified` | Trang 1 (bìa) hoặc các trang offscreen bị trắng xóa trong file PDF do inline style `display: none` trên `.page-content`. |
| [`KI-FIX-003`](file:///docs/knowledge-base/KI-FIX-003-studocu-paywalled-blurred-pages-bypass.md) | [Bypassing Studocu Blurred Paywalled Pages via Selective Active Session Reset](file:///docs/knowledge-base/KI-FIX-003-studocu-paywalled-blurred-pages-bypass.md) | `troubleshoot` | `backend` | `verified` | Tài liệu bị giới hạn xem trước, xuất hiện ảnh mờ WebP (`blurred/page{n}.webp`), thiếu text layer, và banner Premium. |
| [`KI-FIX-004`](file:///docs/knowledge-base/KI-FIX-004-missing-pages-chunk-capture-pipeline.md) | [Preventing Missing and Dropped Pages in Long Document Virtual Scroll Capture](file:///docs/knowledge-base/KI-FIX-004-missing-pages-chunk-capture-pipeline.md) | `troubleshoot` | `frontend` | `verified` | Tài liệu dài (>50-150 trang) bị mất trang, thiếu sheet hoặc ảnh bị vỡ do cơ chế lazy loading và unmount của virtual DOM. |
| [`KI-FIX-005`](file:///docs/knowledge-base/KI-FIX-005-studocu-pdf-inline-preview-mime-disposition.md) | [Khắc Phục Lỗi Bấm Xem PDF Lại Bị Tự Động Tải File Về Máy](file:///docs/knowledge-base/KI-FIX-005-studocu-pdf-inline-preview-mime-disposition.md) | `troubleshoot` | `fullstack` | `verified` | Nhấn nút "Xem" hoặc "Tab" trên tài liệu PDF thì trình duyệt lại tự tải file về thay vì mở modal xem trước Universal Viewer. |
| [`KI-FIX-006`](file:///docs/knowledge-base/KI-FIX-006-clipboard-paste-validation-browser-permissions.md) | [Cơ Chế Xử Lý Quyền Clipboard Của Trình Duyệt & Hiển Thị Lỗi Đỏ Khi Dán Link Không Hợp Lệ](file:///docs/knowledge-base/KI-FIX-006-clipboard-paste-validation-browser-permissions.md) | `troubleshoot` | `frontend` | `verified` | Trình duyệt hiện popup xin quyền đọc clipboard, lỗi trên HTTP thường, hoặc thông báo mờ nhạt khi dán link không hợp lệ. |
| [`KI-FIX-007`](file:///docs/knowledge-base/KI-FIX-007-esmodule-circular-dependency-tdz-crash-pwa.md) | [Xử Lý Lỗi Sập Khởi Động PWA Do Phụ Thuộc Vòng (Circular Dependency TDZ) & Nâng Cao Năng Lực Phòng Vệ Router](file:///docs/knowledge-base/KI-FIX-007-esmodule-circular-dependency-tdz-crash-pwa.md) | `troubleshoot` | `frontend` | `verified` | Ứng dụng PWA sập khi khởi động với thông báo "Khởi động giao diện thất bại - Lỗi không xác định", lặp lại vòng lặp reload, hoặc lỗi TDZ ReferenceError. |
| [`KI-FIX-008`](file:///docs/knowledge-base/KI-FIX-008-mobile-horizontal-scroll-tab-snapping-reset.md) | [Khắc Phục Hiện Tượng Giật Lùi Cuộn Về Đầu Trang Khi Bấm Tab Trên Thiết Bị Di Động](file:///docs/knowledge-base/KI-FIX-008-mobile-horizontal-scroll-tab-snapping-reset.md) | `troubleshoot` | `frontend` | `verified` | Thanh tabs cuộn ngang trên điện thoại bị giật/nhảy cuộn ngược về vị trí tab đầu tiên (`scrollLeft = 0`) khi người dùng bấm chọn tab. |
| [`KI-FIX-009`](file:///docs/knowledge-base/KI-FIX-009-studocu-active-job-persistence-gateway-html-defense.md) | [Khắc Phục Lỗi Unexpected token '<' Khi Gateway Trả Về HTML & Duy Trì State Tiến Trình Tải (Active Job Persistence)](file:///docs/knowledge-base/KI-FIX-009-studocu-active-job-persistence-gateway-html-defense.md) | `troubleshoot` | `fullstack` | `verified` | Lỗi cú pháp JSON khi Gateway/Cloudflare trả về HTML 502/504 hoặc mất hoàn toàn tiến trình tải dở khi reload trang. |
| [`KI-FIX-010`](file:///docs/knowledge-base/KI-FIX-010-selective-dom-diffing-high-frequency-terminal-lag.md) | [Khắc Phục Hiện Tượng Giật Lag Cực Mạnh Do DOM Thrashing Bằng Cơ Chế Selective DOM Diffing](file:///docs/knowledge-base/KI-FIX-010-selective-dom-diffing-high-frequency-terminal-lag.md) | `troubleshoot` | `frontend` | `verified` | Trình duyệt bị giật lag dữ dội do timer và polling re-render toàn bộ DOM và icon Lucide mỗi giây; giải quyết bằng Selective DOM Diffing. |
| [`KI-FIX-011`](file:///docs/knowledge-base/KI-FIX-011-runtime-reference-errors-vanilla-esmodules-render.md) | [Phòng Ngừa & Xử Lý Bẫy Lỗi Runtime ReferenceError Trong Template Literal & Object Literal Của Vanilla ES Modules](file:///docs/knowledge-base/KI-FIX-011-runtime-reference-errors-vanilla-esmodules-render.md) | `troubleshoot` | `frontend` | `verified` | Lỗi ReferenceError âm thầm làm gãy chuỗi render (khiến danh sách tệp luôn báo 0 tệp) và quy trình Smoke Test Node.js. |
| [`KI-FIX-012`](file:///docs/knowledge-base/KI-FIX-012-spa-router-eager-listener-evaluation-dom-order.md) | [Khắc Phục Lỗi Eager Listener Evaluation Khi Đổi Route Trong SPA Router](file:///docs/knowledge-base/KI-FIX-012-spa-router-eager-listener-evaluation-dom-order.md) | `troubleshoot` | `frontend` | `verified` | Lỗi gắn sự kiện vào phần tử DOM trước khi HTML được render vào container khiến nút bấm không nhận tương tác. |
| [`KI-FIX-013`](file:///docs/knowledge-base/KI-FIX-013-polyglot-cli-subcommand-argparse-inheritance.md) | [Xử Lý Lỗi Tham Số Dòng Lệnh Python CLI Bridge Trong Môi Trường Polyglot](file:///docs/knowledge-base/KI-FIX-013-polyglot-cli-subcommand-argparse-inheritance.md) | `troubleshoot` | `backend` | `verified` | Lỗi truyền tham số từ Node.js Fastify sang Python child process gây crash worker hoặc mất cờ chất lượng. |
| [`KI-FIX-014`](file:///docs/knowledge-base/KI-FIX-014-pdf-studio-thumbnail-pagination-lightbox-strict-filters.md) | [Phân Trang Thumbnail 4x2 Chống OOM, Lightbox Phóng To & Bộ Lọc File Khắt Khe Trong PDF Studio](file:///docs/knowledge-base/KI-FIX-014-pdf-studio-thumbnail-pagination-lightbox-strict-filters.md) | `troubleshoot` | `frontend` | `verified` | PDF nhiều trang gây tràn RAM canvas, khó xem chi tiết thumbnail, hoặc người dùng kéo nhầm định dạng file lạ vào tab PDF. |
| [`KI-FIX-015`](file:///docs/knowledge-base/KI-FIX-015-decoupling-background-tasks-spa-dom-lifecycle.md) | [Tách Rời Vòng Đời Tác Vụ Ngầm Khỏi Vòng Đời Hủy DOM Của Router SPA](file:///docs/knowledge-base/KI-FIX-015-decoupling-background-tasks-spa-dom-lifecycle.md) | `troubleshoot` | `frontend` | `verified` | Upload tệp nén hoặc xử lý bị hủy đột ngột khi chuyển tab; giải quyết bằng Singleton Manager và dọn dẹp non-destructive. |
| [`KI-FIX-016`](file:///docs/knowledge-base/KI-FIX-016-selective-dom-diffing-global-task-dock-flicker-prevention.md) | [Cơ Chế Selective In-Place DOM Diffing & Shallow-Diff Guard Triệt Tiêu Nhấp Nháy Tại GlobalTaskDock](file:///docs/knowledge-base/KI-FIX-016-selective-dom-diffing-global-task-dock-flicker-prevention.md) | `troubleshoot` | `frontend` | `verified` | Thanh dock tác vụ ngầm liên tục nhấp nháy, lặp animation mờ dần do xóa tạo lại innerHTML mỗi giây; giải quyết bằng In-Place Leaf Mutation. |
| [`KI-HOWTO-001`](file:///docs/knowledge-base/KI-HOWTO-001-studocu-downloader-docker-casaos-deployment.md) | [Deploying Studocu Downloader with Integrated Web PDF Viewer on CasaOS Docker](file:///docs/knowledge-base/KI-HOWTO-001-studocu-downloader-docker-casaos-deployment.md) | `how-to` | `devops` | `verified` | Hướng dẫn triển khai dịch vụ lên Docker / CasaOS, tích hợp trình đọc PDF.js trực tiếp trên trình duyệt, mount volume bền vững. |
| [`KI-HOWTO-002`](file:///docs/knowledge-base/KI-HOWTO-002-cloudflare-tunnel-docker-homeserver-https.md) | [Triển Khai Cloudflare Zero-Trust Tunnel Bằng Docker Cho Homeserver Để Cấp HTTPS Công Khai](file:///docs/knowledge-base/KI-HOWTO-002-cloudflare-tunnel-docker-homeserver-https.md) | `how-to` | `devops` | `verified` | Mở kết nối HTTPS công khai cho DD Studio từ Internet qua Cloudflare Tunnel không cần mở port modem hay cấu hình DDNS. |
| [`KI-HOWTO-003`](file:///docs/knowledge-base/KI-HOWTO-003-pwa-service-worker-cache-invalidation-mobile.md) | [Quy Trình Quản Lý & Làm Mới Cache Service Worker Cho Ứng Dụng PWA Trên Thiết Bị Di Động](file:///docs/knowledge-base/KI-HOWTO-003-pwa-service-worker-cache-invalidation-mobile.md) | `how-to` | `frontend` | `verified` | Thiết bị di động không cập nhật code mới sau khi deploy (Zombie Service Worker), hoặc lỗi cache miss các file modular sub-components. |

---

## 2. Bản đồ tương tác kiến trúc hệ thống (Architecture Knowledge Map)

```mermaid
graph TD
    UserPublic([Người dùng Internet / 4G]) -->|HTTPS Public| CF[Cloudflare Edge / Tunnel - KI-HOWTO-002]
    UserLAN([Người dùng LAN 192.168.2.x]) -->|Direct HTTP :3000 / HTTPS :3443| Gateway
    
    CF -->|Host Network localhost:3000| Gateway[Fastify Gateway :3000]
    
    subgraph DuyDev Studio Core (PWA Frontend)
        UI[Native Studio PWA UI - KI-CON-002]
        UI -->|Phong cách tối giản Vercel/Linear| CleanUI[Production Minimalism - KI-CON-001]
        UI -->|Thanh tác vụ ngầm nổi & Registry| MultiTask[Universal Multitasking - KI-CON-003]
        UI -->|Tách rời task khỏi DOM teardown| SafeLifecycle[Decoupled Lifecycle - KI-FIX-015]
        UI -->|DOM Diffing chống nhấp nháy dock| DockDiff[Selective Dock Mutation - KI-FIX-016]
        UI -->|Bắt phím tắt Ctrl+V không hỏi quyền| ClipHandler[Zero-Prompt Clipboard - KI-FIX-006]
        UI -->|Xem PDF trong iframe| Viewer[Universal File Viewer Core]
        UI -->|Phân trang 4x2 & Lightbox| PdfView[Paginated Thumbnails - KI-FIX-014]
        UI -->|Selective DOM Diffing chống giật lag| DiffEngine[O(1) Live Updates - KI-FIX-010]
        UI -->|Phòng ngừa lỗi ReferenceError| SafeRender[Safe Template & Smoke Tests - KI-FIX-011]
    end

    subgraph Fastify Gateway & Orchestrator
        Gateway -->|Phòng vệ phản hồi HTML lỗi 502/504| SafeFetch[safeFetchJson Defense - KI-FIX-009]
        Gateway -->|Cưỡng chế Content-Type application/pdf & inline| StreamProxy[PDF Stream Proxy - KI-FIX-005]
        Gateway -->|Proxy API| PyServer[Python Studocu Engine :8090]
        Gateway -->|Background Worker| BullMQ[BullMQ / Redis Queue]
    end

    subgraph Studocu Headless Extraction Engine
        PyServer -->|Duy trì session ấm| Chromium[Headless Chromium :9222]
        Chromium -->|Vượt rào Turnstile| Turnstile[Session Manager - KI-FIX-001]
        Turnstile -->|Dọn sạch session bẩn| AntiPaywall[Active Session Purge - KI-FIX-003]
        AntiPaywall -->|Bóc mờ & Hiển thị DOM| DeCloak[DOM De-cloaking - KI-FIX-002]
        DeCloak -->|Chụp cuốn chiếu chunk| ChunkCapture[Chunk Virtual Scroll - KI-FIX-004]
        ChunkCapture -->|CDP Page.printToPDF| OutPDF[(Thư mục Downloads PDF)]
    end

    OutPDF --> StreamProxy
    StreamProxy --> Viewer
```

---

## 3. Nguyên tắc bảo trì & cập nhật Knowledge Base

1. **Tính nguyên tử (Atomicity)**: Mỗi file KI chỉ giải quyết một vấn đề kỹ thuật hoặc quy trình duy nhất.
2. **Khả năng tìm kiếm (Findability)**: Luôn điền đầy đủ metadata Frontmatter (`trigger_conditions`, `search_queries`, `tags`).
3. **Tính thực thi (Actionability)**: Luôn có code mẫu đối chiếu thực tế, lệnh bash kiểm tra và tiêu chuẩn nghiệm thu rõ ràng.
4. **Quy trình cập nhật**: Khi codebase có thay đổi lớn, cập nhật trường `updated_at`, tăng `version` và ghi log vào mục `## Changelog`.
