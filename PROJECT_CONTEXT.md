# DuyDev Studio (DS) - Project Architecture & Technical Context

> **Tài liệu tổng quan dự án (Living Context Document)**  
> Dành cho: Các nhà phát triển (Human Developers), Cộng tác viên và các Tác nhân AI (AI Coding Agents).  
> Phiên bản: `2.0.0` | Cập nhật gần nhất: `2026-09-21`

---

## 1. Context & Bối Cảnh Dự Án

### 1.1. Dự án sinh ra để làm gì?
Trong quá trình làm việc hàng ngày, người dùng thường xuyên phải xử lý các tác vụ tệp tin cơ bản: nén/đổi định dạng PDF, chuyển đổi video/âm thanh, tạo mã VietQR/Wi-Fi, xem nội dung file nén lớn mà không muốn giải nén ra ổ cứng, hoặc chuyển đổi tài liệu văn bản.

Hầu hết các công cụ trực tuyến hiện nay (Smallpdf, CloudConvert, TinyPNG, ilovepdf...) đều tồn tại nhiều bất cập:
- **Giới hạn số lượng & dung lượng tệp** (yêu cầu trả phí hàng tháng).
- **Rủi ro rò rỉ dữ liệu & quyền riêng tư** (tải tệp nội bộ lên máy chủ của bên thứ ba).
- **Trải nghiệm người dùng tệ** (quảng cáo tràn ngập, hàng đợi chờ đợi lâu, captcha).

**DuyDev Studio (DS)** là một **Trung tâm Tiện ích Đa năng Tự Lưu Trữ (Personal Self-Hosted Utility Hub)** được thiết kế để chạy hoàn toàn trên máy cục bộ (Localhost), máy chủ gia đình (**Homeserver LAN: `192.168.2.171`**) hoặc qua Cloudflare Tunnel (**`studio.duydev.cloud`**). Dự án giải phóng hoàn toàn các giới hạn dung lượng, thắt cổ chai mạng, và đảm bảo 100% quyền riêng tư với tốc độ xử lý phần cứng tối đa.

### 1.2. Triết lý thiết kế cốt lõi
1. **Self-Hosted & Zero-Throttling (Không giới hạn)**: Loại bỏ toàn bộ cơ chế Rate-limit, dung lượng tệp hỗ trợ lên tới 50GB+, tối ưu hóa cho mạng nội bộ cá nhân.
2. **Offline-First Progressive Web App (PWA)**: Có thể cài đặt trực tiếp vào màn hình chính của điện thoại hoặc máy tính, hoạt động độc lập như một Native App với giao diện xúc giác (Tactile Mobile Dock).
3. **Deep Tech Utility (Google Stitch Design)**: Phong cách tối giản kỹ thuật chuyên sâu (Dark Canvas `#0B0F17`, surfaces `#121215`, điểm nhấn Electric Indigo `#6366F1` & High-Tech Cyan `#06B6D4`, phông chữ `Geist` và `JetBrains Mono`). Tuyệt đối **không dùng câu từ quảng cáo hay chú thích hướng dẫn thừa**.
4. **Polyglot Micro-Engine Platform (Đa ngôn ngữ)**: Không ép toàn bộ tác vụ nặng vào Node.js. Sử dụng ngôn ngữ và engine mạnh nhất cho từng loại công việc (Node.js cho I/O & Gateway; Python, FFmpeg, LibreOffice, Poppler cho xử lý tệp nhị phân).
5. **Anti-Monolith & High Modularity**: Không viết các tệp code khổng lồ. Mọi thành phần UI được phân rã thành các sub-components dưới 200 dòng, tách biệt trạng thái (State/Hooks) và giao diện.

---

## 2. Các Phân Hệ & Module Chức Năng (What Project Does)

Hệ thống được tổ chức thành 6 phân hệ công cụ chính:

```
+--------------------------------------------------------------------------------------------------+
|                                    DUYDEV STUDIO UTILITY HUB                                     |
+-------------------+-------------------+--------------------+------------------+------------------+
|    PDF Studio     |  Archive Inspector|  Dynamic QR Studio |Universal Convert | Hash & Telemetry |
+-------------------+-------------------+--------------------+------------------+------------------+
| - Nén & Đổi PDF   | - Duyệt Tree trực | - QR Động ngắn gọn | - 65+ định dạng  | - MD5, SHA-256   |
| - Ghép & Tách PDF |   tiếp (Zero Ext) | - Short URL (/q/..) |   (Ảnh, Video,   | - Mã hóa Base64  |
| - Khóa / Mở khóa  | - Tải lẻ 1 file   | - Analytics lượt   |    Audio, Docx,  | - Telemetry HUD  |
| - Python PyMuPDF  | - Chống Zip Slip  |   quét thời gian   |    PDF, E-Book)  |   CPU, RAM, Disk |
| - OCR tiếng Việt  | - Hỗ trợ RAR5, 7Z | - VietQR, Wi-Fi    | - FFmpeg CLI     |   theo thời gian |
| - LibreOffice CLI |   ZIP không tốn đĩa| - vCard 3.0 danh bạ| - LibreOffice    |   thực           |
+-------------------+-------------------+--------------------+------------------+------------------+
```

### 2.1. Phân hệ PDF (PDF Studio)
- **Tính năng**: Nén PDF không vỡ nét, chuyển đổi PDF sang Word (.docx), hình ảnh PNG/JPG, ghép nối nhiều file và tách trang lẻ.
- **Engine phía sau**:
  - `pdf-lib`: Thao tác trực tiếp trên vector PDF ở tầng Node.js.
  - `engines/document/`: Tích hợp Python `PyMuPDF` (fitz) và `pdf2docx` cho khả năng chuyển đổi ngược PDF -> DOCX với độ chính xác bảng biểu cao nhất.
  - `LibreOffice Headless`: Chuyển đổi DOCX/PPTX/XLSX sang PDF giữ nguyên 100% định dạng Microsoft Office.

### 2.2. Trình Xem File Nén Trực Tuyến (Archive Inspector)
- **Tính năng**: Duyệt cây thư mục và cấu trúc file bên trong tệp `.zip`, `.rar` (RAR5), `.7z` trực tiếp trên trình duyệt mà **không cần giải nén ra ổ cứng**.
- **Cơ chế**: Seek trực tiếp vào Central Directory header của archive. Khi người dùng bấm "Tải lẻ", hệ thống chỉ giải nén duy nhất byte-range của file đó và stream thẳng về client (`Content-Disposition: attachment`). Có cơ chế chặn tấn công Path Traversal / Zip Slip (`..`).

### 2.3. Studio Mã QR Động & VietQR (Dynamic QR Studio)
- **Vấn đề giải quyết**: Mã QR chứa dữ liệu dài (URL dài, vCard nhiều thông tin) thường có ma trận dày đặc (Version 10+), rất khó quét từ xa và không thể đổi link sau khi in.
- **Giải pháp**:
  - **Dynamic Short URL**: Hệ thống cấp link rút gọn siêu ngắn dạng `http://<host>/q/:slug`. Ma trận QR luôn ở mức Version 2-3 (ma trận thưa, ô pixel to, quét cực nhạy). Khi người dùng quét mã, server tự động tăng biến đếm `scanCount` trong SQLite và chuyển hướng HTTP 302 về URL đích.
  - **Khả năng đổi link sau in**: Người dùng có thể cập nhật link đích bất cứ lúc nào mà không cần in lại mã QR.
  - **Customization Studio**: Tùy chỉnh kiểu dáng điểm ảnh (`rounded`, `dots`, `classy`), màu sắc Gradient, nhúng Logo thương hiệu ở giữa với cấp độ sửa lỗi tự động khóa mức `H` (30% error recovery) thông qua `qr-code-styling`.
  - **Tiện ích tích hợp**: Tạo mã VietQR thanh toán chuẩn EMVCo (NAPAS 247, tự sinh CRC16-CCITT), Wi-Fi một chạm, danh bạ vCard 3.0, và công cụ quét ảnh QR (hỗ trợ giải mã cả phía client lẫn endpoint backend `POST /api/v1/qr/decode`).

### 2.4. File Converter Pro (Universal Converter)
- **Tính năng**: Hỗ trợ chuyển đổi qua lại giữa hơn 65+ định dạng:
  - *Hình ảnh*: WebP, AVIF, PNG, JPG, ICO, SVG, TIFF, BMP, HEIC.
  - *Video & Âm thanh*: MP4, WebM, MKV, AVI, GIF, MP3, WAV, AAC, FLAC.
  - *Văn bản & Bảng tính*: DOCX, PPTX, XLSX, PDF, Markdown, HTML, TXT, CSV.
  - *Sách điện tử*: EPUB, MOBI, AZW3, PDF.
