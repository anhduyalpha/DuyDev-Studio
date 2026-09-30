# Tài liệu kỹ thuật — AlphaD Studocu Downloader v1.8.12

Thư mục này mô tả toàn bộ kiến trúc và mã nguồn của extension. Tài liệu được chia thành hai lớp:

1. **Tài liệu kiến trúc:** giải thích hệ thống theo luồng nghiệp vụ, dữ liệu và API Chrome.
2. **Tài liệu từng dòng:** mỗi file runtime dạng văn bản có một tài liệu riêng trong `line-by-line/`; mọi dòng đều có số dòng, nội dung và giải thích.

## Mục lục

- [01 — Kiến trúc tổng thể](01-architecture.md)
- [02 — Luồng chạy từ nút bấm đến PDF](02-runtime-flow.md)
- [03 — Reliable Queue](03-reliable-queue.md)
- [04 — Checkpoint và phục hồi](04-checkpoint-recovery.md)
- [05 — Fingerprint và Integrity Guard](05-fingerprint-integrity.md)
- [06 — Preview, print và download](06-preview-download.md)
- [07 — Chế độ Tự nhận diện](07-processing-modes.md)
- [08 — Quyền, bảo mật và dữ liệu](08-permissions-security.md)
- [09 — Debug, kiểm thử và xử lý lỗi](09-debugging-testing.md)
- [10 — Bản đồ file](10-file-map.md)
- [11 — Message protocol](11-message-protocol.md)
- [12 — Function reference](12-function-reference.md)
- [13 — Validation](13-validation.md)
- [Tài liệu từng dòng](line-by-line/README.md)

## Phạm vi “từng dòng”

Các file được giải thích đầy đủ: `manifest.json`, `background.js`, `popup.html`, `popup.css`, `popup.js`, `offscreen.html`, `offscreen.js`, `custom_style.css`, `viewer_styles.css`, `README.md`.

Các file PNG/WAV là binary nên không có “dòng code”; chúng được mô tả trong [10 — Bản đồ file](10-file-map.md).

- [14 — Thay đổi v1.7.2: chỉ giữ Tự nhận diện](14-v1.7.2-single-mode.md)

- [`15-v1.7.2-cookie-gate.md`](15-v1.7.2-cookie-gate.md): cổng bắt buộc xóa cookies và cách Hàng đợi bị khóa/mở khóa.

- [`16-v1.7.3-active-premium-language.md`](16-v1.7.3-active-premium-language.md): nhãn Active Premium, bộ chuyển VI/EN và kiến trúc i18n runtime.

- [`17-v1.8.0-performance-integrity.md`](17-v1.8.0-performance-integrity.md): kiến trúc tăng tốc giữ nguyên chất lượng và integrity guard.
- [`18-v1.8.1-fast-pdf-pipeline.md`](18-v1.8.1-fast-pdf-pipeline.md): kiến trúc print isolation và fast verification của bản v1.8.1.

- `19-v1.8.2-cancel-animation-fast-export.md`: cancel cleanup, animation tự nhận diện và adaptive PDF transport.

- [`20-v1.8.5-fast-premium-probe.md`](20-v1.8.5-fast-premium-probe.md): renderer nhanh và cơ chế kiểm tra banner từ `document_start`.

- [`21-v1.8.6-button-disappearance-gate.md`](21-v1.8.6-button-disappearance-gate.md): Active Premium chuyển xanh ngay khi nút Premium biến mất.
- [`22-v1.8.7-live-premium-revalidation.md`](22-v1.8.7-live-premium-revalidation.md): kiểm tra DOM trực tiếp, thu hồi trạng thái xanh khi nút/banner Premium xuất hiện muộn.

- [`23-v1.8.8-reload-gate-onetrust-cleanup.md`](23-v1.8.8-reload-gate-onetrust-cleanup.md): khóa lại Active Premium sau mọi F5, kiểm tra DOM theo pageToken và tự dọn banner OneTrust.

- [`24-v1.8.10-active-premium-minimal-ui.md`](24-v1.8.10-active-premium-minimal-ui.md): khôi phục Active Premium của v1.8.8 trong popup tối giản, không hiển thị UI Hàng đợi.

- [`25-v1.8.11-premium-dom-fix-product-root.md`](25-v1.8.11-premium-dom-fix-product-root.md): sửa false-green bằng kiểm tra mọi Premium DOM node và đổi thư mục ZIP thành `Product`.

- [`26-v1.8.12-instant-premium-disappearance.md`](26-v1.8.12-instant-premium-disappearance.md): chỉ kiểm tra nút Premium đang render và xác nhận biến mất khoảng 120 ms.
