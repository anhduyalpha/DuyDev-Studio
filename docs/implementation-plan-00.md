# Kế Hoạch Triển Khai: PLAN 0 — AUDIT EXISTING PDF EXERCISE MODULE

> **Tài liệu tham chiếu**: `tasks/00_README.md`, `tasks/17_GLOBAL-RULES.md`, `tasks/02_TASK-00-AUDIT.md`  
> **Mục tiêu duy nhất**: Khảo sát, đo đạc và thấu hiểu tường tận toàn bộ hiện trạng của module "Tạo Bài Tập Trắc Nghiệm" (frontend, backend, storage, engine, pipeline AI Agnes, queue, test) trước khi bước vào các task tái thiết kế mã nguồn.  
> **Nguyên tắc cốt tử**: **KHÔNG** implement code, **KHÔNG** redesign UI, **KHÔNG** refactor trong bước này.

---

## 1. Bản Đồ & Hiện Trạng 18 Hạng Mục Kỹ Thuật (Architecture Landscape)

### 1.1. Framework Frontend & Backend Hiện Tại
* **Frontend**: 
  - Vanilla JavaScript hiện đại (ES Modules) kết hợp Tailwind CSS utility classes.
  - Không sử dụng bundler nặng (không React, không Vue, không Angular, không Webpack/Vite build step cho frontend client).
  - Tệp tĩnh được phục vụ trực tiếp qua plugin `@fastify/static` từ thư mục gốc `/` và `/src/`.
* **Backend**:
  - Node.js runtime (v20.20.x LTS) viết bằng **TypeScript (v5.4.2)** trên nền framework **Fastify (v4.26.2)**.
  - Quản lý build/chạy: `tsx` trong môi trường dev (`npm run dev`) và `tsc` sinh mã ra `dist/` khi production (`npm run build && npm start`).
  - Hàng đợi tiến trình: **BullMQ (v5.4.0)** kết nối Redis cục bộ (`ioredis v5.3.2`).
  - Cơ sở dữ liệu: **Prisma ORM (v5.11.0)** trên tệp SQLite WAL (`server/dev.db`).

### 1.2. Vị Trí Module "Tạo Bài Tập Trắc Nghiệm"
* **Giao diện người dùng (UI Contract - BẤT KHẢ XÂM PHẠM)**:
  - Entry container: `src/components/tools/quiz/QuizWorkspace.js`
  - Bảng cấu hình tham số: `src/components/tools/quiz/components/QuizConfigPanel.js`
  - Thẻ hiển thị tiến trình & kết quả: `src/components/tools/quiz/components/QuizResultCard.js`
  - Danh sách lịch sử tạo đề: `src/components/tools/quiz/components/QuizHistoryList.js`
  - State Manager: `src/components/tools/quiz/hooks/useQuiz.js`
  - Event Listeners: `src/components/tools/quiz/hooks/useQuizListeners.js`
  - API Client: `src/components/tools/quiz/hooks/quizApi.js`
  - History Local Helper: `src/components/tools/quiz/utilities/quizHistoryHelper.js`
* **Backend Gateway & Worker (Hiện đã được backup tại `backup/quiz-engine-v1`)**:
  - Controller: `server/src/api/controllers/quiz.controller.ts`
  - Routes: `server/src/api/routes/quiz.route.ts`
  - BullMQ Worker: `server/src/workers/quiz.worker.ts`
  - Zod Schema: `server/src/schemas/quiz.schema.ts`
* **Python Engine (Lõi trích xuất & biên dịch - tại `backup/quiz-engine-v1`)**:
  - Trục điều phối chính: `engines/quiz/quiz_pipeline.py`
  - Trích xuất định thức: `engines/quiz/mcq_parser.py`
  - Tiện ích làm sạch text: `engines/quiz/text_utils.py`
  - Cache đa tầng: `engines/quiz/quiz_cache.py`
  - Assets KaTeX cục bộ: `engines/quiz/assets/katex/`

### 1.3. Upload Flow
* **Phía Client**:
  - Khi người dùng chọn file PDF tại `QuizConfigPanel.js`, hàm `setFile(file)` trong `useQuiz.js` được kích hoạt.
  - Gọi `uploadQuizFile(file)` từ `quizApi.js`, ủy quyền cho module `smartUploadFile` (`src/utilities/resumableUploader.js`).
  - File nhỏ được gửi trực tiếp qua `POST /api/v1/files/upload`. File lớn được chia chunk qua `POST /api/v1/files/upload/chunk` và ráp lại tại `POST /api/v1/files/upload/complete`.
  - Phản hồi từ server trả về `{ success: true, fileId: "fil_xxx" }`. Mã `fileId` này được gán vào `state.fileId`.
