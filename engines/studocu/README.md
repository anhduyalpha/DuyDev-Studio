# AlphaD Studocu Downloader v2.2.0 (Modular CLI Tool & Extension)

Công cụ tải tài liệu Studocu chất lượng cao thành PDF A4 Vector và Markdown sạch. Hỗ trợ 2 chế độ:
1. **Modular Standalone CLI Tool (`studocu_dl/`, `studocu_dl.py`, `studocu-dl.bat`)**: Chỉ cần dán link là tự động tải siêu tốc qua Chrome CDP ngầm hoàn toàn không hiện giao diện popup (Khuyên dùng).
2. **Chrome Extension (v2.0)**: Chạy trực tiếp trên trình duyệt qua giao diện Popup/Overlay.

---

## 🌐 Triển Khai Trên VPS & Homeserver (1 Lệnh Duy Nhất)

Tự động cài đặt và chạy máy chủ Web UI + REST API của Studocu Downloader trên bất kỳ máy chủ Linux nào (**Ubuntu, Debian, CentOS, Rocky, AlmaLinux, Arch, Alpine, CasaOS, Proxmox, Raspberry Pi**...):

### Cách 1: Tự động hoàn toàn bằng `deploy.sh` (Khuyên dùng)

```bash
# 1. Clone mã nguồn về VPS / Homeserver
git clone https://github.com/anhduyalpha/Studocu-Downloader.git
cd Studocu-Downloader

# 2. Cấp quyền và chạy script triển khai
chmod +x deploy.sh
./deploy.sh
```

> 💡 **Script sẽ tự động:**
> - Nhận diện hệ điều hành và kiến trúc CPU (`x86_64` hoặc `ARM64`).
> - Tự động cài đặt Docker & Docker Compose nếu máy chủ chưa có.
> - Khởi tạo cấu hình `.env`, thư mục `downloads/` và cấp quyền phù hợp.
> - Build Docker image tối ưu (kèm Chromium, Xvfb, bộ font tiếng Việt Noto CJK).
> - Kiểm tra tình trạng hoạt động (healthcheck) và cung cấp đường link truy cập ngay trên màn hình.

### Tiện ích quản trị máy chủ qua `deploy.sh`:
```bash
./deploy.sh --status    # Kiểm tra trạng thái container và cổng mạng
./deploy.sh --logs      # Xem nhật ký (logs) xử lý trực tiếp
./deploy.sh --update    # Tự động git pull code mới nhất, build lại và restart
./deploy.sh --restart   # Khởi động lại dịch vụ
./deploy.sh --stop      # Dừng và giải phóng tài nguyên
./deploy.sh --bare-metal # Cài đặt native systemd (cho VPS ram thấp, không dùng Docker)
```

### Cách 2: Chạy trực tiếp bằng Docker Compose

```bash
# Khởi chạy ở chế độ nền
docker compose up -d

# Xem logs
docker compose logs -f

# Khởi chạy kèm Cloudflare Tunnel (nếu có CLOUDFLARE_TUNNEL_TOKEN trong .env)
docker compose --profile tunnel up -d
```

Truy cập Web UI tại: `http://<IP_MAY_CHU>:8090`

---

## 🚀 Hướng dẫn nhanh: Standalone CLI Tool (Chỉ cần dán link)

Công cụ CLI hoạt động độc lập, tự động vượt rào cản Cloudflare / Bot Verification trong nền, bóc tách hoàn toàn lớp mờ và paywall, sau đó xuất trực tiếp sang PDF A4 Vector nguyên bản và Markdown.

### Cấu trúc Module (`studocu_dl/`):
- `studocu_dl/utils.py`: Chuẩn hóa URL, sanitize tên file và dò tìm cổng mạng khả dụng.
- `studocu_dl/browser.py`: Tự động định vị Chrome/Edge/Brave và quản lý cờ chống treo đồ họa khi chạy ngầm (`--disable-features=CalculateNativeWinOcclusion`).
- `studocu_dl/cdp.py`: Client WebSocket giao tiếp giao thức Chrome DevTools Protocol (CDP).
- `studocu_dl/dom_scripts.py`: Toàn bộ kịch bản JS giải mã paywall, deep-clone và đóng gói layout in ấn A4.
- `studocu_dl/engine.py`: Bộ điều phối tải tài liệu (`StudocuDownloader`).
- `studocu_dl/cli.py`: Phân tích cờ lệnh dòng lệnh, báo cáo tiến độ và xử lý tương tác.
- `studocu_dl.py`: File mồi tương thích ngược gọi package `studocu_dl`.

