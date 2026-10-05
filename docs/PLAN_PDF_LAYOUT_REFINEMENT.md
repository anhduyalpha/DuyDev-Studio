# PLAN.md — Final PDF Layout Refinement

## Mục tiêu

Refine module **Tạo Bài Tập Trắc Nghiệm → FILE ĐỀ BÀI PDF** đang chạy production.

Phạm vi:
1. Header/title.
2. Optional exam duration.
3. Remove redundant header metadata.
4. Fix excessive whitespace caused by premature pagination.
5. Preserve all existing behavior.
6. Add/verify regression tests.

Không rebuild pipeline, không thay AI/extraction pipeline.

---

## 1. Current State

Các phần sau đang hoạt động và phải được giữ nguyên:

- PDF extraction
- Smart Recognition
- Question range detection
- Question numbering
- Image extraction
- Formula/diagram handling
- A/B/C/D preservation
- Đề bài PDF
- Đáp án PDF

Không rewrite các phần trên.

---

## 2. Header

### 2.1 Title

Tiêu đề chính:

`BÀI TẬP TRẮC NGHIỆM TRANG ...`

Yêu cầu:
- căn giữa;
- lớn hơn body text một mức vừa phải;
- giữ typography/design system hiện tại;
- không quá lớn;
- không phá A4;
- title dài phải wrap an toàn.

### 2.2 Header metadata

Chỉ giữ:
- Môn học
- Lớp
- Thời gian làm bài nếu user nhập

Không render:
- Tổng số câu hỏi
- Thí sinh trả lời từ câu 1 đến câu N

---

## 3. Optional Exam Duration

Duration phải đi theo:

`UI → request → job/config → PDF renderer`

Không hard-code thời gian.

### Có duration

Ví dụ `45 phút`:

`Thời gian làm bài: 45 phút`

### Không có duration

Nếu duration là empty/null/missing:
- không render duration;
- không render label;
- không render placeholder;
- không giữ khoảng trắng dành riêng cho duration.

Header phải tự co chiều cao.

Không làm hỏng request/job cũ không có duration.

---

## 4. Remove Redundant Header Content

### Remove total question count

Không render:

`Tổng số câu hỏi: N câu`

Question count vẫn có thể tồn tại trong internal metadata/validation nếu code cần.

### Remove instruction line

Không render:

`Thí sinh trả lời từ câu 1 đến câu N`

Remove tại template/render source nếu có thể, không chỉ hide bằng CSS.

Không để placeholder hoặc khoảng trắng.

---

## 5. Main Pagination Problem

Hiện tại renderer có xu hướng xử lý question như một block atomic:

```text
if entire_question_does_not_fit:
    page_break()
    render_entire_question_on_next_page()
```

Điều này tạo khoảng trắng lớn cuối trang.

Regression example:

Trang 1:
- Câu 35
- Câu 36
- Câu 37
- Câu 38
- Câu 39
- Câu 40

Sau Câu 40 còn nhiều khoảng trắng.

Câu 41 có:
- stem;
- image;
- A/B/C/D.

Toàn bộ Câu 41 không fit nên bị đẩy sang trang 2.

Mục tiêu là giảm whitespace và tránh page break quá sớm.

**Content integrity luôn ưu tiên hơn space optimization.**

---

## 6. Investigate Root Cause First

Trace:

```text
Question data
→ question layout
→ height measurement
→ page packing
→ page break
→ PDF rendering
```

Tìm chính xác logic đang quyết định page break.

Không giải quyết chỉ bằng:
- giảm font;
- giảm line-height;
- giảm margin;
- scale toàn bộ PDF;
- hard-code page break.

Phải sửa đúng tầng pagination/layout.

---

## 7. Question Layout Model

Về mặt logic, question nên có các phần:

```text
Question
├── Stem
├── RichContent
└── Options
    ├── A
    ├── B
    ├── C
    └── D
```

Không nhất thiết phải thay data model nếu architecture hiện tại đã có abstraction tương đương.

Mục tiêu là pagination có thể đo các phần thay vì chỉ đo tổng question height.

---

## 8. Controlled Splitting

Nếu toàn bộ question fit:

→ render toàn bộ.

Nếu không fit:

→ tìm safe boundary.

Ưu tiên:
1. Stem + RichContent
2. Options

Ví dụ hợp lệ:

Page 1:
```text
Câu 41: ...
[image]
```

Page 2:
```text
A. ...
B. ...
C. ...
D. ...
```

Tốt hơn việc bỏ toàn bộ Câu 41 sang page 2.

---

## 9. Option Integrity

Mỗi option là atomic unit.

Không cắt một option giữa hai trang.

Nếu option không fit:
→ chuyển toàn bộ option sang page tiếp theo.

Ưu tiên giữ A/B/C/D cùng nhau nếu đủ chỗ.

Nếu không đủ:
→ chỉ split giữa các option hoàn chỉnh.

Không được mất option.

---

## 10. Rich Content Integrity

Các thành phần sau phải atomic:

- image
- chemistry structure
- mathematical formula
- table
- chart
- diagram
- reaction scheme

Không crop/cắt giữa page.

Nếu không fit:
→ chuyển sang page tiếp theo.

Không resize xuống bất hợp lý chỉ để tránh page break.

---

## 11. Look-Ahead Packing

