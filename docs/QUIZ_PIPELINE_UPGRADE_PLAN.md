# Quiz Pipeline Upgrade Plan — v3.0

> Kế hoạch nâng cấp kiến trúc module **Tạo Bài Tập Trắc Nghiệm** của DuyDev Studio.
> Mục tiêu: pipeline đủ nhanh và đủ ổn định cho một model nhỏ (Agnes 3.0 Flash) thực thi,
> đồng thời sửa 2 lỗi chặn phát hành: **sinh đề sai số câu** và **không in được PDF khi offline**.

- **Ngày lập**: 2026-10-03
- **Phạm vi**: `engines/quiz/`, `server/src/workers/quiz.worker.ts`, `server/src/services/janitor.service.ts`
- **Số Work Package**: 8 (WP1 → WP8)
- **Ưu tiên tối cao**: **WP2** (fix sinh đề sai) và **WP5** (in PDF offline 100%)

---

## 0. PROMPT ĐIỀU PHỐI — COPY NGUYÊN KHỐI NÀY DÁN CHO GEMINI

<!-- Dán khối dưới đây kèm link/đường dẫn tới chính file này. -->

```text
/goal Thi công nâng cấp kiến trúc module "Tạo Bài Tập Trắc Nghiệm" (Quiz Pipeline v3.0)
của project DuyDev Studio theo đúng đặc tả trong docs/QUIZ_PIPELINE_UPGRADE_PLAN.md.

== BỐI CẢNH ==
Repo: DuyDev Studio (PWA offline-first + Fastify backend + Python engines).
Module đích: engines/quiz/quiz_pipeline.py (2026 dòng) và server/src/workers/quiz.worker.ts.
Pipeline hiện tại gọi AI theo batch 12 câu, chạy TUẦN TỰ, một prompt làm 4 việc cùng lúc.
Hệ quả: chậm (90-140s cho 20 câu), và có 2 lỗi chặn phát hành đã được xác định.

== NHIỆM VỤ ==
Đọc docs/QUIZ_PIPELINE_UPGRADE_PLAN.md và thi công đầy đủ 8 Work Package (WP1 -> WP8).
File plan đã ghi rõ cho từng WP: danh sách file cần tạo/sửa, data contract input/output,
tên hàm và số dòng cần sửa, logic cụ thể, edge case, và lệnh verify kèm pass/fail criteria.
Hãy tự chia sub-task theo từng WP, nhưng KHÔNG được đổi thứ tự thi công.

== THỨ TỰ THI CÔNG BẮT BUỘC ==
WP1 -> WP2 -> WP3 -> WP5 -> WP6 -> WP4 -> WP7 -> WP8
(WP2 và WP5 là ưu tiên tối cao: WP2 sửa lỗi sinh đề sai số câu, WP5 bỏ phụ thuộc CDN.)
Sau MỖI WP phải chạy đủ lệnh verify của WP đó và báo cáo kết quả thật trước khi sang WP kế tiếp.
Nếu một WP fail verify, dừng lại và sửa cho xanh, KHÔNG được bỏ qua để chạy tiếp WP sau.

== RÀNG BUỘC NGHIÊM NGẶT (VI PHẠM = TỪ CHỐI MERGE) ==
1. TUYỆT ĐỐI CẤM sửa hoặc xoá bất kỳ test case nào trong
   engines/quiz/test_quiz_pipeline_v2.py.
   Ngoại lệ DUY NHẤT: các assert về đường dẫn CDN trong test
   `test_katex_delimiters_and_ignored_classes` ở WP5.
   Nếu một test cũ chuyển sang đỏ, đó là REGRESSION do code mới:
   bắt buộc sửa CODE, cấm sửa TEST, cấm skip test, cấm xoá assert.
2. Theo AGENTS.md §4, trước khi báo cáo hoàn thành bất kỳ WP nào có chạm vào server/:
   - `cd server && npx tsc --noEmit` phải ra ĐÚNG 0 error.
   - `cd server && npx vitest run` phải pass 100%, không có test skip mới.
3. CẤM code nửa vời. Không `// TODO`, không `# TODO`, không `pass` giữ chỗ,
   không `raise NotImplementedError`, không hàm rỗng, không `except: pass` mới,
   không comment kiểu "sẽ làm sau". Mỗi WP phải chạy được end-to-end khi đóng lại.
4. CẤM nới lỏng điều kiện để test xanh (hạ assert, bọc try/except để né lỗi,
   comment out logic). Phải sửa đúng nguyên nhân gốc.
5. Giữ nguyên public signature của các hàm mà test hiện có đang gọi:
   cluster_rects, extract_structured_page_content, sort_blocks_by_layout,
   is_section_banner, strip_section_banner, normalize_question,
   chunk_questions_sliding_window, table_to_markdown, format_tables_in_text,
   stitch_cross_page_text, generate_worksheet_html, generate_answer_key_html.
6. Mọi message lỗi hướng tới người dùng phải giữ nguyên tiếng Việt và giữ nguyên
   các cụm khoá mà server/src/workers/quiz.worker.ts đang match trong
   hàm cleanQuizErrorMessage (ví dụ "Không có câu hỏi trong ...").
7. Code mới phải tuân thủ AGENTS.md Rule 1: không God File, không micro-fragmentation,
   dọn sạch tài nguyên async (ThreadPoolExecutor dùng context manager, xoá temp dir
   trong finally).

== ĐỊNH NGHĨA HOÀN THÀNH (DoD) CHO CẢ TASK ==
- `python engines/quiz/test_quiz_pipeline_v2.py` pass 100% (không sửa test).
- `python engines/quiz/test_mcq_parser.py` pass 100% (file test mới từ WP1).
- `cd server && npx tsc --noEmit` ra 0 error.
- `cd server && npx vitest run` pass 100%.
- `rg "cdn.jsdelivr" engines/quiz/` KHÔNG còn kết quả nào.
- Smoke test thật chạy được và sinh ra 2 file PDF hợp lệ:
  python engines/quiz/quiz_pipeline.py <pdf> --pages 11 --count 20 --prefix smoke --output-dir ./.tmp/quiz_smoke
- Với PDF có 10 câu thật và --count 20: kết quả ra ĐÚNG 10 câu, không câu nào trùng nội dung.

== BÁO CÁO ==
Sau mỗi WP, báo cáo đúng định dạng:
  WP<n> | DONE | files changed: <list> | verify: <lệnh> -> <kết quả thật> | ghi chú
Nếu phải lệch khỏi plan, nêu rõ lý do kỹ thuật và phương án thay thế trước khi code.
Không bao giờ báo DONE khi chưa chạy verify thật.
```

---

## 1. RÀNG BUỘC NGHIÊM NGẶT (đọc trước khi viết dòng code đầu tiên)

### 1.1 Cấm sửa test hiện có

`engines/quiz/test_quiz_pipeline_v2.py` chứa 22 test case là lưới an toàn của toàn bộ Module 1.1–1.7.

- **CẤM** sửa nội dung bất kỳ test case nào.
- **CẤM** xoá test case.
- **CẤM** thêm `@unittest.skip`, `return` sớm, hay hạ mức assert.
- **Ngoại lệ duy nhất**: trong WP5, test `test_katex_delimiters_and_ignored_classes`
  đang assert URL CDN `cdn.jsdelivr.net`. Chỉ được sửa **đúng những assert về đường dẫn đó**
  sang đường dẫn local `./katex/...`. Mọi assert khác trong test đó (delimiters,
  `ignoredClasses`, `ignoredTags`) giữ nguyên tuyệt đối.

> Test đỏ = regression do code mới. **Sửa code, không sửa test.**

### 1.2 Verify bắt buộc theo AGENTS.md §4

Với mọi WP có chạm vào `server/`:

```bash
cd server && npx tsc --noEmit     # BẮT BUỘC: đúng 0 error
cd server && npx vitest run       # BẮT BUỘC: pass 100%, không skip mới
```

Với mọi WP có chạm vào `engines/quiz/`:

```bash
python engines/quiz/test_quiz_pipeline_v2.py    # BẮT BUỘC: pass 100%
python engines/quiz/test_mcq_parser.py          # từ WP1 trở đi
```

### 1.3 Cấm code nửa vời

Các mẫu sau **bị từ chối merge ngay**:

| Cấm | Lý do |
|---|---|
| `# TODO`, `// TODO`, `# FIXME` | WP phải đóng kín, không nợ kỹ thuật |
| `pass` giữ chỗ trong hàm mới | hàm rỗng không phải code |
| `raise NotImplementedError` | WP chưa xong thì không được báo DONE |
| `except Exception: pass` mới | vi phạm AGENTS.md Rule 1 (cấm swallow exception) |
| Hàm khai báo nhưng không ai gọi | dead code |
| Comment "sẽ hoàn thiện ở WP sau" | mỗi WP phải tự chạy được |

Mỗi WP khi đóng lại phải để pipeline ở trạng thái **chạy được end-to-end**, không phải trạng thái trung gian.

### 1.4 Signature đóng băng

Các hàm sau đang được test hiện có gọi trực tiếp. Được phép đổi **ruột**, **cấm** đổi tên / thứ tự tham số / kiểu trả về:

```
cluster_rects(rect_list, margin=12.0) -> list[Rect]
sort_blocks_by_layout(page, blocks=None) -> list
extract_structured_page_content(page, page_num, temp_assets_dir) -> (str, list[dict], dict)
is_section_banner(text) -> bool
strip_section_banner(text) -> str
clean_image_markers(text) -> str
normalize_question(q, fallback_num=1) -> dict
chunk_questions_sliding_window(full_text, target_count, window_size=10) -> list[tuple]
table_to_markdown(rows) -> str
format_tables_in_text(text) -> str
stitch_cross_page_text(pages_text) -> str
is_question_dangling(text) -> bool
is_running_header_or_footer(block_text, y0, y1, page_h) -> bool
generate_worksheet_html(title, subtitle, questions, questions_per_page=10) -> str
generate_answer_key_html(title, subtitle, questions, questions_per_page=10) -> str
```

> **Ngoại lệ đã xác minh**: tham số `questions_per_page` của 2 hàm `generate_*_html`
> đã được grep xác nhận **không có test nào truyền vào** và không dùng trong thân hàm
> (chỉ xuất hiện tại chính 2 dòng khai báo `quiz_pipeline.py:1207` và `:1487`).
> Đây là tham số chết, được phép xoá ở **WP5 Bước 6**. Mọi hàm khác trong danh sách trên
> vẫn đóng băng tuyệt đối.

### 1.5 Hợp đồng lỗi với Node worker

`server/src/workers/quiz.worker.ts:74-108` (`cleanQuizErrorMessage`) match các cụm khoá tiếng Việt
trong stderr của Python. **Cấm** đổi các cụm sau:

- `Không có câu hỏi trong {pages_desc}, vui lòng chọn lại.`
- `không chứa văn bản dạng số/vector` / `ảnh scan thuần túy`
- `vượt quá tổng số`

Và `quiz.worker.ts:123-138` parse **từng dòng stdout là một JSON object**.
Mọi `print` ra stdout từ Python **phải** là một dòng JSON hợp lệ, không xen tạp.

---

## 2. CHẨN ĐOÁN HIỆN TRẠNG

### 2.1 Phân rã thời gian (count=20, 2 trang)

