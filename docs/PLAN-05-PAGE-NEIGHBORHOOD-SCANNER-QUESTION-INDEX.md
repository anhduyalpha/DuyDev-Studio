# PLAN-05 — PAGE NEIGHBORHOOD SCANNER + QUESTION INDEX

## 0. Mục tiêu

Bổ sung một lớp kiểm soát **trước extraction/reconstruction** để pipeline luôn xác định đúng toàn bộ câu hỏi thuộc vùng user yêu cầu.

Bug hiện tại cần giải quyết:

- `Trang 13 câu 30 đến 44` → phải lấy **Q30–Q44**, không được chỉ lấy Q41–Q44.
- `Trang 13 câu 31 đến 43` → phải lấy **Q31–Q43**, không được chỉ lấy Q41–Q43.

Plan này phải tổng quát cho mọi PDF, môn học, layout và cách đánh số; không được hard-code trang 13 hay các số câu trên.

---

# 1. Vị trí trong pipeline

```text
USER REQUEST
    ↓
REQUEST NORMALIZER
    ↓
PRINTED PAGE ↔ PHYSICAL PAGE RESOLVER
    ↓
PLAN-05: PAGE NEIGHBORHOOD SCANNER
    ↓
QUESTION INDEX + RANGE VALIDATION
    ↓
PLAN-04: ADAPTIVE EXTRACTION WINDOW
    ↓
QUESTION RECONSTRUCTION
    ↓
SEMANTIC / CONTENT ANALYSIS
    ↓
ASSET EXTRACTION
    ↓
IR
    ↓
DE BAI PDF + DAP AN PDF
```

**Nguyên tắc:** PLAN-05 phải chạy trước khi pipeline quyết định text/image nào được đưa vào reconstruction.

---

# 2. TASK-01 — Full-page Question Inventory

Tạo/reuse service để scan **toàn bộ target page** và lập inventory các câu hỏi.

Input conceptual:

```ts
{
  documentId: string,
  physicalPage: number,
  printedPage?: number
}
```

Output conceptual:

```ts
{
  physicalPage: number,
  printedPage?: number,
  questions: QuestionIndexEntry[],
  confidence: number,
  status: "complete" | "partial" | "ambiguous" | "failed"
}
```

`QuestionIndexEntry` tối thiểu cần có:

```ts
{
  questionNumber: number,
  segments: Array<{
    physicalPage: number,
    bbox?: { x: number, y: number, width: number, height: number },
    textStart?: number,
    textEnd?: number
  }>,
  firstPage: number,
  lastPage: number,
  detectionMethod: "pdf-text" | "layout-analysis" | "vision" | "hybrid",
  confidence: number
}
```

Nếu codebase đã có model tương đương thì reuse, không tạo duplicate abstraction.

---

# 3. TASK-02 — Text-first detection

Ưu tiên code, không gọi Agnes nếu PDF text/layout đã đủ rõ.

Pipeline:

```text
PDF text extraction
→ text spans / blocks
→ coordinates
→ question-number detection
```

Phải phát hiện được dạng:

```text
Câu 30:
Câu 31:
...
Câu 44:
```

Không phụ thuộc font, môn học, màu sắc hay số câu cố định.

Question body và options phải được gắn đúng với question number.

---

# 4. TASK-03 — Layout-aware + column-aware detection

Không được chỉ sort toàn bộ text theo Y.

Phải xét khi cần:

- text coordinates;
- reading order;
- columns;
- line wrapping;
- heading/section blocks;
- khoảng cách giữa question number và body;
- font metadata nếu có.

Với layout hai cột, reading order phải được xác định đúng trước khi xây Question Index.

Không tạo rule riêng cho PDF test hiện tại.

---

# 5. TASK-04 — Page Neighborhood Scanner

Mỗi target page phải có neighborhood nhẹ:

```text
previous physical page
        ↓
target physical page
        ↓
next physical page
```

### Target page

Scan đầy đủ để biết toàn bộ question inventory trên trang.

### Previous page

Chỉ cần đủ để xác định:

- question cuối trang trước;
- question đó có tiếp tục sang target page không;
- target range có bắt đầu giữa một question hay không.

### Next page

Chỉ cần đủ để xác định:

- question cuối target page có tiếp tục không;
- question kế tiếp bắt đầu ở đâu;
- boundary target nằm ở đâu.

Neighbor chỉ là **context**, không tự động trở thành output.

---

# 6. TASK-05 — Build Question Index

