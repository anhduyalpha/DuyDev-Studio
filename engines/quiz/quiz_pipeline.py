"""
Quiz PDF Generator Pipeline
Deterministic AI-powered pipeline to ingest PDF/docs, extract & standardize quiz questions
via Agnes 3.0 Flash API, and compile high-fidelity A4 Portrait worksheets and standalone answer keys.
"""

import sys
import os
import re
import json
import time
import tempfile
import argparse
import subprocess
import urllib.request
import urllib.error
import http.client
import threading
import shutil
import pymupdf

# Reconfigure stdout/stderr for UTF-8
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


DEFAULT_API_BASE = os.environ.get("AGNES_AI_BASE_URL", "https://apihub.agnes-ai.com/v1")
DEFAULT_MODEL = os.environ.get("AGNES_AI_MODEL", "agnes-3.0-flash")
DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "sk-zsaZ9jZjzOk9V5rQj4CxkWO3q5AOmRtG3puwUW5SiiI5NCoK")


def emit_progress(pct: int, stage: str) -> None:
    """Emit JSON formatted progress to stdout for worker streaming."""
    try:
        payload = json.dumps({"progress": pct, "stage": stage}, ensure_ascii=False)
        print(payload, flush=True)
    except Exception:
        pass


def find_chrome_path() -> str:
    """Auto-detect Google Chrome / Chromium executable path across Windows and Linux."""
    candidates = [
        # Linux standard paths
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/snap/bin/chromium",
        # Windows standard paths
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        "google-chrome",
        "chrome",
        "chromium"
    ]
    for c in candidates:
        if os.path.isabs(c):
            if os.path.exists(c):
                return c
        else:
            # Check PATH
            from shutil import which
            found = which(c)
            if found:
                return found

    # Fallback to default
    return "google-chrome" if sys.platform != "win32" else candidates[5]


def download_gdrive_if_needed(url_or_path: str, temp_dir: str) -> str:
    """Download Google Drive file if input is a URL, else return verified local path."""
    if not url_or_path.startswith("http"):
        if not os.path.exists(url_or_path):
            raise FileNotFoundError(f"Tệp PDF nguồn không tồn tại: {url_or_path}")
        return url_or_path

    match = (
        re.search(r"/d/([a-zA-Z0-9_-]+)", url_or_path)
        or re.search(r"[?&]id=([a-zA-Z0-9_-]+)", url_or_path)
        or re.search(r"id=([a-zA-Z0-9_-]+)", url_or_path)
    )
    file_id = match.group(1) if match else None
    if not file_id:
        raise ValueError(f"Không thể trích xuất File ID từ đường dẫn Google Drive: {url_or_path}")

    out_pdf = os.path.join(temp_dir, f"gdrive_{file_id}.pdf")
    if os.path.exists(out_pdf) and os.path.getsize(out_pdf) > 1000:
        return out_pdf

    emit_progress(15, f"Đang tải tài liệu từ Google Drive (ID: {file_id[:8]}...)...")
    download_urls = [
        f"https://drive.google.com/uc?export=download&id={file_id}",
        f"https://drive.usercontent.google.com/download?id={file_id}&export=download"
    ]

    last_error = None
    for d_url in download_urls:
        try:
            req = urllib.request.Request(d_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            })
            with urllib.request.urlopen(req, timeout=35) as resp:
                content = resp.read()
                if b"%PDF" in content[:1024]:
                    with open(out_pdf, "wb") as f:
                        f.write(content)
                    return out_pdf

                # Handle Google Drive large-file scan warning confirmation
                confirm_match = re.search(r"confirm=([0-9A-Za-z_-]+)", content.decode("utf-8", errors="ignore"))
                if confirm_match:
                    confirm_code = confirm_match.group(1)
                    confirm_url = f"{d_url}&confirm={confirm_code}"
                    req2 = urllib.request.Request(confirm_url, headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    })
                    with urllib.request.urlopen(req2, timeout=45) as resp2:
                        c2 = resp2.read()
                        if b"%PDF" in c2[:1024]:
                            with open(out_pdf, "wb") as f:
                                f.write(c2)
                            return out_pdf
        except urllib.error.HTTPError as e:
            last_error = f"HTTP {e.code}"
        except Exception as e:
            last_error = str(e)

    raise RuntimeError(
        f"Không thể tải tệp từ Google Drive ({last_error or 'Không tìm thấy PDF'}). "
        "Vui lòng đảm bảo tệp được chia sẻ công khai ('Bất kỳ ai có đường liên kết')."
    )