* **Phía Server**:
  - Tệp được kiểm tra MIME (`application/pdf`), lưu trữ an toàn dưới thư mục `data/storage/` (quản lý bởi `StorageManager`), và tạo bản ghi trong bảng `FileRecord` (Prisma).

### 1.4. Google Drive Flow
* **Phía Client**:
  - Người dùng có thể dán đường dẫn Google Drive vào ô `quizDriveInput`.
  - `useQuiz.js` xác thực URL qua hàm regex `isValidDriveUrl(url)` (kiểm tra khớp định dạng `drive.google.com/file/d/...` hoặc `drive.google.com/open?id=...`).
  - Nếu hợp lệ, `state.gdriveUrl` được ghi nhận và xóa bỏ file tải lên cục bộ (chỉ 1 trong 2 nguồn được kích hoạt).
* **Phía Server & Engine (Điểm nghẽn nghiêm trọng)**:
  - Server không tải trước file Drive trong worker mà đẩy chuỗi `gdriveUrl` thẳng xuống Python CLI qua đối số `input_source`.
  - Hàm `download_gdrive_if_needed(url_or_path, temp_dir)` trong `quiz_pipeline.py` dùng regex thô để bóc `file_id` và tải bằng `urllib.request` từ link công khai `https://drive.google.com/uc?export=download&id={file_id}`.
  - **Khiếm khuyết**: Nếu Google Drive yêu cầu quét virus (file lớn > 100MB) hoặc link giới hạn quyền, script Python sẽ ném ngoại lệ `RuntimeError` và làm chết job ngay lập tức.

### 1.5. Existing HTTP Routes
| Endpoint | Phương thức | Trách nhiệm | Input Payload | Output Data |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/quiz/parse-prompt` | `POST` | Phân tích câu lệnh tiếng Việt tự do ra tham số | `{ prompt: string }` | `{ pages, count, start, title, prefix }` |
| `/api/v1/quiz/generate` | `POST` | Tạo job xử lý và đưa vào hàng đợi | `CreateQuizJobInput` | `{ jobId, status: "QUEUED", eventsUrl, pollUrl }` |
| `/api/v1/jobs/:id/events` | `GET` | Stream tiến trình thời gian thực (SSE) | Header `Accept: text/event-stream` | Event `progress`, `completed`, `failed` |
| `/api/v1/jobs/:id` | `GET` | Polling trạng thái dự phòng khi SSE rớt | `jobId` param | Thông tin chi tiết job + kết quả tải |
| `/api/v1/files/view/:id` | `GET` | Xem trước PDF trực tiếp trên trình duyệt | `fileId` param | PDF stream binary |
| `/api/v1/files/download/:id`| `GET` | Tải xuống tệp PDF về máy | `fileId` param | PDF binary với header `attachment` |

### 1.6. Storage & Database
* **Database Models (Prisma `schema.prisma`)**:
  - `Job`: Lưu vòng đời tác vụ (`id`, `type = "quiz_generate"`, `status = QUEUED | PROCESSING | COMPLETED | FAILED`, `progress`, `optionsJson`, `errorMessage`).
  - `FileRecord`: Lưu siêu dữ liệu file đầu vào & đầu ra (`id`, `jobId`, `originalName`, `mimeType`, `sizeBytes`, `storagePath`, `isPurged`, `expiresAt`).
  - `HistoryRecord`: Lưu lịch sử xuất bản của công cụ (`toolId = "quiz-generator"`, `title`, `metaJson`).
* **Hệ thống tệp lưu trữ (Storage File System)**:
  - Tệp gốc: `data/storage/` (hoặc cấu hình S3/R2 nếu bật).
  - Tệp tạm thời trong quá trình chạy: `data/temp/quiz_{jobId}/` được tự động tạo và dọn dẹp khi kết thúc.

### 1.7. Background Job & Progress Streaming
* **Hàng đợi**: BullMQ Queue tên `'ds-quiz-tasks'` (được kích hoạt bằng hàm `enqueueQuizJob`).
* **Worker Execution**: `quiz.worker.ts` nhận job, tạo thư mục tạm, gọi tiến trình Python `spawn(pythonBin, ['quiz_pipeline.py', ...])`.
* **Luồng phát tiến trình (Progress Pipe)**:
  - Python engine phát các dòng JSON stdout: `{"progress": 25, "stage": "..."}`.
  - Worker dùng `readline` bắt từng dòng stdout $\rightarrow$ gọi `publishJobEvent(jobId, 'progress', ...)` bắn qua Redis channel `job:events:${jobId}` $\rightarrow$ Endpoint Fastify SSE đẩy về trình duyệt của người dùng.

### 1.8. PDF Extraction (Trích xuất PDF Hiện Tại)
* **Thư viện**: PyMuPDF (`fitz`).
* **Cơ chế**:
  - Trích xuất văn bản theo khối hình học: gom tọa độ $x_0, y_0, x_1, y_1$ để phân biệt cột trái vs cột phải.
  - Lọc Header/Footer dựa trên ngưỡng toạ độ cứng ($y \le 0.08 \cdot H$ hoặc $y \ge 0.86 \cdot H$) kèm regex từ khóa.
  - Nối trang (`stitch_cross_page_text`) dựa trên câu hỏi cuối cùng của trang trước chưa có đủ phương án.
  - Trích xuất hình ảnh: Kết hợp cắt ảnh raster từ `page.get_images()` và nhóm các vector vẽ (`page.get_drawings()`) qua thuật toán sweep-line gom rect.

### 1.9. Tình Trạng OCR Hiện Tại
* **Hiện trạng**: **HOÀN TOÀN CHƯA CÓ OCR**.
* **Bằng chứng**: Trong `quiz_pipeline.py`:
  ```python
  clean_len = len(re.sub(r"\s+", "", stitched_text))
  if clean_len < 50:
      raise ValueError("Tài liệu có thể là ảnh scan thuần túy. Vui lòng chọn trang có lớp chữ hoặc OCR trước.")
  ```
  Nếu gặp trang scan ảnh, hệ thống lập tức báo lỗi và từ chối xử lý, vi phạm quy tắc số 21 trong `tasks/17_GLOBAL-RULES.md`.

### 1.10. Tích Hợp Agnes AI (Agnes Integration)
* **Endpoint**: `https://apihub.agnes-ai.com/v1/chat/completions` (OpenAI-compatible protocol).
* **Model đang cấu hình**: `agnes-3.0-flash`.
* **Xử lý gọi mạng**: Sử dụng `urllib.request` thuần trong Python, có cơ chế retry tối đa 3 lần với exponential backoff khi gặp lỗi HTTP 429, 500, 502, 503, 504.
* **Song song**: Bọc trong `ThreadPoolExecutor` với số luồng cấu hình qua `QUIZ_AI_CONCURRENCY` (mặc định 4 luồng).

