"""
Quiz Pipeline Multi-Tier Content-Hash Cache (WP7)
Provides atomic JSON caching for:
1. PDF text & visual asset extraction (Layer 1)
2. AI standardization & explanation batches (Layer 2)

Respects QUIZ_CACHE_DISABLED and QUIZ_CACHE_DIR environment variables.
Cache TTL is 7 days.
"""

import os
import time
import json
import uuid
import shutil
import base64
import hashlib
from typing import Any

# Default cache directory relative to project root
CACHE_TTL_SECONDS = 7 * 24 * 3600  # 7 days


def cache_root() -> str:
    """Return data/cache/quiz absolute path, creating it if needed. Honors QUIZ_CACHE_DIR env."""
    env_dir = os.environ.get("QUIZ_CACHE_DIR")
    if env_dir:
        target = os.path.abspath(env_dir)
    else:
        # engines/quiz/quiz_cache.py -> ../../data/cache/quiz
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        target = os.path.join(base_dir, "data", "cache", "quiz")
    try:
        os.makedirs(target, exist_ok=True)
    except Exception:
        pass
    return target


def is_cache_enabled() -> bool:
    """Returns False when QUIZ_CACHE_DISABLED == '1'."""
    return os.environ.get("QUIZ_CACHE_DISABLED") != "1"


def is_provider_cache_enabled(provider: Any = None) -> bool:
    """
    Returns True if global cache is enabled AND provider does not explicitly disable it.
    Real providers (e.g. AgnesAIProvider) default to True.
    Mock providers (MockAIProvider, MagicMock, Mock) must explicitly have enable_cache is True.
    """
    if not is_cache_enabled():
        return False
    if provider is None:
        return True

    is_mock = (
        hasattr(provider, "_mock_return_value") or
        provider.__class__.__name__ in ("MockAIProvider", "Mock", "MagicMock") or
        getattr(provider, "__module__", "").startswith("unittest.mock")
    )
    if is_mock:
        return getattr(provider, "enable_cache", False) is True

    return True


def read_json(key: str) -> dict | None:
    """
    Read cache entry JSON.
    Returns None if cache is disabled, key is missing, read error, corrupt JSON,
    or older than TTL (7 days).
    """
    if not is_cache_enabled():
        return None

    filename = key if key.endswith(".json") else f"{key}.json"
    filepath = os.path.join(cache_root(), filename)

    if not os.path.isfile(filepath):
        return None

    try:
        mtime = os.path.getmtime(filepath)
        if time.time() - mtime > CACHE_TTL_SECONDS:
            return None

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data
            return None
    except Exception:
        # Corrupt file or read error -> treat as cache miss
        return None


def write_json(key: str, value: dict) -> None:
    """
    Atomic write: writes to temporary file then renames via os.replace.
    Silently ignores write errors (cache is best-effort).
    """
    if not is_cache_enabled():
        return

    try:
        root = cache_root()
        filename = key if key.endswith(".json") else f"{key}.json"
        target_path = os.path.join(root, filename)
        tmp_path = os.path.join(root, f"{filename}.tmp_{uuid.uuid4().hex[:8]}")

        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(value, f, ensure_ascii=False, indent=2)

        os.replace(tmp_path, target_path)
    except Exception:
        # Silently fail if cache directory is read-only or full
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


def extract_cache_key(pdf_path: str, page_spec: str) -> str:
    """sha256(PDF content bytes + page_spec)."""
    h = hashlib.sha256()
    try:
        with open(pdf_path, "rb") as f:
            while chunk := f.read(65536):
                h.update(chunk)
    except Exception:
        h.update(str(pdf_path).encode("utf-8"))
    h.update(str(page_spec).encode("utf-8"))
    return h.hexdigest()


def ai_cache_key(model: str, prompt_version: str, payload: Any) -> str:
    """sha256(model + prompt_version + json.dumps(payload, sort_keys=True, ensure_ascii=False))."""
    h = hashlib.sha256()
    h.update(str(model).encode("utf-8"))
    h.update(str(prompt_version).encode("utf-8"))
    encoded_payload = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    h.update(encoded_payload.encode("utf-8"))
    return h.hexdigest()


def get_extract_cache(
    pdf_path: str,
    page_spec: str,
    temp_assets_dir: str
) -> tuple[str, list[int], list[dict], dict[str, int], list[int]] | None:
    """
    Look up Layer 1 Extract Cache.
    If hit, copies cached PNGs into temp_assets_dir and reconstructs data_uri.
    Returns None on cache miss or if any referenced PNG image file is missing.
    """
    if not is_cache_enabled():
        return None

    key = extract_cache_key(pdf_path, page_spec)
    data = read_json(f"extract_{key}")
    if not data or not isinstance(data, dict):
        return None

    raw_text = data.get("raw_text")
    actual_pages = data.get("actual_pages")
    asset_map = data.get("asset_map", {})
    source_q_nums = data.get("source_q_nums", [])
    assets_meta = data.get("assets_meta", [])

    if raw_text is None or actual_pages is None:
        return None

    assets_dir = os.path.join(cache_root(), f"assets_{key}")

    # Verify all referenced images exist before accepting cache hit
    for item in assets_meta:
        img_name = item.get("name")
        if not img_name:
            return None
        cached_img_path = os.path.join(assets_dir, img_name)
        if not os.path.isfile(cached_img_path):
            return None

    # Reconstruct extracted_assets
    extracted_assets = []
    os.makedirs(temp_assets_dir, exist_ok=True)

    for item in assets_meta:
        img_name = item["name"]
        cached_img_path = os.path.join(assets_dir, img_name)
        dest_path = os.path.join(temp_assets_dir, img_name)

        try:
            shutil.copy2(cached_img_path, dest_path)
            with open(dest_path, "rb") as f:
                img_bytes = f.read()
            data_uri = f"data:image/png;base64,{base64.b64encode(img_bytes).decode('ascii')}"

            rect_val = item.get("rect")
            extracted_assets.append({
                "id": item.get("id", str(uuid.uuid4())),
                "name": img_name,
                "page": item.get("page", 1),
                "rect": rect_val,
                "data_uri": data_uri,
                "file_path": dest_path,
                "text_inside": item.get("text_inside", "")
            })
        except Exception:
            return None

    return raw_text, actual_pages, extracted_assets, asset_map, source_q_nums


