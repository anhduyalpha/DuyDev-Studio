# `README.md` — giải thích từng dòng

Tổng cộng **110 dòng**. Số dòng khớp với source v1.8.12 trong gói này.

| Dòng | Mã nguồn | Giải thích |
|---:|---|---|
| 1 | `# AlphaD Studocu Downloader v1.8.12` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 2 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 3 | `Extension Chrome chuyển tài liệu Studocu thành PDF A4 bằng một chế độ duy nhất: **Tự nhận diện / Auto Detect**.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 4 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 5 | `## Tính năng chính` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 6 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 7 | `- Tự phân tích từng trang để chọn chiến lược xử lý nội bộ phù hợp.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 8 | `- Gộp DOM và scale nguyên trang vào A4, không chụp màn hình toàn bộ tài liệu.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 9 | `- Bộ điều phối job đáng tin cậy vẫn chạy nội bộ, nhưng popup không còn hiển thị phần Hàng đợi.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 10 | `- Checkpoint và phục hồi tiến trình khi service worker bị tạm dừng.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 11 | `- Fingerprint kiểm tra chữ, hình, SVG, canvas và cấu trúc từng trang.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 12 | `- Chạy nền khi đóng popup hoặc chuyển tab.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 13 | `- Tự đặt tên PDF theo tiêu đề tài liệu Studocu.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 14 | `- Phát một tiếng ting ngắn và hiển thị thông báo khi hoàn tất.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 15 | `- Giao diện chuyển đổi trực tiếp giữa **Tiếng Việt** và **English**.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 16 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 17 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 18 | `## Tăng tốc v1.8.2` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 19 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 20 | `- Giữ single-pass profile, native `cloneNode(true)`, mutation guard và checkpoint batching của v1.8.0.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 21 | `- Niêm phong metadata toàn vẹn sau khi từng sheet, hình ảnh và font đã hoàn tất. Nếu print DOM không đổi, bước trước in chỉ kiểm tra metadata O(số trang), không duyệt lại toàn bộ node.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 22 | `- Khi Chrome bắt đầu `printToPDF`, extension tạm tháo DOM ứng dụng Studocu khỏi `body`, chỉ để lại vùng A4 đã xác minh. Các node gốc được giữ nguyên trong `DocumentFragment` và phục hồi ngay khi Chrome trả stream PDF.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 23 | `- Tài liệu thông thường tải trực tiếp từ Base64; tài liệu rất lớn dùng stream 8 MiB với offscreen khởi động song song để giảm thời gian chờ.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 24 | `- Không chụp màn hình, không raster hóa text/SVG, không đổi ảnh nguồn, không giảm chất lượng PDF.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 25 | `- Trong benchmark tổng hợp 40 trang và 40.000 node giao diện không liên quan, thời gian `printToPDF` giảm từ khoảng 1,81 giây xuống 0,59 giây (~3,08×). Kết quả thực tế tùy tài liệu và máy.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 26 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 27 | `## Active Premium` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 28 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 29 | `Nút chuẩn bị phiên được hiển thị với tên **Active Premium** và nằm ngay dưới nút **Tạo PDF A4 / Create A4 PDF**. Người dùng phải hoàn tất bước này trước khi tạo PDF hoặc dùng phím tắt.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 30 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 31 | `&gt; **Lưu ý trung thực:** “Active Premium” là tên giao diện của bước chuẩn bị phiên hiện có. Nút này thực hiện quy trình làm mới trạng thái Studocu và tải lại tab; nó không thay đổi gói thuê bao, không cấp quyền Premium cho tài khoản và không đại diện cho Studocu.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 32 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 33 | `Trạng thái hoàn tất được lưu bằng `chrome.storage.session`, nên vẫn tồn tại khi popup đóng hoặc service worker tạm dừng, nhưng tự mất khi kết thúc phiên Chrome.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 34 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 35 | `## Chuyển ngôn ngữ Việt / Anh` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 36 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 37 | `- Chọn **VI** hoặc **EN** ở góc phải phần đầu popup.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 38 | `- Lựa chọn được lưu trong `chrome.storage.local` với khóa `stdLanguage`.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 39 | `- Popup, trạng thái, lịch sử, overlay trên trang và thông báo hoàn tất sử dụng ngôn ngữ đã chọn.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 40 | `- Tiến trình đang chạy giữ ngôn ngữ tại thời điểm job được tạo để thông báo không đổi giữa chừng.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 41 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 42 | `## Cài đặt` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 43 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 44 | `1. Giải nén ZIP.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 45 | `2. Mở `chrome://extensions`.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 46 | `3. Bật **Developer mode**.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 47 | `4. Chọn **Load unpacked** và mở thư mục `Product`.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 48 | `5. Mở tài liệu Studocu, bấm **Active Premium**, sau đó chọn **Tạo PDF A4**.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 49 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 50 | `## Tài liệu kỹ thuật` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 51 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 52 | `Xem thư mục [`docs/`](docs/README.md), bao gồm kiến trúc, message protocol, kiểm tra toàn vẹn và tài liệu giải thích từng dòng source.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 53 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 54 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 55 | `## v1.8.2 — Cancel cleanup, activity animation và Fastest PDF Transport` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 56 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 57 | `- Cancel trong overlay xóa giao diện và DOM tạm ngay lập tức, đồng thời báo background dừng job.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 58 | `- Dòng “Mỗi trang được tự phân tích…” / “Every page is analyzed…” có pulse + dấu chấm chuyển động trong suốt giai đoạn quét.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 59 | `- Tài liệu thông thường dùng `ReturnAsBase64` và gửi thẳng vào Downloads API, bỏ toàn bộ vòng `IO.read → message → decode → Blob`.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 60 | `- Tài liệu rất lớn tự chuyển sang stream 8 MiB; offscreen được khởi động song song với lúc Chrome tạo PDF.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 61 | `- Nếu data URL quá lớn, bytes đã tạo được chuyển sang Blob theo chunk mà không in PDF lần hai.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 62 | `- Không raster hóa, không hạ DPI, không nén lại ảnh; text/SVG vẫn được Chrome in dạng vector.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 63 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 64 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 65 | `## v1.8.6 — Active Premium xanh ngay khi nút biến mất` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 66 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 67 | `- Giữ renderer tăng tốc của v1.8.2 và cơ chế xóa cookie hiện tại.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 68 | `- `premium_probe.js` theo dõi trực tiếp nút Premium/Free Trial bằng `MutationObserver`.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 69 | `- Nút có thể xuất hiện trong lúc React khởi tạo; extension không báo đỏ ngay. Khi nút biến mất khỏi giao diện, probe trả kết quả thành công tức thì và Active Premium chuyển xanh.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 70 | `- Nếu nút chưa từng xuất hiện, extension chỉ xác nhận xanh sau khi viewer đã mount và DOM yên lặng trong cửa sổ rất ngắn.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 71 | `- Nếu nút vẫn còn sau thời hạn kiểm tra, Active Premium báo đỏ và tiếp tục khóa thao tác.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 72 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 73 | `## v1.8.7 — kiểm tra lại nút Premium trực tiếp` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 74 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 75 | `- Không còn tin tuyệt đối vào trạng thái xanh đã lưu từ lần chạy trước.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 76 | `- Mỗi lần mở popup, extension kiểm tra trực tiếp DOM của tab hiện tại.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 77 | `- Nếu nút hoặc banner Premium đang hiển thị, trạng thái lập tức chuyển đỏ và khóa tạo PDF.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 78 | `- Content script theo dõi DOM liên tục; nút Premium xuất hiện muộn sau reload vẫn làm trạng thái xanh bị thu hồi.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 79 | `- Trước khi thêm một job PDF, background kiểm tra trực tiếp lần cuối để không cho chạy với trạng thái xanh cũ.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 80 | `- Khi nút đã từng xuất hiện, nó phải biến mất ổn định ít nhất 320 ms mới được xác nhận xanh.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 81 | `- Khi nút chưa từng xuất hiện, extension chờ viewer và React ổn định lâu hơn thay vì báo xanh sau vài chục mili giây.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 82 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 83 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 84 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 85 | `## v1.8.8 — kiểm tra lại sau mọi lần F5 và dọn OneTrust` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 86 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 87 | `- Mỗi document load tạo một `pageToken` mới và đặt Active Premium về trạng thái đang kiểm tra.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 88 | `- Trạng thái xanh cũ không được dùng trong lúc tab đang tải lại.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 89 | `- Nếu nút/banner Premium xuất hiện, Tạo PDF và Hàng đợi bị khóa ngay.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 90 | `- Chỉ mở khóa khi content script xác nhận element Premium không còn sau cửa sổ DOM ổn định.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 91 | `- Message từ document cũ bị loại bằng `pageToken`, tránh trạng thái xanh/đỏ sai do race condition khi F5.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 92 | `- `#onetrust-banner-sdk` được ẩn ngay bằng CSS và xóa khỏi DOM bằng MutationObserver mỗi khi website chèn lại.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 93 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 94 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 95 | `## v1.8.10 — khôi phục Active Premium, giữ popup tối giản` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 96 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 97 | `- Khôi phục nút **Active Premium**, bảng trạng thái đỏ/xanh và toàn bộ cơ chế của v1.8.8.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 98 | `- Sau mỗi lần F5, content script tạo `pageToken` mới, kiểm tra nút/banner Premium và khóa Tạo PDF cho đến khi trạng thái được xác minh.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 99 | `- Nút Active Premium xóa cookies Studocu, tải lại tab và chỉ báo xanh khi probe xác nhận nút Premium đã biến mất.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 100 | `- `#onetrust-banner-sdk` tiếp tục bị ẩn và xóa tự động.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 101 | `- Không khôi phục UI **Hàng đợi**, **Thêm vào hàng đợi** hoặc **Thêm mọi tab Studocu**. Bộ điều phối job nội bộ vẫn được giữ để tiến trình không mất khi service worker ngủ.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 102 | `- Renderer PDF và pipeline xuất nhanh giữ nguyên từ v1.8.8.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 103 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 104 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 105 | `## v1.8.12 — xác nhận gần như tức thì khi nút biến mất` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 106 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 107 | `- Chỉ nút **Free Trial / Go Premium** thực tế quyết định trạng thái; wrapper preview và nút Upload không còn giữ trạng thái đỏ sau khi nút Premium đã biến mất.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 108 | `- Duyệt toàn bộ nút khớp selector nhưng chỉ tính node đang thực sự được render; bản sao React ẩn không gây báo đỏ giả.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 109 | `- MutationObserver xác nhận nút biến mất sau cửa sổ ổn định khoảng 120 ms, thay vì chờ fallback nhiều giây.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 110 | `- Kiểm tra trực tiếp trước khi tạo PDF dùng cùng quy tắc visibility để trạng thái popup và background luôn đồng nhất.` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
