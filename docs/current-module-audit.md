# Báo Cáo Giải Phẫu Kỹ Thuật: Module Tạo Bài Tập Trắc Nghiệm (Audit Report)

> **Mã công việc**: `TASK-00 — Audit Existing Module`  
> **Tài liệu tham chiếu**: `tasks/00_README.md`, `tasks/17_GLOBAL-RULES.md`, `tasks/02_TASK-00-AUDIT.md`, `docs/implementation-plan-00.md`  
> **Trạng thái**: Hoàn thành khảo sát thực tế trên toàn bộ codebase và nhánh dự phòng `backup/quiz-engine-v1`.

---

## 1. Bảng Giải Phẫu Từng Thành Phần (Component Anatomy)

### 1.1. Tầng Giao Diện (Presentation & Frontend Layer)
*Toàn bộ tầng giao diện được giữ nguyên vẹn 100% (UI Contract).*

#### Thành phần 1: `QuizWorkspace.js`
- **Đường dẫn**: `src/components/tools/quiz/QuizWorkspace.js`
- **Hàm/Class**: `renderQuizWorkspace()`
- **Vai trò**: Vùng chứa đơn cột (Single-Column Workspace) điều phối hiển thị luồng tạo bài tập: Điều hướng breadcrumb, Form cấu hình (`quizConfigContainer`), Thẻ kết quả (`quizResultContainer`), và Kho lưu trữ lịch sử (`quizHistoryContainer`).
- **Input/Output**:
  - *Input*: `quizManager.getState()`
  - *Output*: Chuỗi HTML markup hoàn chỉnh.
- **Phụ thuộc**: `QuizConfigPanel.js`, `QuizResultCard.js`, `QuizHistoryList.js`, `useQuiz.js`, `useQuizListeners.js`.
- **Khả năng tái sử dụng**: **100% Reusable** (Không thay đổi).
- **Khiếm khuyết/Lỗ hổng**: Không có. Tuân thủ tuyệt đối chuẩn UI Minimalism.
- **Bằng chứng**: Mã nguồn ngắn gọn (59 dòng), bố cục Geist font, các container được đặt ID rõ ràng để mount động.

#### Thành phần 2: `QuizConfigPanel.js`
- **Đường dẫn**: `src/components/tools/quiz/components/QuizConfigPanel.js`
- **Hàm/Class**: `renderQuizConfigPanel(state)`
- **Vai trò**: Form thu thập tham số người dùng: Dropzone tải PDF (`#quizFileInput`), Ô nhập link Google Drive (`#quizDriveInput`), Khung nhận diện thông minh (`#quizPromptInput`, `#btnQuizParsePrompt`), Trang trích xuất (`#quizPagesInput`), Số câu (`#quizCountInput`), Bắt đầu từ câu (`#quizStartInput`), Tên file bắt buộc (`#quizPrefixInput`), Tiêu đề in (`#quizTitleInput`), và Nút hành động (`#btnQuizGenerate`).
- **Input/Output**:
  - *Input*: `state` từ `QuizManager`.
  - *Output*: Chuỗi HTML render form động theo từng bước (`step 1 -> 2 -> 3`).
- **Phụ thuộc**: `useQuiz.js` (`isValidDriveUrl`).
- **Khả năng tái sử dụng**: **100% Reusable**.
- **Khiếm khuyết/Lỗ hổng**: Không có lỗi UI. Tương tác mượt mà với state.
- **Bằng chứng**: Render có điều kiện ẩn form khi `state.isProcessing = true`, kiểm tra `isReadyToGenerate` chặt chẽ trước khi kích hoạt nút.

#### Thành phần 3: `QuizResultCard.js`
- **Đường dẫn**: `src/components/tools/quiz/components/QuizResultCard.js`
- **Hàm/Class**: `renderQuizResultCard(state)`, `renderProcessingState()`, `renderCompletedState()`, `renderErrorState()`
- **Vai trò**: Card động phản hồi kết quả: Hiển thị thanh tiến trình realtime khi đang chạy (0–100% + stage message + nút Hủy tác vụ `#btnQuizCancelJob`), Thẻ kết quả đôi khi hoàn thành (`_DeBai.pdf` và `_DapAn.pdf` kèm nút Xem trước / Tải về), hoặc Banner báo lỗi khi thất bại.
- **Input/Output**:
  - *Input*: `state` (`isProcessing`, `progress`, `stage`, `result`, `error`).
  - *Output*: Chuỗi HTML card trạng thái.