| Giai đoạn | Hàm | Ước lượng | Ghi chú |
|---|---|---|---|
| Nạp + extract PyMuPDF | `extract_raw_pages` | 2–8s | lên 30–60s/trang nếu PDF nhiều vector |
| **AI chuẩn hoá** | `parse_and_standardize_questions` | **70–110s** | 2 batch × 12 câu, **tuần tự** |
| Build HTML | `generate_*_html` | <1s | |
| Chrome in PDF ×2 | `compile_pdf` | 8–20s | song song, nhưng chờ KaTeX CDN |
| Verify | `verify_pdf_pages` | <1s | |
| **Tổng** | | **~90–140s** | AI chiếm **75–80%** wall-clock |

> Các số trên là **ước lượng suy ra từ cấu trúc code**, chưa benchmark thực tế trên server.

Với `count=40` → 4 batch tuần tự → **150–240s** riêng phần AI.
Schema cho phép `count` tới **200** (`server/src/schemas/quiz.schema.ts:9`) → 17 batch tuần tự,
worst case vượt cả `pdfProcessMs: 1800_000` (30 phút) ở `server/src/config/limits.config.ts:27`.

### 2.2 Danh sách lỗi

| # | Mức | Lỗi | Vị trí | WP sửa |
|---|---|---|---|---|
| 1 | **P0** | Nhân đôi câu hỏi khi `count` > số câu thật | `quiz_pipeline.py:1077-1106` | **WP2** |
| 2 | **P0** | KaTeX từ CDN → fail khi offline + race khi in | `quiz_pipeline.py:1232-1234`, `1726-1742` | **WP5** |
| 3 | P1 | Batch 12 câu vượt `max_tokens: 8192` → truncation, retry lặp y nguyên | `quiz_pipeline.py:876`, `913-918` | WP3, WP8 |
| 4 | P1 | `cluster_rects` O(n³) trên trang nhiều vector | `quiz_pipeline.py:344-368` | WP6 |
| 5 | P2 | Không cache — retry job = làm lại từ đầu | toàn pipeline | WP7 |
| 6 | P2 | API key thật hardcode trong source | `quiz_pipeline.py:37` | WP8 |
| 7 | P2 | `questions_per_page` là tham số chết | `quiz_pipeline.py:1207`, `1487` | WP5 |

### 2.3 Chi tiết 2 lỗi P0

#### P0-1 — Nhân đôi câu hỏi (WP2)

`quiz_pipeline.py:1077-1106`. `batches` tính từ `count`, `windows` tính từ số segment thật:

```python
BATCH_SIZE = 12
batches = []                      # từ count=20 -> [(1,12,12), (13,20,8)]
...
windows = chunk_questions_sliding_window(raw_text, target_count=count, window_size=BATCH_SIZE)
...
w_text = windows[b_idx][2] if b_idx < len(windows) else raw_text   # <-- dòng 1102
```

Trang thật chỉ có 10 câu → `len(segments)=10 <= window_size=12` → hàm trả về **1 window duy nhất**
(dòng 948-950). Batch 2 rơi vào nhánh `else` → nhận lại **toàn bộ `raw_text`**, prompt yêu cầu
"assign sequential numbers from 13 to 20" → AI trích lại 8 câu đầu và **đánh số 13–20**.

**Kết quả: 18 câu, trong đó 8 câu trùng nội dung nhưng khác số.**

- Guard `if not batch_qs: break` (dòng 1139) không bắt được vì AI **có** trả dữ liệu.
- Không có dedup, không có clamp về `count`.
- `normalize_question` tin số do AI trả (dòng 972-979) → dedup theo số cũng vô dụng.

**Điều kiện kích hoạt**: `count > số câu thật` **và** `count > 12`.
Đây là tình huống rất thường gặp (user gõ "20 câu", trang chỉ có 10).
Tốn thêm 1 API call vô ích + đề sai.

#### P0-2 — KaTeX từ CDN (WP5)

`quiz_pipeline.py:1232-1234` (và bản answer key tương ứng quanh dòng 1487+):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
```

Đã kiểm tra: **không có KaTeX nào được vendor local**.
`src/vendor/` chỉ có `docx-preview`, `highlight`, `jszip`, `qr-code-styling`, `thinking-orbs`, `xlsx`.
`node_modules` không có package `katex`.

Hai hệ quả:

1. **Server LAN không ra internet → fail.** Chrome treo chờ network, hết 30s polling
   (`quiz_pipeline.py:1801`), rồi fallback `--headless` thêm 30s → **60s+ rồi fail**.
   Trái trực tiếp mục tiêu offline-first PWA (AGENTS.md §1).
2. **Race khi in.** `--print-to-pdf` chốt theo `load` event, nhưng `renderMathInElement`
   chạy trong `DOMContentLoaded` của script `defer` (dòng 1727-1741).
   Công thức toán có thể **chưa render xong khi PDF đã in**.

---

## 3. KIẾN TRÚC ĐÍCH

Nguyên tắc: **model nhỏ làm việc nhỏ, làm nhiều việc song song, chỉ làm việc mà code không làm được.**

```
                 ┌─ WP6: cluster_rects O(n log n)
PDF ─ extract ───┤                                    ┌─ WP7: cache
                 └─ raw_text + assets ────────────────┤
                                                      ▼
            WP1: PRE-PARSER DETERMINISTIC (regex, 0 AI)
            → biết chính xác N câu có thật, tách sẵn stem + A/B/C/D
                                   │
                    ┌──────────────┴──────────────┐
            confidence=high                 confidence=low
          (90%+ trường hợp)              (số ít, cần AI sửa)
                    │                             │
                    └──────────────┬──────────────┘
                                   ▼
            WP3: PHASE 1 — FORMAT (batch 5 câu, song song 4 luồng)
            chỉ: sub/sup hoá chất + KaTeX + chốt đáp án
                                   │
            ┌──────────────────────┴──────────────────┐
            ▼                                         ▼
  WP4: PHASE 2 — EXPLANATION               Worksheet HTML → PDF
  (song song, chồng lấn)                   (chạy chồng lấn, WP5)
            │                                         │
            └──────────────► Answer key HTML → PDF ◄──┘
```

**Ý tưởng cốt lõi của WP1**: đề trắc nghiệm Việt Nam có cấu trúc cực đều
(`Câu N. ... A. ... B. ... C. ... D. ...`). Việc **tách cấu trúc không cần AI**.
Khi code đã tách sẵn, AI chỉ còn nhiệm vụ làm đẹp + viết lời giải
→ output tokens giảm mạnh, chất lượng tăng, và bug P0-1 **biến mất về mặt cấu trúc**
vì ta biết chính xác số câu **trước khi** gọi AI.

### 3.1 Thứ tự thi công & phụ thuộc

| WP | Tên | Phụ thuộc | Ưu tiên |
|---|---|---|---|
| WP1 | Pre-parser deterministic | — | cao (nền tảng) |
| **WP2** | **Fix nhân đôi + chốt số câu** | WP1 | **P0** |
| WP3 | Micro-batch song song | WP1, WP2 | cao |
| **WP5** | **Vendor KaTeX + khử race in PDF** | — | **P0** |
| WP6 | `cluster_rects` O(n log n) | — | trung bình |
| WP4 | Tách phase 2 + chồng lấn in PDF | WP1–3, WP5 | trung bình |
| WP7 | Cache theo content hash | WP1–WP5 | thấp |
| WP8 | Retry thông minh + bỏ hardcode key | WP3 | thấp |

**Thứ tự thực thi: WP1 → WP2 → WP3 → WP5 → WP6 → WP4 → WP7 → WP8.**

---

# WP1 — Pre-parser deterministic (nền tảng)

**Mục tiêu**: tách cấu trúc câu hỏi MCQ bằng regex, **không gọi AI**, để biết chính xác
số câu thật có trước khi gọi AI.

### Files

| Hành động | Đường dẫn |
|---|---|
| **TẠO MỚI** | `engines/quiz/text_utils.py` |
| **TẠO MỚI** | `engines/quiz/mcq_parser.py` |
| **TẠO MỚI** | `engines/quiz/test_mcq_parser.py` |
| **SỬA** | `engines/quiz/quiz_pipeline.py` (chỉ phần import + re-export) |

### 1. `engines/quiz/text_utils.py` — tách để tránh import vòng

Di chuyển **nguyên văn, không đổi logic** 3 hàm sau từ `quiz_pipeline.py` sang file mới:

| Hàm | Dòng gốc |
|---|---|
| `is_section_banner(text) -> bool` | `quiz_pipeline.py:169-189` |
| `strip_section_banner(text) -> str` | `quiz_pipeline.py:192-201` |
| `clean_image_markers(text) -> str` | `quiz_pipeline.py:487-491` |

Sau đó trong `quiz_pipeline.py`, **xoá 3 định nghĩa cũ** và thay bằng re-export ở đầu file:

```python
from text_utils import is_section_banner, strip_section_banner, clean_image_markers
```

> **BẮT BUỘC**: phải re-export đúng 3 tên này ở namespace của `quiz_pipeline`, vì các test
> hiện có đang `from quiz_pipeline import is_section_banner, strip_section_banner, ...`.
> Test `test_is_section_banner_detection`, `test_normalize_question_sanitizes_section_banner`,
> `test_chunk_questions_sliding_window_strips_trailing_section_banner` sẽ đỏ nếu thiếu.
> Import dùng kiểu `from text_utils import ...` (không phải `from .text_utils`) để khớp
> cách test hiện có chèn `sys.path.insert(0, os.path.dirname(__file__))`.

### 2. `engines/quiz/mcq_parser.py` — API phải export

```python
def parse_mcq_blocks(text: str) -> list[dict]:
    """
    Tách text đã stitch thành danh sách câu hỏi MCQ bằng regex, KHÔNG gọi AI.
    Trả về list theo đúng thứ tự xuất hiện trong tài liệu.
    """

def count_available_questions(text: str) -> int:
    """Số câu hỏi thật có trong text. Tương đương len(parse_mcq_blocks(text))."""
```

**Output data contract** — mỗi phần tử của list:

```python
{
  "source_number": int,     # số câu GỐC trong PDF (ví dụ 12 từ "Câu 12.")
  "stem": str,              # đề bài, đã strip banner, GIỮ NGUYÊN [IMAGE_REF:...]
  "options": {"A": str, "B": str, "C": str, "D": str},
  "confidence": str,        # "high" | "low"
  "raw": str                # nguyên văn segment, để fallback cho AI
}
```

### 3. Logic cài đặt — từng bước

**Bước 1. Tách biên câu.** Tái dùng **đúng** pattern đã có ở `quiz_pipeline.py:929`
để đồng nhất hành vi với code cũ:

```python
BOUNDARY = re.compile(r"(?:^|\n)(?=(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+))", re.IGNORECASE)
```

Bỏ các segment không khớp `^(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+)` (đó là preamble, không phải câu hỏi).

**Bước 2. Lấy `source_number`:**

```python
NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*[\.\:\)]", re.IGNORECASE)
```

Không khớp → bỏ segment đó (không phải câu hỏi).

**Bước 3. Tìm nhãn option.** Pattern (đã verify thực tế):

```python
OPT = re.compile(r"(?:(?<=\s)|^)([A-D])[\.\)\:]\s*")
```

Lookbehind `(?<=\s)` là **bắt buộc** — nó chặn khớp sai khi nhãn bị dán vào từ
(ví dụ `phenolB.y` không được coi là option B).

**Bước 4. CHỌN NHÃN THEO THỨ TỰ TĂNG DẦN — đây là phần quan trọng nhất.**

Không được lấy tất cả match. Phải duyệt match và **chỉ nhận match khi nó đúng là chữ cái
đang chờ** (A rồi B rồi C rồi D):

```python
expected = ["A", "B", "C", "D"]
idx = 0
chosen = []
for m in OPT.finditer(seg):
    if idx < 4 and m.group(1) == expected[idx]:
        chosen.append(m)
        idx += 1
