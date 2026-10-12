<div align="center">

# DuyDev Studio

**Personal Progressive Web App (PWA) & self-hosted file processing suite.**

[![Production](https://img.shields.io/badge/Production-studio.duydev.cloud-6366f1?style=flat-square&logo=cloudflare&logoColor=white)](https://studio.duydev.cloud)
[![PWA](https://img.shields.io/badge/PWA-Offline--First-10b981?style=flat-square&logo=pwa&logoColor=white)](https://studio.duydev.cloud)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-v4-000000?style=flat-square&logo=fastify&logoColor=white)](https://fastify.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776ab?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-f59e0b?style=flat-square)](LICENSE)

<p align="center">
  🌐 <b>Truy cập trực tiếp:</b> <a href="https://studio.duydev.cloud">https://studio.duydev.cloud</a>
</p>

</div>

---

## Giới thiệu

**DuyDev Studio** là ứng dụng web tự lưu trữ (self-hosted PWA) tổng hợp các công cụ xử lý tệp tin và tiện ích cá nhân. Dự án được thiết kế để vận hành độc lập, bảo mật dữ liệu, tối ưu hóa tốc độ và hỗ trợ hoạt động ngoại tuyến.

- **Frontend**: Zero-build Native ES Modules, Tailwind CSS, Service Worker (PWA offline-first), Lucide Icons.
- **Backend Gateway**: Node.js Fastify (TypeScript), xử lý stream tệp trực tiếp vào đĩa với buffer lớn và tính mã băm SHA-256 inline.
- **Hàng đợi & Tác vụ nền**: BullMQ trên Redis 7, xử lý bất đồng bộ các tác vụ nặng (chuyển đổi video, render PDF, trích xuất đề thi).
- **Cơ sở dữ liệu**: SQLite ở chế độ WAL (Prisma ORM).
- **Động cơ xử lý**: PyMuPDF (fitz), FFmpeg CLI, LibreOffice headless, Pillow, pdf2docx, Chromium CDP.

---

## Tính năng chính

### 1. PDF Studio
- **Ghép & Tách**: Ghép nhiều tệp PDF với cơ chế đổi thứ tự kéo-thả; tách dải trang tùy chọn hoặc theo trang chẵn/lẻ qua lưới thumbnail trực quan.
- **Xoay trang**: Xoay góc 90°, 180°, 270° từng trang riêng lẻ hoặc toàn bộ tài liệu.
- **Nén & Tối ưu**: Giảm dung lượng tài liệu theo các mức chất lượng, tự động giữ nguyên tệp gốc nếu kích thước không giảm.
- **Chuyển đổi**: Tạo PDF từ nhiều hình ảnh (tự động căn lề A4), trích xuất toàn bộ ảnh nhúng trong PDF thành tệp ZIP.
- **Đóng dấu & Bảo mật**: Đóng dấu văn bản (watermark), đánh số trang tự động; đặt mật khẩu bảo vệ và gỡ khóa PDF.

### 2. Tạo Bài Tập Trắc Nghiệm (Quiz Generator)
- **Bóc tách nội dung**: Trích xuất câu hỏi từ tệp PDF tải lên hoặc liên kết Google Drive, hỗ trợ bố cục 2 cột và tự động đính kèm hình vẽ thí nghiệm/biểu đồ vào câu hỏi.
- **Đa định dạng câu hỏi**: Hỗ trợ trắc nghiệm 4 lựa chọn (A, B, C, D), nhóm Đúng/Sai 4 ý (a, b, c, d chuẩn GDPT) và câu trả lời ngắn.
- **Công thức khoa học**: Render công thức toán, lý, hóa học bằng KaTeX vector sắc nét.
- **Xuất bản chuẩn in ấn A4**: Tự động sinh đồng thời tệp Đề bài (`DeBai.pdf`) và bảng Ma trận Đáp án kèm lời giải chi tiết (`DapAn.pdf`).

### 3. Chuyển Đổi Tệp Đa Định Dạng (File Converter)
- **Hỗ trợ 65+ định dạng**:
  - *Hình ảnh*: WebP, PNG, JPG, ICO, BMP, TIFF, SVG.
  - *Video & Âm thanh*: MP4, WebM, GIF, MP3, WAV, AAC, FLAC, OGG, M4A.
  - *Văn bản & Bảng tính*: PDF, DOCX, Markdown, TXT, HTML, CSV, XLSX.
  - *Nén*: ZIP, TAR, 7Z, GZ.
- **Kiến trúc lai (Hybrid Fast-Path)**: Chuyển đổi trực tiếp phía client đối với hình ảnh và dữ liệu nhẹ để nhận kết quả ngay; tự động chuyển sang worker backend đa luồng (FFmpeg, PyMuPDF, LibreOffice) đối với video, âm thanh hoặc tài liệu phức tạp.

### 4. So Sánh Hình Ảnh (ViewSplit)
- **Đa khung nhìn**: Bố cục linh hoạt từ 1, 2, 3 đến 4 khung hình song song.
- **Chế độ so sánh nâng cao**: Thanh trượt Before/After đè lớp (Slider Wipe) và bản đồ sai lệch điểm ảnh (Difference map).
- **Pixel Inspector**: Kính lúp phóng to 9×9 điểm ảnh với tâm ngắm, đọc giá trị màu RGB, mã HEX và tọa độ ảnh thực tế.
- **Đồng bộ điều hướng**: Tùy chọn đồng bộ thao tác thu phóng (zoom), kéo cuộn (pan) và con trỏ chuột giữa tất cả các khung nhìn.

### 5. Soi & Nén Tệp (Archive Inspector)
- **Soi tệp nén không cần giải nén**: Đọc trực tiếp Central Directory của tệp `.zip`, `.rar`, `.7z` để duyệt cây thư mục và trích xuất tệp đơn lẻ mà không cần bung toàn bộ dung lượng ra ổ đĩa.
- **Nén ZIP**: Đóng gói nhanh tệp và thư mục thành định dạng ZIP tiêu chuẩn.

### 6. Dynamic QR Studio & VietQR
- **VietQR EMVCo**: Tạo mã QR thanh toán liên ngân hàng Napas 24/7 với thuật toán kiểm tra CRC16-CCITT chuẩn xác.
- **QR Động & Rút gọn link**: Chuyển hướng liên kết qua đường dẫn `/q/:slug`, ghi nhận số lượt quét.
- **Đa nội dung**: Tạo mã QR Wi-Fi, URL, văn bản, danh bạ vCard 3.0 (chuẩn hóa UTF-8).
- **Quét & Giải mã**: Đọc mã QR trực tiếp từ ảnh tải lên, chụp màn hình hoặc dán từ clipboard.

### 7. Bộ Nhớ Lưu Trữ (Storage Drive)
- **Quản lý tệp cá nhân**: Duyệt thư mục, tạo folder, đổi tên, tải lên tệp lớn qua luồng stream và tải thư mục về dưới dạng ZIP.
- **Bảo mật phiên**: Yêu cầu xác thực quản trị để bảo vệ dữ liệu tệp lưu trữ trên máy chủ.

### 8. Tiện Ích Bổ Trợ & Trình Xem Đa Năng
- **Kiểm tra mã băm**: Tính nhanh MD5, SHA-256 của tệp hoặc chuỗi ký tự; mã hóa và giải mã Base64.
- **Studocu Downloader**: Hỗ trợ chuyển đổi tài liệu học tập sang PDF.
- **Universal File Viewer**: Xem trước trực tiếp tài liệu Word (`.docx`), bảng tính Excel (`.xlsx`, `.csv`), tệp PDF, video, âm thanh, mã nguồn cú pháp màu và trình soi nhị phân Hex Dump.

---

## Kiến trúc Hệ thống

```mermaid
flowchart TD
    Client["Client PWA (Vanilla ES Modules / Offline Service Worker)"]

    subgraph Server ["Fastify Gateway"]
        Router["HTTP Router & SSE Streamer"]
        Storage["Storage Manager (Stream to Disk & SHA-256)"]
        Prisma["Prisma ORM (SQLite WAL: dev.db)"]
    end

    subgraph Queue ["Task Queue (BullMQ + Redis 7)"]
        Redis[("Redis Event Bus")]
        W_PDF["PDF Worker"]
        W_Conv["Converter Worker"]
        W_Quiz["Quiz Worker"]
    end

    subgraph Engines ["Processing Engines"]
        E_PyMuPDF["pdf_engine.py (PyMuPDF)"]
        E_FFmpeg["convert_cli.py (FFmpeg / LibreOffice)"]
        E_Quiz["quiz_pipeline.py (PyMuPDF / Chrome CDP)"]
    end

    Client -->|"REST API / Upload"| Router
    Router --> Storage
    Router --> Prisma
    Router -->|"Enqueue Job"| Redis

    Redis --> W_PDF
    Redis --> W_Conv
    Redis --> W_Quiz

    W_PDF --> E_PyMuPDF
    W_Conv --> E_FFmpeg
    W_Quiz --> E_Quiz

    W_PDF -.->|"Job Progress"| Redis
    W_Conv -.->|"Job Progress"| Redis
    W_Quiz -.->|"Job Progress"| Redis
    Redis -.->|"Server-Sent Events (SSE)"| Router
    Router -.->|"Real-Time Push"| Client
```

---

## Công nghệ sử dụng

| Tầng | Thành phần |
| :--- | :--- |
| **Giao diện (Frontend)** | Vanilla ES Modules, Tailwind CSS, Lucide Icons, PDF.js, SheetJS, docx-preview, qr-code-styling |
| **Máy chủ (Backend)** | Node.js v20+, Fastify v4, TypeScript, Zod |
| **Hàng đợi & CSDL** | Redis 7 (BullMQ), SQLite WAL (Prisma ORM) |
| **Xử lý tài liệu** | Python 3.11, PyMuPDF (fitz), LibreOffice headless, pdf2docx, python-docx |
| **Xử lý đa phương tiện**| FFmpeg, Pillow, Sharp |
| **Kiểm thử** | Vitest, TypeScript compiler (`tsc --noEmit`) |

---

## Hướng dẫn Cài đặt & Chạy Cục Bộ

### 1. Yêu cầu môi trường
- **Node.js**: v20.x trở lên
- **Python**: 3.10 trở lên (khuyến nghị 3.11)
- **Redis Server**: Đang chạy tại `127.0.0.1:6379`
- **Công cụ phụ trợ** (tùy chọn theo tính năng): `ffmpeg`, `libreoffice`

### 2. Cài đặt

```bash
# Clone repository
git clone https://github.com/anhduyalpha/DuyDev-Studio.git
cd DuyDev-Studio

# 1. Cài đặt Backend Fastify
cd server
npm install
cp .env.example .env

# Khởi tạo cơ sở dữ liệu SQLite
npx prisma generate
npx prisma db push
cd ..

# 2. Cài đặt thư viện Python cho các Engine
pip install -r engines/converter/fastapi_app/requirements.txt
pip install PyMuPDF pdf2docx python-docx Pillow
```

### 3. Khởi động môi trường phát triển

```bash
# Khởi động máy chủ Fastify (phục vụ đồng bộ cả API và PWA giao diện)
npm run dev

# hoặc chạy trực tiếp từ thư mục server:
cd server && npm run dev
```

Mở trình duyệt tại: **`http://localhost:3000`** *(hoặc cổng được cấu hình trong `server/.env`)*.

---

## Kiểm thử

```bash
cd server

# 1. Kiểm tra tính toàn vẹn kiểu dữ liệu TypeScript
npm run build      # npx tsc --noEmit

# 2. Chạy bộ kiểm thử tự động
npm test           # npx vitest run
```

---

## Triển khai

Dự án có thể triển khai trên máy chủ Linux cá nhân hoặc VPS qua dịch vụ Systemd và reverse proxy (Nginx, Caddy hoặc Cloudflare Zero Trust Tunnel):

```bash
# Quản lý dịch vụ qua Systemd
sudo systemctl status dd-studio.service
sudo systemctl restart dd-studio.service
```

---

## Giấy phép

Dự án được phân phối dưới giấy phép [MIT License](LICENSE).
