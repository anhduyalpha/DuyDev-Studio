"""
Quiz PDF Generator Pipeline v2.0
Deterministic AI-powered pipeline to ingest PDF/docs, extract & standardize multi-format quiz questions
via Agnes 3.0 Flash API, and compile high-fidelity A4 Portrait worksheets and standalone answer keys
with full support for visual assets (diagrams/graphs/images), 2-column flow, structured tables, and KaTeX math.
"""

import sys
import os
import re
import json
import time
import tempfile
import argparse
import subprocess
import signal
import urllib.request
import urllib.error
import http.client
import threading
import shutil
import uuid
import base64
import concurrent.futures
import hashlib
import pymupdf

from text_utils import is_section_banner, strip_section_banner, clean_image_markers
from mcq_parser import parse_mcq_blocks, count_available_questions
import quiz_cache

# IMPORTANT: Any changes to Phase 1 or Phase 2 prompts MUST bump PROMPT_VERSION.
# Bumping this constant invalidates all Layer 2 AI batch cache entries.
PROMPT_VERSION = "v3"

# Reconfigure stdout/stderr for UTF-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


DEFAULT_API_BASE = os.environ.get("AGNES_AI_BASE_URL", "https://apihub.agnes-ai.com/v1")
DEFAULT_MODEL = os.environ.get("AGNES_AI_MODEL", "agnes-3.0-flash")
DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "")

_EMIT_LOCK = threading.Lock()

ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
KATEX_SRC_DIR = os.path.join(ENGINE_DIR, "assets", "katex")


def emit_progress(pct: int, stage: str) -> None:
    """Emit JSON formatted progress to stdout for worker streaming (thread-safe)."""
    try:
        payload = json.dumps({"progress": pct, "stage": stage}, ensure_ascii=False)
        with _EMIT_LOCK:
            print(payload, flush=True)
    except Exception:
        pass


