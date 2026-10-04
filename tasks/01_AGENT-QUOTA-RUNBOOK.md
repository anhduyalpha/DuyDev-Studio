# Agent Quota & Execution Runbook

## Mục tiêu

Làm project lớn nhưng không đốt quota bằng các lượt dài không kiểm soát.

## Cách chạy tối ưu

### Giai đoạn 1 — Planning only

Dùng một lượt ngắn:

```text
Đọc tasks/00_README.md và tasks/01_AGENT-QUOTA-RUNBOOK.md.
Đọc repository hiện tại.
Chỉ lập kế hoạch/audit, chưa code.
```

Sau đó giao TASK-00.

### Giai đoạn 2 — Mỗi lượt một task

Không dùng:

```text
/goal build the entire PDF exercise system
```

Không yêu cầu "làm toàn bộ task".

Dùng:

```text
TASK-03 đã hoàn thành.

Đọc:
tasks/06_TASK-04-AGNES-PROVIDER.md

Chỉ làm TASK-04.
Không làm TASK-05.

Làm xong phải:
1. test;
2. báo cáo files changed;
3. báo cáo test result;
4. cập nhật docs/agent-handoff.md;
5. dừng.
```

## Khi task lớn

Cho phép agent chia TASK thành substeps nội bộ, nhưng không chuyển TASK.

Ví dụ:
- inspect;
- implement;
- test;
- fix;
- final.

Không chạy thêm feature ngoài acceptance criteria.

## Budget discipline

Mỗi TASK phải có:
- Scope;
- Allowed files;
- Forbidden changes;
- Acceptance criteria;
- Test command;
- Stop condition.

Nếu agent phát hiện issue ngoài scope:

```text
DO NOT FIX.
Record in docs/agent-handoff.md under "Out of scope".
```

## Context reuse

Agent đọc:
1. `00_README.md`
2. `01_GLOBAL_RULES.md`
3. task hiện tại
4. `docs/agent-handoff.md`
5. chỉ các file liên quan trực tiếp

Không đọc lại toàn bộ repo nếu không cần.

## Checkpoint

Sau mỗi task:

```text
TASK STATUS:
DONE / BLOCKED / PARTIAL

FILES CHANGED:
...

TESTS:
...

KNOWN ISSUES:
...

NEXT TASK:
...
```

Nếu repo dùng git:
- tạo commit/checkpoint sau mỗi task;
- message: `pdf-exercise: complete TASK-XX`.

## Khi agent đi lệch

Prompt ngắn để kéo agent về:

```text
STOP.

Bạn đang vượt scope của TASK-XX.

Quay lại acceptance criteria.
Không sửa phần ngoài scope.
Chỉ hoàn thành phần đang thiếu của TASK-XX,
chạy test và dừng.
```

## Khi quota gần hết

```text
STOP IMPLEMENTATION.

Chỉ:
1. lưu trạng thái hiện tại;
2. cập nhật docs/agent-handoff.md;
3. liệt kê file đang dang dở;
4. liệt kê test còn thiếu;
5. dừng.

KHÔNG bắt đầu feature mới.
```

## Định nghĩa "xong"

Không tính "xong" khi model nói xong.

Chỉ xong khi:
- code tồn tại;
- test/verification đã chạy;
- acceptance criteria đạt;
- handoff được cập nhật.
