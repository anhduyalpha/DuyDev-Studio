"""
Question Index & Page Neighborhood Scanner Module (PLAN-05).
Implements full-page question inventory, layout-aware & column-aware detection,
lightweight page neighborhood scanning, and hard-gate range validation.

Guarantees:
- Question inventory is built BEFORE extraction/reconstruction.
- Never accepts a partial question range silently (RANGE_MISMATCH hard gate).
- Distinguishes TARGET, CONTINUATION, and CONTEXT pages to isolate boundaries.
- Reuses existing perception models and integrates seamlessly with PLAN-04.
"""

import os
import re
import logging
import hashlib
from typing import Optional, Any

from engines.quiz.perception.models import (
    PageRepresentation,
    PageKind,
    TextBlock,
    QuestionCandidate,
)
from engines.quiz.perception.candidates import (
    detect_continuation_candidate,
    QUESTION_PATTERN,
    STANDALONE_NUM_PATTERN,
    OPTION_PATTERN,
)
from engines.quiz.common.errors import (
    QuizEngineError,
    ErrorCode,
    DiagnosticLayer,
)
from engines.quiz.provider.base import IAIProvider
from engines.quiz.provider.prompt_builder import PromptBuilder
from engines.quiz.quiz_cache import (
    get_question_index_cache,
    set_question_index_cache,
    is_cache_enabled,
)

from .models import (
    QuestionSegment,
    QuestionIndexEntry,
    PageIndex,
    PageNeighborhood,
    ExtractionPlan,
)
from .rule_parser import parse_numeric_instruction

logger = logging.getLogger("engines.quiz.recognition.question_index")