Không chỉ kiểm tra:

```text
question_height > remaining_height
```

Có thể tính:

```text
stem_height
rich_content_height
options_height
```

Ví dụ:

```text
remaining = 350
stem = 80
image = 180
options = 300
```

Toàn bộ không fit, nhưng:

```text
stem + image = 260
```

vẫn fit.

→ đặt stem + image ở page hiện tại, options sang page tiếp theo.

Nếu semantic group đầu tiên cũng không fit:
→ page break trước question.

---

## 12. Balanced Packing

Không cố nhồi mọi pixel.

Không tạo:

Page 1:
`một dòng của question`

Page 2:
`phần còn lại`

Nếu phần có thể đặt cuối page quá nhỏ để tạo semantic group có ý nghĩa:
→ chuyển group đó sang page tiếp theo.

Mục tiêu là balanced packing + content integrity.

---

## 13. Dynamic Header Height

Pagination phải dùng actual header height:

```text
usable_height =
page_height
- actual_header_height
- footer_height
- margins
```

Không có duration:
→ header nhỏ hơn.

Có duration:
→ header cao đúng mức cần thiết.

Không reserve vùng lớn cho metadata không tồn tại.

---

## 14. Implementation Order

### Phase A — Inspect
- Xác định PDF renderer.
- Xác định header template/component.
- Xác định metadata flow.
- Xác định pagination logic.
- Xác định tests.

### Phase B — Header
- Tăng title nhẹ.
- Center title.
- Remove instruction.
- Remove total question display.
- Add/use optional duration.
- Dynamic header height.

### Phase C — Pagination
- Sửa premature page break.
- Controlled split.
- Option atomicity.
- Rich-element atomicity.
- Look-ahead nếu phù hợp.
- Balanced packing.

### Phase D — Validation
- Generate regression PDF.
- Render pages thành images.
- Kiểm tra visual.
- Chạy tests.
- Kiểm tra Đáp án PDF không regression.

---

## 15. Regression Cases

### Case A — No duration

Input:
```text
duration = ""
```

Expected:
- không có `Thời gian làm bài`;
- không có `Tổng số câu hỏi`;
- không có `Thí sinh trả lời từ câu...`;
- header collapse đúng.

### Case B — Duration 45

Input:
```text
duration = "45 phút"
```

Expected:
```text
Thời gian làm bài: 45 phút
```

### Case C — Duration 90

Input:
```text
duration = "90 phút"
```

Expected:
```text
Thời gian làm bài: 90 phút
```

---

## 16. Pagination Regression

Dùng regression document hiện tại có nhóm câu:

`35 → 46`

Đặc biệt kiểm tra:
- Câu 40 → Câu 41
- Câu 44 → Câu 45
- Câu 46 → cuối document

Câu 41 phải giữ:
- stem;
- image;
- A;
- B;
- C;
- D.

Không mất hoặc duplicate content.

---

## 17. Acceptance Criteria

### Header
- [ ] Title centered
- [ ] Title slightly larger
- [ ] Redundant element removed
- [ ] Instruction line removed
- [ ] Total question count removed
- [ ] Duration optional
- [ ] Empty duration produces no duration text
- [ ] Header height dynamic

### Pagination
- [ ] Large unnecessary bottom whitespace reduced
- [ ] Premature page breaks reduced
- [ ] Questions remain ordered
- [ ] Question numbers unchanged
- [ ] No option lost
- [ ] No image lost
- [ ] No formula/diagram lost
- [ ] No duplicate content
- [ ] Rich elements not incorrectly split
- [ ] Layout remains visually clean

### Compatibility
- [ ] Existing extraction unchanged
- [ ] Existing recognition unchanged
- [ ] Existing image handling unchanged
- [ ] Existing answer generation unchanged
- [ ] Answer PDF has no regression

---

## 18. Validation Method

Sau implementation:

1. Generate Đề bài PDF.
2. Render tất cả pages thành images.
3. Inspect page boundaries.
4. Inspect bottom whitespace.
5. Inspect header.
6. Inspect Câu 40 → 41.
7. Inspect Câu 44 → 45.
8. Inspect final question.
9. Generate/verify Đáp án PDF.
10. Run existing tests.

Không chỉ dựa vào text extraction.

Visual output là acceptance criterion cuối cùng.

---

## 19. Performance

Pagination phải deterministic.

Không gọi Agnes/LLM để quyết định page break.

Không thêm AI call.

Không làm pipeline chậm đáng kể.

---

## 20. Scope Guard

Chỉ implement:
- header refinement;
- optional duration;
- redundant metadata removal;
- pagination/whitespace fix;
- related tests.

Không implement feature khác.
Không refactor unrelated modules.

Nếu architecture hiện tại khác plan:
- không đoán;
- ghi rõ file/logic;
- giải thích blocker;
- không tự mở rộng scope.

---

## 21. Final Report

Sau khi hoàn thành:

```text
ROOT CAUSE:
...

FILES CHANGED:
...

HEADER CHANGES:
...

PAGINATION CHANGES:
...

TESTS:
...

VISUAL VALIDATION:
...

REGRESSION:
PASS / FAIL

FINAL STATUS:
PASS / FAIL
```

Nếu PASS:

`FINAL PDF LAYOUT REFINEMENT: PASS`