def extract_raw_pages(pdf_path: str, page_spec: str) -> tuple[str, list[int]]:
    """Extract raw text from PDF for specified pages (1-indexed)."""
    try:
        doc = pymupdf.open(pdf_path)
    except Exception as e:
        raise RuntimeError(f"Không thể đọc tệp PDF. Tệp có thể bị hỏng hoặc có mật khẩu bảo vệ: {e}")

    total_pages = len(doc)
    page_nums = []

    # Parse page spec: e.g. "11", "11,12", "11-12", "36-38"
    for part in page_spec.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-", 1)
            page_nums.extend(range(int(start), int(end) + 1))
        elif part:
            page_nums.append(int(part))

    extracted_texts = []
    actual_pages = []
    for p in page_nums:
        if 1 <= p <= total_pages:
            idx = p - 1
            text = doc[idx].get_text()
            extracted_texts.append(f"--- PAGE {p} ---\n" + text)
            actual_pages.append(p)
        else:
            raise ValueError(f"Trang {p} vượt quá tổng số {total_pages} trang của tài liệu PDF.")

    full_text = "\n\n".join(extracted_texts)
    clean_len = len(re.sub(r"\s+", "", full_text))
    if clean_len < 50:
        raise ValueError(
            f"Trang được chọn ({', '.join(map(str, actual_pages))}) không chứa văn bản dạng số/vector. "
            "Tài liệu có thể là ảnh scan thuần túy. Vui lòng chọn trang có lớp chữ hoặc OCR trước."
        )

    return full_text, actual_pages


def call_agnes_api(
    api_key: str,
    prompt: str,
    system_prompt: str,
    base_url: str = DEFAULT_API_BASE,
    model: str = DEFAULT_MODEL,
    timeout: int = 180,
    max_retries: int = 2
) -> dict:
    """Send chat completion request to Agnes AI with JSON formatting, defensive retries, and timeout resilience."""
    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "max_tokens": 8192
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "DDStudio-QuizPipeline/1.0"
        }
    )

    last_err = None
    for attempt in range(max_retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                
                # Clean markdown JSON fences if present
                cleaned = content.strip()
                if cleaned.startswith("```"):
                    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
                    cleaned = re.sub(r"\s*```$", "", cleaned)
                return json.loads(cleaned)
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="replace")
            last_err = RuntimeError(f"Agnes AI API error (HTTP {e.code}): {err_msg}")
            if e.code in (429, 500, 502, 503, 504) and attempt < max_retries:
                time.sleep(2.0 * (attempt + 1))
                continue
            raise last_err
        except (TimeoutError, urllib.error.URLError, http.client.RemoteDisconnected) as e:
            last_err = RuntimeError(f"Không thể kết nối đến Agnes AI API (quá thời gian chờ {timeout}s hoặc lỗi mạng): {e}")
            if attempt < max_retries:
                time.sleep(2.0 * (attempt + 1))
                continue
            raise last_err
        except Exception as e:
            last_err = RuntimeError(f"Lỗi phản hồi Agnes AI API: {e}")
            if attempt < max_retries:
                time.sleep(2.0 * (attempt + 1))
                continue
            raise last_err

    raise last_err or RuntimeError("Không thể kết nối đến Agnes AI API sau nhiều lần thử lại")


