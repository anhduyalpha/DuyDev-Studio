---
id: KI-CON-002-native-zero-iframe-tool-module-integration
title: "Native Zero-Iframe Tool Module Integration Architecture & Cohesive Modularity"
type: concept
status: verified
domain: frontend
tags: [architecture, modularity, zero-iframe, anti-monolith, thinking-orbs, terminal-logs, single-responsibility]
created_at: 2026-09-22
updated_at: 2026-09-24
version: 1.1.0
owner: "@anhduy"
trigger_conditions: "Integrating external or standalone web utilities into DuyDev Studio without using `<iframe>` embeds while respecting Single Responsibility & Cohesive Modularity."
search_queries:
  - "Kiến trúc tích hợp module Zero-Iframe DuyDev Studio"
  - "Single Responsibility and cohesive modularity refactoring"
  - "Native module integration vs iframe embed"
  - "Tách nhỏ component phức tạp thành sub-modules"
  - "BorderBeam và Thinking Orbs trong module Studio"
related_kis:
  - KI-CON-001-ui-production-minimalism
  - KI-FIX-005-studocu-pdf-inline-preview-mime-disposition
---

# [KI-CON-002] Kiến Trúc Tích Hợp Mô-Đun Thuần Native (Zero-Iframe) & Tính Mô-Đun Gắn Kết (Cohesive Modularity)

## 1. Context & Purpose
Trước đây, nhiều công cụ tiện ích ngoại vi (như Studocu Downloader, Archive Viewer, Converter) thường được phát triển dưới dạng các Web App độc lập. Khi đưa vào **DuyDev Studio**, phương án thô sơ nhất là nhúng qua thẻ `<iframe src="http://localhost:8090">`.

Tuy nhiên, cách tiếp cận bằng `<iframe>` tạo ra vô số khiếm khuyết nghiêm trọng:
- **Phá vỡ trải nghiệm thống nhất (UI Fracture)**: Sai lệch theme (Dark/Light mode), font chữ không đồng bộ (`Geist` / `JetBrains Mono`).
- **Rào cản Clipboard & Bảo mật**: Trình duyệt áp đặt chính sách sandbox nghiêm ngặt lên iframe, chặn việc đọc clipboard tự động và phân mảnh cookie/session.
- **Xung đột Modal & Z-Index**: Hộp thoại xem trước hoặc xác nhận bị co cụm bên trong khung viền iframe thay vì phủ toàn màn hình.

Tài liệu này định hình quy chuẩn kiến trúc **Native Zero-Iframe Tool Integration**: Chuyển đổi toàn bộ giao diện và logic thành các thành phần DOM thuần của Studio, đồng thời phân rã module theo nguyên tắc đơn trách nhiệm (**Single Responsibility Principle**), tách bạch rõ ràng giữa Presentation, State/Logic và Data I/O.

---

## 2. Decomposition Architecture (Mô Hình Phân Rã Đơn Trách Nhiệm)

Thay vì viết một file component khổng lồ hàng nghìn dòng (Monolithic View), toàn bộ mô-đun được cấu trúc thành các hạt nguyên tử (Atomic Components) theo cây thư mục:

```
src/components/tools/studocu/
├── StudocuWorkspace.js          # (~240 dòng) Vỏ bọc Orchestrator, Breadcrumb & Event Bus
├── hooks/
│   └── useStudocu.js            # (~240 dòng) Central State, SSE/Polling & REST API Client
└── components/
    ├── HeroPasteCard.js         # (~90 dòng) Thẻ dán link, BorderBeam animation & Thinking Orbs
    ├── LiveTerminalCard.js      # (~110 dòng) Terminal log trực tiếp, auto-scroll & nút Hủy tiến trình
    ├── DocumentListCard.js      # (~120 dòng) Quản lý tab PDF & Thùng rác, tìm kiếm & sắp xếp
    ├── DocumentItem.js          # (~110 dòng) Hàng tài liệu, badge metadata & các nút Xem/Tab/Tải/Xóa
    └── SlideConfirmModal.js     # (~90 dòng) Modal trượt xác nhận (Slide-to-Confirm) khi xóa thùng rác
```

### 1. Thẻ Nhập Liệu & Hiệu Ứng Trực Quan (`HeroPasteCard.js`)
- Kích thước: ~90 dòng.
- Nhiệm vụ:
  - Render vùng nhập liệu cao cấp với đường viền chuyển động quang học (`BorderBeam`).
  - Tích hợp canvas **Thinking Orbs** ba trạng thái (`idle`, `working`, `success`), phản ánh trực quan trạng thái cào dữ liệu mà không cần phụ thuộc vào gif hay animation cồng kềnh.

### 2. Trình Theo Dõi Tiến Độ Thời Gian Thực (`LiveTerminalCard.js`)
- Kích thước: ~110 dòng.
- Nhiệm vụ:
  - Hiển thị cửa sổ Terminal Obsidian mô phỏng giao diện lập trình viên.
  - Tự động cuộn (`screenEl.scrollTop = screenEl.scrollHeight`) theo log mới nhất.
  - Nút **[ ⓧ Hủy tiến trình tải ]** nằm ngay bên dưới để ngắt kết nối an toàn khi người dùng đổi ý.

