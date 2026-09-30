# 10 — Bản đồ file

| File | Vai trò |
|---|---|
| `manifest.json` | Khai báo Manifest V3, quyền, popup, service worker, content CSS, shortcut và icon. |
| `background.js` | Queue, checkpoint, inject DOM worker, integrity, print, download, notification và cleanup. |
| `popup.html` | Cấu trúc giao diện popup. |
| `popup.css` | Theme AlphaD, thẻ Tự nhận diện cố định, job, queue, preview và history. |
| `popup.js` | Điều khiển popup và message protocol. |
| `offscreen.html` | Trang DOM ẩn dùng cho audio và Blob URL của PDF stream. |
| `offscreen.js` | Phát WAV; nhận chunk PDF, tạo/revoke Blob URL và giải phóng bộ nhớ. |
| `custom_style.css` | CSS nhỏ inject sớm vào Studocu. |
| `viewer_styles.css` | Style tài nguyên public cho viewer legacy/tương thích. |
| `sounds/complete.wav` | Một tiếng ting hoàn tất. Binary PCM WAV. |
| `icons/icon*.png` | Icon AlphaD ở 16/32/48/128 px. Binary PNG. |
| `README.md` | Hướng dẫn sử dụng và thay đổi phiên bản. |
| `docs/` | Tài liệu kỹ thuật. |

## Binary assets

PNG và WAV không có dòng code. Chúng được manifest/offscreen tham chiếu bằng đường dẫn tương đối; không cần build hoặc convert khi cài extension unpacked. Blob PDF chỉ tồn tại tạm thời trong bộ nhớ và được revoke sau khi download kết thúc.

- `docs/15-v1.7.2-cookie-gate.md`: mô tả cookie gate bắt buộc và vị trí Hàng đợi.

- `docs/16-v1.7.3-active-premium-language.md`: giải thích Active Premium và hệ thống chuyển ngôn ngữ Việt/Anh.

- `docs/17-v1.8.0-performance-integrity.md`: clone native, single-pass profile, mutation guard, checkpoint batching và PDF stream.

- `docs/18-v1.8.2-fast-pdf-pipeline.md`: tối ưu riêng bước tạo/tải PDF bằng verified print isolation và metadata guard.

- `premium_probe.js`: content script cực nhẹ chạy từ `document_start` để theo dõi nút Premium sau reload và xác nhận ngay khi nút biến mất.