```

**Lý do**: stem có thể chứa chữ viết tắt kết thúc bằng dấu chấm, ví dụ
`"Câu 3. Vitamin D. có vai trò gì?"`. Nếu lấy mọi match, `D` trong `"Vitamin D."`
sẽ bị nhận là option D **trước cả option A** → stem bị cắt sai hoàn toàn.
Thuật toán tăng dần đã được verify xử lý đúng case này.

**Bước 5. Cắt stem và options:**

- `stem = seg[:chosen[0].start()]` nếu có match; ngược lại `stem = seg`.
- Option thứ `k`: text từ `chosen[k].end()` đến `chosen[k+1].start()`
  (phần tử cuối thì đến `len(seg)`).
- `.strip()` mọi giá trị.

**Bước 6. Strip banner khỏi stem** — bắt buộc gọi:

```python
stem = strip_section_banner(stem).strip()
```

Xử lý case banner `PHẦN II. Câu trắc nghiệm đúng sai.` dính vào cuối câu cuối trang.

**Bước 7. Chấm `confidence`:**

`"high"` khi **và chỉ khi** cả 3 điều kiện:
1. `len(chosen) == 4` (đủ A, B, C, D đúng thứ tự tăng dần),
2. mọi `options[k]` non-empty sau `.strip()` với `k` thuộc `ABCD`,
3. `stem` non-empty sau khi strip banner.

Ngược lại `"low"`. Câu `confidence="low"` **vẫn được giữ trong list** (không loại bỏ) —
WP3 sẽ gửi `raw` cho AI xử lý.

### 4. Edge cases bắt buộc xử lý đúng

| Case | Input mẫu | Kỳ vọng |
|---|---|---|
| Dấu `.` chuẩn | `Câu 1. abc\nA. x\nB. y\nC. z\nD. w` | `high`, 4 options |
| Dấu `)` | `A) x B) y C) z D) w` | `high` |
| Dấu `:` | `A: x B: y C: z D: w` | `high` |
| Options cùng dòng | `A. CH4 B. C2H5OH\nC. CaCO3 D) Fe2O3` | `high`, tách đúng 4 |
| **Viết tắt trong stem** | `Câu 3. Vitamin D. có vai trò gì?\nA. x\nB. y\nC. z\nD. w` | `high`, stem giữ nguyên `Vitamin D.` |
| **Nhãn dán vào từ** | `phenolB.y` | KHÔNG nhận là option |
| Thiếu option D | `A. x\nB. y\nC. z` | `low` |
| Option rỗng | `A. x\nB.\nC. z\nD. w` | `low` |
| Giữ IMAGE_REF | `Câu 5. Xem [IMAGE_REF: fig_p1_1]\nA. x...` | stem **còn** marker |
| Banner dính cuối | `...D. w\nPHẦN II. Câu trắc nghiệm đúng sai.` | banner bị strip |
| Text rỗng | `""` | `[]`, count = 0 |
| Không có câu nào | `"Trang bìa tài liệu"` | `[]`, count = 0 |

> **CẤM** xoá marker `[IMAGE_REF: ...]` ở WP1. `link_assets_to_questions`
> (`quiz_pipeline.py:494-601`) còn cần marker để map ảnh vào câu.

### 5. Test mới — `engines/quiz/test_mcq_parser.py`

Dùng `unittest`, cùng style file test hiện có (có block `sys.path.insert` và
`sys.stdout.reconfigure` cho Windows ở đầu file). Tối thiểu **11 test case**,
phủ đủ bảng edge case ở §4 trên, cộng:

- `test_count_available_questions_matches_parse_length`
- `test_source_number_preserved_from_pdf` (text `Câu 18.` → `source_number == 18`)
- `test_low_confidence_blocks_are_kept_not_dropped`

### Verify WP1

```bash
python engines/quiz/test_mcq_parser.py
python engines/quiz/test_quiz_pipeline_v2.py
```

| Pass | Fail |
|---|---|
| `test_mcq_parser.py`: 11+ test, OK, 0 fail | bất kỳ test fail |
| `test_quiz_pipeline_v2.py`: **22 test pass như trước**, 0 fail, 0 skip | bất kỳ test cũ chuyển đỏ → regression do tách `text_utils.py`, sửa import chứ không sửa test |

---

# ⚠️ WP2 — FIX SINH ĐỀ SAI SỐ CÂU (P0 — ƯU TIÊN TỐI CAO)

**Lỗi đang sửa**: trang có 10 câu + `count=20` → pipeline xuất ra **18 câu, 8 câu trùng nội dung
nhưng đánh số khác**. Xem chẩn đoán đầy đủ ở §2.3 / P0-1.

**Đây là lỗi correctness, không phải lỗi tốc độ. Phải sửa trước mọi việc tối ưu khác.**

### Files

| Hành động | Đường dẫn | Vùng sửa |
|---|---|---|
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `parse_and_standardize_questions` (dòng 1036-1158) |
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `run_pipeline` (dòng 1901-1910) — truyền `source_q_nums` đúng |
| **SỬA (thêm test)** | `engines/quiz/test_quiz_pipeline_v2.py` | **CHỈ THÊM** test mới vào cuối, cấm sửa test cũ |

### Data contract thay đổi

`parse_and_standardize_questions` — signature **giữ nguyên**:

```python
def parse_and_standardize_questions(
    raw_text: str, api_key: str, count: int = 20, start_num: int = 1,
    base_url: str = DEFAULT_API_BASE, model: str = DEFAULT_MODEL, pages_desc: str = ""
) -> list[dict]
```

| | Trước | Sau |
|---|---|---|
| **Input** | `count` = số câu user yêu cầu | giữ nguyên |
| **Output length** | có thể `> số câu thật`, có trùng lặp | **luôn `== min(count, số câu thật)`**, không trùng |
| **Output `number`** | do AI gán, có thể lộn xộn | **luôn tuần tự** `start_num .. start_num + n - 1` |
| **Khi 0 câu** | `RuntimeError` sau khi đã gọi AI | `RuntimeError` **trước khi** gọi AI (tiết kiệm 1 call) |

### Logic sửa — 7 thay đổi bắt buộc

**(1) Chốt số câu thật ngay đầu hàm**, ngay sau khối `system_prompt`:

```python
parsed_blocks = parse_mcq_blocks(raw_text)
available = len(parsed_blocks)
if available == 0:
    desc = pages_desc or "trang đã chọn"
    raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")
effective_count = min(count, available)
```

> Message lỗi phải **giữ nguyên nguyên văn** cụm `Không có câu hỏi trong ... , vui lòng chọn lại.`
> vì `quiz.worker.ts:77-87` đang match cụm này.

**(2) Tính `batches` từ `effective_count`**, KHÔNG phải `count`:

```python
remaining = effective_count      # trước đây: remaining = count
```

**(3) XOÁ `chunk_questions_sliding_window` khỏi luồng chạy.**
Window giờ lấy trực tiếp từ `parsed_blocks`:

```python
windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]
```

→ đảm bảo bất biến `len(windows) == len(batches)`.

> **GIỮ LẠI** định nghĩa hàm `chunk_questions_sliding_window` trong file (không xoá, không đổi
> signature) vì 2 test hiện có đang gọi nó: `test_sliding_window_chunking` và
> `test_chunk_questions_sliding_window_strips_trailing_section_banner`.
> Chỉ **ngừng gọi** nó từ `parse_and_standardize_questions`.

**(4) XOÁ nhánh fallback `else raw_text`** ở dòng 1102 — đây chính là nguồn gốc bug:

```python
# XOÁ DÒNG NÀY:
# w_text = windows[b_idx][2] if b_idx < len(windows) else raw_text

# THAY BẰNG:
assert len(windows) == len(batches), "windows và batches phải khớp 1-1"
w_blocks = windows[b_idx]
```

**(5) Dedup theo nội dung stem** sau khi gom hết kết quả:

```python
import hashlib

def _stem_fingerprint(q: dict) -> str:
    plain = re.sub(r"<[^>]+>", "", str(q.get("question", "")))
    plain = re.sub(r"\s+", "", plain).lower()
    return hashlib.sha1(plain.encode("utf-8")).hexdigest()

seen = set()
deduped = []
for q in all_questions:
    fp = _stem_fingerprint(q)
    if fp in seen:
        continue
    seen.add(fp)
    deduped.append(q)
all_questions = deduped
```

Dedup phải **strip HTML tag trước khi hash** — cùng một câu có thể được AI format
`CH<sub>4</sub>` ở batch này và `CH4` ở batch khác.

**(6) Clamp về `effective_count`:**

```python
all_questions = all_questions[:effective_count]
```

**(7) CƯỠNG CHẾ đánh số tuần tự** — không tin số AI trả.
Đặt **sau** vòng `normalize_question`:

```python
for i, q in enumerate(all_questions):
    q["number"] = start_num + i