def find_chrome_path() -> str:
    """Auto-detect Google Chrome / Chromium executable path across Windows and Linux."""
    candidates = [
        # Linux direct binary (avoids bash wrapper script and cat subshells)
        "/opt/google/chrome/chrome",
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
            from shutil import which
            found = which(c)
            if found:
                return found

    return "/opt/google/chrome/chrome" if (sys.platform != "win32" and os.path.exists("/opt/google/chrome/chrome")) else ("google-chrome" if sys.platform != "win32" else candidates[6])


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


# ==============================================================================
# MODULE 1.1: 2-COLUMN LAYOUT READING ORDER
# ==============================================================================

def is_running_header_or_footer(block_text: str, y0: float, y1: float, page_h: float) -> bool:
    """Detect running headers/footers (page numbers, exam codes, repeated school headers) to purge."""
    text = block_text.strip()
    if not text:
        return False

    header_footer_regex = re.compile(
        r"(?:trang\s*\d+(?:\s*[\/\-]\s*\d+)?|mã\s*đề(?:\s*thi)?\s*[:\d]+|sở\s*gd|phòng\s*gd|bộ\s*giáo\s*dục|"
        r"kỳ\s*thi|đề\s*thi\s*thử|đề\s*chính\s*thức|họ\s*(?:và\s*)?tên|số\s*báo\s*danh|---\s*hết\s*---|\bhết\b)",
        re.IGNORECASE
    )

    # Check top 8% of page
    if y1 < page_h * 0.08:
        if header_footer_regex.search(text) or (len(text) < 60 and ("trang" in text.lower() or "mã đề" in text.lower())):
            return True
    # Check bottom 8% of page
    if y0 > page_h * 0.92:
        if header_footer_regex.search(text) or (len(text) < 60 and ("trang" in text.lower() or "hết" in text.lower())):
            return True
    return False


def detect_column_gutter(page: pymupdf.Page, blocks: list) -> float:
    """
    Detect the vertical 2-column gutter boundary (x_split) from block coordinate distribution.
    Returns x_split coordinate (defaults to page width / 2.0 if layout is single-column or ambiguous).
    """
    pw = page.rect.width
    mid_x = pw / 2.0
    if not blocks:
        return mid_x

    col1_rights = []
    col2_lefts = []
    for b in blocks:
        x0, x1 = b[0], b[2]
        b_w = x1 - x0
        b_mid = (x0 + x1) / 2.0
        # Ignore full-width spanning blocks
        if b_w > pw * 0.65:
            continue
        if b_mid < mid_x and x1 <= mid_x + pw * 0.1:
            col1_rights.append(x1)
        elif b_mid >= mid_x and x0 >= mid_x - pw * 0.1:
            col2_lefts.append(x0)

    if col1_rights and col2_lefts:
        r_max = max(col1_rights)
        l_min = min(col2_lefts)
        if r_max <= l_min and (0.35 * pw <= (r_max + l_min) / 2.0 <= 0.65 * pw):
            return (r_max + l_min) / 2.0

    return mid_x


def sort_blocks_by_layout(page: pymupdf.Page, blocks: list = None) -> list:
    """
    Sort page blocks into natural human reading order.
    Detects 2-column gutter and orders text with band-based segmentation:
    Spanning headers -> [Col 1 (top-to-bottom) then Col 2 (top-to-bottom)] -> Spanning mid-banners -> Footer.
    Eliminates both horizontal interleaving and mid-page banner scrambles.
    """
    pw = page.rect.width
    ph = page.rect.height

    if blocks is None:
        raw_blocks = page.get_text("blocks")
        blocks = [b for b in raw_blocks if (len(b) > 6 and b[6] == 0) or (len(b) > 4 and str(b[4]).strip())]

    if not blocks:
        return []

    # Clean out running headers and footers
    filtered_blocks = []
    for b in blocks:
        x0, y0, x1, y1, text = b[0], b[1], b[2], b[3], str(b[4])
        # Skip special image/table marker blocks from header/footer filter
        if text.startswith("\n[IMAGE_REF:") or text.startswith("\n|"):
            filtered_blocks.append(b)
            continue
        if not is_running_header_or_footer(text, y0, y1, ph):
            filtered_blocks.append(b)

    if not filtered_blocks:
        return blocks

    x_split = detect_column_gutter(page, filtered_blocks)
    gutter_margin = pw * 0.03

    col1_candidates = []
    col2_candidates = []
    spanning_candidates = []

    for b in filtered_blocks:
        x0, y0, x1, y1 = b[0], b[1], b[2], b[3]
        b_mid = (x0 + x1) / 2.0
        b_width = x1 - x0

        # Spanning banner if wide enough across the middle
        if b_width > pw * 0.62 or (x0 < (x_split - gutter_margin) and x1 > (x_split + gutter_margin)):
            spanning_candidates.append(b)
        elif b_mid < x_split:
            col1_candidates.append(b)
        else:
            col2_candidates.append(b)

    is_two_column = (
        len(col1_candidates) >= 1
        and len(col2_candidates) >= 1
        and len(spanning_candidates) <= max(3, int(0.5 * (len(col1_candidates) + len(col2_candidates))))
    )

    if not is_two_column:
        # Standard 1-column layout: sort purely by y0 ascending, then x0
        return sorted(filtered_blocks, key=lambda b: (round(b[1], 1), round(b[0], 1)))

    # Sort spanning banners vertically
    spanning_candidates.sort(key=lambda b: (round(b[1], 1), round(b[0], 1)))

    # Build vertical bands separated by spanning banners
    ordered_result = []

    # If no spanning banners, standard 2-column sort: Col 1 top-to-bottom, then Col 2 top-to-bottom
    if not spanning_candidates:
        col1_candidates.sort(key=lambda b: (round(b[1], 1), round(b[0], 1)))
        col2_candidates.sort(key=lambda b: (round(b[1], 1), round(b[0], 1)))
        return col1_candidates + col2_candidates

    # Partition column blocks into bands defined by spanning elements
    prev_y = -1.0
    for span_b in spanning_candidates:
        span_y0 = span_b[1]
        span_y1 = span_b[3]

        # Blocks strictly above this spanning block (and below previous spanning block)
        band_col1 = [b for b in col1_candidates if prev_y <= b[1] < span_y0 + 5]
        band_col2 = [b for b in col2_candidates if prev_y <= b[1] < span_y0 + 5]

        band_col1.sort(key=lambda b: (round(b[1], 1), round(b[0], 1)))
        band_col2.sort(key=lambda b: (round(b[1], 1), round(b[0], 1)))

        ordered_result.extend(band_col1)
        ordered_result.extend(band_col2)
        ordered_result.append(span_b)

        prev_y = max(prev_y, span_y1 - 5)

    # Remaining blocks below the last spanning banner
    remaining_col1 = [b for b in col1_candidates if b[1] >= prev_y]
    remaining_col2 = [b for b in col2_candidates if b[1] >= prev_y]
    remaining_col1.sort(key=lambda b: (round(b[1], 1), round(b[0], 1)))
    remaining_col2.sort(key=lambda b: (round(b[1], 1), round(b[0], 1)))
    ordered_result.extend(remaining_col1)
    ordered_result.extend(remaining_col2)

    return ordered_result


# ==============================================================================
# MODULE 1.2: VISUAL ASSET EXTRACTOR & BOUNDING-BOX LINKER
# ==============================================================================

def cluster_rects(rect_list: list[pymupdf.Rect], margin: float = 12.0) -> list[pymupdf.Rect]:
    """Group overlapping or nearby rectangles into connected cluster bounding boxes using O(n log n) sweep-line union-find."""
    if not rect_list:
        return []

    # Stage 1: Dense Vector Guard (24pt Grid Pre-Bucketing for n > 1500)
    if len(rect_list) > 1500:
        grid: dict[tuple[int, int], pymupdf.Rect] = {}
        for r in rect_list:
            key = (int(r.x0 // 24.0), int(r.y0 // 24.0))
            if key not in grid:
                grid[key] = pymupdf.Rect(r)
            else:
                grid[key] = grid[key] | r
        target_rects = list(grid.values())
    else:
        target_rects = [pymupdf.Rect(r) for r in rect_list]

    n = len(target_rects)
    if n <= 1:
        return target_rects

    # Stage 2: Disjoint-Set Union (Union-Find)
    parent = list(range(n))
    rank = [0] * n

    def find(i: int) -> int:
        root = i
        while root != parent[root]:
            root = parent[root]
        curr = i
        while curr != root:
            nxt = parent[curr]
            parent[curr] = root
            curr = nxt
        return root

    def union(i: int, j: int) -> None:
        root_i = find(i)
        root_j = find(j)
        if root_i == root_j:
            return
        if rank[root_i] < rank[root_j]:
            parent[root_i] = root_j
        elif rank[root_i] > rank[root_j]:
            parent[root_j] = root_i
        else:
            parent[root_j] = root_i
            rank[root_i] += 1

    # Stage 3: Sweep-Line Traversal along X-axis
    indexed = sorted(range(n), key=lambda i: target_rects[i].x0)
    active: list[int] = []

    for i in indexed:
        new_r = target_rects[i]
        new_active: list[int] = []
        for j in active:
            r_j = target_rects[j]
            if r_j.x1 + margin < new_r.x0:
                continue
            new_active.append(j)
            if r_j.y1 + margin < new_r.y0 or new_r.y1 + margin < r_j.y0:
                continue
            exp_j = pymupdf.Rect(r_j.x0 - margin, r_j.y0 - margin, r_j.x1 + margin, r_j.y1 + margin)
            if exp_j.intersects(new_r):
                union(i, j)
        new_active.append(i)
        active = new_active

    # Stage 4: Aggregate bounding boxes per connected component
    groups: dict[int, pymupdf.Rect] = {}
    for i in indexed:
        root = find(i)
        if root not in groups:
            groups[root] = pymupdf.Rect(target_rects[i])
        else:
            groups[root] = groups[root] | target_rects[i]

    return list(groups.values())


def extract_visual_assets(
    page: pymupdf.Page,
    page_num: int,
    temp_assets_dir: str,
    table_rects: list = None
) -> list[dict]:
    """
    Extract raster images and vector diagrams from the page.
    Filters out borders, hairline rules, tables, section banners, and tiny decorative icons (< 40x40 px).
    Groups connected vector drawings into diagram bounding boxes.
    Renders crisp pixmaps (dpi=200) and saves as PNG and base64 data URI.
    """
    pw = page.rect.width
    ph = page.rect.height
    assets = []
    candidate_rects = []

    # 1. Raster images
    try:
        image_list = page.get_images(full=True)
        for img in image_list:
            xref = img[0]
            for r in page.get_image_rects(xref):
                rect = pymupdf.Rect(r)
                if rect.width > pw * 0.95 and rect.height > ph * 0.95:
                    continue
                # Relaxed size filter: allow wide but short reaction formulas or diagrams
                if ((rect.width < 12 and rect.height < 12) or (rect.width * rect.height < 180)):
                    continue
                candidate_rects.append(rect)
    except Exception:
        pass

    # 2. Vector drawings (diagrams, graphs, circuits, chemical bonds)
    try:
        drawings = page.get_drawings()
        valid_drawing_rects = []
        for d in drawings:
            dr = pymupdf.Rect(d.get("rect", (0, 0, 0, 0)))
            if dr.width > pw * 0.95 and dr.height > ph * 0.95:
                continue
            if dr.height <= 2.0 and dr.width > 80:
                continue
            if dr.width <= 2.0 and dr.height > 80:
                continue
            if dr.width < 2 and dr.height < 2:
                continue
            valid_drawing_rects.append(dr)

        drawing_clusters = cluster_rects(valid_drawing_rects, margin=10.0)
        for cr in drawing_clusters:
            if cr.width >= 18 and cr.height >= 12 and (cr.width * cr.height >= 250):
                if cr.width <= pw * 0.95 and cr.height <= ph * 0.95:
                    candidate_rects.append(cr)
    except Exception:
        pass

    merged_rects = cluster_rects(candidate_rects, margin=2.5)
    merged_rects.sort(key=lambda r: (round(r.y0, 1), round(r.x0, 1)))

    for idx, rect in enumerate(merged_rects, start=1):
        asset_id = f"fig_p{page_num}_{idx}"
        # Filter 1: Skip if rect is inside or heavily overlaps a structured table
        if table_rects:
            is_table_rect = False
            for tr in table_rects:
                t_rect = pymupdf.Rect(tr)
                if t_rect.contains(rect) or (t_rect.intersects(rect) and (t_rect & rect).get_area() > 0.45 * rect.get_area()):
                    is_table_rect = True
                    break
            if is_table_rect:
                continue

        padded_rect = pymupdf.Rect(
            max(0, rect.x0 - 3),
            max(0, rect.y0 - 3),
            min(pw, rect.x1 + 3),
            min(ph, rect.y1 + 3)
        )

        # Filter 2: Skip if rect text contains a section divider banner or running header/footer
        clip_text = page.get_text("text", clip=padded_rect).strip()
        if is_section_banner(clip_text) or is_running_header_or_footer(clip_text, rect.y0, rect.y1, ph):
            continue

        # Filter 3: Skip wide horizontal strip (banner / divider shape) with banner keywords
        if rect.width > pw * 0.5 and rect.height < 45:
            if is_section_banner(clip_text) or any(k in clip_text.lower() for k in ["phần", "câu trắc nghiệm", "đáp án", "đề thi", "chuyên đề"]):
                continue

        try:
            pix = page.get_pixmap(clip=padded_rect, dpi=200)
            if pix.width < 15 and pix.height < 15:
                continue
            png_bytes = pix.tobytes("png")
            b64_data = f"data:image/png;base64,{base64.b64encode(png_bytes).decode('ascii')}"

            png_file = os.path.join(temp_assets_dir, f"{asset_id}.png")
            with open(png_file, "wb") as pf:
                pf.write(png_bytes)

            assets.append({
                "id": asset_id,
                "name": f"{asset_id}.png",
                "page": page_num,
                "rect": (rect.x0, rect.y0, rect.x1, rect.y1),
                "data_uri": b64_data,
                "file_path": png_file,
                "text_inside": clip_text
            })
        except Exception:
            continue

    return assets


def link_assets_to_questions(
    questions: list[dict],
    assets: list[dict],
    asset_question_map: dict = None,
    source_question_nums: list[int] = None
) -> None:
    """
    Link extracted visual assets to question objects with 100% deterministic fidelity.
    Combines:
    1. Direct AI match (q['image_ref'])
    2. Sequential Index Mapping (k-th output question <-> k-th source question)
    3. Layout Spatial Map (mapped_q_num == q['number'])
    4. Text marker match ([IMAGE_REF: ...])
    5. Keyword proximity fallback
    Finally purges internal [IMAGE_REF: ...] markers from all fields.
    """
    assets_by_id = {}
    for a in assets:
        if a.get("is_banner") or is_section_banner(a.get("text_inside", "")):
            continue
        a_id = str(a.get("id") or a.get("name", "")).replace(".png", "").strip()
        if a_id:
            assets_by_id[a_id] = a
            assets_by_id[f"{a_id}.png"] = a
    asset_map = asset_question_map or {}
    source_nums = source_question_nums or []

    # 1. Direct AI match
    for q in questions:
        ref = q.get("image_ref")
        if ref:
            clean_ref = str(ref).replace(".png", "").strip()
            if clean_ref in assets_by_id:
                q["image_ref"] = f"{clean_ref}.png"
                q["image_data"] = assets_by_id[clean_ref].get("data_uri")
            elif ref in assets_by_id:
                q["image_ref"] = f"{ref}.png"
                q["image_data"] = assets_by_id[ref].get("data_uri")
            else:
                q["image_ref"] = None

    assigned_assets = {str(q.get("image_ref", "")).replace(".png", "") for q in questions if q.get("image_data")}

    # 2. Sequential Index Mapping: question at index k was source_nums[k] in the source PDF!
    for idx, q in enumerate(questions):
        if not q.get("image_data") and idx < len(source_nums):
            orig_q_num = source_nums[idx]
            for a_id, mapped_num in asset_map.items():
                if mapped_num == orig_q_num and a_id in assets_by_id and a_id not in assigned_assets:
                    q["image_ref"] = f"{a_id}.png"
                    q["image_data"] = assets_by_id[a_id].get("data_uri")
                    assigned_assets.add(a_id)
                    break

    # 3. Layout Spatial Map: match asset mapped to question number when numbers align
    for q in questions:
        if not q.get("image_data"):
            q_num = q.get("number")
            for a_id, mapped_q_num in asset_map.items():
                if mapped_q_num == q_num and a_id in assets_by_id and a_id not in assigned_assets:
                    q["image_ref"] = f"{a_id}.png"
                    q["image_data"] = assets_by_id[a_id].get("data_uri")
                    assigned_assets.add(a_id)
                    break

    # 4. Text marker match: if [IMAGE_REF: ...] was embedded in question text, options, or statements
    for q in questions:
        if not q.get("image_data"):
            full_q_text = str(q.get("question", "")) + " " + json.dumps(q.get("options", {})) + " " + json.dumps(q.get("statements", {}))
            marker_match = re.search(r"\[IMAGE_REF:\s*(fig_p\d+_\d+)(?:\.png)?\]", full_q_text)
            if marker_match:
                asset_id = marker_match.group(1)
                if asset_id in assets_by_id and asset_id not in assigned_assets:
                    q["image_ref"] = f"{asset_id}.png"
                    q["image_data"] = assets_by_id[asset_id].get("data_uri")
                    assigned_assets.add(asset_id)

    # 5. Keyword proximity fallback: assign remaining unassigned assets to questions mentioning figures
    unassigned_assets = [
        a for a in assets
        if str(a.get("id") or a.get("name", "")).replace(".png", "").strip() not in assigned_assets
    ]
    if unassigned_assets:
        for q in questions:
            if not q.get("image_data"):
                q_text = str(q.get("question", "")).lower()
                if any(w in q_text for w in ["hình vẽ", "hình bên", "hình dưới", "đồ thị", "thí nghiệm", "sơ đồ", "bảng sau", "hình sau", "phổ", "cấu tạo"]):
                    if unassigned_assets:
                        chosen = unassigned_assets.pop(0)
                        chosen_id = str(chosen.get("id") or chosen.get("name", "")).replace(".png", "").strip()
                        q["image_ref"] = f"{chosen_id}.png"
                        q["image_data"] = chosen.get("data_uri")
                        assigned_assets.add(chosen_id)

    # Final cleanup: clean markers from all question fields and sanitize image_ref
    for q in questions:
        q["question"] = clean_image_markers(q.get("question", ""))
        if isinstance(q.get("options"), dict):
            for opt_k in q["options"]:
                q["options"][opt_k] = clean_image_markers(q["options"][opt_k])
        if isinstance(q.get("statements"), dict):
            for st_k in q["statements"]:
                if isinstance(q["statements"][st_k], dict):
                    q["statements"][st_k]["text"] = clean_image_markers(q["statements"][st_k].get("text", ""))
        q["explanation"] = clean_image_markers(q.get("explanation", ""))
        if not q.get("image_data"):
            q["image_ref"] = None


# ==============================================================================
# MODULE 1.3: STRUCTURED TABLE EXTRACTOR
# ==============================================================================

def table_to_markdown(rows: list[list[str]]) -> str:
    """Convert a 2D matrix of cell strings to a standard Markdown table."""
    if not rows or len(rows) < 2:
        return ""
    cleaned = [[(c or "").strip().replace("\n", " ") for c in row] for row in rows]
    if not any(any(c for c in row) for row in cleaned):
        return ""
    cols = max(len(r) for r in cleaned)
    if cols < 2:
        return ""
    norm = [r + [""] * (cols - len(r)) for r in cleaned]
    header = "| " + " | ".join(norm[0]) + " |"
    sep = "| " + " | ".join([":---"] * cols) + " |"
    data = ["| " + " | ".join(r) + " |" for r in norm[1:]]
    return "\n" + "\n".join([header, sep] + data) + "\n"


def extract_tables_with_structure(page: pymupdf.Page) -> list[dict]:
    """
    Detect data tables using PyMuPDF's page.find_tables().
    Converts tables into structured Markdown tables with bounding boxes.
    """
    results = []
    try:
        tabs = page.find_tables()
        for tab in getattr(tabs, "tables", []):
            bbox = pymupdf.Rect(tab.bbox)
            data = tab.extract()
            md = table_to_markdown(data)
            if md:
                results.append({
                    "bbox": (bbox.x0, bbox.y0, bbox.x1, bbox.y1),
                    "markdown": md
                })
    except Exception:
        pass
    return results


def format_tables_in_text(text: str) -> str:
    """Convert markdown tables in question text to HTML tables for printing."""
    def _md_table_replacer(match):
        lines = [l.strip() for l in match.group(0).strip().split("\n") if l.strip()]
        if len(lines) < 2:
            return match.group(0)
        headers = [c.strip() for c in lines[0].strip("|").split("|")]
        data_rows = lines[2:]
        html = ['<table class="q-table">', '<thead><tr>' + ''.join(f'<th>{c}</th>' for c in headers) + '</tr></thead>', '<tbody>']
        for dr in data_rows:
            cells = [c.strip() for c in dr.strip("|").split("|")]
            html.append('<tr>' + ''.join(f'<td>{c}</td>' for c in cells) + '</tr>')
        html.append('</tbody></table>')
        return "\n".join(html)

    table_pattern = re.compile(r'(\|[^\r\n]+\|\r?\n\|[\s:\-|]+\|\r?\n(?:\|[^\r\n]+\|\r?\n?)+)')
    return table_pattern.sub(_md_table_replacer, text)


# ==============================================================================
# MODULE 1.4: CROSS-PAGE QUESTION STITCHER & CONTENT ASSEMBLER
# ==============================================================================

def is_question_dangling(text: str) -> bool:
    """Check if text ends with an incomplete question waiting for options or ending."""
    trimmed = text.strip()
    q_matches = list(re.finditer(r"(?:^|\n)(?:Câu\s*(\d+)|\b(\d+)\s*[\.\:])", trimmed))
    if not q_matches:
        return False
    last_q_start = q_matches[-1].start()
    last_q_text = trimmed[last_q_start:]

    # Check standard 4-option MCQ: A, B, C, D (supports '.' and ')')
    has_mcq_a = bool(re.search(r"(?:^|\s)[A][\.\)\:]", last_q_text))
    has_mcq_c = bool(re.search(r"(?:^|\s)[C][\.\)\:]", last_q_text))
    has_mcq_d = bool(re.search(r"(?:^|\s)[D][\.\)\:]", last_q_text))
    if has_mcq_a and (not has_mcq_c or not has_mcq_d):
        return True

    # Check GDPT 2018 True/False: statements a, b, c, d (supports '.' and ')')
    has_tf_a = bool(re.search(r"(?:^|\s)[aA][\.\)\:]", last_q_text))
    has_tf_c = bool(re.search(r"(?:^|\s)[cC][\.\)\:]", last_q_text))
    has_tf_d = bool(re.search(r"(?:^|\s)[dD][\.\)\:]", last_q_text))
    if has_tf_a and (not has_tf_c or not has_tf_d):
        return True

    last_line = last_q_text.strip().split("\n")[-1].strip()
    if last_line.endswith((":", ",", "là", "thì", "gồm", "được", "có", "sau:", "dưới đây:")):
        return True
    return False


def stitch_cross_page_text(pages_text: list[str]) -> str:
    """
    Remove running headers/footers and stitch dangling questions across page breaks.
    """
    if not pages_text:
        return ""
    if len(pages_text) == 1:
        return pages_text[0]

    stitched = pages_text[0]
    for p_idx in range(1, len(pages_text)):
        curr_p = pages_text[p_idx].strip()
        if not curr_p:
            continue

        if is_question_dangling(stitched):
            starts_with_new_q = bool(re.match(r"^(?:Câu\s*\d+|\d+\s*[\.\:])", curr_p))
            if not starts_with_new_q:
                stitched = stitched + "\n" + curr_p
                continue

        stitched = stitched + f"\n\n--- PAGE BREAK ---\n\n" + curr_p

    return stitched


def extract_structured_page_content(
    page: pymupdf.Page,
    page_num: int,
    temp_assets_dir: str
) -> tuple[str, list[dict], dict]:
    """
    Assemble text blocks, structured Markdown tables, and visual assets on a page
    in natural layout order (Module 1.1 + 1.2 + 1.3).
    Returns (page_text, assets, asset_question_map).
    """
    tables = extract_tables_with_structure(page)
    table_rects = [pymupdf.Rect(t["bbox"]) for t in tables]
    assets = extract_visual_assets(page, page_num, temp_assets_dir, table_rects=table_rects)

    raw_blocks = page.get_text("blocks")
    content_blocks = []

    for b in raw_blocks:
        # Only process text blocks (block_type == 0)
        if len(b) > 6 and b[6] != 0:
            continue
        x0, y0, x1, y1, text = b[0], b[1], b[2], b[3], str(b[4])
        b_rect = pymupdf.Rect(x0, y0, x1, y1)
        inside_table = False
        for tr in table_rects:
            if tr.contains(b_rect) or (tr.intersects(b_rect) and (tr & b_rect).get_area() > 0.6 * b_rect.get_area()):
                inside_table = True
                break
        if not inside_table and text.strip():
            content_blocks.append(b)

    for t in tables:
        bx0, by0, bx1, by1 = t["bbox"]
        content_blocks.append((bx0, by0, bx1, by1, t["markdown"], -1, 0))

    for a in assets:
        ax0, ay0, ax1, ay1 = a["rect"]
        marker = f"\n[IMAGE_REF: {a['id']}]\n"
        content_blocks.append((ax0, ay0, ax1, ay1, marker, -2, 0))

    sorted_blocks = sort_blocks_by_layout(page, content_blocks)
    page_text = "\n".join(str(b[4]).strip() for b in sorted_blocks if str(b[4]).strip())

    # Build spatial mapping: link each image marker to the adjacent question in layout order
    page_asset_map = {}
    curr_q_num = None
    for b in sorted_blocks:
        text = str(b[4]).strip()
        # Reset question context on section divider banner so subsequent assets aren't linked to preceding questions
        if is_section_banner(text):
            curr_q_num = None
            continue
        q_m = re.search(r"(?:^|\n)(?:Câu\s*(\d+)|\b(\d+)[\.\:])", text)
        if q_m:
            curr_q_num = int(q_m.group(1) or q_m.group(2))
        m_img = re.search(r"\[IMAGE_REF:\s*(fig_p\d+_\d+)\]", text)
        if m_img and curr_q_num is not None:
            page_asset_map[m_img.group(1)] = curr_q_num

    # For any assets not yet mapped (e.g. image placed immediately above question stem), look ahead
    for i, b in enumerate(sorted_blocks):
        text = str(b[4]).strip()
        m_img = re.search(r"\[IMAGE_REF:\s*(fig_p\d+_\d+)\]", text)
        if m_img and m_img.group(1) not in page_asset_map:
            for next_b in sorted_blocks[i + 1:i + 4]:
                next_text = str(next_b[4]).strip()
                # Stop looking ahead across section boundaries
                if is_section_banner(next_text):
                    break
                next_qm = re.search(r"(?:^|\n)(?:Câu\s*(\d+)|\b(\d+)[\.\:])", next_text)
                if next_qm:
                    page_asset_map[m_img.group(1)] = int(next_qm.group(1) or next_qm.group(2))
                    break

    return page_text, assets, page_asset_map


def extract_raw_pages(pdf_path: str, page_spec: str, temp_assets_dir: str) -> tuple[str, list[int], list[dict], dict]:
    """Extract structured text, tables, and visual assets from PDF for specified pages (1-indexed)."""
    try:
        doc = pymupdf.open(pdf_path)
    except Exception as e:
        raise RuntimeError(f"Không thể đọc tệp PDF. Tệp có thể bị hỏng hoặc có mật khẩu bảo vệ: {e}")

    total_pages = len(doc)
    page_nums = []

    for part in page_spec.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-", 1)
            page_nums.extend(range(int(start), int(end) + 1))
        elif part:
            page_nums.append(int(part))

    extracted_pages = []
    actual_pages = []
    all_assets = []
    all_asset_map = {}

    for p in page_nums:
        if 1 <= p <= total_pages:
            idx = p - 1
            page_text, page_assets, page_asset_map = extract_structured_page_content(doc[idx], p, temp_assets_dir)
            extracted_pages.append(page_text)
            actual_pages.append(p)
            all_assets.extend(page_assets)
            all_asset_map.update(page_asset_map)
        else:
            raise ValueError(f"Trang {p} vượt quá tổng số {total_pages} trang của tài liệu PDF.")

    stitched_text = stitch_cross_page_text(extracted_pages)
    clean_len = len(re.sub(r"\s+", "", stitched_text))
    if clean_len < 50:
        raise ValueError(
            f"Trang được chọn ({', '.join(map(str, actual_pages))}) không chứa văn bản dạng số/vector. "
            "Tài liệu có thể là ảnh scan thuần túy. Vui lòng chọn trang có lớp chữ hoặc OCR trước."
        )

    # Collect ordered list of distinct question numbers found in the stitched text
    q_matches = list(re.finditer(r"(?:^|\n)(?:Câu\s*(\d+)|\b(\d+)[\.\:])", stitched_text))
    source_q_nums = []
    for m in q_matches:
        n = int(m.group(1) or m.group(2))
        if not source_q_nums or source_q_nums[-1] != n:
            source_q_nums.append(n)

    return stitched_text, actual_pages, all_assets, all_asset_map, source_q_nums


# ==============================================================================
# MODULE 1.5 & 1.6: AI INGESTION & SLIDING-WINDOW CHUNKING
# ==============================================================================

def _salvage_truncated_json(raw: str) -> dict | None:
    """
    Cứu JSON bị cắt giữa mảng 'questions': cắt tới object hoàn chỉnh cuối cùng,
    đóng ngoặc ']}' rồi parse lại. Trả None nếu không cứu được.
    """
    if not raw or not isinstance(raw, str):
        return None

    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
        if isinstance(data, dict) and isinstance(data.get("questions"), list) and len(data["questions"]) > 0:
            return data
    except Exception:
        pass

    q_marker = cleaned.find('"questions"')
    if q_marker == -1:
        return None
    arr_start = cleaned.find('[', q_marker)
    if arr_start == -1:
        return None

    in_str = False
    escape = False
    brace_depth = 0
    bracket_depth = 1
    candidates = []

    i = arr_start + 1
    while i < len(cleaned):
        ch = cleaned[i]
        if escape:
            escape = False
        elif ch == '\\':
            if in_str:
                escape = True
        elif ch == '"':
            in_str = not in_str
        elif not in_str:
            if ch == '{':
                brace_depth += 1
            elif ch == '}':
                if brace_depth == 1 and bracket_depth == 1:
                    candidates.append(i)
                brace_depth -= 1
            elif ch == '[':
                bracket_depth += 1
            elif ch == ']':
                bracket_depth -= 1
                if bracket_depth == 0:
                    break
        i += 1

    for idx in reversed(candidates):
        candidate = cleaned[:idx + 1].rstrip().rstrip(",") + "\n]}"
        try:
            data = json.loads(candidate)
            if isinstance(data, dict) and isinstance(data.get("questions"), list) and len(data["questions"]) > 0:
                return data
        except Exception:
            continue
    return None


def call_agnes_api(
    api_key: str,
    prompt: str,
    system_prompt: str,
    base_url: str = DEFAULT_API_BASE,
    model: str = DEFAULT_MODEL,
    timeout: int = 90,
    max_retries: int = 2
) -> dict:
    """Send chat completion request to Agnes AI with JSON formatting, defensive retries, and timeout resilience."""
    current_temp = 0.1
    current_prompt = prompt
    last_err = None

    for attempt in range(max_retries + 1):
        payload_data = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": current_prompt}
            ],
            "temperature": current_temp,
            "response_format": {"type": "json_object"},
            "max_tokens": 8192
        }
        payload = json.dumps(payload_data).encode("utf-8")

        req = urllib.request.Request(
            f"{base_url.rstrip('/')}/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "DDStudio-QuizPipeline/2.0"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                resp_bytes = resp.read()
                data = json.loads(resp_bytes.decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                cleaned = content.strip()
                if cleaned.startswith("```"):
                    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
                    cleaned = re.sub(r"\s*```$", "", cleaned)
                try:
                    return json.loads(cleaned)
                except json.JSONDecodeError as jde:
                    salvaged = _salvage_truncated_json(cleaned)
                    if salvaged is not None and isinstance(salvaged, dict) and salvaged.get("questions"):
                        return salvaged
                    if attempt < max_retries:
                        current_temp = 0.0
                        if "Chỉ trả JSON compact" not in current_prompt:
                            current_prompt = current_prompt + "\n\nChỉ trả JSON compact, không markdown fence, không giải thích thêm."
                        time.sleep(1.0 * (attempt + 1))
                        continue
                    raise RuntimeError(f"Lỗi phản hồi Agnes AI API (JSON không hợp lệ và không thể cứu): {jde}")
        except json.JSONDecodeError as jde:
            if attempt < max_retries:
                current_temp = 0.0
                if "Chỉ trả JSON compact" not in current_prompt:
                    current_prompt = current_prompt + "\n\nChỉ trả JSON compact, không markdown fence, không giải thích thêm."
                time.sleep(1.0 * (attempt + 1))
                continue
            raise RuntimeError(f"Lỗi phản hồi Agnes AI API (JSON không hợp lệ): {jde}")
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="replace")
            if api_key and api_key in err_msg:
                err_msg = err_msg.replace(api_key, "[REDACTED_API_KEY]")
            last_err = RuntimeError(f"Agnes AI API error (HTTP {e.code}): {err_msg}")
            if e.code == 401:
                raise last_err
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


def chunk_questions_sliding_window(full_text: str, target_count: int, window_size: int = 10) -> list[tuple[int, int, str]]:
    """
    Pre-split candidate text into windows with clean question boundaries.
    Filters out document headers/preambles so question indexing is aligned.
    Returns list of (start_num, end_num, window_text).
    """
    pattern = re.compile(r"(?:^|\n)(?=(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+))", re.IGNORECASE)
    splits = pattern.split(full_text)

    segments = []
    preamble = ""
    for s in splits:
        trimmed = s.strip()
        if not trimmed:
            continue
        if re.match(r"^(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+)", trimmed, re.IGNORECASE):
            # Clean any trailing section banner that got attached to the end of this question
            cleaned_seg = strip_section_banner(trimmed)
            segments.append(cleaned_seg if cleaned_seg else trimmed)
        elif not segments and len(trimmed) > 10:
            preamble = trimmed

    if not segments:
        return [(1, target_count, full_text)]

    if len(segments) <= window_size:
        clean_full = "\n\n".join(segments[:target_count])
        return [(1, min(len(segments), target_count), clean_full)]

    windows = []
    total_segs = min(len(segments), target_count)
    curr = 0

    while curr < total_segs:
        w_start = curr
        w_end = min(curr + window_size, total_segs)
        window_text = "\n\n".join(segments[w_start:w_end])
        windows.append((w_start + 1, w_end, window_text))
        curr = w_end

    return windows


def normalize_question(q: dict, fallback_num: int = 1) -> dict:
    """Defensively validate, sanitize, and normalize multi-format question schema."""
    if not isinstance(q, dict):
        q = {}

    # Number
    num = q.get("number")
    if not isinstance(num, int):
        m = re.search(r"\d+", str(num))
        if m:
            num = int(m.group(0))
        else:
            num = fallback_num
    q["number"] = num

    # Type: Strictly MCQ
    q["type"] = "mcq"

    # Question stem
    raw_question = strip_section_banner(str(q.get("question", "")))
    if not q.get("image_ref"):
        ref_m = re.search(r"\[IMAGE_REF:\s*([^\]]+)\]", raw_question)
        if ref_m:
            q["image_ref"] = ref_m.group(1).strip()

    # Image ref
    img_ref = q.get("image_ref")
    if img_ref:
        s_ref = str(img_ref).strip()
        if s_ref.lower() in ("null", "none", "", "undefined"):
            q["image_ref"] = None
        else:
            q["image_ref"] = s_ref
    else:
        q["image_ref"] = None

    q["question"] = raw_question
    raw_exp = str(q.get("explanation", ""))
    q["explanation"] = strip_section_banner(raw_exp)

    # MCQ options normalization (A, B, C, D)
    raw_opts = q.get("options")
    norm_opts = {}
    banner_clean = lambda s: strip_section_banner(str(s))
    if isinstance(raw_opts, list):
        keys = ["A", "B", "C", "D"]
        for i, val in enumerate(raw_opts[:4]):
            clean_val = clean_image_markers(str(val))
            clean_val = re.sub(r"^[A-D][\.\)\:\s]+", "", clean_val).strip()
            clean_val = banner_clean(clean_val)
            norm_opts[keys[i]] = clean_val
    elif isinstance(raw_opts, dict):
        for k, val in raw_opts.items():
            upper_k = str(k).upper().strip()
            if upper_k in ("A", "B", "C", "D"):
                clean_val = clean_image_markers(str(val))
                clean_val = re.sub(r"^[A-D][\.\)\:\s]+", "", clean_val).strip()
                clean_val = banner_clean(clean_val)
                norm_opts[upper_k] = clean_val
    for k in ["A", "B", "C", "D"]:
        if k not in norm_opts:
            norm_opts[k] = ""
    q["options"] = norm_opts
    ans = str(q.get("answer", "")).upper().strip()
    ans_m = re.search(r"\b([A-D])\b", ans)
    q["answer"] = ans_m.group(1) if ans_m else (ans[:1] if ans in ("A", "B", "C", "D") else "A")

    return q


def _stem_fingerprint(q: dict) -> str:
    plain = re.sub(r"<[^>]+>", "", str(q.get("question", "")))
    plain = re.sub(r"^\s*(?:câu\s*\d+[\.\:\s]*|\d+[\.\:]\s*)", "", plain, flags=re.IGNORECASE)
    plain = re.sub(r"\s+", "", plain).lower()
    return hashlib.sha1(plain.encode("utf-8")).hexdigest()


def _guess_answer_from_raw(raw: str) -> str:
    """Best-effort regex extraction of answer key from raw question segment. Defaults to 'A'."""
    if not raw or not isinstance(raw, str):
        return "A"
    m = re.search(r"(?:đáp\s*án|answer)\s*[:\.]?\s*([A-D])\b", raw, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    return "A"


def _build_phase1_prompt(blocks: list[dict], b_start: int) -> str:
    """Build structured Phase 1 prompt for AI format standardization."""
    payload_blocks = []
    for off, blk in enumerate(blocks):
        if isinstance(blk, dict):
            item = {
                "number": b_start + off,
                "question": blk.get("stem", ""),
                "options": dict(blk.get("options", {}))
            }
            if blk.get("confidence") == "low":
                item["raw_fallback"] = blk.get("raw", "")
        else:
            item = {
                "number": b_start + off,
                "question": str(blk),
                "options": {}
            }
        payload_blocks.append(item)

    prompt = (
        "Đã có sẵn cấu trúc câu hỏi dưới dạng JSON. Nhiệm vụ của bạn CHỈ LÀ:\n"
        "1. Chuẩn hoá công thức hoá học bằng HTML <sub>/<sup> (ví dụ C<sub>2</sub>H<sub>5</sub>OH, Fe<sup>3+</sup>).\n"
        "2. Chuẩn hoá biểu thức toán bằng $...$ (KaTeX).\n"
        "3. Giữ NGUYÊN mọi marker [IMAGE_REF: ...] và mọi bảng Markdown.\n"
        "4. Xác định đáp án đúng, trả về \"answer\" là một trong \"A\",\"B\",\"C\",\"D\".\n"
        "5. Nếu một mục có \"raw_fallback\", hãy dùng nó để sửa lại \"question\"/\"options\" cho đúng.\n\n"
        "KHÔNG viết lời giải. KHÔNG thêm câu. KHÔNG bớt câu. KHÔNG đổi giá trị \"number\".\n"
        "Trả về ĐÚNG JSON: {\"questions\":[{\"number\":int,\"question\":str,\"options\":{\"A\":str,\"B\":str,\"C\":str,\"D\":str},\"answer\":str,\"image_ref\":str|null}]}\n\n"
        "INPUT:\n"
        f"{json.dumps(payload_blocks, ensure_ascii=False)}"
    )
    return prompt


def parse_and_standardize_questions(
    raw_text: str,
    api_key: str,
    count: int = 20,
    start_num: int = 1,
    base_url: str = DEFAULT_API_BASE,
    model: str = DEFAULT_MODEL,
    pages_desc: str = "",
    parsed_blocks: list[dict] | None = None
) -> list[dict]:
    """
    Parse raw text into structured multiple-choice questions (4 options A, B, C, D),
    HTML sub/sup for chemistry, KaTeX math formatting, and image linking via Agnes AI.
    """
    system_prompt = (
        "You are an expert Vietnamese exam editor and master teacher.\n"
        "Your task is to standardize and format multiple-choice quiz questions from the provided textbook/exam JSON payload.\n"
        "Requirements:\n"
        "1. All questions are standard multiple-choice questions (MCQ) with 4 options: A, B, C, D. The answer MUST be 'A', 'B', 'C', or 'D'.\n"
        "2. Standardize chemical formulas using HTML tags: indices to <sub> (e.g. C<sub>2</sub>H<sub>5</sub>OH, H<sub>2</sub>SO<sub>4</sub>) and charges to <sup> (e.g. Fe<sup>3+</sup>).\n"
        "3. Standardize mathematical expressions using KaTeX/LaTeX delimiters: inline math between $...$ (e.g. $E = mc^2$, $\\int_0^1 f(x)dx$, $\\frac{-b \\pm \\sqrt{\\Delta}}{2a}$).\n"
        "4. Preserve visual assets: If the question contains an image marker '[IMAGE_REF: fig_pX_Y]' or refers to a figure, diagram, reaction scheme, chart, or spectrum, you MUST preserve 'image_ref': 'fig_pX_Y.png'. If none, set 'image_ref': null.\n"
        "5. Preserve structured tables: If the question or options contain a Markdown table (e.g. | col1 | col2 | ...), you MUST PRESERVE the entire Markdown table verbatim inside 'question'. Do NOT flatten, compress, or convert tables into plain text.\n"
        "6. Return ONLY a valid JSON object matching this schema:\n"
        "{\n"
        '  "questions": [\n'
        "    {\n"
        '      "number": 1,\n'
        '      "type": "mcq",\n'
        '      "question": "Question text...",\n'
        '      "image_ref": "fig_p1_1.png",\n'
        '      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},\n'
        '      "answer": "A"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "7. If there are NO questions in the provided text, return {\"questions\": []}."
    )

    # (1) Chốt số câu thật ngay đầu hàm, trước khi gọi AI
    if parsed_blocks is None:
        parsed_blocks = parse_mcq_blocks(raw_text)
    available = len(parsed_blocks)
    if available == 0:
        desc = pages_desc or "trang đã chọn"
        raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")
    effective_count = min(count, available)

    # (2) Tính batches từ effective_count với BATCH_SIZE = 5
    BATCH_SIZE = 5
    batches = []
    curr_start = start_num
    remaining = effective_count
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

    # (3) Slicing windows trực tiếp từ parsed_blocks
    windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]

    # (4) Bắt buộc 1-1, bỏ hoàn toàn fallback else raw_text
    assert len(windows) == len(batches), "windows và batches phải khớp 1-1"

    MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))

    def _run_batch(b_idx: int) -> list[dict]:
        """Gọi AI cho đúng một batch. Trả về list câu hỏi thô (chưa normalize)."""
        b_start, b_end, b_count = batches[b_idx]
        w_blocks = windows[b_idx]
        user_prompt = _build_phase1_prompt(w_blocks, b_start)

        # Check Layer 2 AI Cache
        c_key = quiz_cache.ai_cache_key(model, PROMPT_VERSION, {"type": "phase1", "blocks": w_blocks, "start": b_start})
        cached_res = quiz_cache.read_json(f"ai_{c_key}")
        if cached_res and isinstance(cached_res, dict) and "questions" in cached_res:
            return cached_res.get("questions", [])

        res = call_agnes_api(
            api_key, user_prompt, system_prompt,
            base_url=base_url, model=model, timeout=90
        )
        if res and isinstance(res, dict) and "questions" in res:
            quiz_cache.write_json(f"ai_{c_key}", res)
        return res.get("questions", []) if isinstance(res, dict) else []

    results: list[list[dict] | None] = [None] * len(batches)
    errors: dict[int, Exception] = {}

    max_workers = min(MAX_PARALLEL, max(1, len(batches)))

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        fut_map = {ex.submit(_run_batch, i): i for i in range(len(batches))}
        done_n = 0
        for fut in concurrent.futures.as_completed(fut_map):
            i = fut_map[fut]
            try:
                res = fut.result()
                if not res:
                    errors[i] = RuntimeError(f"Gói câu hỏi số {i + 1} trả về danh sách rỗng.")
                else:
                    results[i] = res
            except Exception as e:
                errors[i] = e
            done_n += 1
            emit_progress(
                int(start_progress + (done_n / len(batches)) * (max_ai_progress - start_progress)),
                f"Đang chuẩn hóa {done_n}/{len(batches)} gói "
                f"({min(done_n * BATCH_SIZE, effective_count)}/{effective_count} câu)..."
            )

    # Nếu tất cả các gói đều thất bại -> raise lỗi đầu tiên
    if len(errors) == len(batches):
        first_idx = min(errors.keys())
        first_err = errors[first_idx]
        if isinstance(first_err, RuntimeError) and "trả về danh sách rỗng" in str(first_err):
            desc = pages_desc or "trang đã chọn"
            raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")
        raise first_err

    # Degradation có kiểm soát: lấp chỗ trống cho các batch bị lỗi
    if errors:
        for i, err in errors.items():
            b_start, b_end, b_count = batches[i]
            fallback = []
            for off, blk in enumerate(windows[i]):
                fallback.append({
                    "number": b_start + off,
                    "type": "mcq",
                    "question": blk["stem"] if isinstance(blk, dict) and "stem" in blk else str(blk),
                    "options": dict(blk["options"]) if isinstance(blk, dict) and "options" in blk else {"A": "", "B": "", "C": "", "D": ""},
                    "answer": _guess_answer_from_raw(blk["raw"] if isinstance(blk, dict) and "raw" in blk else ""),
                    "explanation": "",
                    "image_ref": None
                })
            results[i] = fallback

        emit_progress(72, f"Đã chuẩn hóa xong, {len(errors)} gói dùng bản trích xuất gốc...")

    # Ghép kết quả theo thứ tự index gốc results[0..n]
    for b_idx, batch_qs in enumerate(results):
        if not batch_qs:
            continue
        b_start, b_end, b_count = batches[b_idx]
        for idx, q in enumerate(batch_qs):
            target_num = b_start + idx
            norm_q = normalize_question(q, fallback_num=target_num)
            all_questions.append(norm_q)

    # (5) Dedup theo SHA1 fingerprint của question stem
    seen_stems = set()
    deduped = []
    for q in all_questions:
        fp = _stem_fingerprint(q)
        if fp in seen_stems:
            continue
        seen_stems.add(fp)
        deduped.append(q)
    all_questions = deduped

    # (6) Clamp về effective_count
    all_questions = all_questions[:effective_count]

    # (7) Cưỡng chế đánh số tuần tự bắt đầu từ start_num
    for i, q in enumerate(all_questions):
        q["number"] = start_num + i

    if not all_questions:
        desc = pages_desc or "trang đã chọn"
        raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")

    return all_questions