def parse_and_standardize_questions(
    raw_text: str,
    api_key: str,
    count: int = 20,
    start_num: int = 1,
    base_url: str = DEFAULT_API_BASE,
    model: str = DEFAULT_MODEL
) -> list[dict]:
    """Parse raw text into structured question objects with HTML formatting and answers via Agnes AI with intelligent batching."""
    system_prompt = (
        "You are an expert Vietnamese Chemistry teacher and exam editor.\n"
        "Your task is to extract, standardize, and format multiple-choice questions from the provided textbook text.\n"
        "Requirements:\n"
        "1. Identify questions from 'Câu X' accurately.\n"
        "2. Standardize all chemical formulas, subscripts, and superscripts using HTML tags: "
        "always convert indices to <sub> (e.g. C<sub>15</sub>H<sub>31</sub>COOH, C<sub>2</sub>H<sub>5</sub>OH, "
        "C<sub>n</sub>H<sub>2n</sub>O<sub>2</sub>, H<sub>2</sub>SO<sub>4</sub>) and charges to <sup>.\n"
        "3. Provide exactly 4 options A, B, C, D for each question.\n"
        "4. In 'explanation', provide a concise, accurate scientific explanation strictly in Vietnamese (1-3 sentences), "
        "justifying why the chosen answer is correct and citing relevant chemical principles/formulas/reactions.\n"
        "5. Output the single uppercase letter ('A', 'B', 'C', or 'D') in 'answer' matching the result from your analysis.\n"
        "6. Return ONLY a valid JSON object matching this exact schema:\n"
        "{\n"
        '  "questions": [\n'
        "    {\n"
        '      "number": 1,\n'
        '      "question": "Question text...",\n'
        '      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},\n'
        '      "explanation": "Concise scientific explanation proving why the choice is correct...",\n'
        '      "answer": "A"\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    BATCH_SIZE = 12
    # Prepare question ranges: if count > 15, split into batches to avoid token limits & timeouts
    batches = []
    curr_start = start_num
    remaining = count
    while remaining > 0:
        b_count = min(remaining, BATCH_SIZE)
        b_end = curr_start + b_count - 1
        batches.append((curr_start, b_end, b_count))
        curr_start += b_count
        remaining -= b_count

    total_batches = len(batches)
    all_questions = []

    start_progress = 45
    max_ai_progress = 72
    prog_step = (max_ai_progress - start_progress) / max(1, total_batches)

    for b_idx, (b_start, b_end, b_count) in enumerate(batches):
        batch_prog_base = int(start_progress + b_idx * prog_step)
        user_prompt = (
            f"Extract up to {b_count} multiple-choice questions starting from question number {b_start} "
            f"up to question number {b_end} from the following text:\n\n{raw_text}"
        )

        res_holder = {}
        err_holder = {}

        def ai_worker():
            try:
                res_holder["data"] = call_agnes_api(
                    api_key, user_prompt, system_prompt, base_url=base_url, model=model, timeout=180
                )
            except Exception as e:
                err_holder["err"] = e

        ai_thread = threading.Thread(target=ai_worker, daemon=True)
        ai_thread.start()

        elapsed = 0
        current_p = batch_prog_base
        batch_label = f"gói {b_idx + 1}/{total_batches} (Câu {b_start} - {b_end})" if total_batches > 1 else f"{count} câu"

        while ai_thread.is_alive():
            ai_thread.join(timeout=2.0)
            elapsed += 2
            if ai_thread.is_alive():
                if current_p < int(batch_prog_base + prog_step - 2):
                    current_p += 1
                emit_progress(
                    current_p,
                    f"Agnes 3.0 Flash đang chuẩn hóa {batch_label} ({elapsed}s)..."
                )

        if "err" in err_holder:
            raise err_holder["err"]

        res = res_holder.get("data", {})
        batch_qs = res.get("questions", [])
        if not batch_qs:
            # If later batch yields no more questions, stop gracefully if we already got some
            if all_questions:
                break
            raise RuntimeError(f"Agnes AI không tìm thấy câu hỏi trắc nghiệm nào trong phạm vi câu {b_start} - {b_end}.")

        # Normalize question numbering
        for idx, q in enumerate(batch_qs):
            target_num = b_start + idx
            if "number" not in q or not isinstance(q["number"], int):
                q["number"] = target_num
            all_questions.append(q)

        emit_progress(
            int(start_progress + (b_idx + 1) * prog_step),
            f"Đã chuẩn hóa xong {batch_label} ({len(all_questions)}/{count} câu)..."
        )

    if not all_questions:
        raise RuntimeError("Agnes AI không tìm thấy câu hỏi trắc nghiệm nào trong phạm vi trang đã chọn.")

    return all_questions


def determine_option_layout(options: dict) -> str:
    """Determine best grid layout (opt-col-4, opt-col-2, opt-col-1) based on text length."""
    max_len = max(len(re.sub(r"<[^>]+>", "", str(v))) for v in options.values()) if options else 0
    if max_len <= 15:
        return "opt-col-4"
    elif max_len <= 45:
        return "opt-col-2"
    else:
        return "opt-col-1"


def generate_worksheet_html(title: str, subtitle: str, questions: list[dict], questions_per_page: int = 10) -> str:
    """Generate printable HTML worksheet with balanced pagination."""
    items_html = []
    for idx, q in enumerate(questions, start=1):
        num = q.get("number", idx)
        q_text = q.get("question", "")
        opts = q.get("options", {})
        col_class = determine_option_layout(opts)

        break_class = " page-break-before" if (idx > 1 and (idx - 1) % questions_per_page == 0) else ""

        opt_items = []
        for key in ["A", "B", "C", "D"]:
            val = opts.get(key, "")
            opt_items.append(f'<div class="opt-item"><span class="opt-letter">{key}.</span> {val}</div>')
        opts_rendered = "\n      ".join(opt_items)

        item = f"""
  <div class="question-item{break_class}">
    <span class="q-num">Câu {num}:</span>
    <div class="q-content">{q_text}</div>
    <div class="options-grid {col_class}">
      {opts_rendered}
    </div>
  </div>"""
        items_html.append(item)

    body_content = "\n".join(items_html)
    sub_html = f'\n    <div class="sub-title">{subtitle}</div>' if subtitle and subtitle.strip() else ""

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>{title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap');

  @page {{
    size: A4 portrait;
    margin: 12mm 14mm 12mm 14mm;
    @bottom-right {{
      content: "Trang " counter(page) " / " counter(pages);
      font-size: 8.5pt;
      color: #64748b;
      font-family: 'Roboto', sans-serif;
    }}
    @bottom-left {{
      content: "{title}";
      font-size: 8.5pt;
      color: #64748b;
      font-family: 'Roboto', sans-serif;
    }}
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  body {{
    font-family: 'Roboto', 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #1e293b;
    background: #ffffff;
  }}

  .header-box {{
    text-align: center;
    border-bottom: 2px solid #1e3a8a;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }}

  .main-title {{
    font-size: 14.5pt;
    font-weight: 800;
    color: #1e3a8a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 3px;
  }}

  .sub-title {{
    font-size: 9.5pt;
    font-weight: 500;
    color: #475569;
    font-style: italic;
    margin-bottom: 4px;
  }}

  .info-bar {{
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 8.5pt;
    color: #64748b;
    border-top: 1px dashed #cbd5e1;
    padding-top: 4px;
  }}

  .section-banner {{
    background: linear-gradient(135deg, #1e3a8a, #2563eb);
    color: #ffffff;
    padding: 4px 10px;
    border-radius: 4px;
    font-weight: 700;
    font-size: 9.5pt;
    text-transform: uppercase;
    margin-top: 6px;
    margin-bottom: 9px;
    page-break-after: avoid;
    break-after: avoid;
  }}

  .question-item {{
    margin-bottom: 9px;
    page-break-inside: avoid;
    break-inside: avoid;
  }}

  .page-break-before {{
    page-break-before: always;
    break-before: page;
  }}

  .q-num {{
    font-weight: 700;
    color: #1e3a8a;
  }}

  .q-content {{
    font-weight: 500;
    display: inline;
  }}

  .options-grid {{
    display: grid;
    margin-top: 3px;
    margin-left: 12px;
    row-gap: 3px;
    column-gap: 8px;
  }}

  .opt-col-4 {{
    grid-template-columns: repeat(4, 1fr);
  }}

  .opt-col-2 {{
    grid-template-columns: repeat(2, 1fr);
  }}

  .opt-col-1 {{
    grid-template-columns: 1fr;
  }}

  .opt-item {{
    display: flex;
    align-items: baseline;
    font-size: 9.8pt;
  }}

  .opt-letter {{
    font-weight: 700;
    color: #0369a1;
    margin-right: 4px;
    min-width: 16px;
  }}

  sub, sup {{
    font-size: 75%;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }}
  sup {{ top: -0.5em; }}
  sub {{ bottom: -0.25em; }}
</style>
</head>
<body>

  <div class="header-box">
    <div class="main-title">{title}</div>{sub_html}
    <div class="info-bar">
      <span>Họ và tên: .................................................................................</span>
      <span>Lớp: ................</span>
      <span>Thời gian: {len(questions) * 1.5:.0f} phút</span>
    </div>
  </div>

  <div class="section-banner">PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN ({len(questions)} CÂU)</div>

{body_content}

</body>
</html>
"""


def generate_answer_key_html(title: str, subtitle: str, questions: list[dict], questions_per_page: int = 10) -> str:
    """Generate printable HTML standalone answer key with quick matrix and explanations."""
    chunk_size = 10
    chunks = [questions[i:i + chunk_size] for i in range(0, len(questions), chunk_size)]
    table_rows = []
    for c in chunks:
        th_cells = "".join(f"<th>{q.get('number', i+1)}</th>" for i, q in enumerate(c))
        td_cells = "".join(f"<td>{q.get('answer', '-')}</td>" for q in c)
        table_rows.append(f"<tr><th>Câu</th>{th_cells}</tr>\n    <tr><th>Đ/A</th>{td_cells}</tr>")
    table_content = "\n  ".join(table_rows)

    sols_html = []
    for idx, q in enumerate(questions, start=1):
        num = q.get("number", idx)
        ans = q.get("answer", "-")
        expl = q.get("explanation", "")
        break_class = " page-break-before" if (idx > 1 and (idx - 1) % questions_per_page == 0) else ""

        sol = f"""
  <div class="sol-item{break_class}">
    <div class="sol-head"><span class="sol-num">Câu {num}:</span> Chọn <span class="sol-ans">{ans}</span></div>
    <div class="sol-body"><b>Giải thích:</b> {expl}</div>
  </div>"""
        sols_html.append(sol)

    sols_rendered = "\n".join(sols_html)
    sub_html = f'\n    <div class="sub-title">{subtitle}</div>' if subtitle and subtitle.strip() else ""

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>ĐÁP ÁN & LỜI GIẢI CHI TIẾT - {title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap');

  @page {{
    size: A4 portrait;
    margin: 10mm 14mm 10mm 14mm;
    @bottom-right {{
      content: "Trang " counter(page) " / " counter(pages);
      font-size: 8.5pt;
      color: #64748b;
      font-family: 'Roboto', sans-serif;
    }}
    @bottom-left {{
      content: "Đáp án & Lời giải chi tiết — {title}";
      font-size: 8.5pt;
      color: #64748b;
      font-family: 'Roboto', sans-serif;
    }}
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  body {{
    font-family: 'Roboto', 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #1e293b;
    background: #ffffff;
  }}

  .header-box {{
    text-align: center;
    border-bottom: 2px solid #16a34a;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }}

  .main-title {{
    font-size: 14.5pt;
    font-weight: 800;
    color: #15803d;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 3px;
  }}

  .sub-title {{
    font-size: 9.5pt;
    font-weight: 500;
    color: #475569;
    font-style: italic;
    margin-bottom: 4px;
  }}

  .section-banner {{
    background: linear-gradient(135deg, #15803d, #16a34a);
    color: #ffffff;
    padding: 4px 10px;
    border-radius: 4px;
    font-weight: 700;
    font-size: 9.5pt;
    text-transform: uppercase;
    margin-top: 8px;
    margin-bottom: 8px;
    page-break-after: avoid;
    break-after: avoid;
  }}

  .matrix-table {{
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    text-align: center;
    font-size: 8.8pt;
  }}

  .matrix-table th, .matrix-table td {{
    border: 1px solid #cbd5e1;
    padding: 3px 2px;
  }}

  .matrix-table th {{
    background: #f1f5f9;
    color: #334155;
    font-weight: 600;
  }}

  .matrix-table td {{
    font-weight: 700;
    color: #15803d;
    font-size: 9.5pt;
    background: #f8fafc;
  }}

  .sol-item {{
    margin-bottom: 5.5px;
    padding: 4px 8px;
    background: #f8fafc;
    border-left: 3px solid #16a34a;
    border-radius: 0 4px 4px 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }}

  .page-break-before {{
    page-break-before: always;
    break-before: page;
  }}

  .sol-head {{
    font-weight: 700;
    margin-bottom: 2px;
  }}

  .sol-num {{
    color: #1e3a8a;
  }}

  .sol-ans {{
    color: #15803d;
    font-weight: 800;
    margin-left: 4px;
  }}

  .sol-body {{
    color: #334155;
    font-size: 9.1pt;
  }}

  sub, sup {{
    font-size: 75%;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }}
  sup {{ top: -0.5em; }}
  sub {{ bottom: -0.25em; }}
</style>
</head>
<body>

  <div class="header-box">
    <div class="main-title">ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT</div>{sub_html}
  </div>

  <div class="section-banner">I. BẢNG ĐÁP ÁN NHANH</div>
  <table class="matrix-table">
    {table_content}
  </table>

  <div class="section-banner">II. HƯỚNG DẪN GIẢI CHI TIẾT TỪNG CÂU</div>

{sols_rendered}

</body>
</html>
"""


def compile_pdf(chrome_path: str, html_path: str, pdf_path: str) -> None:
    """Compile HTML to PDF using Google Chrome Headless with active file polling and graceful process termination."""
    abs_html = os.path.abspath(html_path)
    abs_pdf = os.path.abspath(pdf_path)

    os.makedirs(os.path.dirname(abs_pdf), exist_ok=True)
    if os.path.exists(abs_pdf):
        try:
            os.remove(abs_pdf)
        except Exception:
            pass

    temp_profile = os.path.join(tempfile.gettempdir(), f"chrome_pdf_{os.getpid()}_{int(time.time()*1000)%100000}")
    os.makedirs(temp_profile, exist_ok=True)

    file_url = f"file:///{abs_html.replace(os.sep, '/')}" if sys.platform == "win32" else f"file://{abs_html}"

    def run_chrome_worker(headless_flag: str) -> bool:
        cmd = [
            chrome_path,
            headless_flag,
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-crash-reporter",
            "--disable-breakpad",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-extensions",
            "--disable-default-apps",
            "--disable-sync",
            "--mute-audio",
            f"--user-data-dir={temp_profile}",
            "--no-pdf-header-footer",
            f"--print-to-pdf={abs_pdf}",
            file_url
        ]

        popen_kwargs = {
            "stdout": subprocess.DEVNULL,
            "stderr": subprocess.DEVNULL
        }
        if sys.platform != "win32":
            popen_kwargs["start_new_session"] = True

        proc = subprocess.Popen(cmd, **popen_kwargs)

        # Actively poll for the PDF file being generated and flushed
        start_time = time.time()
        while time.time() - start_time < 30:
            if os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 1000:
                time.sleep(0.3)
                if proc.poll() is None:
                    try:
                        proc.terminate()
                        proc.wait(timeout=2)
                    except Exception:
                        try:
                            proc.kill()
                        except Exception:
                            pass
                return True

            if proc.poll() is not None:
                time.sleep(0.5)
                if os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 1000:
                    return True
                break

            time.sleep(0.3)

        if proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=2)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

        return os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 1000

    success = run_chrome_worker("--headless=new")
    if not success:
        # Fallback to legacy headless if --headless=new didn't create the file
        success = run_chrome_worker("--headless")

    try:
        if os.path.exists(temp_profile):
            shutil.rmtree(temp_profile, ignore_errors=True)
    except Exception:
        pass

    if not success or not os.path.exists(abs_pdf) or os.path.getsize(abs_pdf) == 0:
        raise RuntimeError(f"Google Chrome không thể xuất tệp PDF từ {os.path.basename(html_path)}")


def verify_pdf_pages(pdf_path: str) -> int:
    """Inspect PDF page count and verify file integrity."""
    doc = pymupdf.open(pdf_path)
    return len(doc)


def sanitize_filename_prefix(prefix: str) -> str:
    """Sanitize and validate mandatory user-provided filename prefix."""
    if not prefix or not prefix.strip():
        raise ValueError("Bắt buộc phải nhập tên file xuất ra (filename prefix)!")
    clean = re.sub(r'[\\/*?:"<>|]', "", prefix.strip()).replace(" ", "_")
    if not clean:
        raise ValueError("Tên file xuất ra không hợp lệ!")
    return clean


def run_pipeline(
    input_source: str,
    pages: str,
    count: int = 20,
    start_q: int = 1,
    title: str = "BÀI TẬP TRẮC NGHIỆM HÓA HỌC 12",
    subtitle: str = "",
    api_key: str = None,
    base_url: str = DEFAULT_API_BASE,
    model: str = DEFAULT_MODEL,
    output_dir: str = "./quiz_output",
    filename_prefix: str = ""
) -> dict:
    """Execute the complete end-to-end quiz generation pipeline with real-time SSE progress."""
    clean_prefix = sanitize_filename_prefix(filename_prefix)
    os.makedirs(output_dir, exist_ok=True)
    temp_dir = tempfile.gettempdir()

    # 1. API Key check
    key = api_key or DEFAULT_API_KEY
    if not key:
        raise ValueError("Thiếu API Key của Agnes AI! Vui lòng cung cấp trong tham số hoặc biến môi trường.")

    emit_progress(10, "Đang nạp tài liệu & kiểm tra định dạng PDF...")

    # 2. Ingest PDF
    pdf_local = download_gdrive_if_needed(input_source, temp_dir)
    
    emit_progress(25, "Đang trích xuất nội dung văn bản từ các trang chỉ định...")
    raw_text, actual_pages = extract_raw_pages(pdf_local, pages)

    # 3. AI Extraction & Answer Ingestion
    emit_progress(45, f"Agnes 3.0 Flash đang chuẩn hóa câu hỏi & giải chi tiết ({count} câu)...")
    questions = parse_and_standardize_questions(
        raw_text, key, count=count, start_num=start_q, base_url=base_url, model=model
    )

    # 4. Generate HTML templates in temp directory
    emit_progress(70, "Đang xây dựng bố cục A4 Portrait & bảng ma trận đáp án...")
    q_per_page = 10 if count >= 15 else (count // 2 if count > 6 else count)
    worksheet_html = generate_worksheet_html(title, subtitle, questions, questions_per_page=q_per_page)
    answer_html = generate_answer_key_html(title, subtitle, questions, questions_per_page=q_per_page)

    ws_html_path = os.path.join(temp_dir, f"{clean_prefix}_DeBai.html")
    ans_html_path = os.path.join(temp_dir, f"{clean_prefix}_DapAn.html")
    with open(ws_html_path, "w", encoding="utf-8") as f:
        f.write(worksheet_html)
    with open(ans_html_path, "w", encoding="utf-8") as f:
        f.write(answer_html)

    # 5. Compile to PDF via Chrome
    emit_progress(85, "Google Chrome Headless đang in ấn tệp PDF Đề bài và Đáp án...")
    chrome = find_chrome_path()
    ws_pdf_path = os.path.join(output_dir, f"{clean_prefix}_DeBai.pdf")
    ans_pdf_path = os.path.join(output_dir, f"{clean_prefix}_DapAn.pdf")
    compile_pdf(chrome, ws_html_path, ws_pdf_path)
    compile_pdf(chrome, ans_html_path, ans_pdf_path)

    # 6. Verify page integrity
    emit_progress(95, "Đang kiểm tra tính toàn vẹn của tệp PDF kết xuất...")
    ws_pages = verify_pdf_pages(ws_pdf_path)
    ans_pages = verify_pdf_pages(ans_pdf_path)

    # 7. Cleanup intermediate files
    for temp_f in [ws_html_path, ans_html_path]:
        try:
            if os.path.exists(temp_f):
                os.remove(temp_f)
        except Exception:
            pass

    emit_progress(100, "Hoàn tất tạo Đề bài và Đáp án chi tiết!")

    result = {
        "success": True,
        "worksheet_pdf": ws_pdf_path,
        "answer_pdf": ans_pdf_path,
        "worksheet_pages": ws_pages,
        "answer_pages": ans_pages,
        "questions_count": len(questions)
    }

    # Output final JSON line for caller process
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description="Agnes 3.0 Flash Quiz PDF Generator Pipeline")
    parser.add_argument("input", help="Path to PDF or Google Drive URL")
    parser.add_argument("--pages", required=True, help="Pages to process, e.g. '11', '11,12', '11-12'")
    parser.add_argument("--count", type=int, default=20, help="Number of questions to extract (default: 20)")
    parser.add_argument("--start", type=int, default=1, help="Starting question number (default: 1)")
    parser.add_argument("--title", default="BÀI TẬP TRẮC NGHIỆM HÓA HỌC 12", help="Document main title")
    parser.add_argument("--subtitle", default="", help="Optional subtitle or author attribution")
    parser.add_argument("--api-key", default=None, help="Agnes AI API Key")
    parser.add_argument("--base-url", default=DEFAULT_API_BASE, help="Agnes AI Base URL")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Model ID")
    parser.add_argument("--output-dir", default="./quiz_output", help="Output directory")
    parser.add_argument("--prefix", required=True, help="Tên file xuất ra (bắt buộc, ví dụ: 'De_Kiem_Tra_1')")
    args = parser.parse_args()

    run_pipeline(
        input_source=args.input,
        pages=args.pages,
        count=args.count,
        start_q=args.start,
        title=args.title,
        subtitle=args.subtitle,
        api_key=args.api_key,
        base_url=args.base_url,
        model=args.model,
        output_dir=args.output_dir,
        filename_prefix=args.prefix
    )


if __name__ == "__main__":
    main()