### 1.11. Các Prompt AI Hiện Tại
1. **Prompt Phân tích câu lệnh (`quiz.controller.ts`)**:
   - Yêu cầu AI bóc tách JSON `{ pages, count, start, title, prefix }`.
2. **Prompt Chuẩn hóa Phase 1 (`_build_phase1_prompt` trong `quiz_pipeline.py`)**:
   - Gửi danh sách câu hỏi thô kèm yêu cầu: sửa lỗi chính tả, chuyển công thức Hóa sang `<sub>/<sup>`, chuyển công thức Toán sang `$ KaTeX $`, bảo toàn `[IMAGE_REF]`, và **tự giải để tìm ra đáp án đúng A/B/C/D**.
3. **Prompt Viết lời giải Phase 2 (`_build_phase2_prompt` trong `quiz_pipeline.py`)**:
   - Gửi stem + options + correct answer và yêu cầu viết 1-3 câu giải thích chi tiết bằng tiếng Việt.

### 1.12. Intermediate Data & Schema
* **Phía TypeScript**: Schema được quản lý chặt chẽ qua Zod trong `server/src/schemas/quiz.schema.ts` (`createQuizJobSchema`, `quizQuestionSchema`, `quizJobResultSchema`).
* **Phía Python**: Dữ liệu trung gian được chuyển đổi dưới dạng Python `dict`:
  - `parsed_block`: `{ source_number: int, stem: str, clean_stem: str, options: dict, confidence: "high"|"low", raw: str }`
  - `question`: `{ number: int, question: str, options: dict, answer: str, explanation: str, image_ref: str|None, option_images: dict|None }`

