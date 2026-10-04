# PDF Exercise Module — TASK Pack v3

## Mục tiêu

Hoàn thiện backend/pipeline cho module "Tạo Bài Tập Trắc Nghiệm" trên website hiện tại.

Frontend/UI đã tồn tại và được xem là contract sản phẩm. Không xây lại UI.

Đầu ra cuối cùng của một job thành công BẮT BUỘC là đúng 2 file:

1. `{prefix}_DeBai.pdf`
2. `{prefix}_DapAn.pdf`

Trong đó:
- `DeBai.pdf`: đề bài đã chuẩn hóa theo style được chọn.
- `DapAn.pdf`: ma trận đáp án + lời giải chi tiết tương ứng.

## Runtime principle

Không gửi Agnes cho mọi bước.

Fast path:
PDF → code inspection → text/geometry extraction → deterministic parsing

AI path:
chỉ dùng Agnes khi cần:
- hiểu ngôn ngữ yêu cầu;
- resolve semantic ambiguity;
- reconstruct câu hỏi;
- phân loại question type;
- chuẩn hóa semantic;
- xử lý rich visual;
- visual diagnosis.

## Batching

Batch là đơn vị runtime, TASK là đơn vị development.

Batch mặc định:
- text/vector: 10–15 câu;
- formula-heavy: 6–10 câu;
- image/table-heavy: 3–6 câu;
- scan: 2–4 trang.

Batch size phải configurable và adaptive.

Có thể chạy các batch độc lập song song nếu rate limit và resource budget cho phép.

## Task order

TASK-00 Audit
→ TASK-01 Agent Foundation
→ TASK-02 Ingestion/Drive
→ TASK-03 PDF Perception
→ TASK-04 Agnes Provider/Prompt
→ TASK-05 Smart Recognition/Range Resolver
→ TASK-06 Batched Reconstruction/Classification
→ TASK-07 Document IR/Normalization/Rich Elements
→ TASK-08 Answer/Solution
→ TASK-09 Style/Layout/Compilers
→ TASK-10 QA/Visual Repair
→ TASK-11 Orchestrator/Job State
→ TASK-12 UI Integration
→ TASK-13 Golden Tests/Performance
→ TASK-14 Production Hardening

## Rule

Mỗi lượt agent chỉ làm MỘT TASK.

Không dùng `/goal` cho toàn bộ 14 TASK.

Sau mỗi TASK:
- test;
- checkpoint/commit nếu repo workflow cho phép;
- cập nhật handoff;
- dừng.