```

### Sửa `run_pipeline` — mapping ảnh

`quiz_pipeline.py:1910` hiện truyền `source_q_nums` lấy từ `extract_raw_pages`.
Sau WP2, số câu output đã bị đánh lại tuần tự, nên **`source_q_nums` phải là số GỐC**
(`parsed_blocks[i]["source_number"]`), không phải số mới.

**Yêu cầu**: `parse_and_standardize_questions` trả thêm thông tin mapping, hoặc
`run_pipeline` tự gọi `parse_mcq_blocks` một lần và truyền
`[b["source_number"] for b in parsed_blocks][:effective_count]` vào `link_assets_to_questions`.

Chọn phương án **gọi `parse_mcq_blocks` một lần trong `run_pipeline`** rồi truyền
`parsed_blocks` xuống `parse_and_standardize_questions` qua tham số mới
`parsed_blocks: list[dict] | None = None` (default `None` → hàm tự parse).
Cách này tránh parse 2 lần và giữ hàm vẫn gọi độc lập được trong test.

> **Lý do quan trọng**: `link_assets_to_questions` bước 2 (`quiz_pipeline.py:537-546`)
> map ảnh bằng `source_nums[idx]` so với `asset_map` — mà `asset_map` được xây từ
> **số câu gốc trong PDF** (`extract_structured_page_content:768-796`).
> Truyền số đã đánh lại sẽ làm **ảnh gắn sai câu**.

### Edge cases bắt buộc

| Case | Kỳ vọng |
|---|---|
| 10 câu thật, `count=20` | ra **đúng 10 câu**, số 1..10, **đúng 2 API call** (10÷5) |
| 10 câu thật, `count=5` | ra 5 câu, số 1..5, 1 API call |
| 0 câu thật | `RuntimeError` tiếng Việt, **0 API call** |
| AI trả `number` lộn xộn (5, 99, 2) | output `number` = `start_num, +1, +2` |
| AI trả 2 batch có câu trùng | dedup, chỉ giữ bản đầu |
| `start_num=18`, 10 câu | số 18..27 |
| AI trả nhiều câu hơn yêu cầu | clamp về `effective_count` |

### Test mới — thêm vào CUỐI `test_quiz_pipeline_v2.py`

> **CẤM** chạm vào 22 test cũ. Chỉ thêm class/test mới ở cuối file, trước `if __name__`.

Dùng `unittest.mock.patch` để mock `call_agnes_api`:

1. `test_no_duplicate_questions_when_count_exceeds_available`
   - text 10 câu, `count=20`
   - assert `len(result) == 10`
   - assert `[q["number"] for q in result] == list(range(1, 11))`
   - assert không có 2 câu nào cùng stem
   - assert `mock_api.call_count == 2`
2. `test_sequential_numbering_overrides_ai_numbers`
   - AI trả `number` = 5, 99, 2 → assert output = `start_num, start_num+1, start_num+2`
3. `test_zero_questions_raises_before_any_api_call`
   - text không có câu → assert raise `RuntimeError`, `mock_api.call_count == 0`
   - assert message chứa `"Không có câu hỏi trong"`

### Verify WP2

```bash
python engines/quiz/test_quiz_pipeline_v2.py
python engines/quiz/test_mcq_parser.py
```

| Pass | Fail |
|---|---|
| 22 test cũ pass **nguyên vẹn** + 3 test mới pass | bất kỳ test cũ đỏ |
| `test_sliding_window_chunking` vẫn pass (hàm được giữ lại) | hàm `chunk_questions_sliding_window` bị xoá → test đỏ |
| 0 fail, 0 error, 0 skip | có skip mới |

---

# WP3 — Micro-batch song song

**Mục tiêu**: giảm batch từ 12 → 5 câu và chạy **song song 4 luồng** thay vì tuần tự.
Đây là WP mang lại phần lớn lợi ích tốc độ (AI đang chiếm 75–80% wall-clock).

### Files

| Hành động | Đường dẫn | Vùng sửa |
|---|---|---|
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `BATCH_SIZE` (dòng 1077) |
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `parse_and_standardize_questions` — xoá khối threading (dòng 1108-1132) |
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `system_prompt` (dòng 1049-1075) + `user_prompt` (dòng 1103-1106) |
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `emit_progress` (dòng 40-46) — thêm lock |
| **SỬA (thêm test)** | `engines/quiz/test_quiz_pipeline_v2.py` | chỉ thêm test mới |

### Thay đổi 1 — `emit_progress` thread-safe (BẮT BUỘC làm trước)

`quiz_pipeline.py:40-46`. Sau WP3, `emit_progress` sẽ được gọi từ nhiều thread.
`quiz.worker.ts:123-138` parse **từng dòng stdout là một JSON object** — nếu 2 thread
`print` xen nhau, dòng JSON bị vỡ và progress biến mất.

```python
_EMIT_LOCK = threading.Lock()

def emit_progress(pct: int, stage: str) -> None:
    """Emit JSON formatted progress to stdout for worker streaming (thread-safe)."""
    try:
        payload = json.dumps({"progress": pct, "stage": stage}, ensure_ascii=False)
        with _EMIT_LOCK:
            print(payload, flush=True)
    except Exception:
        pass
```

> Đây là **bắt buộc, không optional**. Thiếu lock = progress bar vỡ ngẫu nhiên trên production.

### Thay đổi 2 — `BATCH_SIZE = 12` → `5`

`quiz_pipeline.py:1077`. Lý do: 12 câu × (stem + 4 options + explanation tiếng Việt +
HTML sub/sup + KaTeX) dễ vượt `max_tokens: 8192` (dòng 876) → JSON bị cắt → parse fail.

### Thay đổi 3 — Thay threading tuần tự bằng ThreadPoolExecutor

**XOÁ** toàn bộ khối từ dòng 1108 đến 1132 (`res_holder` / `err_holder` / `ai_worker` /
`ai_thread` / `while ai_thread.is_alive()`).

**THAY BẰNG**: tách thân xử lý 1 batch ra hàm riêng rồi fan-out:

```python
MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))

def _run_batch(b_idx: int) -> list[dict]:
    """Gọi AI cho đúng một batch. Trả về list câu hỏi thô (chưa normalize)."""
    b_start, b_end, b_count = batches[b_idx]
    w_blocks = windows[b_idx]
    user_prompt = _build_phase1_prompt(w_blocks, b_start)
    res = call_agnes_api(api_key, user_prompt, system_prompt,
                         base_url=base_url, model=model, timeout=90)
    return res.get("questions", [])

results: list[list[dict] | None] = [None] * len(batches)
errors: dict[int, Exception] = {}

with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_PARALLEL) as ex:
    fut_map = {ex.submit(_run_batch, i): i for i in range(len(batches))}
    done_n = 0
    for fut in concurrent.futures.as_completed(fut_map):
        i = fut_map[fut]
        try:
            results[i] = fut.result()
        except Exception as e:
            errors[i] = e
        done_n += 1
        emit_progress(
            int(45 + (done_n / len(batches)) * (72 - 45)),
            f"Đang chuẩn hóa {done_n}/{len(batches)} gói "
            f"({min(done_n * BATCH_SIZE, effective_count)}/{effective_count} câu)..."
        )
```

**Ghép kết quả theo index `results[0..n]`**, KHÔNG theo thứ tự hoàn thành
(`as_completed` trả về theo thứ tự xong, không theo thứ tự submit).

### Thay đổi 4 — Chính sách lỗi: degradation có kiểm soát

| Tình huống | Hành vi |
|---|---|
| `len(errors) == len(batches)` (toàn bộ fail) | `raise` lỗi đầu tiên, giữ nguyên message tiếng Việt |
| Một phần batch fail | **KHÔNG fail job**. Lấp chỗ trống bằng `parsed_blocks` tương ứng |
| Batch trả `questions: []` | coi như fail của batch đó, áp dụng lấp chỗ trống |

Logic lấp chỗ trống cho batch lỗi thứ `i`:

```python
for i, err in errors.items():
    b_start, b_end, b_count = batches[i]
    fallback = []
    for off, blk in enumerate(windows[i]):
        fallback.append({
            "number": b_start + off,
            "type": "mcq",
            "question": blk["stem"],
            "options": dict(blk["options"]),
            "answer": _guess_answer_from_raw(blk["raw"]),
            "explanation": "",
            "image_ref": None
        })
    results[i] = fallback
```

`_guess_answer_from_raw(raw)`: regex tìm cụm đáp án trong text gốc
(`r"(?:đáp\s*án|answer)\s*[:\.]?\s*([A-D])\b"`, `re.IGNORECASE`);
không tìm được → trả `"A"`.

Khi có batch lỗi, emit một stage cảnh báo:

```python
emit_progress(72, f"Đã chuẩn hóa xong, {len(errors)} gói dùng bản trích xuất gốc...")
```

> Kết quả: đề **vẫn ra đủ câu**, chỉ mất phần làm đẹp công thức ở các câu thuộc batch lỗi.
> Đây là đánh đổi có chủ đích: thà đề thô mà đủ, hơn là fail cả job.

### Thay đổi 5 — Prompt phase 1: gửi JSON đã tách, không gửi text thô

Thêm hàm `_build_phase1_prompt(blocks: list[dict], b_start: int) -> str`.

**Input**: list block từ WP1. **Output**: prompt string.

Payload gửi cho AI chỉ gồm các field cần thiết (bỏ `confidence`, bỏ `raw` nếu
`confidence == "high"`; với block `low` thì gửi thêm `raw` để AI tự sửa):

```python
payload_blocks = []
for off, blk in enumerate(blocks):
    item = {
        "number": b_start + off,
        "question": blk["stem"],
        "options": blk["options"]
    }
    if blk["confidence"] == "low":
        item["raw_fallback"] = blk["raw"]
    payload_blocks.append(item)
```

Thân prompt:

```text
Đã có sẵn cấu trúc câu hỏi dưới dạng JSON. Nhiệm vụ của bạn CHỈ LÀ:
1. Chuẩn hoá công thức hoá học bằng HTML <sub>/<sup> (ví dụ C<sub>2</sub>H<sub>5</sub>OH, Fe<sup>3+</sup>).
2. Chuẩn hoá biểu thức toán bằng $...$ (KaTeX).
3. Giữ NGUYÊN mọi marker [IMAGE_REF: ...] và mọi bảng Markdown.
4. Xác định đáp án đúng, trả về "answer" là một trong "A","B","C","D".
5. Nếu một mục có "raw_fallback", hãy dùng nó để sửa lại "question"/"options" cho đúng.

KHÔNG viết lời giải. KHÔNG thêm câu. KHÔNG bớt câu. KHÔNG đổi giá trị "number".
Trả về ĐÚNG JSON: {"questions":[{"number":int,"question":str,
"options":{"A":str,"B":str,"C":str,"D":str},"answer":str,"image_ref":str|null}]}

INPUT:
<json.dumps(payload_blocks, ensure_ascii=False)>
```

`system_prompt` (dòng 1049-1075) rút gọn tương ứng: **bỏ** yêu cầu số 1
(nhận diện `Câu X` — code đã làm), **bỏ** yêu cầu số 7 (viết explanation — chuyển sang WP4).
Giữ `temperature: 0.1` và `response_format: {"type": "json_object"}`.

### Edge cases

| Case | Kỳ vọng |
|---|---|
| 4 batch, mock mỗi batch `sleep(2)` | tổng ≈ 2s (không phải 8s) |
| Batch 2 mock trả về trước batch 0 | thứ tự câu output vẫn đúng 0→1→2→3 |
| 1 trong 4 batch raise | ra đủ câu, câu thuộc batch lỗi có `explanation == ""` |
| Toàn bộ batch raise | raise lỗi đầu tiên, message tiếng Việt |
| `QUIZ_AI_CONCURRENCY=1` | chạy tuần tự, kết quả giống hệt |
| `effective_count=3` (< BATCH_SIZE) | 1 batch, 1 API call |

### Verify WP3

```bash
python engines/quiz/test_quiz_pipeline_v2.py
python engines/quiz/test_mcq_parser.py

# Smoke test thật (cần API key trong env AGNES_AI_API_KEY)
python engines/quiz/quiz_pipeline.py <pdf> --pages 11 --count 20 \
  --prefix smoke_wp3 --output-dir ./.tmp/quiz_smoke