### Cách 1: Sử dụng dòng lệnh (Terminal)

```bash
# Tải tài liệu dạng PDF mặc định (chạy ẩn hoàn toàn không popup Chrome)
python studocu_dl.py "https://www.studocu.com/vn/document/..."
# hoặc chạy dưới dạng module
python -m studocu_dl "https://www.studocu.com/vn/document/..."

# Xuất đồng thời cả file PDF và file Markdown
python studocu_dl.py "https://www.studocu.com/vn/document/..." --format both

# Tùy chỉnh thư mục lưu file và thời gian chờ
python studocu_dl.py "https://www.studocu.com/vn/document/..." -o my_documents -t 60

# Bật hiển thị Chrome nếu cần giải Captcha thủ công
python studocu_dl.py "https://www.studocu.com/vn/document/..." --show-browser
```

### Cách 2: 1-Click trên Windows (Batch File)

1. Nhấp đúp chuột vào file `studocu-dl.bat`.
2. Dán link tài liệu Studocu khi được nhắc: `👉 Dán link tài liệu Studocu cần tải: ...`
3. Nhấn `Enter`. File PDF và Markdown sẽ tự động được tải và lưu vào thư mục `downloads/`.

---

## Tính năng chính


- Tự phân tích từng trang để chọn chiến lược xử lý nội bộ phù hợp.
- Gộp DOM và scale nguyên trang vào A4, không chụp màn hình toàn bộ tài liệu.
- Bộ điều phối job đáng tin cậy vẫn chạy nội bộ, nhưng popup không còn hiển thị phần Hàng đợi.
- Checkpoint và phục hồi tiến trình khi service worker bị tạm dừng.
- Fingerprint kiểm tra chữ, hình, SVG, canvas và cấu trúc từng trang.
- Chạy nền khi đóng popup hoặc chuyển tab.
- Tự đặt tên PDF theo tiêu đề tài liệu Studocu.
- Phát một tiếng ting ngắn và hiển thị thông báo khi hoàn tất.
- Giao diện chuyển đổi trực tiếp giữa **Tiếng Việt** và **English**.


## Tăng tốc v1.8.2

- Giữ single-pass profile, native `cloneNode(true)`, mutation guard và checkpoint batching của v1.8.0.
- Niêm phong metadata toàn vẹn sau khi từng sheet, hình ảnh và font đã hoàn tất. Nếu print DOM không đổi, bước trước in chỉ kiểm tra metadata O(số trang), không duyệt lại toàn bộ node.
- Khi Chrome bắt đầu `printToPDF`, extension tạm tháo DOM ứng dụng Studocu khỏi `body`, chỉ để lại vùng A4 đã xác minh. Các node gốc được giữ nguyên trong `DocumentFragment` và phục hồi ngay khi Chrome trả stream PDF.
- Tài liệu thông thường tải trực tiếp từ Base64; tài liệu rất lớn dùng stream 8 MiB với offscreen khởi động song song để giảm thời gian chờ.
- Không chụp màn hình, không raster hóa text/SVG, không đổi ảnh nguồn, không giảm chất lượng PDF.
- Trong benchmark tổng hợp 40 trang và 40.000 node giao diện không liên quan, thời gian `printToPDF` giảm từ khoảng 1,81 giây xuống 0,59 giây (~3,08×). Kết quả thực tế tùy tài liệu và máy.

## Active Premium

Nút chuẩn bị phiên được hiển thị với tên **Active Premium** và nằm ngay dưới nút **Tạo PDF A4 / Create A4 PDF**. Người dùng phải hoàn tất bước này trước khi tạo PDF hoặc dùng phím tắt.

