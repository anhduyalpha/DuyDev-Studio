---
id: KI-FIX-019-dual-result-pdf-delivery-split-history-sync
title: "Đồng Bộ Lịch Sử 2 Cột, Xóa Thùng Rác (Trash Support) & Phân Phối File Kép (Dual Result Cards) Trong Quiz Workspace"
type: troubleshoot
status: verified
domain: fullstack
tags: [quiz, history-sync, dual-result-cards, trash-support, selective-dom, pwa, reactive-state]
created_at: 2026-10-02
updated_at: 2026-10-02
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Khi người dùng tạo đề thi trắc nghiệm và cần nhận cả 2 tệp riêng biệt (Đề bài & Đáp án), hiển thị thẻ kết quả kép, lưu trữ lịch sử theo cặp với khả năng xóa tạm/khôi phục thùng rác, và cập nhật trạng thái input không gây giật lag giao diện (zero layout shift)"
search_queries:
  - "Phân phối 2 file PDF độc lập đề bài và đáp án"
  - "Lịch sử bài tập trắc nghiệm dạng hộp thả collapsible dropbox"
  - "Đồng bộ thùng rác quiz với header indicator và global storage"
  - "Cập nhật dynamic validation badge không gây re-render toàn form"
  - "Lỗi không tải được file do thiếu đuôi mở rộng pdf"
related_kis:
  - KI-CON-004-two-column-continuous-flow-quiz-pdf-engine
  - KI-FIX-010-selective-dom-diffing-high-frequency-terminal-lag
  - KI-FIX-016-selective-dom-diffing-global-task-dock-flicker-prevention
  - KI-FIX-018-android-native-bridge-background-downloads-push-notifications
---

# [KI-FIX-019] Đồng Bộ Lịch Sử 2 Cột, Xóa Thùng Rác (Trash Support) & Phân Phối File Kép (Dual Result Cards) Trong Quiz Workspace

## 1. Context & Triệu Chứng (Symptom & Challenges)

Trong quá trình phát triển hệ thống tạo bài tập trắc nghiệm tự động (Quiz Generator), kiến trúc gặp phải 4 trở ngại kỹ thuật lớn về trải nghiệm và quản lý dữ liệu:

1. **Phân phối đơn lẻ bất đối xứng (Single Artifact Bottleneck)**:
   - Hệ thống backend cũ chỉ thiết kế để trả về 1 artifact kết quả duy nhất (`resultFileId`) trong SSE stream và bảng `Job`. Khi Quiz Pipeline V2 sinh ra 2 tệp PDF độc lập (**Đề bài** và **Đáp án**), chỉ có 1 tệp được ghi nhận, dẫn tới việc người dùng không thể tải hoặc xem trước tệp đáp án.
2. **Lỗi thiếu phần mở rộng tệp `.pdf` khi tải về**:
   - Tệp lưu trữ trên disk backend dùng CUID không có đuôi mở rộng (`storagePath = /data/storage/<cuid>`). Khi tải về trên Android hoặc trình duyệt di động, file bị tải về dưới dạng tệp nhị phân không xác định hoặc không mở được bằng ứng dụng đọc PDF.
3. **Lịch sử bị phân mảnh rời rạc & Thiếu thùng rác (Fragmented History & Accidental Deletion)**:
   - Khi lưu vào lịch sử, Đề bài và Đáp án bị tách làm 2 bản ghi độc lập trong bảng lịch sử chung. Người dùng không biết bản ghi nào khớp với bản ghi nào. Hơn nữa, việc nhấn nút xóa lập tức xóa vĩnh viễn dữ liệu mà không có cơ chế khôi phục (Trash / Soft Delete).
4. **Mất tiêu điểm bàn phím & Giật giật giao diện khi validate form (Input Focus Loss & Layout Shift)**:
   - Khi người dùng gõ vào các ô bắt buộc (`prefix`, `pages`), gọi hàm re-render toàn bộ thẻ cấu hình làm mất focus bàn phím, con trỏ nhảy về cuối dòng hoặc mất ký tự đang gõ trên mobile.

