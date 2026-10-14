# KI-CON-011: Kiến Trúc Định Danh Thiết Bị Ẩn Danh Không Cần Đăng Nhập (Zero-Login Device Identity), Phân Vùng Lịch Sử & Hợp Nhất Phiên Truy Cập Telemetry

## 1. Bối cảnh & Vấn đề Kỹ thuật (Problem Statement)
Hệ thống DuyDev Studio là một nền tảng Personal Utility Hub & File Processing Suite hoạt động không yêu cầu người dùng phải đăng nhập tài khoản khách (Zero-Login Public Access). Tuy nhiên, kiến trúc này đặt ra 4 thách thức kỹ thuật lớn:
1. **Lộ lọt dữ liệu & Xâm phạm riêng tư**: Toàn bộ lịch sử xử lý tệp (`#history`) và thùng rác (`#trash`) trước đây dùng chung trong SQLite. Khách A vào web có thể nhìn thấy, tải về hoặc xóa nhầm tệp của Khách B.
2. **Nhận diện sai lệch qua Cloudflare Tunnel**: Khi người dùng truy cập từ mạng gia đình qua domain công khai `studio.duydev.cloud`, toàn bộ request đều được định tuyến qua Cloudflare Edge WAN. Máy chủ nhận IP từ Cloudflare và không thể phân biệt đâu là máy tính của Chủ nhà (Owner) và đâu là khách vãng lai nếu chỉ dựa vào IP.
3. **Phân mảnh phiên truy cập (Session Fragmentation)**: Trong hệ thống theo dõi telemetry, khi một người dùng đổi tab, tải lại trang web hoặc mở ứng dụng TikTok trong vài giây rồi quay lại, hệ thống lại tạo ra một bản ghi "Đã rời web" mới toanh, khiến danh sách phiên bị nhân bản hàng chục thẻ rác cho cùng một thiết bị.
4. **Nhiễu thị giác trên giao diện Admin**: Địa chỉ IPv6 dài (39 ký tự) gây vỡ layout thẻ; danh sách phiên quá dài không scannable và thiếu khả năng quản lý theo từng thiết bị thực tế.

---

## 2. Giải pháp Kiến trúc (Architecture Pattern)

```mermaid
graph TD
    ClientApp[PWA Client App Bootstrap] --> DevIdUtil[deviceId.js: getDeviceId]
    DevIdUtil --> Storage[localStorage: ds_device_id + 10-Year Cookie]
    
    ClientApp --> FetchInterceptor[Global fetch Interceptor: X-Device-Id + X-Is-Admin]
    FetchInterceptor --> Fastify[Fastify Gateway :3000]
    
    subgraph Privacy Scoping
        Fastify --> HistCtrl[history.controller.ts: extractDeviceAndAdmin]
        HistCtrl -->|Non-Admin Request| ScopedWhere[where: deviceId == req.headers['x-device-id']]
        HistCtrl -->|Admin Request| AllWhere[where: All Records]
        ScopedWhere --> PrismaHist[(Prisma HistoryRecord: @@index deviceId, isDeleted)]
    end
    
    subgraph Anti-Fragmentation & Owner Attribution
        Fastify --> Telemetry[telemetry.middleware.ts: VisitorSessionManager]
        Telemetry --> ResumeGuard[5-Minute Resume Window: 300s]
        ResumeGuard -->|Tái kết nối <= 5m| MergeSession[Hợp nhất vào phiên hiện tại & deduplicate route]
        ResumeGuard -->|Tái kết nối > 5m| NewSession[Tạo phiên mới trong Device Profile]
        
        Telemetry --> OwnerDetect[Owner Attribution: LAN IP OR AdminAuth verified]
        OwnerDetect --> DevReg[(deviceRegistryService: server/data/device_registry.json)]
        DevReg --> PersistOwner[Ghi nhớ isOwner vĩnh viễn cả khi truy cập từ Cloudflare WAN]
    end
    
    subgraph Scannable Device-Centric Admin UI
        DevReg --> DeviceAPI[GET /api/v1/admin/traffic/devices]
        Telemetry --> DeviceAPI
        DeviceAPI --> AdminUI[AdminIpTrafficManager.js: 1 Card Per Device]
        AdminUI --> CompactIPv6[Compact IPv6 2402:9d80...9731 + 1-Click Copy]
        AdminUI --> Drawer[Collapsible Past Sessions Drawer]
        AdminUI --> RenameAction[Inline Alias Rename: PC của Duy / Xiaomi 15T Pro]
    end
```

---

## 3. Các Trụ Cột Triển Khai (Core Pillars)

