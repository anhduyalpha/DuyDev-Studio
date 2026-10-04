"""
Post-Processing Engine Module
Normalizes reconstructed questions:
1. Header cleanup: Removes redundant leading markers like 'Câu 35:' from stems.
2. Deduplication via SHA-1 canonical stem hashing.
3. Provenance & Canonical Numbering: Source question number is canonical identity.
4. Range filtering: Restricts questions strictly to requested bounds.
5. Invariant enforcement & targeted recovery for missing MCQ options.
"""

import hashlib
import re
from typing import Optional, Any
from .models import ReconstructedQuestion, QuestionOption, QuestionType
from engines.quiz.common.errors import ErrorCode, DiagnosticLayer, QuizEngineError


def clean_question_stem(stem: str) -> str:
    """Removes redundant leading question headers like 'Câu 35:', 'Câu 31: Câu 35:', etc."""
    if not stem:
        return ""
    # Strip any leading 'Câu \d+[:.]', 'Bài \d+[:.]', 'Question \d+[:.]', or standalone '\d+[:.]'
    pattern = re.compile(
        r"^\s*(?:(?:Câu|Bài|Question|CÂU|BÀI)\s*\d+[\s\.\:\)\-]*|\b\d+[\.\:\)\-]\s*)",
        re.IGNORECASE
    )
    cleaned = stem.strip()
    while True:
        m = pattern.match(cleaned)
        if not m:
            break
        cleaned = cleaned[m.end():].strip()
    return cleaned


def normalize_stem_for_dedup(stem: str) -> str:
    """
    Strips HTML tags, KaTeX markers, and excess whitespace to generate a canonical stem signature.
    """
    clean = re.sub(r"<[^>]+>", "", stem)
    clean = re.sub(r"[\$\s\r\n\t\.,;:\?!]", "", clean).lower()
    return clean


def recover_missing_mcq_options(
    q: ReconstructedQuestion,
    source_context: str = ""
) -> list[QuestionOption]:
    """
    Attempts targeted recovery when an MCQ question is missing options (e.g. has A, B, C but lacks D).
    Inspects stem or provided source context to recover trailing options.
    """
    recovered_opts = list(q.options)
    existing_labels = {opt.label.upper() for opt in recovered_opts}
    expected_labels = ["A", "B", "C", "D"]

    missing_labels = [l for l in expected_labels if l not in existing_labels]
    if not missing_labels:
        return recovered_opts

    # 1. Check if missing option is embedded inside stem
    for lbl in missing_labels:
        opt_pat = re.compile(
            rf"(?:^|\s|\n){lbl}[\.\)\:]\s*([^\n\r]+(?:\n(?!\s*(?:[A-D][\.\)\:]|Câu\s*\d|\b\d+[\.\:]|PHẦN|BẢNG|---|HẾT))[^\n\r]+)*)",
            re.IGNORECASE
        )
        m = opt_pat.search(q.stem)
        if m:
            opt_text = m.group(1).strip()
            opt_text = re.sub(r"(?:\n|\s+)(?:---|--|HẾT|The End|Trang\s*\d+).*$", "", opt_text, flags=re.IGNORECASE).strip()
            recovered_opts.append(QuestionOption(label=lbl, text=opt_text))
            existing_labels.add(lbl)
            # Remove from stem
            q.stem = q.stem[:m.start()].strip()

    # 2. Check if missing option exists in source_context
    missing_labels = [l for l in expected_labels if l not in existing_labels]
    if missing_labels and source_context:
        # Search for question area in source_context supporting both "Câu 46" and "46."
        q_marker_pat = re.compile(
            rf"(?:^|\n|\b)(?:(?:Câu|Bài|Question)\s*{q.source_number}\b|{q.source_number}[\.\:\)])",
            re.IGNORECASE
        )
        m_q = q_marker_pat.search(source_context)
        start_idx = m_q.end() if m_q else 0

        # Find next question marker
        next_marker_pat = re.compile(
            r"(?:^|\n|\b)(?:(?:Câu|Bài|Question)\s*\d+\b|\d+[\.\:\)])",
            re.IGNORECASE
        )
        m_next = next_marker_pat.search(source_context, pos=start_idx + 10)
        end_idx = m_next.start() if m_next else len(source_context)
        q_text_region = source_context[start_idx:end_idx]

        for lbl in missing_labels:
            opt_pat = re.compile(
                rf"(?:^|\s|\n){lbl}[\.\)\:]\s*([^\n\r]+(?:\n(?!\s*(?:[A-D][\.\)\:]|Câu\s*\d|\b\d+[\.\:]|PHẦN|BẢNG|---|HẾT))[^\n\r]+)*)",
                re.IGNORECASE
            )
            m = opt_pat.search(q_text_region)
            if m:
                opt_text = m.group(1).strip()
                opt_text = re.sub(r"(?:\n|\s+)(?:---|--|HẾT|The End|Trang\s*\d+).*$", "", opt_text, flags=re.IGNORECASE).strip()
                recovered_opts.append(QuestionOption(label=lbl, text=opt_text))
                existing_labels.add(lbl)

    # Sort options standard A, B, C, D
    recovered_opts.sort(key=lambda o: expected_labels.index(o.label.upper()) if o.label.upper() in expected_labels else 99)
    return recovered_opts