```

**Test mới bắt buộc** (thêm vào cuối `test_quiz_pipeline_v2.py`):

1. `test_batches_run_in_parallel` — mock `call_agnes_api` với `time.sleep(1.0)`,
   4 batch, `QUIZ_AI_CONCURRENCY=4` → assert tổng thời gian `< 2.0s`.
2. `test_result_order_independent_of_completion_order` — mock cho batch sau trả về
   nhanh hơn batch trước → assert thứ tự `number` vẫn tăng dần.
3. `test_partial_batch_failure_degrades_gracefully` — 1 batch raise →
   assert `len(result) == effective_count`, các câu lỗi có `explanation == ""`.
4. `test_all_batches_failure_raises` — mọi batch raise → assert `RuntimeError`.
5. `test_emit_progress_is_thread_safe` — 50 thread gọi `emit_progress` đồng thời,
   capture stdout → assert **mọi dòng** đều `json.loads` được.

| Pass | Fail |
|---|---|
| 22 test cũ + test WP2 + 5 test mới đều pass | bất kỳ test đỏ |
| Smoke test ra 2 PDF, `questions_count` khớp số câu thật | PDF không sinh ra |
| Thời gian smoke giảm rõ rệt so với trước WP3 | không nhanh hơn → kiểm tra `MAX_PARALLEL` có thực sự áp dụng |

---

# ⚠️ WP5 — IN PDF OFFLINE HOÀN TOÀN, BỎ PHỤ THUỘC CDN (P0 — ƯU TIÊN TỐI CAO)

**Lỗi đang sửa**: pipeline load KaTeX từ `cdn.jsdelivr.net`. Server LAN không ra internet
→ Chrome treo 30s + fallback 30s → **fail**. Thêm race: công thức toán có thể chưa render
khi PDF đã in. Xem chẩn đoán đầy đủ ở §2.3 / P0-2.

**Đây là lỗi chặn phát hành — trái trực tiếp mục tiêu offline-first (AGENTS.md §1).**

### Files

| Hành động | Đường dẫn | Ghi chú |
|---|---|---|
| **TẠO MỚI** | `engines/quiz/assets/katex/katex.min.css` | vendor |
| **TẠO MỚI** | `engines/quiz/assets/katex/katex.min.js` | vendor |
| **TẠO MỚI** | `engines/quiz/assets/katex/contrib/auto-render.min.js` | vendor |
| **TẠO MỚI** | `engines/quiz/assets/katex/fonts/*.woff2` | **chỉ woff2** |
| **SỬA** | `.gitignore` | đảm bảo không loại trừ `engines/quiz/assets/` |
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `generate_worksheet_html` (dòng 1227-1234, 1726-1742) |
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `generate_answer_key_html` (khối `<head>` + script cuối, quanh dòng 1487+ và 1726-1742) |
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `compile_pdf` (dòng 1752-1846) |
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `run_pipeline` (dòng 1884-1890, 1971-1984) |
| **SỬA (CHỈ assert CDN)** | `engines/quiz/test_quiz_pipeline_v2.py` | `test_katex_delimiters_and_ignored_classes` |

### Bước 1 — Vendor KaTeX vào repo

```bash
cd /tmp && npm pack katex@0.16.11 && tar -xzf katex-0.16.11.tgz
```

Copy từ `package/dist/` sang `engines/quiz/assets/katex/`:

| Nguồn | Đích |
|---|---|
| `dist/katex.min.css` | `assets/katex/katex.min.css` |
| `dist/katex.min.js` | `assets/katex/katex.min.js` |
| `dist/contrib/auto-render.min.js` | `assets/katex/contrib/auto-render.min.js` |
| `dist/fonts/*.woff2` | `assets/katex/fonts/` |

**CHỈ copy `.woff2`** — bỏ `.ttf` và `.woff` (Chrome headless đọc woff2 tốt).
Giảm từ ~1.2MB xuống ~330KB.

> Đây là **build-time asset của engine**, không phải runtime dependency của PWA
> → commit vào git, **không** thêm vào `package.json`.
> Kiểm tra `.gitignore` (dòng liên quan `assets`, `fonts`, `*.woff2`) để chắc chắn
> thư mục này không bị loại trừ. Nếu có rule loại trừ, thêm negation
> `!engines/quiz/assets/**`.

Pin version chính xác `0.16.11` (đúng version CDN đang dùng) để không đổi hành vi render.

### Bước 2 — Per-job HTML dir + copy KaTeX

Hiện tại `run_pipeline:1889-1890` ghi HTML thẳng vào `tempfile.gettempdir()`.
Cần đổi sang **thư mục riêng cho mỗi job** để đặt KaTeX cạnh HTML.

```python
ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
KATEX_SRC_DIR = os.path.join(ENGINE_DIR, "assets", "katex")

# trong run_pipeline, thay cho ws_html_path / ans_html_path cũ:
job_html_dir = os.path.join(temp_dir, f"quiz_html_{uuid.uuid4().hex[:8]}")
os.makedirs(job_html_dir, exist_ok=True)
shutil.copytree(KATEX_SRC_DIR, os.path.join(job_html_dir, "katex"), dirs_exist_ok=True)

ws_html_path = os.path.join(job_html_dir, f"{clean_prefix}_DeBai.html")
ans_html_path = os.path.join(job_html_dir, f"{clean_prefix}_DapAn.html")
```

Thêm vào khối `finally` (dòng 1971-1984) — **bắt buộc**, tránh rác temp:

```python
try:
    if os.path.exists(job_html_dir):
        shutil.rmtree(job_html_dir, ignore_errors=True)
except Exception:
    pass
```

Nếu `KATEX_SRC_DIR` không tồn tại → raise lỗi rõ ràng ngay đầu `run_pipeline`:

```python
if not os.path.isdir(KATEX_SRC_DIR):
    raise RuntimeError(
        "Thiếu thư viện KaTeX cục bộ tại engines/quiz/assets/katex. "
        "Vui lòng cài đặt lại engine."
    )
```

### Bước 3 — Sửa HTML template (cả 2 hàm generate)

**Trong `<head>`** — thay 3 dòng CDN (`quiz_pipeline.py:1232-1234` và khối tương ứng
trong `generate_answer_key_html`) bằng **chỉ 1 dòng CSS**:

```html
<link rel="stylesheet" href="./katex/katex.min.css">
```

**XOÁ** 2 dòng `<script defer src="https://cdn.jsdelivr.net/...">` khỏi `<head>`.

**Ở cuối `<body>`** — thay khối script `DOMContentLoaded` (dòng 1726-1742):

```html
  <script src="./katex/katex.min.js"></script>
  <script src="./katex/contrib/auto-render.min.js"></script>
  <script>
    renderMathInElement(document.body, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
      ],
      ignoredClasses: ["section-banner", "main-title", "header-box", "q-num", "info-bar", "matrix-table", "notranslate", "katex-ignore"],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      throwOnError: false
    });
  </script>
```

**3 thay đổi then chốt khử race:**

1. **Bỏ `defer`** — script đồng bộ, chạy ngay tại vị trí.
2. **Bỏ `DOMContentLoaded` wrapper** — script ở cuối body nên DOM đã sẵn sàng.
3. **Đặt ở cuối `<body>`** — đảm bảo `renderMathInElement` chạy xong **trước** `load` event,
   mà `--print-to-pdf` chốt theo `load`.

> **GIỮ NGUYÊN TUYỆT ĐỐI** mảng `delimiters`, `ignoredClasses`, `ignoredTags`.
> Test `test_katex_delimiters_and_ignored_classes` assert các giá trị này.
> Lưu ý escape trong f-string Python: `\\\\(` trong source → `\\(` trong HTML output.

### Bước 4 — Sửa `compile_pdf` flags

`quiz_pipeline.py:1770-1789`, trong `run_chrome_worker`. **Thêm 4 flag**:

```python
"--allow-file-access-from-files",        # cho phép HTML local load ./katex/*
"--virtual-time-budget=8000",            # chờ JS render toán xong rồi mới in
"--run-all-compositor-stages-before-draw",
"--disable-features=NetworkService",     # chặn mọi egress, không còn chờ CDN
```

Giữ nguyên mọi flag hiện có.

### Bước 5 — Rút timeout polling 30s → 15s

`quiz_pipeline.py:1801`: `while time.time() - start_time < 30:` → `< 15:`

Lý do: đã bỏ CDN thì không còn gì phải chờ network. Giữ nguyên cơ chế fallback
`--headless` (dòng 1835-1837) để tương thích Chrome cũ.

### Bước 6 — Dọn tham số chết

Xoá tham số `questions_per_page` khỏi `generate_worksheet_html` (dòng 1207) và
`generate_answer_key_html` (dòng 1487) — không dùng ở đâu.

> **KIỂM TRA TRƯỚC KHI XOÁ**: grep xem test có truyền tham số này không:
> ```bash
> rg -n "questions_per_page" engines/quiz/
> ```
> Nếu test hiện có truyền nó → **GIỮ LẠI** tham số (vi phạm §1.4 signature đóng băng).
> Chỉ xoá khi grep xác nhận không ai dùng.

### Edge cases

| Case | Kỳ vọng |
|---|---|
| Server không có internet | PDF vẫn sinh ra, công thức toán render đúng |
| Thiếu `assets/katex/` | raise lỗi tiếng Việt rõ ràng, không treo 60s |
| Câu có `$x^2$` | PDF có glyph toán, **không** còn `$...$` thô trong text layer |
| Câu có `C<sub>2</sub>H<sub>5</sub>OH` | render subscript đúng |
| 2 job chạy đồng thời | mỗi job có `job_html_dir` riêng, không tranh file |
| Job xong / job lỗi | `job_html_dir` bị dọn sạch trong `finally` |

### Verify WP5

```bash
# 1. Không còn CDN nào trong engine
rg "cdn.jsdelivr" engines/quiz/
# Kỳ vọng: KHÔNG có kết quả nào

# 2. Asset đã vendor
ls engines/quiz/assets/katex/katex.min.js \
   engines/quiz/assets/katex/contrib/auto-render.min.js
ls engines/quiz/assets/katex/fonts/ | head

# 3. Test
python engines/quiz/test_quiz_pipeline_v2.py

# 4. Smoke test OFFLINE — quan trọng nhất
#    Ngắt mạng (hoặc chặn egress) rồi chạy:
python engines/quiz/quiz_pipeline.py <pdf> --pages 11 --count 10 \
  --prefix smoke_offline --output-dir ./.tmp/quiz_smoke

# 5. Kiểm tra công thức đã render (không còn $ thô trong text layer)
python -c "import pymupdf,sys; d=pymupdf.open('./.tmp/quiz_smoke/smoke_offline_DeBai.pdf'); print(''.join(p.get_text() for p in d).count('$'))"
```

| Pass | Fail |
|---|---|
| `rg cdn.jsdelivr engines/quiz/` → 0 kết quả | còn bất kỳ URL CDN |
| Smoke test **offline** sinh đủ 2 PDF | PDF không sinh ra khi offline |
| Đếm ký tự `$` trong text layer = 0 (với đề có công thức) | còn `$...$` thô → race chưa khử xong |
| 22 test cũ pass (trừ assert CDN đã sửa trong 1 test) | test khác ngoài `test_katex_delimiters_and_ignored_classes` bị sửa |
| Thời gian compile PDF ≤ trước đó | chậm hơn → kiểm tra `--virtual-time-budget` |

> **Nhắc lại ngoại lệ duy nhất của §1.1**: chỉ được sửa assert đường dẫn CDN trong
> `test_katex_delimiters_and_ignored_classes`. Mọi assert về `delimiters`,
> `ignoredClasses`, `ignoredTags` trong test đó giữ nguyên. Không chạm test nào khác.

---

# WP6 — `cluster_rects` từ O(n³) xuống O(n log n)

**Lỗi đang sửa**: `quiz_pipeline.py:344-368`. Vòng `while changed` chạy lại full O(n²) pass
cho đến khi hội tụ. PDF Hoá/Lý/Toán thường có 500–2000 vector path mỗi trang.
Với n=1500, một pass đã >1.1 triệu phép `Rect.intersects` trong Python thuần.
`extract_visual_assets` còn gọi `cluster_rects` **hai lần** (dòng 420 và 428).

### Files

| Hành động | Đường dẫn | Vùng sửa |
|---|---|---|
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `cluster_rects` (dòng 344-368) — viết lại ruột |
| **SỬA (thêm test)** | `engines/quiz/test_quiz_pipeline_v2.py` | chỉ thêm test mới |

### Data contract — ĐÓNG BĂNG

```python
def cluster_rects(rect_list: list[pymupdf.Rect], margin: float = 12.0) -> list[pymupdf.Rect]
```

**Cấm** đổi tên, thứ tự tham số, default `margin=12.0`, hay kiểu trả về.
Semantics phải **giữ nguyên**: group các rect giao nhau (sau khi nở `margin`) thành bbox hợp nhất.

### Logic cài đặt — union-find + sweep line

Thay vòng `while changed` bằng:

1. **Sort** index theo `x0` tăng dần.
2. **Union-find** với path compression + union by size.
3. **Sweep**: duy trì `active` list. Với mỗi rect mới theo thứ tự `x0`:
   - Pop khỏi `active` mọi rect có `x1 + margin < new.x0` (không thể giao được nữa).
   - So `new` với phần còn lại trong `active`; nếu rect nở `margin` giao nhau → `union(i, j)`.
   - Push `new` vào `active`.
4. **Gộp**: mỗi set hợp nhất bbox bằng toán tử `|` của `pymupdf.Rect`.
5. **Guard cho trang cực nhiều vector**: nếu `len(rect_list) > 1500`:
   - Bucket theo grid 24pt (`key = (int(x0/24), int(y0/24))`),
   - gộp bbox từng bucket trước,
   - rồi chạy union-find trên tập bbox đã giảm.

Điều kiện giao sau khi nở `margin` (giữ đúng semantics bản cũ, dòng 361-362):

```python
exp = pymupdf.Rect(a.x0 - margin, a.y0 - margin, a.x1 + margin, a.y1 + margin)
if exp.intersects(b): union(...)
```

### Edge cases

| Case | Kỳ vọng |
|---|---|
| `rect_list = []` | trả `[]` (giữ hành vi dòng 346-347) |
| 1 rect | trả 1 rect y nguyên |
| Mọi rect rời nhau | trả đúng n cluster |
| Mọi rect giao nhau | trả 1 cluster = bbox toàn bộ |
| Chuỗi rect giao bắt cầu A–B, B–C (A không giao C) | **1 cluster** (transitive) |
| 2000 rect | hoàn thành `< 1.5s` |
| `margin=0` | chỉ gộp rect thực sự giao |

> Case "bắt cầu transitive" là cái dễ làm sai nhất khi thay thuật toán.
> Union-find xử lý đúng tự nhiên, nhưng phải test.

### Verify WP6

```bash
python engines/quiz/test_quiz_pipeline_v2.py
```

**Test mới bắt buộc** (thêm vào cuối file test):

1. `test_cluster_rects_performance_2000_rects`
   - 2000 rect random (seed cố định) → assert thời gian `< 1.5s`.
2. `test_cluster_rects_equivalence_with_reference`
   - 200 rect random (seed cố định), cài một bản reference O(n³) **ngay trong test**
     (copy logic cũ vào test, không để trong source),
   - assert output bản mới **giống hệt** reference: so sánh
     `sorted(set((round(r.x0,1), round(r.y0,1), round(r.x1,1), round(r.y1,1))))`.
3. `test_cluster_rects_transitive_bridging`
   - A–B giao, B–C giao, A–C không giao → assert ra **1 cluster**.

| Pass | Fail |
|---|---|
| `test_cluster_rects` **cũ pass không sửa** | sửa test cũ để lách |
| 3 test mới pass | perf test > 1.5s |
| Test equivalence khớp 100% | output lệch so với reference → semantics đã bị đổi |

---

# WP4 — Tách lời giải thành phase 2 + chồng lấn in PDF

**Mục tiêu**: `explanation` là phần tốn output tokens nhất và **worksheet không cần nó**.
Tách ra phase riêng → in worksheet ngay trong lúc AI đang viết lời giải.

**Chỉ làm sau khi WP1, WP2, WP3, WP5, WP6 đã xanh hết.**

### Files

| Hành động | Đường dẫn | Vùng sửa |
|---|---|---|
| **SỬA** | `engines/quiz/quiz_pipeline.py` | thêm `generate_explanations` (đặt sau `parse_and_standardize_questions`) |
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `run_pipeline` (dòng 1904-1945) — pipeline chồng lấn |
| **SỬA (thêm test)** | `engines/quiz/test_quiz_pipeline_v2.py` | chỉ thêm test mới |

### Data contract hàm mới

```python
def generate_explanations(
    questions: list[dict],
    api_key: str,
    base_url: str = DEFAULT_API_BASE,
    model: str = DEFAULT_MODEL,
    batch_size: int = 5,
    max_workers: int = 4
) -> None:
    """
    Sinh lời giải cho từng câu, mutate IN-PLACE q["explanation"].
    Không raise khi một phần batch lỗi — các câu lỗi giữ explanation = "".
    """
```

| | Chi tiết |
|---|---|
| **Input** | list câu đã normalize, mỗi câu có `number`, `question`, `options`, `answer` |
| **Output** | `None` — mutate in-place `q["explanation"]` |
| **Side effect** | gọi `emit_progress` trong khoảng 72→80 |
| **Không raise** | mọi lỗi → `explanation = ""`, emit stage cảnh báo |

**Prompt phase 2** — chỉ gửi `number + question + options + answer`
(KHÔNG gửi `image_ref`, KHÔNG gửi `raw`):

```text
Với mỗi câu hỏi trắc nghiệm dưới đây (đã biết đáp án đúng), hãy viết lời giải
ngắn gọn, chính xác về mặt khoa học, bằng tiếng Việt, 1-3 câu.
Dùng HTML <sub>/<sup> cho công thức hoá học và $...$ cho biểu thức toán.
Trả về ĐÚNG JSON: {"explanations": {"<number>": "<lời giải>", ...}}

INPUT:
<json.dumps(items, ensure_ascii=False)>
```

Map kết quả về câu theo `str(q["number"])`. Key thiếu → giữ `""`.

Fan-out song song dùng **cùng pattern ThreadPoolExecutor của WP3**
(bao gồm ghép theo index và `emit_progress` có lock).

### Pipeline chồng lấn trong `run_pipeline`

Sau `link_assets_to_questions` (dòng 1910), thay khối tuần tự hiện tại
(build HTML → compile cả 2 PDF ở dòng 1917-1945) bằng:

```python
# Worksheet KHÔNG cần explanation -> build & in NGAY, chồng lấn với phase 2
chrome = find_chrome_path()
ws_pdf_path = os.path.join(output_dir, f"{clean_prefix}_DeBai.pdf")
ans_pdf_path = os.path.join(output_dir, f"{clean_prefix}_DapAn.pdf")

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
    f_ws = ex.submit(_build_and_compile_worksheet,
                     title, subtitle, questions, ws_html_path, chrome, ws_pdf_path)

    # Phase 2 chạy trên main thread, song song với Chrome đang in worksheet
    if os.environ.get("QUIZ_SKIP_EXPLANATION") != "1":
        generate_explanations(questions, key, base_url=base_url, model=model)

    # Answer key CẦN explanation -> chỉ submit SAU khi phase 2 xong
    f_ans = ex.submit(_build_and_compile_answer,
                      title, subtitle, questions, ans_html_path, chrome, ans_pdf_path)

    f_ws.result()
    f_ans.result()
```

Thêm 2 helper nhỏ (mỗi hàm chỉ build HTML, ghi file, gọi `compile_pdf`):

```python
def _build_and_compile_worksheet(title, subtitle, questions, html_path, chrome, pdf_path) -> None
def _build_and_compile_answer(title, subtitle, questions, html_path, chrome, pdf_path) -> None
```

> **Lưu ý thứ tự**: `f_ans` phải submit **sau** khi `generate_explanations` trả về,
> nếu không answer key sẽ in ra với `explanation` rỗng. Đây là điểm dễ sai nhất của WP4.

### Chính sách lỗi

| Tình huống | Hành vi |
|---|---|
| Phase 2 lỗi toàn bộ | **KHÔNG fail job**. `explanation = ""`, answer key vẫn in bảng ma trận đáp án + chữ cái đúng |
| Phase 2 lỗi một phần | câu lỗi `explanation = ""`, câu khác bình thường |
| `QUIZ_SKIP_EXPLANATION=1` | bỏ qua phase 2 hoàn toàn (chế độ nhanh nhất) |

### Đánh đổi — cần nắm rõ trước khi làm

Số API call tăng **~2×** (phase 1 + phase 2), nhưng mỗi call nhỏ hơn nhiều và chạy song song
→ wall-clock giảm.

> **Nếu quota Agnes là ràng buộc chính**: cân nhắc **bỏ WP4**, giữ `explanation` trong prompt
> phase 1. WP1–WP3 một mình đã thu được phần lớn lợi ích tốc độ.
> Quyết định này thuộc về chủ project, không phải của agent thi công.

### Edge cases

| Case | Kỳ vọng |
|---|---|
| Mock worksheet compile `sleep(5)` + explanation `sleep(5)` | tổng `< 7s` (chứng minh chồng lấn) |
| Phase 2 raise toàn bộ | job **COMPLETED**, answer PDF vẫn có, `explanation` rỗng |
| `QUIZ_SKIP_EXPLANATION=1` | 0 API call phase 2, 2 PDF vẫn ra |
| AI trả thiếu key cho câu 3 | câu 3 `explanation == ""`, câu khác có lời giải |
| AI trả key không phải số | bỏ qua an toàn, không crash |

### Verify WP4

```bash
python engines/quiz/test_quiz_pipeline_v2.py

QUIZ_SKIP_EXPLANATION=1 python engines/quiz/quiz_pipeline.py <pdf> --pages 11 \
  --count 10 --prefix smoke_fast --output-dir ./.tmp/quiz_smoke

python engines/quiz/quiz_pipeline.py <pdf> --pages 11 --count 10 \
  --prefix smoke_full --output-dir ./.tmp/quiz_smoke
```

**Test mới bắt buộc**:

1. `test_worksheet_compile_overlaps_explanation_phase` — mock cả 2 `sleep(5)` → tổng `< 7s`.
2. `test_explanation_failure_does_not_fail_job` — phase 2 raise → assert 2 PDF vẫn sinh,
   mọi `explanation == ""`.
3. `test_skip_explanation_env_flag` — `QUIZ_SKIP_EXPLANATION=1` → assert phase 2 mock
   `call_count == 0`.
4. `test_answer_key_contains_explanations_when_phase2_succeeds` — assert HTML answer key
   chứa text lời giải (đảm bảo không bị race submit sớm).

| Pass | Fail |
|---|---|
| 4 test mới + toàn bộ test trước đó pass | bất kỳ test đỏ |
| `smoke_fast` nhanh hơn `smoke_full` rõ rệt | không khác → flag chưa có tác dụng |
| Answer PDF của `smoke_full` **có** lời giải | lời giải rỗng → `f_ans` submit sớm (xem Lưu ý thứ tự) |

---

# WP7 — Cache theo content hash

**Mục tiêu**: retry job hoặc chỉnh tiêu đề không phải extract lại PDF và gọi lại AI.

### Files

| Hành động | Đường dẫn | Vùng sửa |
|---|---|---|
| **TẠO MỚI** | `engines/quiz/quiz_cache.py` | module cache độc lập |
| **SỬA** | `engines/quiz/quiz_pipeline.py` | thêm `PROMPT_VERSION`; wrap `extract_raw_pages` và 2 phase AI |
| **SỬA** | `server/src/services/janitor.service.ts` | thêm dọn `data/cache/quiz` |
| **SỬA (thêm test)** | `engines/quiz/test_quiz_pipeline_v2.py` | chỉ thêm test mới |

### API `engines/quiz/quiz_cache.py`

```python
def cache_root() -> str:
    """Trả về data/cache/quiz, tự tạo nếu chưa có. Tôn trọng env QUIZ_CACHE_DIR."""

def is_cache_enabled() -> bool:
    """False khi env QUIZ_CACHE_DISABLED == '1'."""

def read_json(key: str) -> dict | None:
    """Đọc cache entry. Trả None nếu miss, lỗi đọc, hoặc đã quá TTL 7 ngày."""

def write_json(key: str, value: dict) -> None:
    """Ghi atomic: ghi file .tmp rồi os.replace. Lỗi ghi -> bỏ qua im lặng (cache là best-effort)."""

def extract_cache_key(pdf_path: str, page_spec: str) -> str:
    """sha256(nội dung PDF bytes + page_spec)."""

def ai_cache_key(model: str, prompt_version: str, payload: dict) -> str:
    """sha256(model + prompt_version + json.dumps(payload, sort_keys=True, ensure_ascii=False))."""
```

### 2 loại cache

**(1) Extract cache** — `data/cache/quiz/extract_<hash>.json`

```python
{
  "raw_text": str,
  "actual_pages": list[int],
  "asset_map": dict[str, int],
  "source_q_nums": list[int],
  "assets_meta": [{"id": str, "name": str, "page": int, "rect": [4 floats], "text_inside": str}]
}
```

PNG lưu riêng trong `data/cache/quiz/assets_<hash>/<asset_id>.png`.

> **Quan trọng — KHÔNG lưu `data_uri` vào JSON.** Base64 làm file cache phình gấp ~1.4×
> kích thước ảnh. Khi cache hit: copy PNG sang `temp_assets_dir` của job, đọc bytes,
> rebuild `data_uri` bằng `base64.b64encode`. Cấu trúc asset dict trả về phải **giống hệt**
> output của `extract_visual_assets` (đủ các key `id`, `name`, `page`, `rect`, `data_uri`,
> `file_path`, `text_inside`) vì `link_assets_to_questions` phụ thuộc.

**(2) AI cache** — `data/cache/quiz/ai_<hash>.json`

Cache **từng batch** của phase 1 và phase 2 riêng biệt. Key gồm `model` + `PROMPT_VERSION`
+ payload blocks đã `sort_keys`.

### `PROMPT_VERSION` — bắt buộc

Thêm hằng ở đầu `quiz_pipeline.py`:

```python
PROMPT_VERSION = "v3"
```

> **Quy tắc vận hành**: **mọi lần sửa nội dung prompt (phase 1 hoặc phase 2) PHẢI bump**
> `PROMPT_VERSION`. Không bump = cache cũ phục vụ kết quả theo prompt cũ, debug cực khó.
> Ghi rule này thành comment ngay cạnh hằng số.

### TTL & dọn rác

- TTL **7 ngày**, kiểm theo `os.path.getmtime`.
- `read_json` tự coi entry quá TTL là miss (không cần xoá ngay).
- `QUIZ_CACHE_DISABLED=1` → bypass toàn bộ (cả đọc và ghi).

### Sửa `server/src/services/janitor.service.ts`

Thêm một static method mới theo đúng pattern của `cleanupOrphanedChunks`
(`janitor.service.ts:24`), rồi gọi nó trong `runJanitorOnce` (dòng 73):

```ts
/**
 * Removes quiz pipeline cache entries (extract + AI batch) older than 7 days.
 */