- **Phụ thuộc**: `FileViewerConnector.js`, `lucide-icons`.
- **Khả năng tái sử dụng**: **100% Reusable**.
- **Khiếm khuyết/Lỗ hổng**: Không có.
- **Bằng chứng**: Hỗ trợ đầy đủ badges (số hình vẽ, số câu MCQ, True/False, Short Answer), đường dẫn tải về hỗ trợ mã hóa tên file an toàn (`encodeURIComponent`).

#### Thành phần 4: `useQuiz.js` & `useQuizListeners.js`
- **Đường dẫn**: `src/components/tools/quiz/hooks/useQuiz.js`, `src/components/tools/quiz/hooks/useQuizListeners.js`
- **Hàm/Class**: Class `QuizManager` (Singleton `quizManager`), `attachQuizListeners()`
- **Vai trò**: State machine quản lý trạng thái tải tệp (`setFile`), nhập Google Drive (`setGdriveUrl`), gọi phân tích prompt (`parsePrompt`), gửi yêu cầu tạo đề (`generateQuiz`), và kết nối Server-Sent Events.
- **Input/Output**:
  - *Input*: Sự kiện DOM của người dùng.
  - *Output*: Phát sự kiện notify (`file-selected`, `job-started`, `job-enqueued`, `job-completed`, `job-failed`).
- **Phụ thuộc**: `quizApi.js`, `resumableUploader.js`, `storage.js`, `quizHistoryHelper.js`.
- **Khả năng tái sử dụng**: **100% Reusable**.
- **Khiếm khuyết/Lỗ hổng**: Không có rò rỉ bộ nhớ; có cơ chế abort upload (`uploadAbortController`) và đóng EventSource khi component unmount hoặc tạo job mới.
- **Bằng chứng**: Quản lý tiến trình upload và chuyển đổi mượt mà giữa tệp cục bộ và link Google Drive.

#### Thành phần 5: `quizApi.js`
- **Đường dẫn**: `src/components/tools/quiz/hooks/quizApi.js`
- **Hàm/Class**: `uploadQuizFile()`, `parsePromptApi()`, `generateQuizJob()`, `connectJobEvents()`
- **Vai trò**: HTTP Client giao tiếp với Fastify API Gateway. Quản lý kết nối SSE `EventSource` (`/api/v1/jobs/:id/events`) kèm cơ chế Polling dự phòng mỗi 2.5 giây (`GET /api/v1/jobs/:id`).
- **Input/Output**:
  - `parsePromptApi(prompt)` $\rightarrow$ Trả về `{ pages, count, start, title, prefix }`.
  - `generateQuizJob(payload)` $\rightarrow$ Trả về `{ jobId, status, eventsUrl, pollUrl }`.
  - `connectJobEvents(jobId, callbacks)` $\rightarrow$ Trả về hàm `teardown()`.
- **Phụ thuộc**: `resumableUploader.js`.
- **Khả năng tái sử dụng**: **100% Reusable**.
- **Khiếm khuyết/Lỗ hổng**: Không có. Khả năng chịu lỗi cao trên mạng di động nhờ cơ chế dual-channel (SSE + Polling timer).

---

### 1.2. Tầng Cổng Backend (Backend Gateway & Routing Layer)
*(Khảo sát từ codebase và nhánh lưu trữ `backup/quiz-engine-v1`)*

#### Thành phần 6: `quiz.route.ts` & `quiz.controller.ts`
- **Đường dẫn**: `server/src/api/routes/quiz.route.ts`, `server/src/api/controllers/quiz.controller.ts`
- **Hàm/Class**: `quizRoute(app)`, `enqueueQuizJob()`, `parsePromptIntent()`
- **Vai trò**:
  - `POST /api/v1/quiz/parse-prompt`: Bóc tách ngôn ngữ tự nhiên ra thông số đề thi.
  - `POST /api/v1/quiz/generate`: Xác thực payload qua Zod, tạo bản ghi `prisma.job` (`status = QUEUED`), đẩy vào BullMQ `quizQueue`.
- **Input/Output**:
  - *Input*: JSON body từ client.
  - *Output*: HTTP 200/202 JSON response.