# ==============================================================================
# PHASE 2: EXPLANATIONS GENERATION (WP4)
# ==============================================================================

def _build_phase2_prompt(batch_slice: list[dict]) -> str:
    """Build compact Phase 2 prompt for explanation generation (stem + options + answer)."""
    items = []
    for q in batch_slice:
        opts = q.get("options", {})
        if not isinstance(opts, dict):
            opts = {}
        items.append({
            "number": q.get("number"),
            "question": q.get("question", ""),
            "options": dict(opts),
            "answer": q.get("answer", "")
        })

    prompt = (
        "Với mỗi câu hỏi trắc nghiệm dưới đây (đã biết đáp án đúng), hãy viết lời giải "
        "ngắn gọn, chính xác về mặt khoa học, bằng tiếng Việt, 1-3 câu.\n"
        "Dùng HTML <sub>/<sup> cho công thức hoá học và $...$ cho biểu thức toán.\n"
        'Trả về ĐÚNG JSON: {"explanations": {"<number>": "<lời giải>"}}\n\n'
        "INPUT:\n"
        f"{json.dumps(items, ensure_ascii=False)}"
    )
    return prompt


def _parse_explanations_response(res: dict | None) -> dict[str, str]:
    """
    Safely parse AI response into a mapping of str(question_number) -> explanation text.
    Handles standard {"explanations": {"<num>": "<text>"}}, list representations,
    and number-prefixed keys like "Câu 1".
    """
    parsed_map: dict[str, str] = {}
    if not res or not isinstance(res, dict):
        return parsed_map

    exp_data = None
    if "explanations" in res:
        exp_data = res["explanations"]
    elif "questions" in res and isinstance(res["questions"], list):
        for item in res["questions"]:
            if isinstance(item, dict) and "number" in item:
                num = item.get("number")
                text = item.get("explanation") or item.get("text") or ""
                parsed_map[str(num)] = str(text).strip()
        return parsed_map
    else:
        exp_data = res

    if isinstance(exp_data, dict):
        for k, v in exp_data.items():
            m = re.search(r"\d+", str(k))
            clean_k = m.group(0) if m else str(k).strip()
            if isinstance(v, str):
                parsed_map[clean_k] = v.strip()
            elif isinstance(v, dict):
                text = v.get("explanation") or v.get("text") or v.get("content") or ""
                parsed_map[clean_k] = str(text).strip()
            elif v is not None:
                parsed_map[clean_k] = str(v).strip()
    elif isinstance(exp_data, list):
        for item in exp_data:
            if isinstance(item, dict):
                num = item.get("number")
                text = item.get("explanation") or item.get("text") or item.get("content") or ""
                if num is not None:
                    parsed_map[str(num)] = str(text).strip()

    return parsed_map