### 1.13. HTML/CSS Renderer
* Hệ thống sử dụng mẫu HTML/CSS A4 2 cột chuyên dụng viết cứng dạng string template trong mã nguồn Python (`WORKSHEET_HTML_TEMPLATE` và `ANSWER_KEY_HTML_TEMPLATE`).
* CSS nhúng bộ font `Geist` và font KaTeX cục bộ, định nghĩa phân trang `@page { size: A4 portrait; margin: 12mm 10mm 12mm 10mm; }`, chống ngắt câu mồ côi bằng `break-inside: avoid;`.

### 1.14. PDF Compiler
* Gọi trực tiếp trình duyệt Google Chrome cài sẵn trên hệ điều hành (`find_chrome_path`) ở chế độ headless:
  ```bash
  chrome --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files \
         --run-all-compositor-stages-before-draw --virtual-time-budget=8000 \
         --print-to-pdf="output.pdf" "file:///temp/worksheet.html"
  ```
* Cơ chế KaTeX hoàn toàn offline nhờ vendor sẵn trọn bộ assets vào `engines/quiz/assets/katex/`, không phụ thuộc vào internet.

### 1.15. Sinh Đáp Án & Lời Giải (Answer & Solution Generation)
* Đáp án đúng (`answer`) hiện đang dựa hoàn toàn vào việc giao cho AI tự suy luận trong Phase 1.
* Lời giải chi tiết (`explanation`) được AI viết trong Phase 2, ghép vào ma trận bảng đáp án ở đầu trang và khối danh sách lời giải ở các trang sau của file `DapAn.pdf`.

### 1.16. Preview & Download Flow
* Khi job hoàn thành (100%), worker trả về đối tượng kết quả chứa siêu dữ liệu của 2 file:
  - `worksheet`: `{ fileId, fileName: "..._DeBai.pdf", downloadUrl, viewUrl }`
  - `answer`: `{ fileId, fileName: "..._DapAn.pdf", downloadUrl, viewUrl }`
* UI nhận sự kiện `completed` từ SSE, ẩn thanh tiến trình, hiển thị `QuizResultCard.js` với 2 nút:
  - **Xem trước**: Mở modal `FileViewerConnector.js` nhúng PDF viewer trực tiếp.
  - **Tải về**: Gọi trực tiếp đường dẫn `downloadUrl`.

### 1.17. Cơ Chế Dọn Dẹp (Cleanup)
* Trong Python: Khối `finally` xóa sạch toàn bộ thư mục tạm thời trên đĩa (`temp_dir`, `job_html_dir`).
* Trong Node.js: `JanitorService` chạy định kỳ mỗi 15 phút, quét bảng `FileRecord` để xóa các tệp quá hạn (hết `expiresAt`) và các chunk upload dở dang.

### 1.18. Hệ Thống Kiểm Thử (Tests)
* **Backend Vitest**: 3 file unit test (`tests/unit/quiz.test.ts`, `quiz_prompt.test.ts`, `quiz_history.test.ts`).
* **Python Engine**:
  - `test_mcq_parser.py`: Kiểm tra bóc tách cấu trúc regex, thứ tự 2 cột $A-C-B-D$, lọc tự luận.
  - `test_quiz_pipeline_v2.py`: Kiểm tra 51 test case toàn diện từ HTML render, layout, batching, thread lock đến error handling.
  - `test_adversarial_wp2.py` & `test_adversarial_wp3_wp8.py`: Kiểm tra phòng thủ adversarial inputs, timeout, retry, salvage JSON cụt.

---

## 2. Đánh Giá Chuyên Sâu: Điểm Khuyết, Quá Tải & Tiềm Năng Tối Ưu (Critical Gaps & Opportunities)

### 2.1. Code Có Thể Tái Sử Dụng (Reuse)
1. **Frontend PWA Contract (100% Giữ nguyên)**: Toàn bộ cấu trúc UI `src/components/tools/quiz/` đã hoàn thiện chỉn chu, cơ chế SSE và fallback polling cực kỳ mượt mà.
2. **Khung sườn PDF Headless Chrome**: Logic tìm binary Chrome, tập cờ in ấn headless và bộ assets KaTeX cục bộ (`assets/katex/`) hoàn toàn có thể tái sử dụng nguyên vẹn.
3. **Prisma Job Lifecycle & File Storage**: Mô hình lưu trữ `Job`, `FileRecord`, `StorageManager` đã được chuẩn hóa trong toàn bộ hệ thống DD Studio.
4. **Thuật toán hình học Sweep-Line $O(n \log n)$**: Hàm gom nhóm vector drawings trong `quiz_pipeline.py` chạy rất nhanh và chính xác.