---

## 2. Phân Tích Nguyên Nhân Gốc Rễ (Root Cause Analysis)

- **Backend Protocol**: `jobs.controller.ts` lấy `artifact = job.files.find(f => f.purpose === 'PROCESSED_ARTIFACT') || job.files[0]`, bỏ qua trường hợp một job sinh ra nhiều artifact đồng cấp có vai trò chuyên biệt (`worksheet` và `answer`).
- **Prisma Storage Scheme**: Cần một transaction nguyên tử đăng ký cả 2 `FileRecord` độc lập gắn cùng `jobId`, đồng thời truyền cấu trúc `optionsJson.result` chứa đủ metadata của cả 2 file.
- **Frontend State Model**: Store chỉ hỗ trợ danh sách phẳng các item độc lập. Một bộ đề trắc nghiệm bản chất là **một cặp (Pair)**: một nguồn bài tập sinh ra 1 bản Đề bài và 1 bản Đáp án có chung ngữ cảnh thời gian, tiêu đề, số câu và số trang.
- **DOM Re-render Loop**: Sự kiện `input` kích hoạt subscriber cập nhật state và re-render component cha thông qua `innerHTML`, hủy toàn bộ các phần tử `<input>` đang hoạt động.

---

## 3. Giải Pháp Triệt Để (Resolution)

### 3.1. Đăng ký nguyên tử và phân phối Dual Payload ở Backend
Trong `server/src/workers/quiz.worker.ts`:
- Bắt buộc ghi tệp storage kèm phần mở rộng `.pdf` rõ ràng: `${wsFileId}.pdf` và `${ansFileId}.pdf`.
- Sử dụng `prisma.$transaction` để ghi nhận song song 2 `FileRecord` với `mimeType: 'application/pdf'` và đầy đủ SHA-256 hash.
- Lưu payload kết quả hoàn chỉnh vào `job.optionsJson` và phát qua Redis Pub/Sub:

```typescript
// server/src/workers/quiz.worker.ts
const resultPayload = {
  jobId,
  percentage: 100,
  worksheet: {
    fileId: wsFileId,
    fileName: wsFileName,
    sizeBytes: wsStats.size,
    pages: resultMeta.worksheet_pages || 1,
    downloadUrl: `/api/v1/files/download/${wsFileId}/${wsEncodedName}?filename=${wsEncodedName}`,
    viewUrl: `/api/v1/files/view/${wsFileId}/${wsEncodedName}`
  },
  answer: {
    fileId: ansFileId,
    fileName: ansFileName,
    sizeBytes: ansStats.size,
    pages: resultMeta.answer_pages || 1,
    downloadUrl: `/api/v1/files/download/${ansFileId}/${ansEncodedName}?filename=${ansEncodedName}`,
    viewUrl: `/api/v1/files/view/${ansFileId}/${ansEncodedName}`
  },
  questionsCount: resultMeta.questions_count || count,
  extractedImagesCount: resultMeta.extracted_images_count || 0
};

// Lưu trực tiếp vào Job optionsJson để client có thể khôi phục sau khi reload
await prisma.job.update({
  where: { id: jobId },
  data: {
    status: 'COMPLETED',
    progress: 100,
    optionsJson: JSON.stringify({ ...existingOptions, result: resultPayload }),
    completedAt: new Date()
  }
});
```

Đồng thời, cập nhật `server/src/api/controllers/jobs.controller.ts` để khi kết nối lại SSE với job đã `COMPLETED`, controller tự trích xuất `opts.result` và phát sự kiện `completed` mang đầy đủ payload kép:

```typescript
// server/src/api/controllers/jobs.controller.ts
if (job.status === 'COMPLETED') {
  let completedPayload: Record<string, unknown> = {
    jobId,
    percentage: 100,
    resultFileId: artifact?.id || null,
    downloadUrl: artifact ? `/api/v1/files/download/${artifact.id}` : null
  };
  try {
    const opts = JSON.parse(job.optionsJson || '{}');
    if (opts.result) {
      completedPayload = { ...completedPayload, ...opts.result };
    }
  } catch {}
  reply.raw.write(`event: completed\ndata: ${JSON.stringify(completedPayload)}\n\n`);
  reply.raw.end();
  return;
}
```