> **Lưu ý trung thực:** “Active Premium” là tên giao diện của bước chuẩn bị phiên hiện có. Nút này thực hiện quy trình làm mới trạng thái Studocu và tải lại tab; nó không thay đổi gói thuê bao, không cấp quyền Premium cho tài khoản và không đại diện cho Studocu.

Trạng thái hoàn tất được lưu bằng `chrome.storage.session`, nên vẫn tồn tại khi popup đóng hoặc service worker tạm dừng, nhưng tự mất khi kết thúc phiên Chrome.

## Chuyển ngôn ngữ Việt / Anh

- Chọn **VI** hoặc **EN** ở góc phải phần đầu popup.
- Lựa chọn được lưu trong `chrome.storage.local` với khóa `stdLanguage`.
- Popup, trạng thái, lịch sử, overlay trên trang và thông báo hoàn tất sử dụng ngôn ngữ đã chọn.
- Tiến trình đang chạy giữ ngôn ngữ tại thời điểm job được tạo để thông báo không đổi giữa chừng.

## Cài đặt

1. Giải nén ZIP.
2. Mở `chrome://extensions`.
3. Bật **Developer mode**.
4. Chọn **Load unpacked** và mở thư mục `Product`.
5. Mở tài liệu Studocu, bấm **Active Premium**, sau đó chọn **Tạo PDF A4**.

## Tài liệu kỹ thuật

Xem thư mục [`docs/`](docs/README.md), bao gồm kiến trúc, message protocol, kiểm tra toàn vẹn và tài liệu giải thích từng dòng source.


## v1.8.2 — Cancel cleanup, activity animation và Fastest PDF Transport

- Cancel trong overlay xóa giao diện và DOM tạm ngay lập tức, đồng thời báo background dừng job.
- Dòng “Mỗi trang được tự phân tích…” / “Every page is analyzed…” có pulse + dấu chấm chuyển động trong suốt giai đoạn quét.
- Tài liệu thông thường dùng `ReturnAsBase64` và gửi thẳng vào Downloads API, bỏ toàn bộ vòng `IO.read → message → decode → Blob`.
- Tài liệu rất lớn tự chuyển sang stream 8 MiB; offscreen được khởi động song song với lúc Chrome tạo PDF.
- Nếu data URL quá lớn, bytes đã tạo được chuyển sang Blob theo chunk mà không in PDF lần hai.
- Không raster hóa, không hạ DPI, không nén lại ảnh; text/SVG vẫn được Chrome in dạng vector.


## v1.8.6 — Active Premium xanh ngay khi nút biến mất

- Giữ renderer tăng tốc của v1.8.2 và cơ chế xóa cookie hiện tại.
- `premium_probe.js` theo dõi trực tiếp nút Premium/Free Trial bằng `MutationObserver`.
- Nút có thể xuất hiện trong lúc React khởi tạo; extension không báo đỏ ngay. Khi nút biến mất khỏi giao diện, probe trả kết quả thành công tức thì và Active Premium chuyển xanh.
- Nếu nút chưa từng xuất hiện, extension chỉ xác nhận xanh sau khi viewer đã mount và DOM yên lặng trong cửa sổ rất ngắn.
- Nếu nút vẫn còn sau thời hạn kiểm tra, Active Premium báo đỏ và tiếp tục khóa thao tác.

## v1.8.7 — kiểm tra lại nút Premium trực tiếp

- Không còn tin tuyệt đối vào trạng thái xanh đã lưu từ lần chạy trước.
- Mỗi lần mở popup, extension kiểm tra trực tiếp DOM của tab hiện tại.
- Nếu nút hoặc banner Premium đang hiển thị, trạng thái lập tức chuyển đỏ và khóa tạo PDF.
- Content script theo dõi DOM liên tục; nút Premium xuất hiện muộn sau reload vẫn làm trạng thái xanh bị thu hồi.
- Trước khi thêm một job PDF, background kiểm tra trực tiếp lần cuối để không cho chạy với trạng thái xanh cũ.
- Khi nút đã từng xuất hiện, nó phải biến mất ổn định ít nhất 320 ms mới được xác nhận xanh.
- Khi nút chưa từng xuất hiện, extension chờ viewer và React ổn định lâu hơn thay vì báo xanh sau vài chục mili giây.



