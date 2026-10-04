"""
Dynamic Range Resolver Module
Determines target start/end pages, question counts, and handles candidate inspection and expansion.
Fast Path: Traverses page candidates deterministically without calling AI unless ambiguity arises.
"""

from typing import Optional
import logging
from pydantic import BaseModel

from engines.quiz.perception.models import PageRepresentation
from engines.quiz.perception.candidates import detect_continuation_candidate
from engines.quiz.provider.base import IAIProvider, ProviderError
from engines.quiz.provider.prompt_builder import PromptBuilder

from .models import SmartRecognitionResult, ParsedNumericConstraint
from .rule_parser import parse_numeric_instruction

logger = logging.getLogger("engines.quiz.recognition.range_resolver")


def _find_page_by_question_number(doc_reps: list[PageRepresentation], q_num: int) -> Optional[int]:
    """Finds the 1-based page number containing the specified question candidate number."""
    import re
    # 1. Search candidate records
    for rep in doc_reps:
        for cand in rep.candidates:
            if cand.candidate_number == q_num:
                return rep.page_number

    # 2. Search raw text regex fallback
    pat = re.compile(rf"(?:(?:Câu|Bài|Question)\s*{q_num}\b|(?:\n|^)\s*{q_num}[\.\:\)])", re.IGNORECASE)
    for rep in doc_reps:
        if pat.search(rep.raw_text):
            return rep.page_number
    return None


def resolve_smart_range(
    instruction: str,
    doc_reps: list[PageRepresentation],
    ai_provider: Optional[IAIProvider] = None,
    max_page_traversal: int = 50
) -> SmartRecognitionResult:
    """
    Resolves start_page, end_page, start_question, and question_count based on user instruction.
    1. Fast Path: Parses numeric constraints via regex.
    2. Inspects page representations to deterministically expand the page range.
    3. Fallback: Invokes AI provider only if natural language is ambiguous or candidates are absent.
    """
    import re
    total_pages = len(doc_reps) if doc_reps else 1
    warnings: list[str] = []

    # Map page_number (1-based) to PageRepresentation
    page_map: dict[int, PageRepresentation] = {
        rep.page_number: rep for rep in doc_reps
    }

    # Step 1: Deterministic Regex Parsing (Fast Path)
    parsed = parse_numeric_instruction(instruction)

    # Step 2: If instruction is not parseable by regex, invoke AI Fallback
    if parsed is None:
        if ai_provider is not None:
            try:
                ai_result = _resolve_with_ai(instruction, doc_reps, ai_provider)
                # Clamp AI page bounds to actual document limits
                ai_start_p = max(1, min(ai_result.start_page, total_pages))
                ai_end_p = max(ai_start_p, min(ai_result.end_page, total_pages))
                return SmartRecognitionResult(
                    start_page=ai_start_p,
                    end_page=ai_end_p,
                    start_question=max(1, ai_result.start_question),
                    question_count=max(1, ai_result.question_count),
                    question_mode="ai_resolved",
                    confidence=min(0.95, ai_result.confidence),
                    warnings=ai_result.warnings
                )
            except Exception as ex:
                logger.warning(f"AI range resolution failed: {ex}. Falling back to default range.")
                warnings.append(f"Không thể giải nghĩa tự động chỉ dẫn: {ex}")

        # Default fallback if AI unavailable or failed
        return SmartRecognitionResult(
            start_page=1,
            end_page=min(total_pages, 3),
            start_question=1,
            question_count=10,
            question_mode="auto",
            confidence=0.5,
            warnings=["Chỉ dẫn không chứa thông tin số hợp lệ. Mặc định lấy từ trang 1 đến 3."]
        )

    # Step 3: Fast Path Execution with Candidate Inspection
    start_p = parsed.start_page
    if parsed.start_question is not None:
        start_q = parsed.start_question
        found_p = _find_page_by_question_number(doc_reps, start_q)
        if start_p is None:
            start_p = found_p if found_p is not None else 1
        elif found_p is not None:
            # Check if the requested start_page actually contains start_q
            start_p_rep = page_map.get(start_p)
            has_start_q = False
            if start_p_rep:
                has_start_q = any(c.candidate_number == start_q for c in start_p_rep.candidates) or bool(
                    re.search(rf"(?:(?:Câu|Bài|Question)\s*{start_q}\b|(?:\n|^)\s*{start_q}[\.\:\)])", start_p_rep.raw_text, re.IGNORECASE)
                )
            if not has_start_q:
                # Canonical question identity mandate: align start_p with where start_q actually lives
                logger.info(f"Aligning start_page from {start_p} to {found_p} to match canonical question {start_q}")
                start_p = found_p
    else:
        if start_p is None:
            start_p = 1
        start_p_rep = page_map.get(start_p)
        if start_p_rep and start_p_rep.candidates:
            start_q = start_p_rep.candidates[0].candidate_number
        else:
            start_q = 1

    requested_count = parsed.question_count

    # Clamp start_page to document range
    start_p = max(1, min(start_p, total_pages))

    # Case A: User explicitly provided both start_page and end_page
    if parsed.end_page is not None:
        end_p = max(start_p, min(parsed.end_page, total_pages))

        # Check continuation beyond end_p to preserve trailing options (BUG #3)
        if end_p < total_pages:
            rep_end = page_map.get(end_p)
            rep_next = page_map.get(end_p + 1)
            if rep_end and rep_next and detect_continuation_candidate(rep_end, rep_next):
                end_p = min(total_pages, end_p + 1)

        # If count was not explicitly specified, count candidate questions across [start_p .. end_p]
        if requested_count is None:
            total_detected = 0
            for p in range(start_p, end_p + 1):
                rep = page_map.get(p)
                if rep:
                    total_detected += len(rep.candidates)
            resolved_count = max(1, total_detected) if total_detected > 0 else 10
        else:
            resolved_count = requested_count

        return SmartRecognitionResult(
            start_page=start_p,
            end_page=end_p,
            start_question=start_q,
            question_count=resolved_count,
            question_mode="explicit" if parsed.question_count is not None else "auto",
            confidence=1.0,
            warnings=warnings
        )

    # Case B: User specified start_page and question_count -> Dynamic Expansion
    if requested_count is not None:
        target_count = requested_count
        accumulated_count = 0
        curr_p = start_p
        traversal_limit = min(total_pages, start_p + max_page_traversal - 1)

        while curr_p <= traversal_limit:
            rep = page_map.get(curr_p)
            if rep and rep.candidates:
                # Filter candidates >= start_q if on start_page
                valid_candidates = [
                    c for c in rep.candidates
                    if curr_p > start_p or c.candidate_number >= start_q
                ]
                accumulated_count += len(valid_candidates)
            else:
                # If page has no detected candidates, estimate 5 questions per page
                accumulated_count += 5

            if accumulated_count >= target_count:
                # Check continuation onto the next page
                next_rep = page_map.get(curr_p + 1)
                if rep and next_rep and detect_continuation_candidate(rep, next_rep):
                    # Expand one page to include the continued question options (BUG #3)
                    curr_p = min(total_pages, curr_p + 1)
                break

            curr_p += 1

        end_p = min(total_pages, max(start_p, curr_p))
        if accumulated_count < target_count:
            warnings.append(
                f"Tài liệu chỉ tìm thấy xấp xỉ {accumulated_count} câu hỏi trong dải trang được duyệt."
            )

        return SmartRecognitionResult(
            start_page=start_p,
            end_page=end_p,
            start_question=start_q,
            question_count=target_count,
            question_mode="auto",
            confidence=1.0,
            warnings=warnings
        )

    # Case C: Single page specified with no count (e.g. "Trang 11")
    rep = page_map.get(start_p)
    detected_on_page = len(rep.candidates) if rep and rep.candidates else 10

    return SmartRecognitionResult(
        start_page=start_p,
        end_page=start_p,
        start_question=start_q,
        question_count=max(1, detected_on_page),
        question_mode="auto",
        confidence=1.0,
        warnings=warnings
    )