### 3. Danh Sách & Bộ Lọc Tinh Giản (`DocumentListCard.js` & `DocumentItem.js`)
- Tuân thủ [KI-CON-001]: Loại bỏ triệt để các tab dư thừa như tab *"Tất cả"* hoặc *"Markdown"* khi dự án chỉ tập trung vào PDF.
- Danh sách tài liệu chỉ giữ lại 2 tab thực chất: **PDF** và **Thùng rác**.
- Nút **Xem**: Gọi trực tiếp Universal File Viewer Core (`ViewerConnector.preview`).
- Nút **Tab**: Mở trực tiếp stream trên tab mới.
- Nút **Tải**: Tải file về máy tính.
- Nút **Xóa 1 file**: Thực thi ngay lập tức vào thùng rác, **không hiện popup hỏi phiền hà**.

### 4. Hộp Thoại Trượt Xác Nhận An Toàn (`SlideConfirmModal.js`)
- Kích thước: ~90 dòng.
- Đối với hành động hủy diệt hàng loạt như **Xóa tất cả thùng rác**, thay vì dùng `window.confirm()` thô thiển hoặc popup đơn giản dễ bấm nhầm, áp dụng thanh trượt cử chỉ **"Kéo để xác nhận xóa vĩnh viễn"** (Slide to Confirm) tạo cảm giác an toàn và cao cấp.

### 5. Hook Điều Phối Trạng Thái Tập Trung (`useStudocu.js`)
- Kích thước: ~240 dòng.
- Triển khai mô hình **Singleton Store**:
  - Quản lý `isDownloading`, `progress`, `stepLabel`, `logs`, `files`, `trash`.
  - Hỗ trợ cơ chế pub/sub nhẹ (`subscribe`, `notify`) giúp UI tự động đồng bộ mà không cần cài đặt các thư viện cồng kềnh như Redux hay Zustand.

---

## 3. Anti-Patterns Cần Tránh Khi Tích Hợp

| ❌ Cách Làm Bị Cấm | Lý Do Kỹ Thuật | ✅ Chuẩn Native DuyDev Studio |
| :--- | :--- | :--- |
| **Nhúng qua `<iframe>`** | Bị cô lập style, lỗi CORS clipboard, modal xem trước bị kẹt bên trong iframe. | Tách nhỏ thành sub-components thuần DOM nhúng trực tiếp vào app mount. |
| **Một file chứa toàn bộ UI + API ("God Component")** | Vi phạm Single Responsibility, khó kiểm thử, rò rỉ tài nguyên khi unmount. | Tách thành `hooks/` quản lý state và `components/` chuyên biệt. |
| **Nén code hoặc bẻ vụn code khiên cưỡng (Code Golfing)** | Làm mờ ranh giới module, tăng độ phức tạp nhận thức và khó debug. | Giữ cấu trúc mạch lạc, tự nhiên theo trách nhiệm domain. |
| **Hộp thoại xác nhận cho mọi thao tác** | Làm gián đoạn trải nghiệm (Micro-interruption). | Xóa 1 file cho chạy ngay; Chỉ dùng Slide-to-confirm cho hành vi xóa sạch thùng rác. |
| **Tabs bộ lọc không cần thiết** | Gây rối mắt và loãng thông tin khi chỉ có 1 định dạng duy nhất. | Tinh giản chỉ giữ lại các tab có dữ liệu thực tế (PDF, Thùng rác). |

---

## 4. Verification Checklist (Tiêu Chí Nghiệm Thu Mô-Đun)

Mọi mô-đun mới khi đưa vào hệ thống phải vượt qua checklist sau:
- [ ] Tuân thủ nguyên tắc Single Responsibility & Cohesive Modularity (tách bạch rõ ràng UI layout, Hooks logic và Data services).
- [ ] Dọn dẹp đầy đủ tài nguyên bất đồng bộ (giải phóng EventSource, Observers, Timers, ObjectURLs) khi unmount.
- [ ] Không sử dụng bất kỳ thẻ `<iframe>` nào để bọc ứng dụng chính (trừ iframe nhúng tài liệu của File Viewer Core).
- [ ] Tích hợp đầy đủ phím tắt bàn phím toàn cục (ví dụ: `Ctrl + V`).
- [ ] Kiểm tra TypeScript backend biên dịch đạt 0 lỗi: `cd server && npx tsc --noEmit`.
- [ ] Toàn bộ bộ test tự động vượt qua: `cd server && npx vitest run`.

---

## 5. Changelog
- **2026-09-24 (v1.1.0)**: Bãi bỏ quy tắc giới hạn dòng cơ học (250 dòng), cập nhật chuẩn Single Responsibility, Cohesive Modularity và Defensive Resource Safety (@anhduy).
- **2026-09-22 (v1.0.0)**: Ban hành kiến trúc tích hợp Native Zero-Iframe (@anhduy).
