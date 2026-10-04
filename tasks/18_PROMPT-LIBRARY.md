# Ready-to-use Prompts for Antigravity

## A. Start project

```text
Đọc tasks/00_README.md và tasks/17_GLOBAL-RULES.md.

Bạn chịu trách nhiệm xây backend pipeline cho module Tạo Bài Tập Trắc Nghiệm
trên repository hiện tại.

UI đã có sẵn. Không redesign UI.

Trước tiên chỉ audit repository theo TASK-00.
Không code nghiệp vụ.
Không làm TASK tiếp theo.

Sau khi audit:
- cập nhật docs/current-module-audit.md
- cập nhật docs/current-data-flow.md
- cập nhật docs/agent-handoff.md
- báo cáo files và findings
- dừng.
```

## B. Run one task

```text
Đọc:
tasks/17_GLOBAL-RULES.md
tasks/XX_TASK-....md
docs/agent-handoff.md

Chỉ thực hiện TASK-XX.

Scope chỉ là acceptance criteria trong TASK-XX.
Không thực hiện TASK tiếp theo.
Không redesign UI.
Không rewrite unrelated code.

Trước khi sửa:
- inspect relevant files;
- xác định files cần thay đổi.

Sau khi sửa:
- chạy test/lint/typecheck phù hợp;
- cập nhật docs/agent-handoff.md;
- báo cáo files changed;
- báo cáo tests;
- báo cáo known issues;
- dừng.
```

## C. Quota nearly exhausted

```text
STOP.

Không triển khai thêm feature.

Hãy:
1. lưu code hiện tại an toàn;
2. cập nhật docs/agent-handoff.md;
3. ghi chính xác file/function đang dang dở;
4. ghi test nào đã chạy và test nào còn thiếu;
5. ghi bước tiếp theo;
6. dừng.
```

## D. Agent over-scopes

```text
STOP.

Bạn đang thay đổi ngoài phạm vi TASK hiện tại.

Chỉ quay lại acceptance criteria của TASK hiện tại.
Không thêm tính năng.
Không refactor unrelated code.
Không làm TASK tiếp theo.

Chạy test liên quan rồi dừng.
```

## E. Finish receipt

```text
TASK COMPLETE RECEIPT

TASK:
...

FILES CHANGED:
...

ENDPOINTS:
...

TESTS:
...

RESULT:
PASS / FAIL / PARTIAL

AI CALLS ADDED:
...

KNOWN ISSUES:
...

NEXT TASK:
...

STOP.
```