Question Index phải cho phép một question nằm trên nhiều physical page.

Ví dụ:

```json
{
  "questionNumber": 41,
  "segments": [
    { "physicalPage": 13, "bbox": {} },
    { "physicalPage": 14, "bbox": {} }
  ],
  "firstPage": 13,
  "lastPage": 14
}
```

Không được giả định:

```text
one question = one page
```

Index nên lưu/cache theo document + document version/hash + physical page.

---

# 7. TASK-06 — Requested Range Validator (HARD GATE)

Ví dụ:

```text
requested = Q30–Q44
expected count = 15
```

Index phải xác nhận đủ:

```text
30,31,32,33,34,35,36,37,38,39,40,41,42,43,44
```

Nếu thiếu bất kỳ câu nào:

```text
RANGE_MISMATCH
```

**Không được silent partial success.**

Ví dụ:

```text
Requested: 30–44
Detected: 41–44
```

Không được tiếp tục tạo PDF 4 câu rồi báo success.

Phải:

```text
mismatch
→ re-scan
→ layout re-analysis
→ targeted vision nếu cần
→ rebuild index
→ validate lại
```

Nếu vẫn không xác định được thì trả trạng thái lỗi/warning rõ ràng, không tạo output thiếu câu.

---

# 8. TASK-07 — Missing Question Recovery

Khi text/layout scanner không thấy đủ câu:

```text
1. Re-read PDF text spans
2. Rebuild reading order
3. Inspect columns/layout
4. Check previous/next page
5. Targeted vision scan
6. Rebuild Question Index
7. Validate lại
```

Không gửi toàn bộ document cho Agnes chỉ vì một page bị ambiguous.

---

# 9. TASK-08 — Vision fallback

Agnes chỉ là fallback khi:

- PDF là scan;
- question number là image;
- text extraction thiếu;
- layout/reading order ambiguous;
- code detectors conflict.

Structured vision output conceptual:

```json
{
  "page": 13,
  "questions": [
    { "number": 30, "top": 102, "bottom": 186 }
  ]
}
```

Prompt vision chỉ yêu cầu **inventory + boundary**, không yêu cầu viết lại toàn bộ câu hỏi.

Agnes không được tự động overwrite kết quả code nếu hai detector conflict; phải đưa conflict vào validation/reconciliation.

---

# 10. TASK-09 — Target / Continuation / Context isolation

Downstream extraction plan phải phân biệt:

```text
TARGET
CONTINUATION
CONTEXT
```

Ví dụ:

```json
{
  "pages": [
    { "page": 12, "role": "context" },
    { "page": 13, "role": "target" },
    { "page": 14, "role": "continuation" }
  ]
}
```

Renderer/reconstruction chỉ được lấy TARGET + CONTINUATION.

CONTEXT chỉ dùng để xác định boundary/validate.

Không được để Q45/Q46 của trang kế tiếp lọt vào request Q30–Q44 chỉ vì page đó được scan làm context.

---

# 11. TASK-10 — Exact Extraction Plan

Sau khi range được validate:

```text
User: Q30–Q44
↓
Question Index
↓
validated target questions
↓
PLAN-04 Adaptive Extraction Window
```

PLAN-05 không thay thế PLAN-04.

PLAN-05 chịu trách nhiệm:

- question inventory;
- question boundary metadata;
- requested range correctness.

PLAN-04 chịu trách nhiệm:

- adaptive page expansion;
- cross-page extraction window;
- exact physical extraction.

Hai plan phải reuse cùng abstractions, không tạo hai engine cạnh tranh.

---

# 12. TASK-11 — Cache / Performance

Ưu tiên:

```text
cached Question Index
→ PDF text extraction
→ layout analysis
→ targeted vision
→ full vision chỉ khi bất khả kháng
```

Nếu user request lại cùng PDF:

```text
Request 1: Q30–44
Request 2: Q31–43
```

không scan lại toàn bộ PDF nếu Question Index còn valid.

Không batch Agnes máy móc cho page indexing khi code đã xác định được boundary.

---

# 13. TASK-12 — Confidence + conflict handling

Mỗi index entry nên có confidence/detection method.

Ví dụ:

```text
PDF text + coordinates rõ       → high
Multi-column ambiguous          → medium
Vision-only                     → medium/low
Detector conflict               → low
```

Nếu code và vision đưa kết quả khác nhau:

```text
CONFLICT
→ reconcile
→ không silently chọn một bên
```

Threshold cụ thể phải reuse framework hiện có nếu repository đã có.