- **Mã nguồn cốt lõi**: Tận dụng mã nguồn Python được bóc tách từ 2 repo mã nguồn mở lớn (`fastapi_app` và `file_conversor_core`) đặt tại `engines/converter/`, vận hành qua cầu nối CLI `convert_cli.py`.

### 2.5. Tiện Ích Băm & Trắc Lượng Hệ Thống (System Telemetry & Hash)
- Tính toán mã băm SHA-256, MD5, SHA-512 trực tiếp bằng Web Crypto / Node Streams.
- Giám sát thông số phần cứng homeserver (CPU usage, RAM usage, Dung lượng ổ cứng trống) hiển thị thời gian thực trên thanh HUD.

---

## 3. Kiến Trúc Kỹ Thuật Tổng Thể (System Architecture)

Dự án áp dụng mô hình kiến trúc **Polyglot Asynchronous Orchestration**:

```
[ CLIENT TIER ]
   DuyDev Studio PWA (Vanilla ES Modules + Tailwind CSS + Lucide Icons + Stitch Design Tokens)
   - Lưu trữ trạng thái PersistentStore (localStorage + IndexedDB draft files)
   - Kết nối Server-Sent Events (SSE) theo dõi tiến độ xử lý thời gian thực
                                    │
                         HTTP / REST │ Server-Sent Events (SSE)
                                    ▼
[ GATEWAY & INGRESS TIER ]
   Fastify v4.x (Node.js 22+ / TypeScript, Strict Mode)
   - Streaming Multipart Uploader (@fastify/multipart) -> Ghi thẳng xuống đĩa, không đè RAM
   - Zod Validation Schemas (Kiểm soát hợp đồng dữ liệu vào/ra)
   - SQLite WAL Mode (Prisma ORM) -> Quản lý Users, Jobs, FileRecords, DynamicQrs, QrScanLogs
   - Global Pino Structured Logger (Có bảo mật Redaction token/path nhạy cảm)
   - Unified Error Handling (AppError -> JSON chuẩn hóa)
                                    │
               Enqueue Job Requests │ Redis Pub/Sub Events
                                    ▼
[ WORKER & TASK BROKER TIER ]
   BullMQ v5.x + Redis 7.2
   - Quản lý hàng đợi tác vụ nặng: 'converter-tasks', 'pdf-tasks', 'ocr-tasks'
   - Phân phối việc tới các Isolated Workers
                                    │
                  Dispatches CLI/IPC│ Streams stdout progress ticks
                                    ▼
[ POLYGLOT ENGINE TIER (Native CLIs & Python Scripts) ]
   ├── engines/converter/convert_cli.py  -> Điều phối chuyển đổi 65+ format (Pillow, MoviePy, pdf2docx)
   ├── engines/document/pdf_engine.py    -> PyMuPDF (fitz) xử lý PDF hiệu năng cao
   ├── LibreOffice Headless (soffice)     -> Chuyển đổi DOCX/PPTX/XLSX sang PDF chuẩn xác
   ├── FFmpeg & ffprobe Native CLI       -> Chuyển đổi, nén video/audio với GPU/CPU đa luồng
   └── Tesseract OCR Native CLI          -> Nhận diện ký tự quang học Tiếng Việt (vie) & Anh (eng)
                                    │
               Reads / Writes Files │ Unlinks expired files (TTL 30m)
                                    ▼
[ STORAGE & PERSISTENCE TIER ]
   Local Filesystem (/data/storage)
   ├── /uploads/       (Tệp người dùng tải lên)
   ├── /processed/     (Tệp kết quả sau chuyển đổi)
   └── /temp/          (Tệp nháp trong quá trình xử lý)
   Janitor Daemon (Chạy ngầm mỗi 15 phút, tự động dọn sạch file hết hạn và cập nhật SQLite)
```

---

## 4. Cấu Trúc Thư Mục Chi Tiết (Codebase Directory Layout)

