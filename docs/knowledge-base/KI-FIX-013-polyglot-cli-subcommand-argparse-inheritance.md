---
id: KI-FIX-013-polyglot-cli-subcommand-argparse-inheritance
title: "Xử Lý Lỗi Unrecognized Arguments Trong Kiến Trúc Polyglot CLI Giữa Node.js Worker & Python PyMuPDF Engine"
type: troubleshoot
status: verified
domain: backend
tags: [polyglot, python, argparse, cli-bridge, pymupdf, subcommands, bullmq, error-exit-2]
created_at: 2026-09-23
updated_at: 2026-09-23
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Python PDF Engine báo lỗi (exit 2): usage: pdf_engine.py [-h] {compress,merge,split,...} ... pdf_engine.py: error: unrecognized arguments: --strip-metadata khi worker xử lý các tác vụ xoay, tách, ghép, đóng dấu hoặc bảo mật PDF."
search_queries:
  - "Python PDF Engine error (exit 2) unrecognized arguments: --strip-metadata"
  - "pdf_engine.py error: unrecognized arguments"
  - "Python argparse subparser unrecognized argument inheritance"
  - "Node.js worker child_process python CLI unrecognized flag"
  - "Fix lỗi này với mọi tabs trong module pdf python exit 2"
related_kis:
  - KI-CON-002-native-zero-iframe-tool-module-integration
  - KI-FIX-012-spa-router-eager-listener-evaluation-dom-order
---

# [KI-FIX-013] Xử Lý Lỗi Unrecognized Arguments Trong Kiến Trúc Polyglot CLI Giữa Node.js Worker & Python PyMuPDF Engine

## 1. Context & Purpose
Trong kiến trúc **Polyglot Micro-Engine** của DuyDev Studio, cổng Node.js Fastify và hàng đợi BullMQ đóng vai trò điều phối (Orchestrator). Khi người dùng thực thi các tác vụ PDF (Nén, Ghép, Tách, Xoay, Watermark, Khóa/Mở khóa), worker tạo tiến trình con (`child_process.spawn`) gọi bộ máy Python PyMuPDF (`engines/document/pdf_engine.py`).

Một lỗi nghiêm trọng xảy ra khi các cờ tùy chọn dùng chung (như `--strip-metadata`) được truyền từ Orchestrator nhưng thư viện `argparse` của Python chỉ khai báo cờ này trên một lệnh con duy nhất (`compress`), khiến toàn bộ các lệnh con còn lại bị sập với mã lỗi thoát **exit code 2**.

---

## 2. Root Cause Analysis

### Cơ Chế Lỗi Trong Python `argparse.add_subparsers`
Trong Python `argparse`, các đối số (arguments) gắn vào một subparser độc lập sẽ **không tự động kế thừa sang các subparser khác**:

```python
# ❌ LỖI TRƯỚC ĐÂY trong pdf_engine.py:
subparsers = parser.add_subparsers(dest="subcommand", required=True)

# Cờ --strip-metadata chỉ được khai báo RIÊNG cho compress:
p_comp = subparsers.add_parser("compress")
p_comp.add_argument("--strip-metadata", action="store_true")

# Các lệnh con khác hoàn toàn KHÔNG có cờ này:
p_rot = subparsers.add_parser("rotate")
p_rot.add_argument("--angle", type=int)
```

Trong khi đó, ở phía Frontend PWA và Node.js Worker:
1. `usePdfQueue.js` mặc định kích hoạt `this.stripMetadata = true`.
2. Khi người dùng bấm chạy bất kỳ tác vụ nào (ví dụ: Xoay trang hoặc Tách trang), `pdf.worker.ts` tự động ghép cờ `--strip-metadata` vào chuỗi tham số gọi tiến trình:
   ```bash
   python pdf_engine.py rotate --input in.pdf --output out.pdf --angle 90 --strip-metadata
   ```
3. Bộ phân tích `argparse` của Python không tìm thấy `--strip-metadata` trong định nghĩa của lệnh `rotate`, lập tức in ra `sys.stderr` và thoát với mã 2:
   ```text
   usage: pdf_engine.py [-h] {compress,merge,split,extract-text,convert,rotate,images-to-pdf,watermark,extract-images,lock,unlock} ...
   pdf_engine.py: error: unrecognized arguments: --strip-metadata
   ```
4. Worker bắt được exit code 2 và quăng ngoại lệ `FileCorruptedError`, khiến toàn bộ tiến trình thất bại trên mọi tab ngoài Nén PDF.

---

## 3. Core Instructions / Solution