def post_process_questions(
    questions: list[ReconstructedQuestion],
    start_question: int = 1,
    expected_count: Optional[int] = None,
    source_context: str = ""
) -> list[ReconstructedQuestion]:
    """
    Deduplicates, sorts, maps numbers canonically, and enforces content integrity invariants.
    Rule: Source question number is canonical identity.
    """
    if not questions:
        return []

    # 1. Clean stem headers and deduplicate using SHA-1 hash of canonical stem
    seen_hashes: set[str] = set()
    cleaned_candidates: list[ReconstructedQuestion] = []

    for q in questions:
        cleaned_stem = clean_question_stem(q.stem)
        canonical = normalize_stem_for_dedup(cleaned_stem)
        # Deduplication signature: combine source_number and canonical stem
        if q.source_number and q.source_number > 0:
            dedup_sig = f"{q.source_number}_{canonical}"
        else:
            opts_sig = "".join(f"{o.label}:{normalize_stem_for_dedup(o.text)}" for o in q.options)
            dedup_sig = f"{canonical}_{opts_sig}"

        stem_hash = hashlib.sha1(dedup_sig.encode("utf-8")).hexdigest()

        if stem_hash in seen_hashes:
            continue

        seen_hashes.add(stem_hash)
        q_copy = q.model_copy(update={"stem": cleaned_stem})
        cleaned_candidates.append(q_copy)

    # 2. Stable Sort: by primary source page and original source_number
    def sort_key(q: ReconstructedQuestion):
        primary_page = q.source_pages[0] if q.source_pages else 9999
        return (primary_page, q.source_number)

    cleaned_candidates.sort(key=sort_key)

    # 3. Filter by canonical requested question range
    # If start_question is requested, prioritize questions >= start_question
    in_range_questions = [
        q for q in cleaned_candidates
        if q.source_number >= start_question
    ]
    # Fallback to all candidates if none >= start_question (e.g. 1-based questions with custom offset)
    if not in_range_questions:
        in_range_questions = cleaned_candidates

    # If expected_count is set, constrain to target end question bound
    if expected_count is not None and expected_count > 0:
        target_end_q = start_question + expected_count - 1
        bounded_questions = [
            q for q in in_range_questions
            if q.source_number <= target_end_q
        ]
        # If bounded questions exist, use them; otherwise truncate in_range_questions
        if bounded_questions:
            in_range_questions = bounded_questions[:expected_count]
        else:
            in_range_questions = in_range_questions[:expected_count]

    # 4. Canonical Numbering and Targeted Invariant Verification
    processed: list[ReconstructedQuestion] = []
    for idx, q in enumerate(in_range_questions):
        if q.source_number and q.source_number >= start_question:
            canonical_num = q.source_number
        else:
            canonical_num = start_question + idx

        primary_page = q.source_pages[0] if q.source_pages else 1
        stem_hash = hashlib.sha1(q.stem.encode("utf-8")).hexdigest()[:8]
        stable_id = f"q_p{primary_page}_num{canonical_num}_{stem_hash}"

        # Option integrity invariant: standard MCQ must have 4 options A, B, C, D
        final_options = q.options
        if q.type == QuestionType.PART_I_MCQ and 0 < len(q.options) < 4:
            # Trigger targeted recovery
            final_options = recover_missing_mcq_options(q, source_context)
            if len(final_options) < 4:
                display_num = q.source_number if q.source_number > 0 else canonical_num
                raise QuizEngineError(
                    ErrorCode.OPTION_MISSING,
                    DiagnosticLayer.IR_FAILURE,
                    f"Câu {display_num} (ID '{stable_id}') bị thiếu phương án lựa chọn (chỉ có {len(final_options)}/4 phương án). "
                    f"Không thể tiếp tục khi vi phạm toàn vẹn nội dung.",
                    stage="RECONSTRUCTING"
                )

        updated_q = q.model_copy(
            update={
                "id": stable_id,
                "number": canonical_num,
                "source_number": q.source_number or canonical_num,
                "options": final_options
            }
        )
        processed.append(updated_q)

    return processed