```text
DD Studio/
├── index.html                   # Entry point PWA, nạp Tailwind CDN, Lucide, fonts và src/app.js
├── manifest.webmanifest         # Cấu hình PWA độc lập (standalone, icons, theme-color #09090B)
├── sw.js                        # Service Worker (quản lý offline cache và cập nhật app)
├── package.json                 # Cấu hình root
├── server.cjs                   # Máy chủ tĩnh Node.js phục vụ PWA khi dev cục bộ
├── AGENTS.md                    # Hướng dẫn và quy tắc riêng cho các AI Coding Agents
├── PROJECT_CONTEXT.md           # Tài liệu bối cảnh và kiến trúc tổng quan (File này)
│
├── .agents/                     # Cấu hình riêng cho AI Agents
│   └── rules/
│       └── ui-standards.md      # Quy chuẩn cấm chú thích thừa, tuân thủ UI minimalism
│
├── docs/                        # Tài liệu kỹ thuật chi tiết
│   ├── BACKEND_SPEC.md          # Đặc tả API, Schemas, Database, Error codes (Version 1.0.0)
│   └── knowledge-base/          # Cơ sở tri thức chuẩn hóa (Knowledge Items)
│       └── KI-CON-001-ui-production-minimalism.md
│
├── src/                         # TẦNG FRONTEND PWA (Native ES Modules)
│   ├── app.js                   # Application Bootstrapper & Hash-based Router
│   ├── assets/                  # Icons vector (icon-192.svg, icon-512.svg, logo-ds.svg)
│   ├── styles/
│   │   └── stitch-tokens.css    # Biến màu sắc Dark Minimalism (Google Stitch)
│   ├── utilities/               # Tiện ích dùng chung
│   │   ├── formatters.js        # Định dạng byte (KB/MB/GB), thời gian tương đối
│   │   ├── storage.js           # Quản lý LocalStorage
│   │   ├── persistentStore.js   # Bộ quản lý State tự động lưu chống reload
│   │   ├── pwa.js               # Đăng ký Service Worker
│   │   └── toast.js             # Thông báo Toast notification
│   ├── hooks/                   # Reactive state & logic hooks
│   │   ├── useTheme.js          # Dark/Light theme toggle
│   │   ├── usePWAInstall.js     # Bắt sự kiện cài đặt PWA
│   │   └── useToolRegistry.js   # Quản lý danh mục và tìm kiếm công cụ
│   ├── components/
│   │   ├── layout/              # Header.js, BottomNav.js, Footer.js
│   │   ├── dashboard/           # CategoryFilters.js, ToolCard.js, RecentActivity.js
│   │   ├── common/              # Badge.js, Dropzone.js
│   │   └── tools/               # CÁC CÔNG CỤ ĐÃ ĐƯỢC MODULAR HÓA (< 200 dòng/file)
│   │       ├── qr/              # Phân hệ QR Studio
│   │       │   ├── QrStudio.js           # Shell & Tab controller
│   │       │   ├── QrFormVietQr.js       # Form VietQR ngân hàng EMVCo
│   │       │   ├── QrFormWifi.js         # Form Wi-Fi một chạm
│   │       │   ├── QrFormDynamic.js      # Form QR động rút gọn URL
│   │       │   ├── QrFormVCard.js        # Form danh bạ vCard 3.0
│   │       │   ├── QrStylePanel.js       # Tùy biến chấm tròn, màu sắc, logo
│   │       │   └── QrPreviewCard.js      # Xem trước, tải SVG/PNG, copy ảnh
│   │       ├── pdf/             # Phân hệ PDF Workspace
│   │       ├── archive/         # Phân hệ xem file nén trực tuyến
│   │       ├── converter/       # Phân hệ chuyển đổi đa định dạng
│   │       ├── hash/            # Tiện ích kiểm tra mã băm
│   │       └── image/           # Chuyển đổi nhanh ảnh đơn giản
│   └── pages/                   # Các trang view chính (DashboardPage, ToolPage, HistoryPage, ServerPage)
│
├── server/                      # TẦNG BACKEND GATEWAY (Fastify v4 + TypeScript)
│   ├── package.json             # Fastify, Prisma, BullMQ, ioredis, Zod, Sharp, Vitest
│   ├── tsconfig.json            # NodeNext ESM strict configuration
│   ├── .env.example             # Biến môi trường mẫu
│   ├── .env                     # Biến môi trường máy chủ
│   ├── dev.db                   # SQLite Database (WAL Mode)
│   ├── prisma/
│   │   └── schema.prisma        # Models: User, Job, FileRecord, SystemMetric, DynamicQr, QrScanLog
│   ├── src/
│   │   ├── app.ts               # Khởi chạy Fastify, CORS, Multipart, Global Error Handler
│   │   ├── config/              # env.config.ts, limits.config.ts
│   │   ├── lib/                 # prisma.ts (WAL Pragmas), logger.ts (Pino), errors.ts (AppError)
│   │   ├── types/               # Domain interfaces, DTOs, SSE event contracts
│   │   ├── schemas/             # Zod validation schemas (jobs, files, qr, dynamic-qr, archive)
│   │   ├── storage/             # storage.manager.ts (Path resolver, SHA-256, Path Traversal Guard)
│   │   ├── queues/              # task.queue.ts (BullMQ queue pool & Redis connection)
│   │   ├── workers/             # Task consumers (converter.worker.ts, pdf.worker.ts)
│   │   ├── services/            # Business services (dynamic-qr, qr, archive, janitor)
│   │   └── api/
│   │       ├── controllers/     # Request handlers
│   │       └── routes/          # files, jobs, archive, qr, dynamic-qr, converter, history
│   └── tests/                   # Unit & Integration tests (Vitest)
│
├── engines/                     # TẦNG ENGINE NĂNG LƯỢNG XỬ LÝ (Polyglot Tools)
│   ├── converter/               # Bộ máy chuyển đổi 65+ định dạng
│   │   ├── convert_cli.py       # Cầu nối CLI trung tâm gọi các converter
│   │   ├── fastapi_app/         # Mã nguồn bóc tách từ universal-file-converter
│   │   │   ├── converters/      # images.py, video.py, docs.py, docx_converter.py, pdf.py, pptx_converter.py, archive.py
│   │   │   └── requirements.txt # Thư viện Python cho converter
│   │   └── file_conversor_core/ # Mã nguồn bóc tách từ file_conversor
│   │       ├── ffmpeg_backend.py
│   │       ├── libreoffice_backend.py
│   │       ├── pdf2docx_backend.py
│   │       └── pymupdf_backend.py
│   ├── document/                # Các script Python xử lý PDF chuyên sâu
│   └── media/                   # Cấu hình và profile FFmpeg
│
└── scripts/
    └── setup_homeserver_engines.sh # Script tự động cài đặt FFmpeg, LibreOffice, Poppler, Redis, 7zip lên homeserver
```