### Bước 1: Khởi Tạo Parent Parser Dùng Chung Trong Python CLI
Sử dụng kỹ thuật `parents=[common_parser]` của Python `argparse` để phân phối các cờ chung cho toàn bộ các subparser:

```python
# engines/document/pdf_engine.py
def main():
    # 1. Tạo parser cơ sở không có cờ -h (để tránh xung đột với subparser)
    common_parser = argparse.ArgumentParser(add_help=False)
    common_parser.add_argument(
        "--strip-metadata", 
        action="store_true", 
        help="Strip document metadata"
    )

    parser = argparse.ArgumentParser(description="DD Studio PyMuPDF Document Engine")
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    # 2. Truyền parents=[common_parser] vào TẤT CẢ các lệnh con:
    p_comp = subparsers.add_parser("compress", parents=[common_parser])
    p_merge = subparsers.add_parser("merge", parents=[common_parser])
    p_split = subparsers.add_parser("split", parents=[common_parser])
    p_rot = subparsers.add_parser("rotate", parents=[common_parser])
    p_img = subparsers.add_parser("images-to-pdf", parents=[common_parser])
    p_wm = subparsers.add_parser("watermark", parents=[common_parser])
    p_lck = subparsers.add_parser("lock", parents=[common_parser])
    p_unl = subparsers.add_parser("unlock", parents=[common_parser])
    p_txt = subparsers.add_parser("extract-text", parents=[common_parser])
    p_conv = subparsers.add_parser("convert", parents=[common_parser])
    p_ext = subparsers.add_parser("extract-images", parents=[common_parser])
```

### Bước 2: Hiện Thực Logic Xóa Metadata Trong Các Module Nghiệp Vụ
Trong `pdf_ops_basic.py` và `pdf_ops_advanced.py`, kiểm tra cờ `strip_metadata` trước khi lưu file PDF thành phẩm:

```python
# Ví dụ trong cmd_rotate, cmd_split, cmd_merge, cmd_lock:
if getattr(args, "strip_metadata", False):
    emit_progress(85, "Sanitizing metadata headers")
    doc.set_metadata({})  # Xóa sạch Title, Author, Creator, Producer

doc.save(args.output, garbage=3, deflate=True)
```

### Bước 3: Đồng Bộ Trong Node.js Worker (`server/src/workers/pdf.worker.ts`)
Đảm bảo Orchestrator truyền đúng cờ cho cả tác vụ gộp nhiều tệp (`merge`, `images_to_pdf`) và tác vụ đơn lẻ:

```typescript
if (operation === 'merge' || operation === 'images_to_pdf') {
  const pyArgs = [subcmd, '--inputs', ...inputPaths, '--output', resultPath];
  if (options?.stripMetadata) pyArgs.push('--strip-metadata');
  await executePythonEngine(pythonBin, scriptPath, pyArgs, emitProgress);
} else {
  // ...
  if (options?.stripMetadata) pyArgs.push('--strip-metadata');
  await executePythonEngine(pythonBin, scriptPath, pyArgs, emitProgress);
}
```

---

## 4. Gotchas & Edge Cases

- **Cấm Xung Đột `add_help`**: Khi tạo `common_parser`, bắt buộc phải đặt `add_help=False`. Nếu để `True`, `argparse` sẽ báo lỗi `argparse.ArgumentError: -h/--help already exists` khi subparser kế thừa.
- **Tác Vụ Không Xuất File PDF**: Đối với tác vụ như `extract-images` (xuất ảnh nhúng thành file .ZIP), việc truyền `--strip-metadata` sẽ được `argparse` chấp nhận an toàn mà không ném lỗi cú pháp, nhưng handler sẽ không cố gọi `set_metadata` trên thư mục ảnh.

---

## 5. Verification

1. Kiểm tra trợ giúp CLI của từng lệnh con trên Terminal:
   ```bash
   python engines/document/pdf_engine.py rotate --help
   python engines/document/pdf_engine.py split --help
   python engines/document/pdf_engine.py merge --help
   ```
   *Yêu cầu*: Mọi lệnh con đều phải hiển thị cờ `--strip-metadata` trong danh sách options.
2. Chạy Vitest test suite của server:
   ```bash
   cd server && npx vitest run tests/unit/pdf.test.ts
   ```
   *Yêu cầu*: Toàn bộ unit tests xử lý PDF chạy thành công 100%.

---

## 6. Changelog
- **2026-09-23 (v1.0.0)**: Khởi tạo KI xử lý lỗi unrecognized arguments `--strip-metadata` trên toàn bộ các lệnh con của bộ máy PDF PyMuPDF.