- **Phụ thuộc**: `prisma.js`, `task.queue.ts`, `quiz.schema.ts`, `logger.js`.
- **Khả năng tái sử dụng**:
  - Khung route và xác thực Zod: **Tái sử dụng tốt**.
  - Logic phân tích prompt: **Cần tái cấu trúc**.
- **Khiếm khuyết/Lỗ hổng**:
  - Hàm `parsePromptIntent` có logic "reconcile" chắp vá giữa AI và Regex: Khi AI trả về sai số trang (nhầm giữa câu 1 và trang 11), code phải kiểm tra đè ngược lại.
  - Chưa xử lý tải trước tệp Google Drive tại server trước khi tạo job.
- **Bằng chứng**: Các đoạn code vá víu tại dòng 195–210 trong `quiz.controller.ts`:
  ```typescript
  if (regexDefaults.pages && regexDefaults.pages !== pagesRes) {
    if (regexDefaults.pages.includes(pagesRes) || pagesRes === '1' || !pagesRes) {
      pagesRes = regexDefaults.pages;
    }
  }
  ```

#### Thành phần 7: `quiz.schema.ts`
- **Đường dẫn**: `server/src/schemas/quiz.schema.ts`
- **Hàm/Class**: `createQuizJobSchema`, `parsePromptSchema`, `quizQuestionSchema`, `quizJobResultSchema`
- **Vai trò**: Định nghĩa hợp đồng dữ liệu chuẩn hóa bằng thư viện Zod, xác thực tính hợp lệ của tham số đầu vào và kết quả đầu ra.
- **Input/Output**: TypeScript Types & Zod Schemas.
- **Phụ thuộc**: `zod`.
- **Khả năng tái sử dụng**: **100% Reusable**.
- **Khiếm khuyết/Lỗ hổng**: Chưa có schema cho dữ liệu trung gian OCR và visual asset metadata.
- **Bằng chứng**: Xác thực chặt chẽ `pages`, `count` (1–200), `prefix`, và hỗ trợ chuyển đổi linh hoạt `gdriveUrl` hoặc `fileId`.

#### Thành phần 8: `task.queue.ts`
- **Đường dẫn**: `server/src/queues/task.queue.ts`
- **Hàm/Class**: `quizQueue`, `enqueueQuizJob()`, `publishJobEvent()`
- **Vai trò**: Đẩy tác vụ vào hàng đợi BullMQ Redis (`ds-quiz-tasks`) và xuất bản các sự kiện tiến trình qua Redis Pub/Sub (`job:events:${jobId}`).
- **Input/Output**: Job Payload $\rightarrow$ BullMQ Job.
- **Phụ thuộc**: `bullmq`, `ioredis`, `env.ts`.
- **Khả năng tái sử dụng**: **100% Reusable**.
- **Khiếm khuyết/Lỗ hổng**: Không có.
- **Bằng chứng**: Kết nối Redis an toàn, tự động xử lý ngắt kết nối và đóng hàng đợi nhẹ nhàng khi server shutdown.

---

### 1.3. Tầng Xử Lý Tác Vụ Nền (Worker & Engine Layer)

#### Thành phần 9: `quiz.worker.ts`
- **Đường dẫn**: `server/src/workers/quiz.worker.ts`
- **Hàm/Class**: `processQuizJob()`, `executeQuizEngine()`, `cleanQuizErrorMessage()`
- **Vai trò**: Lắng nghe job từ BullMQ, tìm đường dẫn tệp nguồn (từ `FileRecord`), tạo thư mục tạm `data/temp/quiz_{jobId}`, spawn tiến trình Python gọi `quiz_pipeline.py`, đọc từng dòng stdout JSON để emit SSE tiến trình, lưu kết quả vào Prisma và đăng ký tệp vào bảng `HistoryRecord`.
- **Input/Output**:
  - *Input*: `QuizJobPayload` (`jobId`, `fileId`, `gdriveUrl`, `pages`, `count`, ...).
  - *Output*: Cập nhật `prisma.job` (`COMPLETED` hoặc `FAILED`) và tạo 2 `FileRecord`.
