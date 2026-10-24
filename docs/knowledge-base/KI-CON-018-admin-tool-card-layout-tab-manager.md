---
id: KI-CON-018
title: "Kiến Trúc Bố Cục Thẻ & Danh Mục Động Trong Admin Console (Dynamic Tool Card Layout & Tab Manager)"
type: concept
category: fullstack
status: verified
created_at: 2026-10-24
tags: [admin, tool-registry, layout, dashboard, tabs, categories, ordering, persistence]
---

# KI-CON-018: Kiến Trúc Bố Cục Thẻ & Danh Mục Động Trong Admin Console (Dynamic Tool Card Layout & Tab Manager)

## 1. Bối Cảnh & Vấn Đề (Context & Problem)
Trước phiên bản `v23.83`, toàn bộ danh mục (`category`) và thứ tự sắp xếp của các thẻ công cụ trên trang chủ DuyDev Studio được định nghĩa tĩnh (hardcoded) trong hằng số `DEFAULT_TOOLS` tại [`src/hooks/useToolRegistry.js`](file:///src/hooks/useToolRegistry.js). Mọi thay đổi về vị trí hoặc việc di chuyển một công cụ giữa các tab (ví dụ: chuyển `ViewSplit` từ Tiện ích sang Nâng cao) đòi hỏi lập trình viên phải sửa code và deploy lại toàn bộ dự án.

Quản trị viên cần một bảng điều khiển trực quan trong Admin Console (`#admin`) cho phép:
1. Tự do thay đổi công cụ nào thuộc về tab nào (ví dụ: `pdf`, `convert`, `archive`, `qr`, `system`, `advanced`).
2. Tự do thay đổi thứ tự ưu tiên hiển thị (ranking / order index) của từng thẻ.
3. Đồng bộ hóa tức thì và lưu trữ bền vững trên máy chủ (`server/data/tool_layout_config.json`) để toàn bộ người dùng và thiết bị khách truy cập đều nhận được bố cục mới mà không làm mất trạng thái offline của PWA.

---

## 2. Kiến Trúc Giải Pháp (Architectural Solution)

Hệ thống được thiết kế theo mô hình 4 tầng thống nhất:

```
┌───────────────────────────────────────────────────────────┐
│               Admin Console (#admin)                      │
│       Tab 3: Quản Lý Thẻ & Tab (AdminToolCardManager)     │
│  - Bộ lọc danh mục & Tìm kiếm tức thì                     │
│  - Dropdown chọn Tab (pdf, convert, archive, qr, etc.)    │
│  - Nút di chuyển lên/xuống (Move Up / Move Down)          │
│  - Xem trước trực quan (Visual Tab Preview)               │
└─────────────────────────────┬─────────────────────────────┘
                              │ PUT /api/v1/admin/tool-layout
                              │ (x-storage-auth)
                              ▼
┌───────────────────────────────────────────────────────────┐
│           Fastify Gateway & ToolLayoutService             │
│  - Lưu cấu hình nguyên tử: server/data/tool_layout_config.json│
│  - Chuẩn hóa thứ tự tuần tự: 1, 2, 3...                   │
│  - Tự động gộp công cụ mặc định (Zero-Tool Loss Guarantee)│
│  - Public Endpoint: GET /api/v1/system/tool-layout        │
└─────────────────────────────┬─────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌───────────────────────────────┐ ┌─────────────────────────┐
│      Client ToolRegistry      │ │   DashboardPage (SPA)   │
│  - Khởi tạo 0ms từ localStorage│ │  - Bộ lọc tabs Category │
│  - Background Sync ngầm       │ │  - Lưới thẻ tool-card   │
│  - Phản ứng thông qua notify()│ │  - Nhãn đếm tự động     │
└───────────────────────────────┘ └─────────────────────────┘
```

### 2.1. Bảo Đảm Không Mất Thẻ (Zero-Tool Loss Guarantee)
Khi lưu trữ hoặc nạp cấu hình tùy biến, `ToolLayoutService` thực hiện thuật toán hợp nhất hai chiều (two-way merge):
- Duyệt qua toàn bộ danh sách `DEFAULT_TOOL_LAYOUT`.
- Nếu có bất kỳ công cụ mới nào được bổ sung trong mã nguồn mà chưa có trong file cấu hình JSON trên máy chủ, công cụ đó sẽ được tự động gắn vào cuối danh sách với danh mục mặc định của nó.
- Đảm bảo tuyệt đối không bao giờ bị biến mất công cụ do cấu hình cũ lưu đè.

### 2.2. Khởi Động Liền Mạch PWA (0ms Instant Hydration)
- `ToolRegistry` nạp cấu hình ghi đè từ `localStorage.getItem('ds_tool_layout_override')` ngay trong constructor synchronous, đảm bảo render tức thì khớp 100% với lần tải trước.
- Khi có kết nối mạng, một tiến trình ngầm gọi `GET /api/v1/system/tool-layout` sau 120ms để nhận các thay đổi mới nhất từ Admin và tự động cập nhật lại giao diện bằng `toolRegistry.notify()`.

---

## 3. Các Thành Phần & Điểm Chạm (Touched Components)

| Tệp / Mô-đun | Trách Nhiệm Chính |
|---|---|
| `server/src/services/tool-layout.service.ts` | Dịch vụ đọc, ghi nguyên tử và reset cấu hình bố cục tại `server/data/tool_layout_config.json`. |
| `server/src/api/controllers/tool-layout.controller.ts` | Trình điều khiển xác thực Zod schema và xử lý các yêu cầu HTTP quản trị và công khai. |
| `server/src/api/routes/admin.route.ts` | Đăng ký các route bảo vệ: `GET/PUT /api/v1/admin/tool-layout`, `POST /api/v1/admin/tool-layout/reset`. |
| `server/src/api/routes/system.route.ts` | Đăng ký route công khai: `GET /api/v1/system/tool-layout`. |
| `src/hooks/useToolRegistry.js` | Mở rộng `ToolRegistry` với cơ chế `loadLocalLayout()`, `fetchServerLayout()`, `applyLayoutSync()`, và các API quản trị. |
| `src/components/admin/AdminToolCardManager.js` | Giao diện đồ họa Tab Quản lý thẻ: lọc tab con, tìm kiếm, đổi dropdown danh mục, đảo vị trí thẻ, lưu và reset. |
| `src/pages/AdminPage.js` | Bổ sung nút Tab thứ 3 trên thanh điều hướng top và container `#adminToolManagerViewContainer`. |
| `server/tests/unit/tool_layout.test.ts` | Bộ kiểm thử tự động 8 kịch bản bao phủ trọn vẹn tầng service, controller, route bảo vệ và tính toàn vẹn frontend. |

---

## 4. Kiểm Thử & Xác Nhận (Verification)
- Đạt 100% test cases trong `server/tests/unit/tool_layout.test.ts` (Exit 0).
- Không ảnh hưởng đến các kịch bản kiểm thử hồi quy `pwa_lifecycle.test.ts`, `tool_registry_categories.test.ts`, `viewsplit.test.ts`.
- Giao diện tuân thủ tuyệt đối chuẩn thiết kế tối giản Vercel/Linear và Impeccable UI tokens.