def generate_explanations(
    questions: list[dict],
    api_key: str,
    base_url: str = DEFAULT_API_BASE,
    model: str = DEFAULT_MODEL,
    batch_size: int = 5,
    max_workers: int = 4
) -> None:
    """
    Generate detailed explanations for questions in Phase 2, mutating q["explanation"] IN-PLACE.
    Never raises an exception on partial or total failure; failed questions retain explanation = "".
    """
    if not questions:
        return

    # Ensure all questions have an explanation field initialized
    for q in questions:
        if "explanation" not in q or q["explanation"] is None:
            q["explanation"] = ""

    if not api_key:
        emit_progress(80, "Bỏ qua tạo lời giải chi tiết (thiếu API key)...")
        return

    system_prompt = (
        "You are an expert Vietnamese exam editor and master teacher.\n"
        "Your task is to write concise, scientifically accurate explanations in Vietnamese (1-3 sentences) "
        "for the provided multiple-choice questions with known correct answers.\n"
        "Use HTML <sub>/<sup> for chemical formulas and $...$ for mathematical expressions.\n"
        'Return ONLY a valid JSON object matching: {"explanations": {"<number>": "<lời giải>"}}'
    )

    batches = [questions[i:i + batch_size] for i in range(0, len(questions), batch_size)]
    total_batches = len(batches)
    if total_batches == 0:
        return

    concurrency_env = os.environ.get("QUIZ_AI_CONCURRENCY")
    effective_workers = int(concurrency_env) if concurrency_env else max_workers
    actual_workers = min(max(1, effective_workers), total_batches)

    def _run_exp_batch(b_idx: int) -> dict[str, str]:
        b_slice = batches[b_idx]
        user_prompt = _build_phase2_prompt(b_slice)

        # Check Layer 2 AI Cache
        c_key = quiz_cache.ai_cache_key(model, PROMPT_VERSION, {"type": "phase2", "items": b_slice})
        cached_res = quiz_cache.read_json(f"ai_{c_key}")
        if cached_res and isinstance(cached_res, dict):
            return _parse_explanations_response(cached_res)

        res = call_agnes_api(
            api_key, user_prompt, system_prompt,
            base_url=base_url, model=model, timeout=90
        )
        if res and isinstance(res, dict):
            quiz_cache.write_json(f"ai_{c_key}", res)
        return _parse_explanations_response(res)

    errors: dict[int, Exception] = {}
    start_prog = 72
    max_prog = 80
    prog_range = max_prog - start_prog

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=actual_workers) as ex:
            fut_map = {ex.submit(_run_exp_batch, i): i for i in range(total_batches)}
            done_n = 0
            for fut in concurrent.futures.as_completed(fut_map):
                b_idx = fut_map[fut]
                try:
                    exp_map = fut.result()
                    for q in batches[b_idx]:
                        q_num_str = str(q.get("number"))
                        if q_num_str in exp_map and exp_map[q_num_str]:
                            raw_exp = exp_map[q_num_str]
                            q["explanation"] = strip_section_banner(raw_exp).strip()
                except Exception as e:
                    errors[b_idx] = e
                done_n += 1
                pct = int(start_prog + (done_n / total_batches) * prog_range)
                emit_progress(
                    pct,
                    f"Đang viết lời giải chi tiết {done_n}/{total_batches} gói "
                    f"({min(done_n * batch_size, len(questions))}/{len(questions)} câu)..."
                )
    except Exception:
        emit_progress(80, "Không thể tạo lời giải chi tiết, dùng bảng đáp án rút gọn...")
        return

    if errors:
        if len(errors) == total_batches:
            emit_progress(80, "Không thể tạo lời giải chi tiết, dùng bảng đáp án rút gọn...")
        else:
            emit_progress(80, f"Đã viết xong lời giải, {len(errors)}/{total_batches} gói dùng đáp án rút gọn...")