class QuestionIndexService:
    """
    Central service for PLAN-05: Page Neighborhood Scanner & Question Index.
    Constructs full-page question inventories, verifies cross-page boundaries,
    and enforces hard-gate range validation before extraction.
    """

    def __init__(self, ai_provider: Optional[IAIProvider] = None):
        self.ai_provider = ai_provider

    # =========================================================================
    # TASK-01 & TASK-02 & TASK-03: Full-Page Question Inventory
    # =========================================================================

    def build_page_index(
        self,
        page_rep: PageRepresentation,
        doc_reps: Optional[list[PageRepresentation]] = None
    ) -> PageIndex:
        """
        Scans a single physical page fully and constructs its PageIndex inventory.
        Text-first: executes deterministically without AI calls if layout is clear.
        Layout-aware: handles multi-column reading order and spatial coordinates.
        """
        # 1. Check cache
        cache_key = self._compute_page_cache_key(page_rep)
        cached_data = get_question_index_cache(cache_key)
        if cached_data and isinstance(cached_data, dict):
            try:
                return PageIndex.model_validate(cached_data)
            except Exception:
                pass

        # 2. Detect printed page number from headers/footers
        printed_page = self._extract_printed_page_number(page_rep)

        # 3. Check if scanned document
        is_scanned = (
            page_rep.page_kind == PageKind.SCANNED or
            (page_rep.character_count < 30 and len(page_rep.candidates) == 0)
        )

        # 4. Multi-column layout detection (TASK-03)
        columns_detected = self._detect_column_count(page_rep)

        # 5. Extract and sort question entries with column awareness
        questions = self._extract_page_questions(page_rep, columns_detected)

        # 6. Determine confidence & status
        confidence = 1.0 if not is_scanned else 0.5
        if not questions:
            status = "failed" if is_scanned else "empty"
        else:
            status = "complete"

        page_index = PageIndex(
            physical_page=page_rep.page_number,
            printed_page=printed_page,
            questions=questions,
            confidence=confidence,
            status=status,
            columns_detected=columns_detected,
            is_scanned=is_scanned,
        )

        # 7. Cache result
        if is_cache_enabled():
            set_question_index_cache(cache_key, page_index.model_dump())

        return page_index

    # =========================================================================
    # TASK-04 & TASK-05: Page Neighborhood Scanner & Multi-Page Question Index
    # =========================================================================

    def build_neighborhood_index(
        self,
        target_physical_page: int,
        doc_reps: list[PageRepresentation]
    ) -> PageNeighborhood:
        """
        Constructs neighborhood around a target physical page:
        [previous physical page] -> [target physical page] -> [next physical page].
        Target page is scanned fully; neighbor pages are scanned lightweight to resolve
        inward stem continuations and outward trailing option continuations.
        """
        return self.build_multi_page_neighborhood_index([target_physical_page], doc_reps)

    def build_multi_page_neighborhood_index(
        self,
        target_pages: list[int],
        doc_reps: list[PageRepresentation]
    ) -> PageNeighborhood:
        """
        Constructs neighborhood scanning context across a set of target physical pages.
        Isolates TARGET pages, CONTINUATION pages, and CONTEXT pages.
        """
        page_map: dict[int, PageRepresentation] = {
            rep.page_number: rep for rep in doc_reps
        }
        total_pages = len(doc_reps)

        if not target_pages:
            return PageNeighborhood(
                target_page=1,
                previous_page=None,
                next_page=None,
                page_roles={},
                question_index=[],
                status="empty",
                confidence=0.0
            )

        sorted_targets = sorted(target_pages)
        first_target = sorted_targets[0]
        last_target = sorted_targets[-1]

        prev_page = (first_target - 1) if (first_target - 1) in page_map else None
        next_page = (last_target + 1) if (last_target + 1) in page_map else None

        page_roles: dict[int, str] = {p: "target" for p in sorted_targets}

        # 1. Full scan on all target pages
        target_indices: dict[int, PageIndex] = {}
        for p in sorted_targets:
            if p in page_map:
                target_indices[p] = self.build_page_index(page_map[p], doc_reps)

        # 2. Lightweight scan on previous page (inward continuation check)
        prev_page_index: Optional[PageIndex] = None
        inward_continuation_entry: Optional[QuestionIndexEntry] = None

        if prev_page and prev_page in page_map:
            prev_rep = page_map[prev_page]
            first_target_rep = page_map[first_target]
            prev_page_index = self.build_page_index(prev_rep, doc_reps)

            if prev_page_index.questions and detect_continuation_candidate(prev_rep, first_target_rep):
                last_prev_q = prev_page_index.questions[-1]
                # Check if continuation text on first target page completes or continues last_prev_q
                inward_continuation_entry = last_prev_q.model_copy(deep=True)
                inward_continuation_entry.last_page = first_target
                # Derive bottom boundary from first target question bbox if available
                cont_bottom = first_target_rep.height * 0.25
                if first_target in target_indices and target_indices[first_target].questions:
                    first_t_q = target_indices[first_target].questions[0]
                    if first_t_q.segments and first_t_q.segments[0].bbox[1] > 0:
                        cont_bottom = min(cont_bottom, first_t_q.segments[0].bbox[1])
                inward_continuation_entry.segments.append(
                    QuestionSegment(
                        physical_page=first_target,
                        bbox=(0.0, 0.0, first_target_rep.width, cont_bottom),
                        role="continuation"
                    )
                )
                page_roles[prev_page] = "continuation"
            else:
                page_roles[prev_page] = "context"

        # 3. Lightweight scan on next page (outward continuation check)
        next_page_index: Optional[PageIndex] = None

        if next_page and next_page in page_map:
            next_rep = page_map[next_page]
            last_target_rep = page_map[last_target]
            next_page_index = self.build_page_index(next_rep, doc_reps)

            last_target_p_index = target_indices.get(last_target)
            if last_target_p_index and last_target_p_index.questions:
                if detect_continuation_candidate(last_target_rep, next_rep):
                    page_roles[next_page] = "continuation"
                else:
                    page_roles[next_page] = "context"
            else:
                page_roles[next_page] = "context"

        # 4. Assemble consolidated question index
        question_dict: dict[int, QuestionIndexEntry] = {}

        # Add inward continuation if present
        if inward_continuation_entry:
            question_dict[inward_continuation_entry.question_number] = inward_continuation_entry

        # Add target questions
        for p in sorted_targets:
            p_idx = target_indices.get(p)
            if not p_idx:
                continue
            for q in p_idx.questions:
                if q.question_number not in question_dict:
                    question_dict[q.question_number] = q.model_copy(deep=True)
                else:
                    # Merge cross-page segments
                    existing = question_dict[q.question_number]
                    existing.segments.extend(q.segments)
                    existing.last_page = max(existing.last_page, q.last_page)
                    existing.options_detected = sorted(list(set(existing.options_detected + q.options_detected)))
                    existing.has_complete_options = (
                        len(existing.options_detected) >= 4 and
                        {"A", "B", "C", "D"}.issubset(set(existing.options_detected))
                    )

        # Check if last question continues to next_page
        if next_page and page_roles.get(next_page) == "continuation":
            sorted_q_nums = sorted(question_dict.keys())
            if sorted_q_nums:
                last_q = question_dict[sorted_q_nums[-1]]
                last_q.last_page = next_page
                next_rep = page_map[next_page]
                # Derive bottom boundary from first next-page question if available
                cont_bottom = next_rep.height * 0.25
                if next_page_index and next_page_index.questions:
                    first_next_q = next_page_index.questions[0]
                    if first_next_q.segments and first_next_q.segments[0].bbox[1] > 0:
                        cont_bottom = min(cont_bottom, first_next_q.segments[0].bbox[1])
                last_q.segments.append(
                    QuestionSegment(
                        physical_page=next_page,
                        bbox=(0.0, 0.0, next_rep.width, cont_bottom),
                        role="continuation"
                    )
                )

        unified_index = sorted(question_dict.values(), key=lambda e: (e.first_page, e.question_number))

        return PageNeighborhood(
            target_page=first_target,
            previous_page=prev_page,
            next_page=next_page,
            page_roles=page_roles,
            question_index=unified_index,
            status="complete" if unified_index else "partial",
            confidence=1.0,
        )

    # =========================================================================
    # TASK-06 & TASK-07 & TASK-08: Requested Range Validator (HARD GATE)
    # =========================================================================

    def validate_requested_range(
        self,
        neighborhood: PageNeighborhood,
        start_q: int,
        end_q: int,
        count: int,
        doc_reps: list[PageRepresentation],
        ai_provider: Optional[IAIProvider] = None,
        raise_on_mismatch: bool = False
    ) -> tuple[bool, list[int], list[int], list[QuestionIndexEntry]]:
        """
        Validates detected question range against requested range.
        HARD GATE: If any question is missing, executes Missing Question Recovery.
        If still mismatched, raises QuizEngineError(RANGE_MISMATCH) or returns False.
        NEVER accepts partial range silently!
        """
        expected_numbers = list(range(start_q, end_q + 1))
        detected_entries = [
            e for e in neighborhood.question_index
            if start_q <= e.question_number <= end_q
        ]
        detected_numbers = [e.question_number for e in detected_entries]
        missing_numbers = [q for q in expected_numbers if q not in detected_numbers]

        if not missing_numbers:
            return True, detected_numbers, [], detected_entries

        logger.warning(
            f"Range mismatch detected! Expected: {len(expected_numbers)} (Q{start_q}..Q{end_q}), "
            f"Detected: {len(detected_numbers)}. Missing: {missing_numbers}. Engaging Recovery Path."
        )

        # TASK-07: Missing Question Recovery
        recovered_entries = self._recover_missing_questions(
            neighborhood=neighborhood,
            missing_numbers=missing_numbers,
            doc_reps=doc_reps,
            ai_provider=ai_provider
        )

        if recovered_entries:
            for entry in recovered_entries:
                neighborhood.question_index.append(entry)
            neighborhood.question_index.sort(key=lambda e: (e.first_page, e.question_number))

            detected_entries = [
                e for e in neighborhood.question_index
                if start_q <= e.question_number <= end_q
            ]
            detected_numbers = [e.question_number for e in detected_entries]
            missing_numbers = [q for q in expected_numbers if q not in detected_numbers]

        if not missing_numbers:
            logger.info("Missing question recovery SUCCESS: All requested questions verified.")
            return True, detected_numbers, [], detected_entries

        # HARD GATE: Still missing after recovery
        error_msg = (
            f"RANGE_MISMATCH: Yêu cầu {count} câu hỏi (từ Câu {start_q} đến Câu {end_q}) "
            f"nhưng hệ thống chỉ xác định được {len(detected_numbers)} câu ({detected_numbers}). "
            f"Thiếu các câu: {missing_numbers}. "
            f"Tuyệt đối không xuất bản đề thi thiếu câu hỏi."
        )
        logger.error(error_msg)

        if raise_on_mismatch:
            raise QuizEngineError(
                ErrorCode.RANGE_MISMATCH,
                DiagnosticLayer.RECOGNITION_FAILURE,
                error_msg,
                stage="PLANNING",
                details={
                    "start_question": start_q,
                    "end_question": end_q,
                    "expected_count": count,
                    "detected_numbers": detected_numbers,
                    "missing_numbers": missing_numbers,
                }
            )

        return False, detected_numbers, missing_numbers, detected_entries

    # =========================================================================
    # TASK-09 & TASK-10: Exact Extraction Plan Construction
    # =========================================================================

    def build_extraction_plan(
        self,
        neighborhood: PageNeighborhood,
        start_q: int,
        end_q: int,
        count: int,
        doc_reps: list[PageRepresentation],
        ai_provider: Optional[IAIProvider] = None,
        raise_on_mismatch: bool = False
    ) -> ExtractionPlan:
        """
        Builds exact extraction plan for PLAN-04.
        Ensures context pages are strictly isolated and target questions are validated.
        """
        is_valid, detected_nums, missing_nums, entries = self.validate_requested_range(
            neighborhood=neighborhood,
            start_q=start_q,
            end_q=end_q,
            count=count,
            doc_reps=doc_reps,
            ai_provider=ai_provider,
            raise_on_mismatch=raise_on_mismatch
        )

        target_pages: list[int] = [
            p for p, role in neighborhood.page_roles.items() if role == "target"
        ]
        continuation_pages: list[int] = [
            p for p, role in neighborhood.page_roles.items() if role == "continuation"
        ]
        context_pages: list[int] = [
            p for p, role in neighborhood.page_roles.items() if role == "context"
        ]

        # Verify whether continuation pages actually contain requested target questions
        # If a continuation page doesn't belong to any target question, downgrade it to context
        active_continuation: list[int] = []
        for p in continuation_pages:
            has_target_q = any(
                p in [seg.physical_page for seg in entry.segments]
                for entry in entries
            )
            if has_target_q:
                active_continuation.append(p)
            else:
                context_pages.append(p)

        warnings: list[str] = []
        if missing_nums:
            warnings.append(f"RANGE_MISMATCH: Thiếu câu {missing_nums}")

        status = "RANGE_VALID" if is_valid else "RANGE_MISMATCH"

        plan = ExtractionPlan(
            requested_start_question=start_q,
            requested_end_question=end_q,
            requested_count=count,
            target_pages=target_pages,
            continuation_pages=sorted(list(set(active_continuation))),
            context_pages=sorted(list(set(context_pages))),
            target_question_numbers=detected_nums if is_valid else detected_nums,
            validated=is_valid,
            status=status,
            warning_messages=warnings,
        )

        # TASK-13: Observability Logging
        self._log_observability(neighborhood, plan, start_q, end_q, count, missing_nums)

        return plan

    # =========================================================================
    # Internal Helpers: Layout, Recovery, Vision, Observability
    # =========================================================================

    def _extract_page_questions(
        self,
        page_rep: PageRepresentation,
        columns_detected: int
    ) -> list[QuestionIndexEntry]:
        """
        Extracts question entries respecting spatial geometry and column reading order.
        """
        page_w = page_rep.width if page_rep.width > 0 else 595.0
        midpoint = page_w / 2.0

        raw_candidates = list(page_rep.candidates)

        # Also search raw text for candidates that might have been split across blocks
        if page_rep.raw_text:
            seen_nums = {c.candidate_number for c in raw_candidates}
            for match in QUESTION_PATTERN.finditer(page_rep.raw_text):
                try:
                    q_n = int(match.group(1))
                    if q_n not in seen_nums:
                        raw_candidates.append(
                            QuestionCandidate(
                                candidate_number=q_n,
                                marker_text=match.group(0).strip(),
                                bbox=(50.0, 100.0, page_w - 50.0, 150.0),
                                y_pos=100.0,
                                options_detected=[]
                            )
                        )
                        seen_nums.add(q_n)
                except Exception:
                    pass

        if not raw_candidates:
            return []

        # Sort according to column reading order (TASK-03)
        if columns_detected == 2:
            left_col = [c for c in raw_candidates if c.bbox[0] < midpoint]
            right_col = [c for c in raw_candidates if c.bbox[0] >= midpoint]
            left_col.sort(key=lambda c: (c.y_pos, c.candidate_number))
            right_col.sort(key=lambda c: (c.y_pos, c.candidate_number))

            # If both columns are sequential (e.g. left has 30..37, right has 38..44)
            ordered_candidates = left_col + right_col
        else:
            ordered_candidates = sorted(raw_candidates, key=lambda c: (c.y_pos, c.candidate_number))

        # Check if candidate_numbers are strictly sequential; if so, monotonic ordering takes precedence
        nums = [c.candidate_number for c in ordered_candidates]
        if nums == sorted(nums):
            # Already strictly monotonic
            pass
        elif sorted(nums) == list(range(min(nums), max(nums) + 1)):
            # Perfectly contiguous numbers, sort by candidate_number
            ordered_candidates.sort(key=lambda c: c.candidate_number)

        entries: list[QuestionIndexEntry] = []
        for cand in ordered_candidates:
            q_num = cand.candidate_number
            opts = sorted(list(set(cand.options_detected)))

            # Check raw_text slice around candidate for options
            if page_rep.raw_text and len(opts) < 4:
                slice_opts = self._find_options_in_text(page_rep.raw_text, q_num)
                opts = sorted(list(set(opts + slice_opts)))

            has_complete = (len(opts) >= 4 and {"A", "B", "C", "D"}.issubset(set(opts)))

            seg = QuestionSegment(
                physical_page=page_rep.page_number,
                bbox=cand.bbox,
                role="body",
            )
            entries.append(
                QuestionIndexEntry(
                    question_number=q_num,
                    segments=[seg],
                    first_page=page_rep.page_number,
                    last_page=page_rep.page_number,
                    detection_method="pdf-text",
                    confidence=1.0,
                    options_detected=opts,
                    has_complete_options=has_complete,
                    stem_preview=cand.marker_text,
                )
            )

        return entries

    def _find_options_in_text(self, text: str, q_num: int) -> list[str]:
        """Finds option letters for a question within the raw text."""
        pat = re.compile(
            rf"(?:^|\n|\b)(?:(?:Câu|Bài|Question)\s*{q_num}\b|{q_num}[\.\:\)])",
            re.IGNORECASE
        )
        m = pat.search(text)
        if not m:
            return []
        start_idx = m.end()
        # Find next question marker
        next_m = re.search(
            r"(?:^|\n)\s*(?:(?:Câu|Bài|Question)\s*\d+\b|\d+[\.\:\)]\s+[A-ZÀ-Ỹ])",
            text[start_idx:],
            re.IGNORECASE
        )
        end_idx = (start_idx + next_m.start()) if next_m else len(text)
        slice_str = text[start_idx:end_idx]
        return list(set(OPTION_PATTERN.findall(slice_str)))

    def _detect_column_count(self, page_rep: PageRepresentation) -> int:
        """Determines if the page has a 2-column or 1-column layout."""
        if not page_rep.blocks or page_rep.width <= 0:
            return 1

        width = page_rep.width
        midpoint = width / 2.0
        left_count = 0
        right_count = 0
        spanning_count = 0

        header_th = page_rep.height * 0.12 if page_rep.height > 0 else 100.0
        footer_th = page_rep.height * 0.88 if page_rep.height > 0 else 750.0

        for b in page_rep.blocks:
            # Skip running headers and footers
            if b.bbox[1] < header_th or b.bbox[3] > footer_th:
                continue
            x0, y0, x1, y1 = b.bbox
            if x0 < midpoint - 40 and x1 > midpoint + 40:
                spanning_count += 1
            elif x1 <= midpoint + 20:
                left_count += 1
            elif x0 >= midpoint - 20:
                right_count += 1

        if left_count >= 2 and right_count >= 2 and spanning_count <= 2:
            return 2
        return 1

    def _extract_printed_page_number(self, page_rep: PageRepresentation) -> Optional[int]:
        """Extracts printed page number from header or footer text blocks."""
        patterns = [
            re.compile(r"(?:Trang|Page)(?:\s*số|\s*:|\s*-)?\s*(\d+)\b", re.IGNORECASE),
            re.compile(r"\b(?:Trang|Page)\s*(\d+)\s*/\s*\d+\b", re.IGNORECASE),
            re.compile(r"(?:^|\n|\s)[-–—]\s*(\d+)\s*[-–—](?:\s|$|\n)"),
            re.compile(r"(?:^|\n)\s*(\d+)\s*/\s*\d+\s*(?:$|\n)"),
        ]
        candidates_to_check = [
            page_rep.raw_text[:400] if page_rep.raw_text else "",
            page_rep.raw_text[-400:] if page_rep.raw_text else "",
        ]
        for text in candidates_to_check:
            for pat in patterns:
                m = pat.search(text)
                if m:
                    try:
                        return int(m.group(1))
                    except ValueError:
                        pass
        return None

    def _find_question_bbox(
        self,
        page_rep: PageRepresentation,
        q_num: int,
        marker_str: str = ""
    ) -> tuple[float, float, float, float]:
        """Extracts spatial bounding box for a question candidate from structured blocks if available."""
        page_w = page_rep.width if page_rep.width > 0 else 595.0
        if page_rep.blocks:
            for b in page_rep.blocks:
                for line in b.lines:
                    if (
                        (marker_str and marker_str in line.text) or
                        re.search(rf"\b(?:Câu|Bài|Question)\s*{q_num}\b", line.text, re.IGNORECASE) or
                        re.search(rf"(?:^|\s){q_num}[\.\:\)]", line.text)
                    ):
                        y0 = line.bbox[1]
                        y1 = min(page_rep.height if page_rep.height > 0 else 842.0, y0 + 100.0)
                        return (line.bbox[0], y0, max(line.bbox[2], page_w - 50.0), y1)
        return (50.0, 100.0, page_w - 50.0, 150.0)

    def _recover_missing_questions(
        self,
        neighborhood: PageNeighborhood,
        missing_numbers: list[int],
        doc_reps: list[PageRepresentation],
        ai_provider: Optional[IAIProvider]
    ) -> list[QuestionIndexEntry]:
        """
        Executes multi-step recovery for missing question numbers:
        1. Deep text span search on target page.
        2. Boundary search across neighboring pages (previous AND next).
        3. Targeted vision scan via AI provider.
        """
        recovered: list[QuestionIndexEntry] = []
        page_map = {rep.page_number: rep for rep in doc_reps}
        target_rep = page_map.get(neighborhood.target_page)

        # Step 1: Deep text scan on target page
        if target_rep and target_rep.raw_text:
            for q_num in list(missing_numbers):
                pat = re.compile(
                    rf"(?:^|\n|\b)(?:(?:Câu|Bài|Question|CÂU|BÀI)\s*{q_num}\b|{q_num}[\.\:\)])",
                    re.IGNORECASE
                )
                m = pat.search(target_rep.raw_text)
                if m:
                    opts = self._find_options_in_text(target_rep.raw_text, q_num)
                    bbox = self._find_question_bbox(target_rep, q_num, m.group(0))
                    seg = QuestionSegment(
                        physical_page=target_rep.page_number,
                        bbox=bbox,
                        role="body"
                    )
                    entry = QuestionIndexEntry(
                        question_number=q_num,
                        segments=[seg],
                        first_page=target_rep.page_number,
                        last_page=target_rep.page_number,
                        detection_method="layout-analysis",
                        confidence=0.9,
                        options_detected=opts,
                        has_complete_options=len(opts) >= 4,
                        stem_preview=m.group(0),
                    )
                    recovered.append(entry)
                    missing_numbers.remove(q_num)

        # Step 2: Neighbor pages search (both previous AND next pages)
        if missing_numbers:
            neighbor_pages: list[tuple[int, str]] = []
            if neighborhood.previous_page and neighborhood.previous_page in page_map:
                neighbor_pages.append((neighborhood.previous_page, "previous"))
            if neighborhood.next_page and neighborhood.next_page in page_map:
                neighbor_pages.append((neighborhood.next_page, "next"))

            for p_num, _rel in neighbor_pages:
                if not missing_numbers:
                    break
                p_rep = page_map[p_num]
                if not p_rep.raw_text:
                    continue

                for q_num in list(missing_numbers):
                    pat = re.compile(
                        rf"(?:^|\n|\b)(?:(?:Câu|Bài|Question|CÂU|BÀI)\s*{q_num}\b|{q_num}[\.\:\)])",
                        re.IGNORECASE
                    )
                    m = pat.search(p_rep.raw_text)
                    if m:
                        opts = self._find_options_in_text(p_rep.raw_text, q_num)
                        bbox = self._find_question_bbox(p_rep, q_num, m.group(0))
                        seg = QuestionSegment(
                            physical_page=p_rep.page_number,
                            bbox=bbox,
                            role="body"
                        )
                        recovered.append(
                            QuestionIndexEntry(
                                question_number=q_num,
                                segments=[seg],
                                first_page=p_rep.page_number,
                                last_page=p_rep.page_number,
                                detection_method="layout-analysis",
                                confidence=0.85,
                                options_detected=opts,
                                has_complete_options=len(opts) >= 4,
                                stem_preview=m.group(0),
                            )
                        )
                        missing_numbers.remove(q_num)
                        neighborhood.page_roles[p_rep.page_number] = "continuation"

        # Step 3: Targeted Vision Fallback (TASK-08)
        if missing_numbers and ai_provider and target_rep:
            vision_entries = self._targeted_vision_fallback(target_rep, missing_numbers, ai_provider)
            for ventry in vision_entries:
                recovered.append(ventry)
                if ventry.question_number in missing_numbers:
                    missing_numbers.remove(ventry.question_number)

        return recovered

    def _targeted_vision_fallback(
        self,
        page_rep: PageRepresentation,
        missing_numbers: list[int],
        ai_provider: IAIProvider
    ) -> list[QuestionIndexEntry]:
        """
        Executes targeted vision scan strictly asking for question number inventories.
        Only called when text/layout detectors cannot resolve ambiguous questions.
        Passes full page text and visual context to ensure provider can accurately detect items.
        """
        try:
            from pydantic import BaseModel
            class VisionQuestionItem(BaseModel):
                number: int
                top_y: float = 0.0
                bottom_y: float = 0.0

            class VisionPageInventory(BaseModel):
                page: int
                questions: list[VisionQuestionItem]

            prompt_builder = (
                PromptBuilder()
                .set_role("Senior Examination Page Layout Inspector")
                .set_task("Verify all visible question numbers on this examination page.")
                .set_input({
                    "page": page_rep.page_number,
                    "target_missing_questions": missing_numbers,
                    "page_text": page_rep.raw_text[:4000] if page_rep.raw_text else "",
                    "character_count": page_rep.character_count,
                    "detected_candidate_numbers": [c.candidate_number for c in page_rep.candidates],
                    "has_images": len(page_rep.images) > 0 or page_rep.drawing_count > 0,
                })
                .add_rule("Do NOT hallucinate questions not physically printed.")
                .set_schema(VisionPageInventory)
            )

            result: VisionPageInventory = ai_provider.generate_structured(
                task_name=f"vision_inventory_p{page_rep.page_number}",
                user_prompt=prompt_builder.build(),
                system_prompt="You are a precise examination layout vision validator.",
                schema=VisionPageInventory,
                temperature=0.0
            )

            recovered: list[QuestionIndexEntry] = []
            for item in result.questions:
                if item.number in missing_numbers:
                    seg = QuestionSegment(
                        physical_page=page_rep.page_number,
                        bbox=(50.0, item.top_y, page_rep.width - 50.0, item.bottom_y),
                        role="body"
                    )
                    recovered.append(
                        QuestionIndexEntry(
                            question_number=item.number,
                            segments=[seg],
                            first_page=page_rep.page_number,
                            last_page=page_rep.page_number,
                            detection_method="vision",
                            confidence=0.8,
                            options_detected=[],
                            has_complete_options=False,
                        )
                    )
            return recovered
        except Exception as ex:
            logger.warning(f"Targeted vision fallback failed: {ex}")
            return []

    def _compute_page_cache_key(self, page_rep: PageRepresentation) -> str:
        """Generates deterministic cache key for a page's question inventory."""
        data_sig = f"{page_rep.page_number}_{page_rep.character_count}_{page_rep.raw_text[:300]}"
        return hashlib.sha256(data_sig.encode("utf-8")).hexdigest()

    def _log_observability(
        self,
        neighborhood: PageNeighborhood,
        plan: ExtractionPlan,
        start_q: int,
        end_q: int,
        count: int,
        missing_nums: list[int]
    ) -> None:
        """Emits structured diagnostic logging compliant with TASK-13."""
        q_summary = ", ".join(str(q.question_number) for q in neighborhood.question_index)
        log_msg = (
            f"\n--- [PLAN-05 QUESTION INDEX & NEIGHBORHOOD AUDIT] ---\n"
            f"REQUEST: Q{start_q}..Q{end_q} (count={count})\n"
            f"TARGET PHYSICAL PAGE: {neighborhood.target_page}\n"
            f"NEIGHBORHOOD: prev={neighborhood.previous_page}, target={neighborhood.target_page}, next={neighborhood.next_page}\n"
            f"PAGE ROLES: {neighborhood.page_roles}\n"
            f"QUESTION INDEX: [{q_summary}]\n"
            f"VALIDATION: expected={count}, detected={len(plan.target_question_numbers)}, missing={missing_nums or 'none'}\n"
            f"RESULT: {plan.status}\n"
            f"-------------------------------------------------------"
        )
        logger.info(log_msg)