static async cleanupQuizCache(): Promise<number>
```

- Đường dẫn: `path.resolve(process.cwd(), 'data', 'cache', 'quiz')`.
  Dùng `resolvedStoragePaths` từ `server/src/config/env.config.ts:51-57` nếu phù hợp,
  hoặc `path.resolve(process.cwd(), 'data', 'cache', 'quiz')` nếu cache nằm ngoài `STORAGE_ROOT`.
  **Phải khớp với `cache_root()` phía Python** — đây là nguồn lỗi dễ xảy ra nhất.
- Xoá file `extract_*.json`, `ai_*.json` và thư mục `assets_*` có `mtime` > 7 ngày.
- Trả về số entry đã xoá. Cộng vào `JanitorPurgeResult` nếu interface cho phép,
  hoặc log qua logger hiện có.
- **Không** để exception thoát ra ngoài làm chết chu kỳ janitor (bọc try/catch
  có log, **không** phải `catch {}` rỗng — vi phạm AGENTS.md Rule 1).

### Edge cases

| Case | Kỳ vọng |
|---|---|
| Chạy cùng job 2 lần | lần 2 **0 API call**, chỉ còn thời gian Chrome |
| PDF đổi 1 byte | cache miss (hash theo nội dung) |
| Đổi `--title` / `--prefix` | extract + AI cache **vẫn hit** (không nằm trong key) |
| Đổi `--pages` | extract cache miss |
| Bump `PROMPT_VERSION` | AI cache miss toàn bộ |
| `QUIZ_CACHE_DISABLED=1` | bypass, hành vi như trước WP7 |
| Cache file corrupt / JSON lỗi | coi như miss, không crash |
| Thư mục cache không ghi được | pipeline vẫn chạy bình thường (best-effort) |
| Cache hit nhưng PNG bị xoá | coi như miss toàn bộ extract entry |

### Verify WP7

```bash
python engines/quiz/test_quiz_pipeline_v2.py
cd server && npx tsc --noEmit        # BẮT BUỘC 0 error (có sửa janitor.service.ts)
cd server && npx vitest run          # BẮT BUỘC pass 100%