---

## 5. Tiến Độ Hiện Tại & Lộ Trình Phát Triển (Current Status & Roadmap)

### 5.1. Những việc đã hoàn thành (Done & Verified)
- [x] **Frontend Shell**: Xây dựng hoàn chỉnh khung PWA theo phong cách Stitch Deep Tech Utility, Bottom Navigation Bar cho di động, dark mode, cài đặt Service Worker.
- [x] **Refactor Modular Architecture**: Phân rã triệt để các file code nguyên khối lớn (`QrStudio.js`, `PdfConverter.js`) thành các sub-components độc lập dưới 200 dòng trong `src/components/tools/`.
- [x] **Backend Fastify Foundation**:
  - Dựng máy chủ Fastify v4 bằng TypeScript đạt chuẩn 0 lỗi type-check (`tsc --noEmit`).
  - Cấu hình SQLite WAL mode tự động kích hoạt qua Prisma hooks (`dev.db`).
  - Xây dựng tầng `StorageManager` quản lý stream ghi đĩa trực tiếp, tính toán SHA-256 tức thời, chặn tấn công Path Traversal / Zip Slip.
  - Xây dựng hệ thống bắt lỗi tập trung `AppError` trả về cấu trúc JSON đồng nhất.
- [x] **Dynamic QR Engine**:
  - Bổ sung model `DynamicQr` và `QrScanLog` vào database.
  - Xây dựng API tạo link ngắn, tự sinh slug ngẫu nhiên hoặc tùy biến, đếm lượt quét và redirect 302 tại `/q/:slug`.
  - Tích hợp `qr-code-styling` hỗ trợ tùy biến hạt chấm, màu gradient và nhúng logo với cấp độ sửa lỗi `H`.
- [x] **Polyglot Engines Ingestion**:
  - Bóc tách và đưa sẵn toàn bộ mã nguồn xử lý 65+ định dạng từ `universal-file-converter` và `file_conversor` vào `engines/converter/`.
  - Soạn thảo script cài đặt phụ thuộc hệ thống `setup_homeserver_engines.sh`.
