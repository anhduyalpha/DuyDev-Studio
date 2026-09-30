# 09 — Debug, kiểm thử và xử lý lỗi

## Kiểm tra tĩnh

```bash
node --check background.js
node --check popup.js
node --check offscreen.js
python -m json.tool manifest.json
```

## Lỗi debugger

Đóng DevTools trên tab Studocu. Chrome chỉ cho một debugger client attach target trong nhiều tình huống.

## Trang thiếu dữ liệu

Dùng Hybrid hoặc Integrity, giữ mạng ổn định và không reload tab. Fingerprint warning có thể được dựng lại bằng nút preview.

## Queue không phục hồi

`storage.session` tồn tại trong browser session, không phải kho lưu vĩnh viễn sau khi thoát hoàn toàn Chrome. Mở lại browser sẽ cần enqueue lại.

## Test matrix đề xuất

- Text-only.
- Bảng và highlight.
- Hóa học/công thức.
- SVG/canvas.
- Scan ảnh toàn trang.
- 100+ trang.
- Chuyển tab.
- Tạm dừng/tiếp tục.
- Restart service worker.
- Preview download/rebuild/cancel.
- Queue 3–5 tab.