### 2.2. Code Đang Lỗi / Khiếm Khuyết Nghiêm Trọng (Defects & Gaps)
1. **Tải Google Drive quá ngây thơ**: Dùng `urllib.request` tải link chia sẻ công khai mà không có cơ chế bypass trang xác nhận virus (> 100MB) hoặc không lưu trữ vào storage tập trung của server.
2. **Thiếu hoàn toàn khả năng OCR**: Khi gặp PDF scan dạng ảnh, pipeline ném lỗi `ValueError` thay vì kích hoạt đường dẫn xử lý Vision/OCR (`tasks/17_GLOBAL-RULES.md`, Rule 21).
3. **Phụ thuộc vào Regex để đếm câu & phân trang**: Khi gặp các định dạng đề thi ngoại lệ (đề thi SAT, đề tiếng Anh, đề bài kẻ khung bảng), bộ regex dễ bị ngộ nhận hoặc bỏ sót câu.
4. **Không có cơ chế Visual QA**: Sau khi Chrome xuất PDF, không có khâu kiểm tra thị giác xem công thức toán có bị tràn lề, hình vẽ có bị chèn đè lên chữ hay không.

### 2.3. Code Đang Giao Quá Nhiều Trách Nhiệm Cho Agnes (AI Overburden)
* **Prompt Phase 1 ôm đồm cùng lúc 5 việc**:
  - Vừa sửa chính tả tiếng Việt.
  - Vừa chuyển đổi công thức Toán/Hóa sang LaTeX/HTML.
  - Vừa giải đề để tìm đáp án đúng A/B/C/D.
  - Vừa map hình ảnh `[IMAGE_REF]`.
  - Vừa sửa lại cấu trúc JSON khi độ tin cậy thấp.
  $\rightarrow$ Điều này biến Agnes thành "nút thắt cổ chai", dễ sinh ảo giác (hallucination), giải sai đáp án hoặc làm sai lệch cấu trúc câu hỏi gốc.

### 2.4. Điểm Có Thể Làm Deterministic Để Giảm AI Calls (Cost & Latency Reduction)
1. **Deterministic Fast-Path cho Prompt Parsing**: Sử dụng bộ phân tích cú pháp biểu thức chính quy (Regex AST) cho 90% câu lệnh chuẩn (`trang X-Y lấy Z câu`). Chỉ gọi Agnes khi câu lệnh mơ hồ hoặc phi cấu trúc.
2. **Bóc tách bảng đáp án sẵn có (Answer Key Extraction)**: 80% tài liệu ôn thi có sẵn bảng đáp án ở cuối trang/cuối sách (ví dụ: `1.A 2.B 3.C...`). Xây dựng module tự động tìm và bóc tách bảng đáp án này sẽ **giảm 100% số lần gọi AI giải đề**.
3. **Quyết định Bố Cục Cột (Columnization)**: Phân chia 1 cột, 2 cột hay 4 cột dựa trên đo đạc chiều dài ký tự và kích thước ảnh bằng thuật toán hình học, không cần AI quyết định.
4. **Chuẩn hóa công thức Hóa học cơ bản**: Dùng regex chuyển đổi các chất phổ biến (`H2O`, `CO2`, `H2SO4`, `NaOH`) sang thẻ `<sub>` trước khi cần đến AI.

---

## 3. Kế Hoạch Thực Hiện PLAN 0: AUDIT (Step-by-Step Audit Execution)

### Bước 1: Khảo sát Luồng Nhận Dạng & Nhập Liệu (Ingestion & Drive Audit)
- Kiểm tra chi tiết luồng xử lý file upload từ client lên server.
- Phân tích rủi ro trong việc trích xuất và tải file Google Drive hiện tại; đề xuất kiến trúc xử lý Drive an toàn tại tầng server trước khi chuyển xuống engine.

### Bước 2: Khảo sát Lõi Thị Giác PDF & Thử Nghiệm OCR (PDF Perception & OCR Audit)
- Đánh giá khả năng phân tách văn bản 2 cột và cắt ảnh của PyMuPDF trên nhiều loại tài liệu (sách giáo khoa, đề thi scan, đề thi Word convert).
- Xác định điểm tích hợp công nghệ OCR (nhận diện trang scan qua `agnes-3.0-flash` Vision hoặc Tesseract/PaddleOCR cục bộ).

