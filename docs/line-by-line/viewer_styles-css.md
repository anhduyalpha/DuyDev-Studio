# `viewer_styles.css` — giải thích từng dòng

Tổng cộng **5 dòng**. Số dòng khớp với source v1.8.12 trong gói này.

| Dòng | Mã nguồn | Giải thích |
|---:|---|---|
| 1 | `/* Compatibility-only print fallback. The automatic exporter patches the PDF page boxes itself. */` | Chú thích mục đích hoặc lý do của phần logic kế tiếp. |
| 2 | `@page { size: Letter portrait; margin: 0; }` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 3 | `@media print {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 4 | `  html, body { margin:0 !important; padding:0 !important; background:#fff !important; }` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 5 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