---

### 3.2. Hiển thị thẻ kết quả kép (Dual Result Cards) trong Frontend
Trong `src/components/tools/quiz/components/QuizResultCard.js`:
- Thiết kế bố cục lưới phản hồi (responsive grid `grid-cols-1 md:grid-cols-2 gap-4`).
- Cột trái: Thẻ **Đề bài** (Badge xanh dương `Đề bài`, số câu, số trang A4, dung lượng, nút **Xem trước** và nút **Tải về**).
- Cột phải: Thẻ **Đáp án & Lời giải** (Badge xanh lá `Đáp án & Lời giải`, ma trận đáp án, hình vẽ trích xuất, nút **Xem trước** và **Tải về**).
- Cả hai nút tải về đều có thuộc tính `download` rõ ràng và query parameter `?filename=...` để trình duyệt di động nhận diện chuẩn tên tệp và đuôi `.pdf`.

---

### 3.3. Mô hình lưu trữ cặp (Paired Quiz Storage) & Đồng bộ thùng rác 2 chiều
Xây dựng helper chuyên trách `src/components/tools/quiz/utilities/quizHistoryHelper.js`:

#### A. Chuẩn hóa cấu trúc bản ghi cặp (Pair Normalization)
```javascript
function normalizeQuizPair(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    id: item.id || `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Number(item.timestamp) || Date.now(),
    createdAt: item.createdAt || new Date().toISOString(),
    deletedAt: item.deletedAt || null,
    prefix: item.prefix || item.title || 'Bài tập',
    title: item.title || 'Bài tập trắc nghiệm',
    count: Number(item.count) || 20,
    worksheet: { fileId, fileName, sizeBytes, pages, downloadUrl, viewUrl },
    answer: { fileId, fileName, sizeBytes, pages, downloadUrl, viewUrl }
  };
}
```

#### B. Cơ chế Soft Delete & Thùng rác (Trash Lifecycle)
- **Tách biệt 2 vùng lưu trữ**: `ds_quiz_history_v1` (Active History) và `ds_quiz_trash_v1` (Trash Bin).
- **Chuyển vào thùng rác (`moveQuizPairToTrash`)**: Rút cặp item khỏi danh sách active, gán `deletedAt: new Date().toISOString()`, đẩy vào danh sách trash. Đồng thời đồng bộ đánh dấu xóa `storage.moveToTrashSync()` cho cả 2 tệp `worksheet.fileId` và `answer.fileId` để cập nhật chỉ số thùng rác toàn cục trên Header (`updateHeaderTrashIndicator()`).
- **Khôi phục (`restoreQuizPairFromTrash`)**: Đưa item từ trash quay lại history, xóa trường `deletedAt`, gọi `storage.restoreTrashItemSync()`.
- **Xóa vĩnh viễn (`deleteQuizPairPermanently`)**: Loại bỏ triệt để khỏi local storage và gọi `storage.permanentlyDeleteTrashItemSync()` giải phóng dung lượng.

---

### 3.4. Giao diện hộp thả (Collapsible Dropbox) & Loại bỏ hoàn toàn nút sao chép link
Trong `src/components/tools/quiz/components/QuizHistoryList.js`:
- Thiết kế header hộp thả dày dặn, tương phản cao, nổi bật tên tệp chính kèm tổng số trang A4 và tổng dung lượng cả 2 file.
- Nhấp vào tiêu đề để mở/gập nội dung chi tiết dạng accordion (`openDropboxes.has(pair.id)`).
- Phân chia tab điều hướng: **Lịch sử** (kèm số lượng) và **Thùng rác** (kèm badge đỏ khi có mục đã xóa).
- **Zero Fluff (Tuân thủ KI-CON-001)**: Loại bỏ toàn bộ các nút thừa như "Sao chép liên kết", chỉ giữ 2 hành động thiết yếu: **Xem trước** (mở Lightbox Viewer của hệ thống) và **Tải về**.

---

### 3.5. Cập nhật DOM chọn lọc (Selective DOM Updating) - Chống Layout Shift
Trong `src/components/tools/quiz/hooks/useQuizListeners.js`:
- Khi người dùng gõ vào các ô input (`quizPrefixInput`, `quizPagesInput`, `quizDriveInput`), **tuyệt đối không gọi hàm re-render toàn form**.
- Thay vào đó, gọi trực tiếp các hàm cập nhật DOM chọn lọc: `syncValidationUI()` và `syncGenerateButton()`.
- Hàm `syncValidationUI()` chỉ thay đổi class CSS viền (`border-emerald-500/40` vs `border-rose-500/40`) và cập nhật markup badge trạng thái (`quizPrefixStatus`, `quizPagesStatus`, `quizSourceStatus`) bằng `innerHTML` thu hẹp phạm vi.
- Giữ nguyên focus bàn phím của người dùng, mang lại phản hồi trực quan tức thì (valid checkmark) mà không gây giật lag (Zero Layout Shift).

---

## 4. Gotchas & Edge Cases

| Trường hợp biên | Rủi ro tiềm ẩn | Biện pháp xử lý |
| :--- | :--- | :--- |
| **User nhấn F5 khi Job vừa xong** | Mất kết quả thẻ kép trên màn hình | Worker lưu cấu trúc `resultPayload` vào `Job.optionsJson`. SSE kết nối lại sẽ hydrate đầy đủ cả 2 file. |
| **Tên tệp chứa ký tự đặc biệt tiếng Việt** | Trình duyệt tải về bị lỗi tên tệp rác | Mã hóa kép bằng `encodeURIComponent` cả trong URL download và thuộc tính `download="Tên_Gốc.pdf"`. |
| **Xóa một nửa cặp file** | Tệp còn lại thành orphan rác | `moveQuizPairToTrash` luôn xử lý nguyên tử cả 2 `fileId` (worksheet và answer) cùng lúc. |
| **Xóa nhầm toàn bộ lịch sử** | Người dùng mất hết dữ liệu | Nút "Chuyển tất cả vào thùng rác" (`moveAllQuizPairsToTrash`) chỉ là soft delete, có thể khôi phục 1 chạm bằng "Khôi phục tất cả". |

---

## 5. Verification (Kiểm Thử & Xác Minh)

1. **Kiểm tra biên dịch Typescript Backend**:
   ```bash
   cd server && npx tsc --noEmit
   ```
   *Kết quả*: 0 lỗi cú pháp.
2. **Kiểm tra Unit Test Suite**:
   ```bash
   cd server && npx vitest run tests/unit/quiz_history.test.ts
   ```
   *Kết quả*: Tất cả các test case về paired normalization, soft delete, restore và permanent delete đều vượt qua.
3. **Kiểm tra thực tế giao diện**:
   - Khởi tạo đề thi với 20 câu hỏi -> Khi hoàn thành, 2 thẻ riêng biệt Đề bài & Đáp án xuất hiện mượt mà.
   - Thử nghiệm gõ tên tệp: Icon trạng thái chuyển từ đỏ "Bắt buộc" sang xanh "Hợp lệ" ngay lập tức mà con trỏ không bị mất focus.
   - Bấm icon thùng rác tại một bộ đề -> Mục chuyển sang tab Thùng rác, badge Header hiển thị số lượng rác mới. Bấm khôi phục -> Cặp đề quay lại tab Lịch sử nguyên vẹn.

---

## 6. Changelog
- **2026-10-02 (v1.0.0)**: Khởi tạo KI giải quyết dứt điểm cơ chế lưu trữ lịch sử theo cặp, thùng rác 2 chiều, phân phối thẻ kết quả kép và cập nhật DOM chọn lọc không giật lag (@anhduy).