- [x] **Knowledge Base**: Thiết lập quy chuẩn `KI-CON-001` cấm chú thích thừa, giữ vững tinh thần Vercel/Linear minimalism.

### 5.2. Công việc đang thực hiện & Kế hoạch tiếp theo (Next Milestones)
1. **Kết nối Universal Converter**: Hoàn thiện cầu nối `engines/converter/convert_cli.py` và cắm BullMQ worker `converter.worker.ts` với giao diện người dùng `ConverterWorkspace.js`.
2. **State Persistence**: Nạp dữ liệu draft vào `IndexedDB` và kết nối lại luồng SSE tự động khi người dùng lỡ tay `F5` / reload trang giữa chừng.
3. **Triển khai Homeserver (`192.168.2.171`)**: Chạy script provision cài đặt engine, build bản `dist/` và kích hoạt daemon PM2 để truy cập trơn tru trong mạng LAN gia đình.

---

## 6. Hướng Dẫn Dành Cho Nhà Phát Triển & Tác Nhân AI (Contributor & Agent Guide)

Khi quét và chỉnh sửa codebase của dự án này, **bắt buộc tuân thủ các quy tắc sau**:

### 6.1. Quy tắc viết Code (Coding Standards)
1. **Nguyên tắc Đơn trách nhiệm & Tính Mô-đun Gắn kết (Single Responsibility & Cohesive Modularity)**:
   - Phân tầng nghiêm ngặt: Tách biệt rõ giữa Giao diện (Presentation), Quản lý State & Nghiệp vụ (Hooks/Controllers) và Tầng Dữ liệu/Mạng (API/Storage/Workers).
   - Ngăn chặn "God Files" ôm đồm nhiều nhiệm vụ; đồng thời nghiêm cấm "Micro-Fragmentation" hoặc "Code Golfing" (cố tình gom dòng, gọt bỏ chú thích hoặc cắt xén logic tự nhiên chỉ để đạt một con số dòng đếm cơ học).
   - Quản lý vòng đời tài nguyên phòng thủ: Luôn dọn dẹp các kết nối mạng, EventSource, WebSocket, Animation frame, Timer và ObjectURL khi component unmount.
2. **Quy tắc đa ngôn ngữ (Polyglot Discipline)**:
   - Tuyệt đối không tự viết lại các thuật toán xử lý ảnh, giải mã video hoặc parse PDF phức tạp bằng JavaScript nếu đã có engine chuyên dụng (`FFmpeg`, `PyMuPDF`, `LibreOffice`, `Sharp`).
   - Sử dụng các module có sẵn tại `engines/converter/` để tái sử dụng tối đa, tiết kiệm token và thời gian.
3. **TypeScript Nghiêm Ngặt**:
   - Trong thư mục `server/`, giữ `strict: true`. Tuyệt đối không dùng `any` bừa bãi. Mọi lỗi phải kế thừa từ `AppError`.
4. **Không làm rò rỉ đường dẫn cá nhân**:
   - Khi log ra terminal hoặc trả về client, tự động ẩn/redact thông tin tài khoản, mật khẩu và đường dẫn chứa tên người dùng hệ điều hành (`C:\Users\...`).

### 6.2. Quy tắc Giao diện & Copywriting (UI Standards)
- **Tuân thủ triệt để [ui-standards.md](.agents/rules/ui-standards.md)**:
  - Cấm hoàn toàn câu từ tiếp thị, quảng cáo, giải thích hiển nhiên kiểu `(Ảnh số)`, `(Vector in ấn)`, `(Phổ biến)`.
  - Cấm đặt các khẩu hiệu thừa như *"Sẵn sàng in ấn qua Zalo/Messenger"*.
  - Giao diện phải ngắn gọn, đanh thép, mật độ thông tin cao như Linear và Vercel.

### 6.3. Lệnh Kiểm Thử & Xác Minh (Verification Commands)
Trước khi bàn giao hoặc kết thúc một tác vụ:
```bash
# 1. Kiểm tra TypeScript phía Server (Bắt buộc 0 lỗi)
cd server && npx tsc --noEmit

# 2. Chạy bộ kiểm thử tự động Vitest
cd server && npx vitest run

# 3. Biên dịch bản build server
cd server && npm run build

# 4. Kiểm tra cú pháp script Python
python -m py_compile engines/converter/convert_cli.py
```