# ==============================================================================
# MODULE 1.7: A4 PRINT HTML TEMPLATES & KATEX
# ==============================================================================

def determine_option_layout(options: dict) -> str:
    """Determine best grid layout (opt-col-4, opt-col-2, opt-col-1) based on text length."""
    max_len = max(len(re.sub(r"<[^>]+>", "", str(v))) for v in options.values()) if options else 0
    if max_len <= 15:
        return "opt-col-4"
    elif max_len <= 45:
        return "opt-col-2"
    else:
        return "opt-col-1"


def render_question_content_html(q: dict) -> str:
    """Render question stem, embedded image (if any), and options/statements according to type."""
    q_type = q.get("type", "mcq")
    raw_text = clean_image_markers(q.get("question", ""))
    q_text_formatted = format_tables_in_text(raw_text)

    # Embedded image box (guarded against null strings)
    img_html = ""
    img_src = q.get("image_data")
    if img_src and str(img_src).lower() not in ("null", "none", "", "undefined"):
        img_html = f"""
    <div class="q-image-box">
      <img src="{img_src}" alt="Hình minh họa" />
    </div>"""

    # Standard MCQ
    opts = q.get("options", {})
    col_class = determine_option_layout(opts)
    opt_items = []
    for key in ["A", "B", "C", "D"]:
        val = clean_image_markers(str(opts.get(key, "")))
        opt_items.append(f'<div class="opt-item"><span class="opt-letter">{key}.</span> {val}</div>')
    opts_rendered = "\n      ".join(opt_items)
    body = f"""
    <div class="q-content">{q_text_formatted}</div>{img_html}
    <div class="options-grid {col_class}">
      {opts_rendered}
    </div>"""
    return body


