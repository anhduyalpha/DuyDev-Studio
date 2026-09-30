# 04 — Checkpoint và phục hồi

## Nội dung checkpoint

Checkpoint không lưu nội dung tài liệu. Nó chỉ lưu:

- `documentKey`.
- `expectedTotal`.
- `completedIndexes`.
- Hash/fingerprint cấu trúc từng trang.
- Mode từng trang.
- Cờ `prepared`.
- Thời điểm cập nhật.

## Hai mức phục hồi

### Service worker restart, tab chưa reload

Các DOM sheet clone vẫn có thể nằm trong `window.__STD_A4_EXPORT_STATE__.captures`. Lần chạy mới kiểm tra `documentKey`, hủy controller cũ rồi tái sử dụng `Map` capture. Những trang đã clone được bỏ qua.

### Tab đã reload

DOM tạm đã mất nên không thể tái sử dụng node. Queue và metadata vẫn được phục hồi, nhưng nội dung phải quét lại để bảo đảm đúng với trang hiện tại.

## Tính an toàn

- Không dùng checkpoint của tài liệu khác.
- Chỉ reuse khi key khớp và `captures` thật sự là `Map` trong tab.
- Khi hoàn tất, checkpoint bị xóa khỏi job và storage session được dọn khi queue rỗng.