### 3.1. Định Danh Thiết Bị 2 Lớp (Dual-Storage Client Device Identity)
- Tại `src/utilities/deviceId.js`: Khởi tạo định danh thiết bị ngẫu nhiên duy nhất `dev_<uuid4>` ngay khi web khởi chạy.
- Lưu trữ đồng thời trên `localStorage` và Cookie `ds_device_id` (với `max-age=315360000` - 10 năm) để bảo toàn định danh thiết bị ngay cả khi người dùng xóa bộ nhớ tạm web hoặc chạy trong chế độ PWA Standalone.
- Tại `src/app.js`: Tích hợp `setupGlobalApiFetchInterceptor()` bọc `window.fetch` toàn cục, tự động gắn `X-Device-Id` và cờ `X-Is-Admin` vào tất cả các yêu cầu `/api/v1/*`.

### 3.2. Phân Vùng Lịch Sử & Thùng Rác Riêng Biệt (Per-Device History Partitioning)
- Cập nhật Prisma Schema (`server/prisma/schema.prisma`): Bổ sung `deviceId String? @map("device_id")` kèm chỉ mục tối ưu `@@index([deviceId, isDeleted, createdAt])`.
- Trong `server/src/api/controllers/history.controller.ts`:
  - Hàm `extractDeviceAndAdmin(req)` bóc tách danh tính.
  - Người dùng khách chỉ xem, xóa và khôi phục các tệp có `deviceId` khớp với thiết bị của mình. Khách ẩn danh không có header sẽ nhận danh sách rỗng (ngăn chặn tuyệt đối việc rò rỉ dữ liệu của người khác).
  - Quản trị viên (`isAdmin === true`) được phép xem toàn bộ lịch sử hệ thống.

### 3.3. Hợp Nhất Phiên Chống Phân Mảnh & Ghi Nhớ Chủ Nhà (Anti-Fragmentation & Owner Persistence)
- Cửa sổ tái kết nối 5 phút (300 giây): Khi cùng một `deviceId` quay lại web trong vòng 5 phút (hoặc mở đồng thời nhiều tab), hệ thống tự động hợp nhất thời gian và chuyển trạng thái sang `ONLINE` thay vì tạo thẻ "Đã rời web" mới.
- Khử trùng lặp lộ trình: Khi người dùng tương tác trên cùng một trang (`#dashboard` ➔ `#dashboard`), danh sách `routeHistory` chỉ lưu một điểm duy nhất, triệt tiêu rác dữ liệu lộ trình.
- Ghi nhớ Chủ nhà (`deviceRegistryService`): Thiết bị truy cập từ LAN (`192.168.*`, `10.*`, `127.0.0.1`, `::1`) hoặc đã xác thực mật khẩu Admin sẽ được gắn nhãn `isOwner = true` và lưu bền vững vào `server/data/device_registry.json`. Khi thiết bị đó ra ngoài dùng mạng 4G/5G hoặc truy cập qua Cloudflare Tunnel WAN, hệ thống vẫn nhận diện chính xác là Chủ nhà `👑`.

### 3.4. Giao Diện Quản Trị Trung Tâm Hóa Theo Thiết Bị (Device-Centric Admin UI)
- `AdminIpTrafficManager.js`: Hiển thị chính xác **1 thẻ duy nhất cho mỗi thiết bị**, gom toàn bộ các lần truy cập trong quá khứ vào ngăn kéo thu gọn `▾ Lịch sử truy cập (N phiên trước)`.
- Định dạng IPv6 siêu gọn: Rút gọn `2402:9d80...9731` kèm tooltip hiển thị toàn bộ và nút 1-click sao chép.
- Phân loại bộ lọc chuẩn xác: Đếm đúng số lượng thiết bị duy nhất theo `Tất cả`, `🟢 Đang Online`, `👑 Chủ nhà`, `🏠 LAN`, `🌐 WAN`.
- Cho phép Admin đổi tên gợi nhớ (Alias), đánh dấu Chủ nhà và Chặn thiết bị ngay tại giao diện.

---

## 4. Quy Chuẩn Kiểm Thử & Xác Minh (Verification Standards)
- **Kiểm tra cú pháp JavaScript**: `rtk err node --check src/utilities/deviceId.js src/components/admin/AdminIpTrafficManager.js src/app.js` (Phải đạt mã thoát 0).
- **Kiểm tra kiểu TypeScript**: `cd server && rtk err npx tsc --noEmit` (0 lỗi).
- **Kiểm thử đơn vị tự động**: Chạy `rtk vitest run tests/unit/admin_visitor_sessions.test.ts` (100% test case kiểm tra gom phiên, deduplication route, và gán quyền owner đều vượt qua).