# Đo cache: chạy 2 lần cùng tham số
time python engines/quiz/quiz_pipeline.py <pdf> --pages 11 --count 10 --prefix c1 --output-dir ./.tmp/quiz_smoke
time python engines/quiz/quiz_pipeline.py <pdf> --pages 11 --count 10 --prefix c1 --output-dir ./.tmp/quiz_smoke
```

**Test mới bắt buộc**:

1. `test_extract_cache_hit_skips_pymupdf` — mock `extract_structured_page_content`,
   chạy 2 lần → assert lần 2 `call_count` không tăng.
2. `test_ai_cache_hit_skips_api_call` — chạy 2 lần → assert lần 2 `call_agnes_api` 0 lần.
3. `test_prompt_version_bump_invalidates_cache` — đổi `PROMPT_VERSION` → assert gọi AI lại.
4. `test_cache_disabled_env_bypasses` — `QUIZ_CACHE_DISABLED=1` → assert luôn gọi AI.
5. `test_corrupt_cache_entry_treated_as_miss` — ghi file cache nội dung rác → assert không crash.
6. `test_cached_assets_rebuild_data_uri` — cache hit → assert mọi asset có `data_uri`
   hợp lệ bắt đầu bằng `data:image/png;base64,`.

| Pass | Fail |
|---|---|
| Lần chạy thứ 2 nhanh hơn rõ rệt, 0 API call | lần 2 vẫn gọi AI |
| 6 test mới + toàn bộ test trước pass | bất kỳ test đỏ |
| `tsc --noEmit` 0 error, `vitest run` 100% | có error TS hoặc test server đỏ |
| Đường dẫn cache Python và janitor TS **khớp nhau** | janitor dọn sai thư mục → cache phình vô hạn |

---

# WP8 — Retry thông minh + bỏ hardcode API key

### Files

| Hành động | Đường dẫn | Vùng sửa |
|---|---|---|
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `DEFAULT_API_KEY` (dòng 37) |
| **SỬA** | `engines/quiz/quiz_pipeline.py` | `call_agnes_api` (dòng 858-920) |
| **SỬA (thêm test)** | `engines/quiz/test_quiz_pipeline_v2.py` | chỉ thêm test mới |

### Thay đổi 1 — Bỏ API key hardcode (bảo mật)

`quiz_pipeline.py:37` đang chứa **một API key thật** trong source:

```python
DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "sk-zsaZ9j...")   # <-- key thật
```

Sửa thành:

```python
DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "")
```

> **HÀNH ĐỘNG VẬN HÀNH (ngoài phạm vi code)**: key này đã nằm trong git history
> → sau khi xoá, chủ project nên **rotate key** trên dashboard Agnes AI.
> Agent thi công chỉ cần xoá khỏi source và báo lại nhắc nhở này.

Thông báo lỗi khi thiếu key đã có sẵn ở `run_pipeline:1893-1894`, giữ nguyên.

### Thay đổi 2 — Phân biệt loại lỗi

`call_agnes_api` hiện bắt `except Exception` chung (dòng 913-918) → khi JSON bị cắt do
`max_tokens`, nó **retry với payload y hệt, temperature y hệt** → truncate y hệt.
3 lần thất bại, mỗi lần tới `timeout=180` (~9,5 phút vô ích).

Bắt `json.JSONDecodeError` **riêng và trước** `except Exception`:

```python
except json.JSONDecodeError as e:
    # Thử salvage trước khi retry
```

### Thay đổi 3 — Salvage JSON bị cắt

Thêm helper:

```python
def _salvage_truncated_json(raw: str) -> dict | None:
    """
    Cứu JSON bị cắt giữa mảng "questions": cắt tới object hoàn chỉnh cuối cùng,
    đóng ngoặc "]}" rồi parse lại. Trả None nếu không cứu được.
    """
```

Cài đặt: tìm vị trí `}` cuối cùng mà tại đó độ sâu ngoặc nhọn về đúng mức nằm trong
mảng `questions`, cắt chuỗi tại đó, append `"]}"`, `json.loads`. Thành công → dùng luôn,
không retry.

### Thay đổi 4 — Retry có điều chỉnh

Salvage thất bại → retry **khác payload**, không lặp y nguyên:

- `temperature: 0.0` (thay vì 0.1),
- append vào cuối user prompt:
  `"\n\nChỉ trả JSON compact, không markdown fence, không giải thích thêm."`

> Hiện tại `req` được tạo **một lần** trước vòng retry (dòng 879-887) nên không thể đổi
> payload giữa các lần thử. **Phải refactor**: dựng `payload` + `Request` **bên trong**
> vòng `for attempt`, để lần thử sau dùng được temperature và prompt đã điều chỉnh.
> Đây là điểm bắt buộc, không làm thì thay đổi 4 vô nghĩa.

### Thay đổi 5 — Timeout 180s → 90s

Default `timeout: int = 180` → `90` (dòng 864). Với batch 5 câu (sau WP3), 90s rất thoải mái.
Worst case mỗi batch: 90×3 + sleep ≈ 5 phút thay vì 9,5 phút.

### Edge cases

| Case | Kỳ vọng |
|---|---|
| JSON bị cắt giữa mảng, có 3 object hoàn chỉnh | salvage ra 3 câu, **không** retry |
| JSON cắt ngay giữa object đầu | salvage trả `None` → retry với temp 0.0 |
| Response bọc ```json fence | strip fence như hiện tại (dòng 896-898) vẫn hoạt động |
| HTTP 429 | retry với backoff như hiện tại (dòng 903-905), **không** salvage |
| HTTP 401 (key sai) | raise ngay, không retry |
| Timeout mạng | retry theo logic hiện có (dòng 907-912) |
| Thiếu `AGNES_AI_API_KEY` | lỗi tiếng Việt từ `run_pipeline:1893-1894` |