### Bước 3: Khảo sát Tương Tác Agnes AI & Chiến Lược Micro-Batching (Agnes Provider Audit)
- Rà soát các tham số cấu hình: `AGNES_AI_BASE_URL`, `AGNES_AI_MODEL`, `AGNES_AI_API_KEY`.
- Phân rã các prompt hiện tại thành các micro-prompt chuyên biệt theo mô hình **AI Micro-Pipeline**.

### Bước 4: Khảo sát Cơ Chế Trình Bày & Biên Dịch PDF (Renderer & Compilers Audit)
- Kiểm tra tính tương thích của KaTeX v0.16.11 offline đối với các công thức hóa học phức tạp (vòng benzen, mũi tên thuận nghịch $\rightleftharpoons$).
- Đánh giá độ ổn định và tài nguyên CPU/RAM của tiến trình headless Chrome khi chạy nhiều job đồng thời.

### Bước 5: Tổng Hợp & Xuất Bản Các Tài Liệu Audit Bắt Buộc
- Biên tập và tạo 3 tài liệu báo cáo đầy đủ theo đúng đặc tả của `tasks/02_TASK-00-AUDIT.md`:
  1. `docs/current-module-audit.md` (Báo cáo giải phẫu chi tiết toàn bộ thành phần).
  2. `docs/current-data-flow.md` (Sơ đồ luồng dữ liệu từ upload $\rightarrow$ background $\rightarrow$ engine $\rightarrow$ output).
  3. `docs/agent-handoff.md` (Tài liệu bàn giao hiện trạng kỹ thuật cho Agent thực hiện TASK-01).

---

## 4. Danh Mục Tệp (Files & Artifacts)

### Files Cần Inspect
- **Frontend**:
  - `src/components/tools/quiz/QuizWorkspace.js`
  - `src/components/tools/quiz/components/QuizConfigPanel.js`
  - `src/components/tools/quiz/components/QuizResultCard.js`
  - `src/components/tools/quiz/hooks/useQuiz.js`
  - `src/components/tools/quiz/hooks/quizApi.js`
  - `src/utilities/resumableUploader.js`
- **Backend (tại nhánh `backup/quiz-engine-v1` và server hiện tại)**:
  - `server/src/app.ts`
  - `server/src/api/controllers/quiz.controller.ts`
  - `server/src/api/routes/quiz.route.ts`
  - `server/src/workers/quiz.worker.ts`
  - `server/src/queues/task.queue.ts`
  - `server/src/schemas/quiz.schema.ts`
  - `server/prisma/schema.prisma`
  - `server/src/services/janitor.service.ts`
- **Engine (tại nhánh `backup/quiz-engine-v1`)**:
  - `engines/quiz/quiz_pipeline.py`
  - `engines/quiz/mcq_parser.py`
  - `engines/quiz/quiz_cache.py`
  - `engines/quiz/text_utils.py`
  - `engines/quiz/test_quiz_pipeline_v2.py`
  - `engines/quiz/test_mcq_parser.py`

### Files Dự Kiến Tạo (Expected Artifacts)
- `docs/implementation-plan-00.md` (Tệp kế hoạch này).
- `docs/current-module-audit.md` (Báo cáo audit chi tiết từng component).
- `docs/current-data-flow.md` (Bản đồ luồng dữ liệu trực quan).
- `docs/agent-handoff.md` (Biên bản bàn giao cho TASK-01).

---

## 5. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

- [ ] Bản kế hoạch bao phủ đầy đủ 18 mục kỹ thuật được yêu cầu và trả lời chính xác hiện trạng của codebase.
- [ ] Xác định rõ ranh giới giữa code có thể tái sử dụng, code bị lỗi, các điểm Agnes bị quá tải và các cơ hội tối ưu deterministic.
- [ ] **Tuyệt đối không có dòng code nào bị sửa đổi hay refactor** trong mã nguồn ứng dụng (giữ nguyên quy tắc chỉ lập plan và khảo sát).
- [ ] Giao diện người dùng (UI Contract) được bảo toàn nguyên vẹn 100%.
- [ ] Cung cấp đầy đủ cơ sở kỹ thuật rõ ràng để một kỹ sư mới có thể đọc hiểu toàn bộ hệ thống mà không cần mở từng tệp nguồn.

---

## 6. Trạng Thái & Điểm Dừng (Checkpoint)
- Sau khi lưu bản kế hoạch này vào `docs/implementation-plan-00.md`, **tiến trình sẽ dừng lại ngay lập tức** để chờ xác nhận từ người dùng trước khi tiến hành viết các tài liệu audit chi tiết.