def generate_worksheet_html(title: str, subtitle: str, questions: list[dict]) -> str:
    """Generate printable HTML worksheet with multiple-choice question support and KaTeX rendering."""
    items_html = []

    for idx, q in enumerate(questions, start=1):
        num = q.get("number", idx)
        content = render_question_content_html(q)

        item = f"""
  <div class="question-item">
    <span class="q-num">Câu {num}:</span>
{content}
  </div>"""
        items_html.append(item)

    body_content = "\n".join(items_html)
    sub_html = f'\n    <div class="sub-title">{subtitle}</div>' if subtitle and subtitle.strip() else ""

    top_banner = f'<div class="section-banner notranslate katex-ignore">CÂU HỎI TRẮC NGHIỆM ({len(questions)} CÂU)</div>'

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>{title}</title>
<link rel="stylesheet" href="./katex/katex.min.css">
<style>
  @page {{
    size: A4 portrait;
    margin: 10mm 12mm 10mm 12mm;
    @bottom-right {{
      content: "Trang " counter(page) " / " counter(pages);
      font-size: 8.5pt;
      color: #64748b;
      font-family: 'Roboto', 'Liberation Sans', 'DejaVu Sans', sans-serif;
    }}
    @bottom-left {{
      content: "{title}";
      font-size: 8.5pt;
      color: #64748b;
      font-family: 'Roboto', 'Liberation Sans', 'DejaVu Sans', sans-serif;
    }}
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  body {{
    font-family: 'Roboto', 'Liberation Sans', 'DejaVu Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
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
    margin-top: 7px;
    margin-bottom: 9px;
    page-break-after: avoid;
    break-after: avoid;
  }}

  .question-item {{
    margin-bottom: 9px;
    page-break-inside: avoid;
    break-inside: avoid;
  }}

  .q-num {{
    font-weight: 700;
    color: #1e3a8a;
  }}

  .q-content {{
    font-weight: 500;
    display: inline;
  }}

  /* Visual Asset Image Box */
  .q-image-box {{
    margin: 6px auto;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid;
  }}
  .q-image-box img {{
    max-width: 85%;
    max-height: 180px;
    object-fit: contain;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 3px;
    background: #ffffff;
  }}

  /* Structured Markdown/HTML Table inside Question */
  .q-table {{
    border-collapse: collapse;
    margin: 6px auto;
    font-size: 9pt;
  }}
  .q-table th, .q-table td {{
    border: 1px solid #cbd5e1;
    padding: 3px 8px;
    text-align: center;
  }}
  .q-table th {{
    background: #f1f5f9;
    font-weight: 600;
    color: #334155;
  }}

  /* Multiple Choice Layout */
  .options-grid {{
    display: grid;
    margin-top: 3px;
    margin-left: 12px;
    row-gap: 3px;
    column-gap: 8px;
  }}
  .opt-col-4 {{ grid-template-columns: repeat(4, 1fr); }}
  .opt-col-2 {{ grid-template-columns: repeat(2, 1fr); }}
  .opt-col-1 {{ grid-template-columns: 1fr; }}

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

  /* True/False Table Layout */
  .tf-table {{
    width: 100%;
    border-collapse: collapse;
    margin-top: 5px;
    margin-bottom: 4px;
    font-size: 9.2pt;
  }}
  .tf-table th, .tf-table td {{
    border: 1px solid #cbd5e1;
    padding: 3px 6px;
  }}
  .tf-table th {{
    background: #f8fafc;
    font-weight: 600;
    color: #334155;
    text-align: center;
  }}
  .tf-text {{
    padding-left: 8px;
  }}
  .tf-cell {{
    text-align: center;
    width: 48px;
  }}

  /* Short Answer Layout */
  .sa-box {{
    margin-top: 5px;
    margin-left: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 9.5pt;
  }}
  .sa-label {{
    font-weight: 600;
    color: #475569;
  }}
  .sa-fill {{
    display: inline-block;
    width: 160px;
    height: 20px;
    border-bottom: 1.5px dashed #94a3b8;
  }}

  sub, sup {{
    font-size: 75%;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }}
  sup {{ top: -0.5em; }}
  sub {{ bottom: -0.25em; }}

  /* KaTeX font fallback */
  .katex, .katex-html {{
    font-family: 'KaTeX_Main', 'Cambria Math', 'STIX Two Math', 'Times New Roman', serif;
  }}
</style>
</head>
<body>

  <div class="header-box notranslate katex-ignore">
    <div class="main-title">{title}</div>{sub_html}
    <div class="info-bar">
      <span>Họ và tên: .................................................................................</span>
      <span>Lớp: ................</span>
      <span>Thời gian: {len(questions) * 1.5:.0f} phút</span>
    </div>
  </div>

  {top_banner}

{body_content}

  <script src="./katex/katex.min.js"></script>
  <script src="./katex/contrib/auto-render.min.js"></script>
  <script>
    renderMathInElement(document.body, {{
      delimiters: [
        {{left: '$$', right: '$$', display: true}},
        {{left: '$', right: '$', display: false}},
        {{left: '\\\\(', right: '\\\\)', display: false}},
        {{left: '\\\\[', right: '\\\\]', display: true}}
      ],
      ignoredClasses: ["section-banner", "main-title", "header-box", "q-num", "info-bar", "matrix-table", "notranslate", "katex-ignore"],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      throwOnError: false
    }});
  </script>
</body>
</html>
"""


def generate_answer_key_html(title: str, subtitle: str, questions: list[dict]) -> str:
    """Generate printable HTML standalone answer key with quick matrix table and multiple-choice solutions."""
    # MCQ Matrix Table (chunks of 10)
    chunk_size = 10
    chunks = [questions[i:i + chunk_size] for i in range(0, len(questions), chunk_size)]
    rows = []
    for c in chunks:
        th_cells = "".join(f"<th>{q.get('number', i+1)}</th>" for i, q in enumerate(c))
        td_cells = "".join(f"<td>{q.get('answer', '-')}</td>" for q in c)
        rows.append(f"<tr><th>Câu</th>{th_cells}</tr>\n    <tr><th>Đ/A</th>{td_cells}</tr>")
    table_html = "\n  ".join(rows)
    matrix_content = f"""
  <div class="section-banner notranslate katex-ignore">BẢNG ĐÁP ÁN</div>
  <table class="matrix-table notranslate katex-ignore">
    {table_html}
  </table>"""

    # Detailed Explanations
    sols_html = []
    for idx, q in enumerate(questions, start=1):
        num = q.get("number", idx)
        ans = q.get("answer", "-")
        expl = format_tables_in_text(clean_image_markers(q.get("explanation", "")))

        img_html = ""
        img_src = q.get("image_data")
        if img_src and str(img_src).lower() not in ("null", "none", "", "undefined"):
            img_html = f'<div class="sol-img"><img src="{img_src}" alt="Hình minh họa" /></div>'

        sol = f"""
  <div class="sol-item">
    <div class="sol-head"><span class="sol-num">Câu {num}:</span> Chọn <span class="sol-ans">{ans}</span></div>{img_html}
    <div class="sol-body"><b>Hướng dẫn giải:</b> {expl}</div>
  </div>"""
        sols_html.append(sol)

    sols_rendered = "\n".join(sols_html)
    sub_html = f'\n    <div class="sub-title">{subtitle}</div>' if subtitle and subtitle.strip() else ""

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>ĐÁP ÁN & LỜI GIẢI CHI TIẾT - {title}</title>
<link rel="stylesheet" href="./katex/katex.min.css">
<style>
  @page {{
    size: A4 portrait;
    margin: 10mm 14mm 10mm 14mm;
    @bottom-right {{
      content: "Trang " counter(page) " / " counter(pages);
      font-size: 8.5pt;
      color: #64748b;
      font-family: 'Roboto', 'Liberation Sans', 'DejaVu Sans', sans-serif;
    }}
    @bottom-left {{
      content: "Đáp án & Lời giải chi tiết — {title}";
      font-size: 8.5pt;
      color: #64748b;
      font-family: 'Roboto', 'Liberation Sans', 'DejaVu Sans', sans-serif;
    }}
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  body {{
    font-family: 'Roboto', 'Liberation Sans', 'DejaVu Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
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
    margin-bottom: 7px;
    padding: 5px 8px;
    background: #f8fafc;
    border-left: 3px solid #16a34a;
    border-radius: 0 4px 4px 0;
    page-break-inside: avoid;
    break-inside: avoid;
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

  .sol-stmts {{
    font-size: 8.9pt;
    margin: 3px 0 3px 8px;
    color: #1e293b;
    line-height: 1.35;
  }}
  .tag-true {{
    color: #15803d;
    font-weight: 700;
  }}
  .tag-false {{
    color: #b91c1c;
    font-weight: 700;
  }}

  .sol-body {{
    color: #334155;
    font-size: 9.1pt;
  }}

  .sol-img {{
    margin: 4px auto;
    text-align: center;
  }}
  .sol-img img {{
    max-width: 60%;
    max-height: 120px;
    object-fit: contain;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 2px;
  }}

  /* Structured Markdown/HTML Table inside Solution */
  .q-table {{
    border-collapse: collapse;
    margin: 4px auto;
    font-size: 8.8pt;
  }}
  .q-table th, .q-table td {{
    border: 1px solid #cbd5e1;
    padding: 2px 6px;
    text-align: center;
  }}
  .q-table th {{
    background: #f1f5f9;
    font-weight: 600;
  }}

  sub, sup {{
    font-size: 75%;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }}
  sup {{ top: -0.5em; }}
  sub {{ bottom: -0.25em; }}

  /* KaTeX font fallback */
  .katex, .katex-html {{
    font-family: 'KaTeX_Main', 'Cambria Math', 'STIX Two Math', 'Times New Roman', serif;
  }}
</style>
</head>
<body>

  <div class="header-box notranslate katex-ignore">
    <div class="main-title">ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT</div>{sub_html}
  </div>

{matrix_content}

  <div class="section-banner notranslate katex-ignore">HƯỚNG DẪN GIẢI CHI TIẾT TỪNG CÂU</div>

{sols_rendered}

  <script src="./katex/katex.min.js"></script>
  <script src="./katex/contrib/auto-render.min.js"></script>
  <script>
    renderMathInElement(document.body, {{
      delimiters: [
        {{left: '$$', right: '$$', display: true}},
        {{left: '$', right: '$', display: false}},
        {{left: '\\\\(', right: '\\\\)', display: false}},
        {{left: '\\\\[', right: '\\\\]', display: true}}
      ],
      ignoredClasses: ["section-banner", "main-title", "header-box", "q-num", "info-bar", "matrix-table", "notranslate", "katex-ignore"],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      throwOnError: false
    }});
  </script>
</body>
</html>
"""


# ==============================================================================
# PDF COMPILATION & VERIFICATION
# ==============================================================================

def _terminate_proc_safely(p: subprocess.Popen) -> None:
    """Defensively terminate process and its child processes on POSIX and Windows."""
    if p.poll() is not None:
        return
    if sys.platform != "win32":
        try:
            os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            p.wait(timeout=2)
        except Exception:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGKILL)
            except Exception:
                pass
    else:
        try:
            p.terminate()
            p.wait(timeout=2)
        except Exception:
            try:
                p.kill()
            except Exception:
                pass


def compile_pdf(chrome_path: str, html_path: str, pdf_path: str, timeout: float = None) -> None:
    """Compile HTML to PDF using Google Chrome Headless with active file polling and graceful process termination."""
    abs_html = os.path.abspath(html_path)
    abs_pdf = os.path.abspath(pdf_path)

    os.makedirs(os.path.dirname(abs_pdf), exist_ok=True)
    if os.path.exists(abs_pdf):
        try:
            os.remove(abs_pdf)
        except Exception:
            pass

    temp_profile = os.path.join(tempfile.gettempdir(), f"chrome_pdf_{os.getpid()}_{uuid.uuid4().hex[:8]}")
    os.makedirs(temp_profile, exist_ok=True)

    file_url = f"file:///{abs_html.replace(os.sep, '/')}" if sys.platform == "win32" else f"file://{abs_html}"

    effective_timeout = timeout
    if effective_timeout is None:
        try:
            effective_timeout = float(os.environ.get("QUIZ_CHROME_TIMEOUT", "45.0"))
        except (ValueError, TypeError):
            effective_timeout = 45.0

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
            "--allow-file-access-from-files",
            "--run-all-compositor-stages-before-draw",
            "--disable-features=NetworkService",
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

        start_time = time.time()
        while time.time() - start_time < effective_timeout:
            # Active check if PDF has been generated with valid size (> 1000 bytes)
            if os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 1000:
                time.sleep(0.3)
                _terminate_proc_safely(proc)
                return True

            # If Chrome process exited, give disk flushing grace period up to 6 seconds
            if proc.poll() is not None:
                flush_start = time.time()
                while time.time() - flush_start < 6.0:
                    if os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 1000:
                        return True
                    time.sleep(0.2)
                break

            time.sleep(0.25)

        _terminate_proc_safely(proc)
        return os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 1000

    success = run_chrome_worker("--headless=new")
    if not success and not (os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 1000):
        # Fallback to --headless only if new headless failed to produce file
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


def _build_and_compile_worksheet(
    title: str,
    subtitle: str,
    questions: list[dict],
    html_path: str,
    chrome: str,
    pdf_path: str
) -> None:
    """Build Worksheet HTML and compile to PDF using Google Chrome Headless."""
    worksheet_html = generate_worksheet_html(title, subtitle, questions)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(worksheet_html)
    compile_pdf(chrome, html_path, pdf_path)


def _build_and_compile_answer(
    title: str,
    subtitle: str,
    questions: list[dict],
    html_path: str,
    chrome: str,
    pdf_path: str
) -> None:
    """Build Answer Key HTML and compile to PDF using Google Chrome Headless."""
    answer_html = generate_answer_key_html(title, subtitle, questions)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(answer_html)
    compile_pdf(chrome, html_path, pdf_path)


# ==============================================================================
# PIPELINE ENTRYPOINT
# ==============================================================================

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
    """Execute the complete end-to-end Quiz Pipeline v2.0 with real-time SSE progress."""
    if not os.path.isdir(KATEX_SRC_DIR):
        raise RuntimeError(
            "Thiếu thư viện KaTeX cục bộ tại engines/quiz/assets/katex. "
            "Vui lòng cài đặt lại engine."
        )

    clean_prefix = sanitize_filename_prefix(filename_prefix)
    os.makedirs(output_dir, exist_ok=True)
    temp_dir = tempfile.gettempdir()
    temp_assets_dir = os.path.join(temp_dir, f"quiz_assets_{uuid.uuid4().hex[:8]}")
    os.makedirs(temp_assets_dir, exist_ok=True)

    job_html_dir = os.path.join(temp_dir, f"quiz_html_{uuid.uuid4().hex[:8]}")
    os.makedirs(job_html_dir, exist_ok=True)
    shutil.copytree(KATEX_SRC_DIR, os.path.join(job_html_dir, "katex"), dirs_exist_ok=True)

    ws_html_path = os.path.join(job_html_dir, f"{clean_prefix}_DeBai.html")
    ans_html_path = os.path.join(job_html_dir, f"{clean_prefix}_DapAn.html")

    key = api_key or DEFAULT_API_KEY
    if not key:
        raise ValueError("Thiếu API Key của Agnes AI! Vui lòng cung cấp trong tham số hoặc biến môi trường.")

    try:
        emit_progress(10, "Đang nạp tài liệu & kiểm tra định dạng PDF...")
        pdf_local = download_gdrive_if_needed(input_source, temp_dir)

        emit_progress(25, "Đang trích xuất văn bản 2 cột, bảng biểu & hình ảnh minh họa...")
        cached_extract = quiz_cache.get_extract_cache(pdf_local, str(pages), temp_assets_dir)
        if cached_extract is not None:
            raw_text, actual_pages, extracted_assets, asset_map, source_q_nums = cached_extract
        else:
            raw_text, actual_pages, extracted_assets, asset_map, source_q_nums = extract_raw_pages(pdf_local, pages, temp_assets_dir)
            quiz_cache.set_extract_cache(pdf_local, str(pages), raw_text, actual_pages, extracted_assets, asset_map, source_q_nums)
        pages_desc = f"Trang {', '.join(map(str, actual_pages))}" if actual_pages else f"Trang {pages}"

        emit_progress(45, f"Đang chuẩn hóa câu hỏi đa định dạng GDPT 2018 ({count} câu)...")
        parsed_blocks = parse_mcq_blocks(raw_text)
        questions = parse_and_standardize_questions(
            raw_text, key, count=count, start_num=start_q, base_url=base_url, model=model, pages_desc=pages_desc,
            parsed_blocks=parsed_blocks
        )

        effective_count = len(questions)
        source_nums_for_assets = [b["source_number"] for b in parsed_blocks][:effective_count]

        # Link visual assets to questions using AI match, layout spatial map, and fallbacks
        link_assets_to_questions(questions, extracted_assets, asset_map, source_nums_for_assets)

        # Compute question type breakdown
        mcq_count = len(questions)
        tf_count = 0
        sa_count = 0

        emit_progress(72, "Đang khởi tạo tiến trình in ấn và tạo lời giải chi tiết...")
        chrome = find_chrome_path()
        ws_pdf_path = os.path.join(output_dir, f"{clean_prefix}_DeBai.pdf")
        ans_pdf_path = os.path.join(output_dir, f"{clean_prefix}_DapAn.pdf")

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            # (1) Worksheet KHÔNG cần explanation -> build & in NGAY, chồng lấn với phase 2
            f_ws = executor.submit(
                _build_and_compile_worksheet,
                title, subtitle, questions, ws_html_path, chrome, ws_pdf_path
            )

            # (2) Phase 2 chạy trên main thread, song song với Chrome đang in worksheet
            if os.environ.get("QUIZ_SKIP_EXPLANATION") != "1":
                try:
                    generate_explanations(questions, key, base_url=base_url, model=model)
                except Exception:
                    pass

            # (3) Answer key CẦN explanation -> chỉ submit SAU khi phase 2 xong
            f_ans = executor.submit(
                _build_and_compile_answer,
                title, subtitle, questions, ans_html_path, chrome, ans_pdf_path
            )

            curr_p = 82
            elapsed = 0.0
            while not (f_ws.done() and f_ans.done()):
                time.sleep(0.2)
                elapsed += 0.2
                if curr_p < 93 and int(elapsed * 5) % 5 == 0:
                    curr_p += 1
                emit_progress(curr_p, f"Đang xuất tệp PDF Đề bài và Đáp án qua Chrome ({int(elapsed)}s)...")

            f_ws.result()
            f_ans.result()

        emit_progress(95, "Đang kiểm tra tính toàn vẹn của tệp PDF xuất ra...")
        ws_pages = verify_pdf_pages(ws_pdf_path)
        ans_pages = verify_pdf_pages(ans_pdf_path)

        emit_progress(100, "Hoàn tất tạo Đề bài và Đáp án chi tiết v2.0!")

        result = {
            "success": True,
            "worksheet_pdf": ws_pdf_path,
            "answer_pdf": ans_pdf_path,
            "worksheet_pages": ws_pages,
            "answer_pages": ans_pages,
            "questions_count": len(questions),
            "extracted_images_count": len(extracted_assets),
            "question_types": {
                "mcq": mcq_count,
                "true_false": tf_count,
                "short_answer": sa_count
            }
        }

        print(json.dumps(result, ensure_ascii=False), flush=True)
        return result

    finally:
        # Atomic cleanup of temporary per-job HTML directory and visual assets
        try:
            if os.path.exists(job_html_dir):
                shutil.rmtree(job_html_dir, ignore_errors=True)
        except Exception:
            pass

        try:
            if os.path.exists(temp_assets_dir):
                shutil.rmtree(temp_assets_dir, ignore_errors=True)
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser(description="Quiz PDF Generator Pipeline v2.0")
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

    try:
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
    except Exception as e:
        err_msg = str(e).strip()
        sys.stderr.write(f"{err_msg}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