### Verify WP8

```bash
python engines/quiz/test_quiz_pipeline_v2.py
rg -n "sk-" engines/quiz/     # Kỳ vọng: KHÔNG có API key nào trong source
```

**Test mới bắt buộc**:

1. `test_salvage_truncated_json_recovers_complete_objects` — JSON cắt sau 3 object
   → assert ra 3 câu.
2. `test_salvage_returns_none_on_unrecoverable` — JSON cắt giữa object đầu → assert `None`.
3. `test_retry_uses_zero_temperature_after_json_error` — mock urlopen, lần 1 trả JSON rác,
   lần 2 OK → assert payload lần 2 có `"temperature": 0.0`.
4. `test_http_401_does_not_retry` — assert `urlopen` chỉ được gọi 1 lần.
5. `test_no_hardcoded_api_key_in_source` — đọc chính file `quiz_pipeline.py`,
   assert không match `r"sk-[A-Za-z0-9]{20,}"`.

| Pass | Fail |
|---|---|
| `rg "sk-" engines/quiz/` → 0 kết quả | còn key trong source |
| 5 test mới + toàn bộ test trước pass | bất kỳ test đỏ |
| Test 3 xác nhận payload lần 2 **khác** lần 1 | retry vẫn lặp payload y nguyên → chưa refactor `Request` vào trong vòng lặp |

---

## 4. BẢNG VERIFY TỔNG HỢP

| WP | Lệnh bắt buộc | Pass criteria |
|---|---|---|
| WP1 | `python engines/quiz/test_mcq_parser.py`<br>`python engines/quiz/test_quiz_pipeline_v2.py` | 11+ test mới pass; 22 test cũ pass nguyên vẹn |
| **WP2** | `python engines/quiz/test_quiz_pipeline_v2.py` | +3 test mới pass; 10 câu thật + `count=20` → **đúng 10 câu**, 2 API call |
| WP3 | `python engines/quiz/test_quiz_pipeline_v2.py`<br>+ smoke test | +5 test mới pass; 4 batch song song ≈ thời gian 1 batch; mọi dòng stdout là JSON hợp lệ |
| **WP5** | `rg "cdn.jsdelivr" engines/quiz/`<br>+ smoke test **offline** | 0 kết quả CDN; PDF sinh được khi **ngắt mạng**; 0 ký tự `$` thô trong text layer |
| WP6 | `python engines/quiz/test_quiz_pipeline_v2.py` | +3 test mới pass; 2000 rect `< 1.5s`; equivalence khớp reference 100% |
| WP4 | `python engines/quiz/test_quiz_pipeline_v2.py`<br>+ 2 smoke test | +4 test mới pass; chồng lấn chứng minh `< 7s`; answer PDF **có** lời giải |
| WP7 | `python ...test_quiz_pipeline_v2.py`<br>`cd server && npx tsc --noEmit`<br>`cd server && npx vitest run` | +6 test mới pass; **tsc 0 error**; **vitest 100%**; lần chạy 2 có 0 API call |
| WP8 | `python ...test_quiz_pipeline_v2.py`<br>`rg -n "sk-" engines/quiz/` | +5 test mới pass; 0 API key trong source |

### Verify cuối cùng (sau WP8)

```bash
# Python
python engines/quiz/test_quiz_pipeline_v2.py
python engines/quiz/test_mcq_parser.py

# Backend — AGENTS.md §4, BẮT BUỘC
cd server && npx tsc --noEmit
cd server && npx vitest run

# Bảo mật & offline
rg "cdn.jsdelivr" engines/quiz/
rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/

# Cấm code nửa vời
rg -n "TODO|FIXME|NotImplementedError" engines/quiz/

# Smoke end-to-end
python engines/quiz/quiz_pipeline.py <pdf> --pages 11 --count 20 \
  --prefix final_smoke --output-dir ./.tmp/quiz_smoke

# Affected test theo AGENTS.md Rule 0
git diff --name-only | codegraph affected -p "C:\Users\AnhDuy\Code\Project\DD Studio" --stdin -q
```

Toàn bộ 5 lệnh kiểm tra phải ra kết quả mong đợi, 3 lệnh `rg` cuối phải ra **0 kết quả**.

### Dọn dẹp sau khi verify

```bash
rm -rf ./.tmp/quiz_smoke
```

Không commit file PDF smoke test. Kiểm tra `git status` sạch trước khi báo DONE.

---

## 5. KỲ VỌNG SAU NÂNG CẤP

| Kịch bản | Hiện tại | Sau WP1–3, 5, 6 | Sau thêm WP4, 7 |
|---|---|---|---|
| 20 câu (trang có 10) | 90–140s + **ra 18 câu SAI** | 40–60s, **đúng 10 câu** | 30–45s |
| 40 câu | 150–240s | 50–70s | 35–55s |
| Chạy lại cùng job | = lần đầu | = lần đầu | **5–15s** (cache hit) |
| Server không có internet | **FAIL** | **OK** | OK |
| Trang nhiều vector (1500+) | +30–60s | +2–5s | +2–5s |
| Batch AI vượt `max_tokens` | fail sau ~9,5 phút | salvage hoặc retry ~5 phút | như trước |

> Các số là **ước lượng suy ra từ cấu trúc code**, không phải kết quả benchmark.
> Sau WP3 và WP7, hãy đo thực tế bằng `time` và cập nhật lại bảng này.

### Thay đổi hành vi người dùng nhìn thấy

| Trước | Sau |
|---|---|
| Yêu cầu 20 câu, trang có 10 → ra 18 câu lộn xộn | ra **đúng 10 câu**, số 1–10 |
| Progress nhảy theo gói tuần tự | progress mượt hơn, báo `x/y gói` |
| Offline → job FAILED | job chạy bình thường |
| 1 batch AI lỗi → cả job FAILED | job xong, câu lỗi dùng bản trích xuất gốc |

---

## 6. BIẾN MÔI TRƯỜNG MỚI

| Biến | Default | Tác dụng | WP |
|---|---|---|---|
| `QUIZ_AI_CONCURRENCY` | `4` | Số luồng gọi AI song song | WP3 |
| `QUIZ_SKIP_EXPLANATION` | — | `=1` bỏ phase 2, chế độ nhanh nhất | WP4 |
| `QUIZ_CACHE_DISABLED` | — | `=1` bypass toàn bộ cache | WP7 |
| `QUIZ_CACHE_DIR` | `data/cache/quiz` | Thư mục cache | WP7 |
| `AGNES_AI_API_KEY` | `""` | **bắt buộc** sau WP8 (không còn fallback hardcode) | WP8 |

Các biến đã có, giữ nguyên: `AGNES_AI_BASE_URL`, `AGNES_AI_MODEL`, `PYTHON_BIN`.

> `server/src/workers/quiz.worker.ts:212-221` đang forward `AGNES_AI_*` xuống Python qua CLI args.
> Các biến `QUIZ_*` mới **không cần** forward — Python đọc trực tiếp từ env của process con,
> vốn thừa hưởng env của Node. Không cần sửa worker cho WP3/WP4/WP7.

---

## 7. RỦI RO & PHƯƠNG ÁN LÙI

| Rủi ro | Dấu hiệu | Phương án |
|---|---|---|
| WP1 tách `text_utils.py` gây import vòng | `ImportError` khi chạy test | Giữ 3 hàm ở `quiz_pipeline.py`, cho `mcq_parser.py` nhận chúng qua tham số inject |
| WP3 song song làm rate-limit Agnes | HTTP 429 dồn dập | Hạ `QUIZ_AI_CONCURRENCY=2`; backoff hiện có (dòng 903-905) vẫn giữ |
| WP4 tăng 2× số API call vượt quota | hết quota giữa job | Bỏ WP4, trả `explanation` về prompt phase 1 |
| WP5 Chrome không đọc được `./katex/` | PDF ra nhưng toán không render | Kiểm `--allow-file-access-from-files`; thử nhúng inline CSS/JS vào HTML |
| WP6 đổi semantics clustering | ảnh bị cắt sai / thiếu ảnh | Test equivalence đã chặn; nếu đỏ thì revert về bản O(n³) và chỉ thêm guard n>1500 |
| WP7 cache phục vụ kết quả cũ sau khi sửa prompt | đề không đổi dù đã sửa prompt | Bump `PROMPT_VERSION`; hoặc `QUIZ_CACHE_DISABLED=1` |

**Nguyên tắc lùi**: mỗi WP là một commit riêng, message theo Conventional Commits
(`fix(quiz): ...` cho WP2/WP5, `perf(quiz): ...` cho WP3/WP6, `feat(quiz): ...` cho WP1/WP7).
Cần lùi WP nào thì revert đúng commit đó, không revert cả nhóm.

Theo AGENTS.md Rule 5: thi công trên branch `dev`, verify trên `http://192.168.2.171:3001`,
chỉ promote lên `main` khi đã xác nhận 100% trên dev server.

---

## 8. CHECKLIST ĐÓNG TASK

- [ ] WP1 — pre-parser + `text_utils.py` + 11 test mới
- [ ] **WP2 — fix nhân đôi câu hỏi (P0)** + 3 test mới
- [ ] WP3 — micro-batch song song + lock `emit_progress` + 5 test mới
- [ ] **WP5 — vendor KaTeX, in PDF offline (P0)** + sửa đúng 1 assert CDN
- [ ] WP6 — `cluster_rects` union-find + 3 test mới
- [ ] WP4 — phase 2 explanation + chồng lấn in PDF + 4 test mới
- [ ] WP7 — cache + janitor TS + 6 test mới
- [ ] WP8 — salvage JSON + bỏ hardcode key + 5 test mới
- [ ] 22 test cũ trong `test_quiz_pipeline_v2.py` **pass nguyên vẹn, không bị sửa**
- [ ] `cd server && npx tsc --noEmit` → 0 error
- [ ] `cd server && npx vitest run` → pass 100%
- [ ] `rg "cdn.jsdelivr" engines/quiz/` → 0 kết quả
- [ ] `rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/` → 0 kết quả
- [ ] `rg -n "TODO|FIXME|NotImplementedError" engines/quiz/` → 0 kết quả
- [ ] Smoke test offline sinh đủ 2 PDF hợp lệ
- [ ] 10 câu thật + `count=20` → ra đúng 10 câu, không trùng
- [ ] Dọn `./.tmp/quiz_smoke`, `git status` sạch
- [ ] **Rotate API key Agnes AI** (việc vận hành, ngoài code)