def _resolve_with_ai(
    instruction: str,
    doc_reps: list[PageRepresentation],
    ai_provider: IAIProvider
) -> SmartRecognitionResult:
    """Helper invoking AgnesAIProvider when user instruction is ambiguous."""
    page_summaries = [
        {
            "page": rep.page_number,
            "char_count": rep.character_count,
            "kind": rep.page_kind.value,
            "candidates": [c.candidate_number for c in rep.candidates]
        }
        for rep in doc_reps[:20]  # First 20 pages summary
    ]

    prompt_builder = (
        PromptBuilder()
        .set_role("Expert Vietnamese Examination Range Resolver")
        .set_task("Analyze user instructions and document metadata to determine start page, end page, start question, and count.")
        .set_input({
            "instruction": instruction,
            "total_pages": len(doc_reps),
            "page_summaries": page_summaries
        })
        .add_rule("Never pick start_page less than 1 or greater than total_pages.")
        .add_rule("Provide reasonable start_question and question_count.")
        .set_schema(SmartRecognitionResult)
        .set_uncertainty_policy("If ambiguous, set confidence below 0.9 and add explanatory warnings.")
    )

    full_prompt = prompt_builder.build()
    return ai_provider.generate_structured(
        task_name="smart_range_resolver",
        user_prompt=full_prompt,
        system_prompt="You are a precise document range resolver. Respond with JSON matching the schema.",
        schema=SmartRecognitionResult,
        temperature=0.0
    )