## v1.8.8 — kiểm tra lại sau mọi lần F5 và dọn OneTrust

- Mỗi document load tạo một `pageToken` mới và đặt Active Premium về trạng thái đang kiểm tra.
- Trạng thái xanh cũ không được dùng trong lúc tab đang tải lại.
- Nếu nút/banner Premium xuất hiện, Tạo PDF và Hàng đợi bị khóa ngay.
- Chỉ mở khóa khi content script xác nhận element Premium không còn sau cửa sổ DOM ổn định.
- Message từ document cũ bị loại bằng `pageToken`, tránh trạng thái xanh/đỏ sai do race condition khi F5.
- `#onetrust-banner-sdk` được ẩn ngay bằng CSS và xóa khỏi DOM bằng MutationObserver mỗi khi website chèn lại.


## v1.8.10 — khôi phục Active Premium, giữ popup tối giản

- Khôi phục nút **Active Premium**, bảng trạng thái đỏ/xanh và toàn bộ cơ chế của v1.8.8.
- Sau mỗi lần F5, content script tạo `pageToken` mới, kiểm tra nút/banner Premium và khóa Tạo PDF cho đến khi trạng thái được xác minh.
- Nút Active Premium xóa cookies Studocu, tải lại tab và chỉ báo xanh khi probe xác nhận nút Premium đã biến mất.
- `#onetrust-banner-sdk` tiếp tục bị ẩn và xóa tự động.
- Không khôi phục UI **Hàng đợi**, **Thêm vào hàng đợi** hoặc **Thêm mọi tab Studocu**. Bộ điều phối job nội bộ vẫn được giữ để tiến trình không mất khi service worker ngủ.
- Renderer PDF và pipeline xuất nhanh giữ nguyên từ v1.8.8.


## v1.8.12 — xác nhận gần như tức thì khi nút biến mất

- Chỉ nút **Free Trial / Go Premium** thực tế quyết định trạng thái; wrapper preview và nút Upload không còn giữ trạng thái đỏ sau khi nút Premium đã biến mất.
- Duyệt toàn bộ nút khớp selector nhưng chỉ tính node đang thực sự được render; bản sao React ẩn không gây báo đỏ giả.
- MutationObserver xác nhận nút biến mất sau cửa sổ ổn định khoảng 120 ms, thay vì chờ fallback nhiều giây.
- Kiểm tra trực tiếp trước khi tạo PDF dùng cùng quy tắc visibility để trạng thái popup và background luôn đồng nhất.


## v2.0.0 — Omni-Extraction Engine, Deep Session Purge & Universal De-cloaking

- **Deep Session Sanitization**: Active Premium dọn sạch triệt để cả Cookies, `localStorage`, `sessionStorage`, `IndexedDB` và `CacheStorage` của Studocu, ngăn chặn hoàn toàn việc tái sinh session cũ.
- **Anti-Telemetry Paywall Bypass**: Tự động kích hoạt rules `declarativeNetRequest` chặn các endpoint theo dõi (`telemetry`, `logger`, `tracking`) đếm số trang xem thử.
- **Universal DOM De-cloaking**: Bóc sạch toàn bộ lớp mờ CSS (`filter: blur(...)`, `backdrop-filter`), ép hiển thị text layer bị ẩn và triệt tiêu 100% overlay paywall.
- **Adaptive Rolling-Window Virtualization**: Nhận diện tổng số trang thật qua metadata và tự động teleport viewport, bắt trọn 100% tài liệu dài hàng trăm trang dù React có unmount các trang cũ.
- **Tainted Canvas Lossless Fallback**: Bảo vệ chống lỗi CORS khi render canvas từ CDN bằng offscreen 2D buffer.
- **Omni-Extraction Markdown**: Bổ sung nút bấm xuất toàn bộ nội dung tài liệu sang file Markdown (`.md`) sạch, phân trang rõ ràng, không dính watermark, tối ưu để nạp vào AI tóm tắt.