- **Phụ thuộc**: `child_process`, `prisma.js`, `task.queue.ts`, `storage.manager.ts`.
- **Khả năng tái sử dụng**: Khung sườn worker và stream stdout tái sử dụng được, nhưng cần tái cấu trúc cách gọi engine.
- **Khiếm khuyết/Lỗ hổng**:
  - Bắn nguyên URL Google Drive xuống Python thay vì xử lý tải tệp tại worker.
  - Phân tích lỗi stderr của Python bằng regex chuỗi (`cleanQuizErrorMessage`) rất mỏng manh, dễ bỏ sót mã lỗi gốc.
- **Bằng chứng**: Dòng 185: `let inputSource = gdriveUrl || '';` đẩy thẳng URL xuống subprocess.

#### Thành phần 10: `quiz_pipeline.py`
- **Đường dẫn**: `engines/quiz/quiz_pipeline.py`
- **Hàm/Class**:
  - `download_gdrive_if_needed()`
  - `extract_structured_page_content()`
  - `extract_raw_pages()`
  - `stitch_cross_page_text()`
  - `link_assets_to_questions()`
  - `call_agnes_api()`
  - `parse_and_standardize_questions()`
  - `generate_explanations()`
  - `_build_and_compile_worksheet()`
  - `_build_and_compile_answer_key()`
  - `compile_html_to_pdf_via_chrome()`
  - `run_pipeline()`
- **Vai trò**: "Nhạc trưởng" điều phối toàn bộ quá trình: Tải drive $\rightarrow$ Bóc tách PDF 2 cột $\rightarrow$ Phân tích regex MCQ $\rightarrow$ Chuẩn hóa qua AI Agnes $\rightarrow$ Sinh lời giải $\rightarrow$ Render HTML $\rightarrow$ Gọi Headless Chrome in PDF.
- **Input/Output**:
  - *Input*: CLI arguments (`input`, `--pages`, `--count`, `--start`, `--title`, `--prefix`, ...).
  - *Output*: 2 file PDF chuẩn in ấn (`_DeBai.pdf` và `_DapAn.pdf`) kèm JSON tiến trình stdout.
- **Phụ thuộc**: `pymupdf` (`fitz`), `mcq_parser.py`, `quiz_cache.py`, `text_utils.py`, Google Chrome binary, KaTeX assets.
- **Khả năng tái sử dụng**:
  - Thuật toán trích xuất hình học 2 cột, logic gọi Chrome và KaTeX offline: **Rất tốt**.
  - Logic gọi Agnes AI và bóc tách câu hỏi: **Cần đập đi xây lại theo hướng micro-pipeline**.
- **Khiếm khuyết/Lỗ hổng**:
  1. *Ôm đồm vai trò*: Tệp dài hơn 2,700 dòng, kiêm nhiệm từ tải mạng, xử lý ảnh, bóc text, gọi AI, đến in PDF (vi phạm Single Responsibility).
  2. *Không có OCR*: Bỏ cuộc ngay lập tức nếu văn bản ít hơn 50 ký tự (`clean_len < 50`).
  3. *Tải Google Drive sơ sài*: Dùng `urllib.request` thuần, không thể vượt qua trang xác nhận virus của Google Drive cho tệp lớn.
  4. *Quá tải prompt*: Ép AI làm cả 5 việc cùng lúc trong Phase 1.
  5. *Không có Visual QA*: In xong không kiểm tra xem PDF có bị tràn trang, lệch chữ hay hỏng font không.

#### Thành phần 11: `mcq_parser.py`
- **Đường dẫn**: `engines/quiz/mcq_parser.py`
- **Hàm/Class**: `parse_mcq_blocks(text)`, `count_available_questions(text)`
- **Vai trò**: Phân tích văn bản thuần trích xuất được để tìm các bộ 4 đáp án A, B, C, D (dùng candidate 4-tuple scoring), lọc bỏ câu tự luận (yêu cầu $\ge 2$ đáp án), tước tiền tố lặp số câu.
- **Input/Output**:
  - *Input*: `text: str`.
  - *Output*: `list[dict]` gồm `{ source_number, stem, clean_stem, options, confidence, raw }`.
- **Phụ thuộc**: `re`, `text_utils.py`.
- **Khả năng tái sử dụng**: Tái sử dụng như một **Fast-Path** trước khi cần gọi đến AI.
- **Khiếm khuyết/Lỗ hổng**: Chỉ dựa vào Regex. Nếu gặp đề thi đánh số La Mã, đề tiếng Anh format khác lạ (`1/`, `a)`, `b)`), hoặc đề bảng biểu, bộ parser này sẽ bỏ sót câu hỏi.