---

# 14. TASK-13 — Observability

Trong development/debug mode cần log được:

```text
REQUEST
printed page: 13
questions: 30–44

PAGE RESOLUTION
printed 13 → physical 13

NEIGHBORHOOD
previous: 12
 target: 13
 next: 14

QUESTION INDEX
30 ...
31 ...
...
44 ...

VALIDATION
expected: 15
detected: 15
missing: none
extra: none

RESULT
RANGE_VALID
```

Nếu mismatch:

```text
expected: 15
detected: 4
missing: 30–40
recovery: vision
```

Không log API key hoặc dữ liệu nhạy cảm.

---

# 15. TASK-14 — Service/API boundary

Tạo service abstraction phù hợp architecture hiện tại, conceptual:

```ts
QuestionIndexService
  buildPageIndex(...)
  buildNeighborhoodIndex(...)
  validateRequestedRange(...)
  buildExtractionPlan(...)
```

Không nhét toàn bộ logic vào HTTP route handler.

Nếu project đã có service tương đương thì mở rộng service đó thay vì tạo duplicate.

---

# 16. TASK-15 — Regression tests bắt buộc

### Case A — production bug

```text
Trang 13 câu 30 đến 44
Expected: Q30–Q44 (15 câu)
```

### Case B

```text
Trang 13 câu 31 đến 43
Expected: Q31–Q43 (13 câu)
```

### Case C — previous-page continuation

Q40 bắt đầu ở page trước và tiếp tục ở target.

Request Q40–41 phải trả đủ Q40 + Q41.

### Case D — next-page continuation

Q44 bắt đầu target, tiếp tục next page, Q45 bắt đầu sau Q44.

Request Q44 không được lấy Q45.

### Case E — two-column layout

Question inventory phải đúng reading order.

### Case F — rich-content question

Question có image/diagram/formula vẫn phải index đúng boundary.

### Case G — scanned PDF

Text extraction fail → vision fallback, không được báo “không có câu hỏi” ngay.

---

# 17. TASK-16 — Không hard-code

Tuyệt đối không thêm rule kiểu:

```text
if page == 13 → questions = 30..44
if chemistry → scan 41..44
```

Không dùng đặc điểm riêng của PDF regression làm business rule.

---

# 18. Acceptance Criteria

- [ ] Target page được scan đầy đủ.
- [ ] Neighbor pages được scan khi cần.
- [ ] Question Index được tạo trước extraction.
- [ ] Question number + boundary được lưu.
- [ ] Multi-page question được hỗ trợ.
- [ ] Previous-page continuation được hỗ trợ.
- [ ] Next-page continuation được hỗ trợ.
- [ ] Context và target được phân biệt.
- [ ] Requested range được validate bằng hard gate.
- [ ] Partial result không được silently accepted.
- [ ] Missing question có recovery path.
- [ ] Vision chỉ là fallback khi cần.
- [ ] Index có cache.
- [ ] Multi-column layout được xử lý.
- [ ] Rich-content question không phá indexing.
- [ ] Agnes conflict không tự động overwrite code result.
- [ ] PLAN-04 nhận extraction plan từ PLAN-05.
- [ ] `Trang 13 câu 30–44` → đủ 15 câu.
- [ ] `Trang 13 câu 31–43` → đủ 13 câu.
- [ ] Không leak câu ngoài requested range.
- [ ] UI hiện tại không bị thay đổi.
- [ ] Renderer/theme hiện tại không bị thay đổi.
- [ ] Existing answer/PDF pipeline không regression.

---

# 19. Definition of Done

Agent phải:

1. Inspect architecture hiện tại trước khi code.
2. Tìm và reuse page resolver, PDF extractor, layout parser, question parser hiện có.
3. Implement PLAN-05.
4. Integrate với PLAN-04.
5. Viết regression tests.
6. Chạy test suite liên quan.
7. Generate regression PDF.
8. Verify actual extracted question list.
9. Verify page-13 production regression.
10. Cập nhật `docs/agent-handoff.md`.
11. Báo cáo files changed, tests, regression result và known limitations.

Không redesign UI.
Không thay đổi Agnes provider.
Không thay đổi PDF theme.
Không refactor unrelated modules.

---

# 20. Core principle

> **Never render what the system has not first proven belongs to the requested question range.**

> **Never accept a partial question range as a successful extraction.**

> **Code phải xác định vùng tài liệu trước; Agnes chỉ xử lý những phần semantic/vision mà code không thể xác định chắc chắn.**