def set_extract_cache(
    pdf_path: str,
    page_spec: str,
    raw_text: str,
    actual_pages: list[int],
    extracted_assets: list[dict],
    asset_map: dict[str, int],
    source_q_nums: list[int]
) -> None:
    """Save Layer 1 Extract Cache (metadata JSON + asset PNG files)."""
    if not is_cache_enabled():
        return

    try:
        key = extract_cache_key(pdf_path, page_spec)
        assets_dir = os.path.join(cache_root(), f"assets_{key}")
        os.makedirs(assets_dir, exist_ok=True)

        assets_meta = []
        for asset in extracted_assets:
            src_file = asset.get("file_path")
            img_name = asset.get("name")
            if src_file and os.path.isfile(src_file) and img_name:
                dst_file = os.path.join(assets_dir, img_name)
                try:
                    shutil.copy2(src_file, dst_file)
                except Exception:
                    pass

            rect_raw = asset.get("rect")
            if hasattr(rect_raw, "x0"):
                rect_clean = [rect_raw.x0, rect_raw.y0, rect_raw.x1, rect_raw.y1]
            elif isinstance(rect_raw, (list, tuple)):
                rect_clean = list(rect_raw)
            else:
                rect_clean = [0.0, 0.0, 0.0, 0.0]

            assets_meta.append({
                "id": asset.get("id", ""),
                "name": img_name,
                "page": asset.get("page", 1),
                "rect": rect_clean,
                "text_inside": asset.get("text_inside", "")
            })

        meta = {
            "raw_text": raw_text,
            "actual_pages": actual_pages,
            "asset_map": asset_map,
            "source_q_nums": source_q_nums,
            "assets_meta": assets_meta
        }
        write_json(f"extract_{key}", meta)
    except Exception:
        pass


def get_perception_cache(pdf_path: str, page_range_spec: str) -> list[dict] | None:
    """Retrieves cached DocumentRepresentation page dictionaries."""
    if not is_cache_enabled():
        return None
    key = f"doc_rep_{extract_cache_key(pdf_path, page_range_spec)}"
    data = read_json(key)
    if data and isinstance(data, dict) and "pages" in data:
        return data["pages"]
    return None


def set_perception_cache(pdf_path: str, page_range_spec: str, page_dicts: list[dict]) -> None:
    """Saves DocumentRepresentation page dictionaries with 7-day TTL."""
    if not is_cache_enabled():
        return
    key = f"doc_rep_{extract_cache_key(pdf_path, page_range_spec)}"
    write_json(key, {"pages": page_dicts, "version": "v3.0.0"})


def get_ai_reconstruct_cache(batch_hash: str) -> dict | None:
    """Retrieves cached AI batch reconstruction response."""
    if not is_cache_enabled():
        return None
    return read_json(f"ai_recon_{batch_hash}")


def set_ai_reconstruct_cache(batch_hash: str, result_dict: dict) -> None:
    """Saves AI batch reconstruction response with 7-day TTL."""
    if not is_cache_enabled():
        return
    write_json(f"ai_recon_{batch_hash}", result_dict)


def get_ai_solve_cache(batch_hash: str) -> dict | None:
    """Retrieves cached AI batch answer solving response."""
    if not is_cache_enabled():
        return None
    return read_json(f"ai_solve_{batch_hash}")


def set_ai_solve_cache(batch_hash: str, result_dict: dict) -> None:
    """Saves AI batch answer solving response with 7-day TTL."""
    if not is_cache_enabled():
        return
    write_json(f"ai_solve_{batch_hash}", result_dict)


def get_vision_cache(vision_hash: str) -> dict | None:
    """Retrieves cached Vision QA inspection response."""
    if not is_cache_enabled():
        return None
    return read_json(f"vision_qa_{vision_hash}")


def set_vision_cache(vision_hash: str, result_dict: dict) -> None:
    """Saves Vision QA inspection response with 7-day TTL."""
    if not is_cache_enabled():
        return
    write_json(f"vision_qa_{vision_hash}", result_dict)


def get_question_index_cache(cache_key: str) -> dict | None:
    """Retrieves cached Page Question Index for PLAN-05."""
    if not is_cache_enabled():
        return None
    return read_json(f"q_index_{cache_key}")


def set_question_index_cache(cache_key: str, result_dict: dict) -> None:
    """Saves Page Question Index with 7-day TTL for PLAN-05."""
    if not is_cache_enabled():
        return
    write_json(f"q_index_{cache_key}", result_dict)