#### Thành phần 12: `quiz_cache.py`
- **Đường dẫn**: `engines/quiz/quiz_cache.py`
- **Hàm/Class**: `extract_cache_key()`, `ai_cache_key()`, `get_extract_cache()`, `save_extract_cache()`
- **Vai trò**: Cache 2 tầng theo Content-Hash:
  - Tầng 1: Cache kết quả bóc tách PDF (PDF SHA256 + dải trang).
  - Tầng 2: Cache kết quả gọi AI (Payload hash + Model + Prompt Version).
- **Input/Output**: JSON files lưu trong `data/cache/quiz/`.
- **Phụ thuộc**: `hashlib`, `json`, `os`.
- **Khả năng tái sử dụng**: **100% Reusable**.
- **Khiếm khuyết/Lỗ hổng**: Không có. Ghi file atomic an toàn.

---

## 2. Báo Cáo Điều Tra Đặc Biệt (Special Investigation Findings)

Tuân thủ nghiêm ngặt yêu cầu điều tra tại `tasks/02_TASK-00-AUDIT.md`:

### 2.1. Hệ thống có gửi toàn bộ file PDF lên Agnes không?
* **Kết luận**: **KHÔNG (NO)**.
* **Bằng chứng thực tế**:
  - Hàm `extract_raw_pages()` sử dụng PyMuPDF (`fitz`) cục bộ để mở file PDF trên đĩa, đọc từng trang, bóc tách chuỗi văn bản và cắt ảnh lưu vào thư mục tạm.
  - Dữ liệu gửi lên Agnes AI trong `parse_and_standardize_questions()` chỉ là các chuỗi văn bản JSON đã được tiền xử lý (`payload_blocks`). Tệp PDF gốc hoàn toàn không bị đẩy lên API.

### 2.2. Hệ thống có gửi từng câu hỏi một (1 call / question) không?
* **Kết luận**: **KHÔNG (NO)**.
* **Bằng chứng thực tế**:
  - Hệ thống không gọi AI theo từng câu lẻ tẻ. Trong Phase 1, câu hỏi được chia cửa sổ theo hằng số `BATCH_SIZE = 5` (`windows = [parsed_blocks[i:i + BATCH_SIZE] ...]`).
  - Trong Phase 2 (`generate_explanations`), câu hỏi cũng được chia theo từng đợt `batch_size = 5`.

### 2.3. Hệ thống có batching không?
* **Kết luận**: **CÓ (YES)**.
* **Bằng chứng thực tế**:
  - Hằng số `BATCH_SIZE = 5` được áp dụng cố định cho cả hai pha chuẩn hóa và viết lời giải.
  - Các batch được đẩy vào `concurrent.futures.ThreadPoolExecutor` để chạy song song tối đa 4 luồng (`QUIZ_AI_CONCURRENCY = 4`).
  - **Điểm yếu**: Kích thước batch 5 là **cố định (hardcoded)**, chưa phải là **Adaptive Batching** (chưa tự động co giãn kích thước batch: 10–15 câu cho text thuần, 3–6 câu cho bài có hình/bảng như yêu cầu tại `tasks/00_README.md`).

### 2.4. Hệ thống có trộn lẫn Extraction / Normalization / Rendering trong cùng một prompt không?
* **Kết luận**: **CÓ (YES - Trộn lẫn nghiêm trọng trong Phase 1)**.
* **Bằng chứng thực tế**:
  - Trong `_build_phase1_prompt`, System Prompt và User Prompt yêu cầu Agnes AI thực hiện đồng thời:
    1. Chuẩn hóa cấu trúc câu hỏi trắc nghiệm (MCQ).
    2. Sửa lỗi chính tả từ bản trích xuất thô.
    3. Chuyển đổi công thức Hóa học sang thẻ HTML `<sub>/<sup>`.
    4. Chuyển đổi công thức Toán học sang `$ KaTeX $`.
    5. Bảo tồn nhãn định vị hình ảnh `[IMAGE_REF: ...]`.
    6. **Tự giải bài toán để xác định đáp án đúng (`answer: "A"|"B"|"C"|"D"`)**.
  - Việc bắt một mô hình AI vừa làm "mắt đọc" (nhận diện chính tả, toán, hóa), vừa làm "bộ não giải đề" (suy luận logic đáp án), vừa làm "bộ định dạng cấu trúc JSON" trong 1 prompt duy nhất làm tăng tỷ lệ ảo giác lên gấp nhiều lần.

