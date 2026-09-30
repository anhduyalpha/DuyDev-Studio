#!/usr/bin/env python3
"""
DD Studio - AI PDF Layout Advisor & Decision Router (< 160 lines)
Evaluates PDF diagnostic summaries and queries Agnes AI (agnes-3.0-flash)
to produce a conversion execution plan and sanitizer rule set.
"""

import os
import json
import re
import urllib.request
from typing import Dict, Any, Optional

try:
    from pdf_diagnostics import run_pdf_diagnostics
except ImportError:
    from .pdf_diagnostics import run_pdf_diagnostics


def _get_api_key() -> str:
    key = os.environ.get("AGNES_AI_API_KEY", "").strip()
    if key:
        return key
    candidates = [
        os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "server", ".env")),
        "/home/anhduy/dd-studio/server/.env"
    ]
    for env_path in candidates:
        if os.path.isfile(env_path):
            try:
                with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        if line.strip().startswith("AGNES_AI_API_KEY="):
                            val = line.strip().split("=", 1)[1].strip().strip('"').strip("'")
                            if val:
                                return val
            except Exception:
                pass
    return ""


def _deterministic_plan(diag: Dict[str, Any], note: str = "Deterministic rules") -> Dict[str, Any]:
    checks = diag.get("checks", {})
    has_ql = checks.get("question_list", {}).get("detected", False)
    has_grid = checks.get("tables_and_grids", {}).get("has_true_grid", True)
    has_header = checks.get("header_footer", {}).get("has_header_box", False)
    has_exp = checks.get("scientific_exponents", {}).get("detected", False)

    doc_type = "academic_quiz" if has_ql else ("structured_tables" if has_grid else "standard_document")
    return {
        "document_type": doc_type,
        "parse_stream_table": False if has_ql else True,
        "parse_lattice_table": bool(has_grid),
        "sanitizer_rules": {
            "unpack_collapsed_list_tables": bool(has_ql),
            "normalize_question_paragraphs": bool(has_ql),
            "clean_header_footer_tables": bool(has_header),
            "restore_scientific_exponents": bool(has_exp),
            "preserve_true_grid_tables": bool(has_grid),
        },
        "strategy_notes": note
    }


def analyze_pdf_layout_strategy(input_path: str, diagnostics: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Analyzes PDF via diagnostics battery and consults Agnes AI for conversion strategy."""
    if diagnostics is None:
        try:
            diagnostics = run_pdf_diagnostics(input_path)
        except Exception as e:
            return _deterministic_plan({}, f"Diagnostics failed: {e}")

    default_plan = _deterministic_plan(diagnostics, "Rule-based engine active")
    api_key = _get_api_key()
    if not api_key:
        return default_plan

    base_url = os.environ.get("AGNES_AI_BASE_URL", "https://apihub.agnes-ai.com/v1").rstrip("/")
    model = os.environ.get("AGNES_AI_MODEL", "agnes-3.0-flash")

    summary = {
        "page_count": diagnostics.get("document_summary", {}).get("page_count", 1),
        "question_list": diagnostics.get("checks", {}).get("question_list", {}),
        "tables_and_grids": diagnostics.get("checks", {}).get("tables_and_grids", {}),
        "header_footer": diagnostics.get("checks", {}).get("header_footer", {}),
        "scientific_exponents": diagnostics.get("checks", {}).get("scientific_exponents", {})
    }

    prompt = (
        "You are a strategic decision router for PDF to Word conversion.\n"
        f"Diagnostic summary:\n{json.dumps(summary, ensure_ascii=False)}\n"
        'Return ONLY valid JSON: {"document_type": "academic_quiz"|"structured_tables"|"standard_document", '
        '"parse_stream_table": bool, "parse_lattice_table": bool, '
        '"sanitizer_rules": {"unpack_collapsed_list_tables": bool, "normalize_question_paragraphs": bool, '
        '"clean_header_footer_tables": bool, "restore_scientific_exponents": bool, "preserve_true_grid_tables": bool}, '
        '"strategy_notes": "short rationale"}'
    )

    try:
        req_data = json.dumps({
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a precise JSON configuration router for document layout conversion."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.1,
            "max_tokens": 250
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=req_data,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "DDStudio/1.0"
            }
        )

        with urllib.request.urlopen(req, timeout=2.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data["choices"][0]["message"]["content"].strip()
            json_match = re.search(r'\{[\s\S]*\}', content)
            parsed = json.loads(json_match.group(0) if json_match else content)

            has_ql = diagnostics.get("checks", {}).get("question_list", {}).get("detected", False)
            has_grid = diagnostics.get("checks", {}).get("tables_and_grids", {}).get("has_true_grid", True)
            has_exp = diagnostics.get("checks", {}).get("scientific_exponents", {}).get("detected", False)
            has_header = diagnostics.get("checks", {}).get("header_footer", {}).get("has_header_box", False)

            parse_stream = False if has_ql else bool(parsed.get("parse_stream_table", False))
            parse_lattice = True if has_grid else bool(parsed.get("parse_lattice_table", True))
            san_rules = parsed.get("sanitizer_rules", {})

            return {
                "document_type": str(parsed.get("document_type", default_plan["document_type"])),
                "parse_stream_table": parse_stream,
                "parse_lattice_table": parse_lattice,
                "sanitizer_rules": {
                    "unpack_collapsed_list_tables": bool(san_rules.get("unpack_collapsed_list_tables", False)) or has_ql,
                    "normalize_question_paragraphs": bool(san_rules.get("normalize_question_paragraphs", False)) or has_ql,
                    "clean_header_footer_tables": bool(san_rules.get("clean_header_footer_tables", False)) or has_header,
                    "restore_scientific_exponents": bool(san_rules.get("restore_scientific_exponents", False)) or has_exp,
                    "preserve_true_grid_tables": bool(san_rules.get("preserve_true_grid_tables", False)) or has_grid
                },
                "strategy_notes": str(parsed.get("strategy_notes", "Configured by Agnes AI"))
            }
    except Exception as exc:
        default_plan["strategy_notes"] += f" (Agnes fallback: {exc})"
        return default_plan