### 2.5. Hệ thống có Schema Validation cho kết quả AI không?
* **Kết luận**: **BÁN PHẦN (PARTIAL / CHƯA ĐẠT CHUẨN)**.
* **Bằng chứng thực tế**:
  - Ở tầng Node.js Fastify Gateway: Có thư viện Zod kiểm tra schema đầu vào và đầu ra cuối cùng.
  - Ở tầng Python Engine: Hoàn toàn **chưa có Pydantic schema validation**. Code chỉ sử dụng kiểm tra thô sơ: `if res and isinstance(res, dict) and "questions" in res:`, sau đó dùng hàm tự chế `normalize_question()` để vá víu các trường bị thiếu. Nếu AI trả về format méo mó ngoài dự tính, dữ liệu rác vẫn có thể lọt vào file in.

### 2.6. Hệ thống có vòng lặp Visual QA (Visual QA Loop) không?
* **Kết luận**: **HOÀN TOÀN KHÔNG (NO)**.
* **Bằng chứng thực tế**:
  - Sau khi Headless Chrome xuất file PDF qua hàm `compile_html_to_pdf_via_chrome()`, pipeline chỉ kiểm tra sự tồn tại của file trên đĩa:
    ```python
    if not os.path.exists(output_pdf_path) or os.path.getsize(output_pdf_path) < 1000:
        raise RuntimeError(f"Chrome in PDF thất bại...")
    ```
  - Hoàn toàn không có bước chụp lại trang PDF (PDF render to image) để kiểm tra: Có công thức KaTeX nào bị tràn lề không? Có hình vẽ nào bị đè lên chữ không? Có câu hỏi nào bị ngắt trang mồ côi không?

---

## 3. Tổng Hợp Các Điểm Có Thể Làm Deterministic (Giảm Phụ Thuộc AI)

| Hạng mục | Cơ chế cũ (Dùng AI / Regex gãy) | Giải pháp Deterministic mới | Lợi ích |
| :--- | :--- | :--- | :--- |
| **Phân tích câu lệnh (Prompt Parsing)** | Gọi Agnes AI cho mọi câu lệnh | Dùng Regex AST bóc tách 90% câu lệnh chuẩn (`trang X-Y làm Z câu`) | Tiết kiệm 100% thời gian gọi mạng cho prompt chuẩn, phản hồi dưới 5ms |
| **Bóc tách đáp án (Answer Key)** | Bắt AI tự giải 100% câu hỏi | Xây dựng module tự động tìm bảng đáp án ở cuối tài liệu (`1.A 2.B 3.C...`) | Loại bỏ hoàn toàn nguy cơ AI giải sai đáp án đối với đề có sẵn key |
| **Bố cục cột (Column Layout)** | Code đo độ dài ký tự thô sơ | Đo đạc chiều dài pixel thực tế và tỷ lệ khung hình của ảnh minh họa | Dàn trang 1, 2, 4 cột thẩm mỹ tuyệt đối mà không cần AI can thiệp |
| **Công thức Hóa học cơ bản** | Gửi toàn bộ công thức cho AI | Bộ từ điển Regex tự động chuyển đổi chất quen thuộc (`H2O`, `CO2`, `H2SO4`...) | Giảm tải token gửi lên AI |

---

## 4. Kết Luận Khảo Sát & Khuyến Nghị Cho Các Task Tiếp Theo

1. **Bảo tồn tuyệt đối**: Giữ nguyên toàn bộ mã nguồn Frontend PWA (`src/components/tools/quiz/`), cấu trúc bảng Prisma (`Job`, `FileRecord`), và tài nguyên KaTeX offline.
2. **Loại bỏ**: Xóa bỏ tư duy "1 prompt giải quyết tất cả" trong Python engine.
3. **Kiến trúc mới**: Chuyển đổi toàn diện sang mô hình **AI Micro-Pipeline** với các module nhỏ gọn, có Pydantic schema validation ở từng chặng, bổ sung OCR fallback cho đề scan, và tích hợp cơ chế Selective Visual QA trước khi bàn giao file PDF cho người dùng.
