"""
Adaptive Batch Planner Module
Calculates dynamic batch sizes based on document content density (text, formulas, visuals, scans)
and packages batch payloads with neighboring page context for seamless cross-page stitching.
"""

import re
from typing import Optional
from engines.quiz.perception.models import PageRepresentation, PageKind
from engines.quiz.perception.candidates import detect_continuation_candidate
from .models import BatchPayload

# Heuristic patterns for formula density detection
FORMULA_SYMBOLS_PATTERN = re.compile(
    r"(?:\$|\\frac|\\sqrt|\^{|_{|\\cdot|\\times|->|⇌|\b(?:mol|gam|lít|mL)\b)",
    re.IGNORECASE
)


class BatchPlanner:
    """
    Plans and partitions examination pages/questions into independent, adaptive batches.
    Complies with Global Rule 14 (No single-question AI calls) and Rule 15 (Adaptive batching).
    """

    @staticmethod
    def classify_page_complexity(page_rep: PageRepresentation) -> str:
        """
        Classifies page density to assign optimal batch capacity.
        Returns: 'scanned', 'visual_heavy', 'formula_heavy', or 'vector_text'.
        """
        if page_rep.page_kind == PageKind.SCANNED:
            return "scanned"

        if len(page_rep.images) > 0 or page_rep.drawing_count > 2 or page_rep.image_area_ratio > 0.12:
            return "visual_heavy"

        formula_count = len(FORMULA_SYMBOLS_PATTERN.findall(page_rep.raw_text))
        if formula_count >= 15:
            return "formula_heavy"

        return "vector_text"

    @classmethod
    def get_batch_capacity(cls, batch_type: str, custom_capacities: Optional[dict[str, int]] = None) -> int:
        """
        Returns recommended question capacity for a batch type:
        - text/vector: 12 (within 10-15)
        - formula-heavy: 8 (within 6-10)
        - visual-heavy: 4 (within 3-6)
        - scanned: 2 pages
        """
        capacities = {
            "vector_text": 12,
            "formula_heavy": 8,
            "visual_heavy": 4,
            "scanned": 2
        }
        if custom_capacities and batch_type in custom_capacities:
            return custom_capacities[batch_type]
        return capacities.get(batch_type, 10)

    @classmethod
    def plan_batches(
        cls,
        doc_reps: list[PageRepresentation],
        start_page: int,
        end_page: int,
        start_question: int = 1,
        question_count: Optional[int] = None,
        custom_capacities: Optional[dict[str, int]] = None
    ) -> list[BatchPayload]:
        """
        Generates structured BatchPayload items across the target page range.
        Ensures questions split across pages (N -> N+1) are stitched with neighboring context.
        """
        page_map: dict[int, PageRepresentation] = {
            rep.page_number: rep for rep in doc_reps
        }

        # Filter active pages in range [start_page .. end_page]
        active_pages: list[PageRepresentation] = [
            page_map[p] for p in range(start_page, end_page + 1)
            if p in page_map
        ]

        if not active_pages:
            return []

        # Check if entire range is scanned
        is_scanned_range = any(p.page_kind == PageKind.SCANNED for p in active_pages)

        batches: list[BatchPayload] = []

        if is_scanned_range:
            # Plan by pages (2-4 pages per batch)
            page_chunk_size = cls.get_batch_capacity("scanned", custom_capacities)
            for i in range(0, len(active_pages), page_chunk_size):
                chunk = active_pages[i:i + page_chunk_size]
                chunk_page_nums = [p.page_number for p in chunk]
                chunk_text = "\n\n--- Trang Mới ---\n\n".join(p.raw_text for p in chunk)

                # Collect neighboring contexts
                prev_ctx = ""
                if chunk[0].page_number > 1 and (chunk[0].page_number - 1) in page_map:
                    prev_ctx = page_map[chunk[0].page_number - 1].raw_text[-300:]

                next_ctx = ""
                if chunk[-1].page_number + 1 in page_map:
                    next_ctx = page_map[chunk[-1].page_number + 1].raw_text[:300]

                batch_id = f"batch_scan_{i // page_chunk_size + 1}_p{chunk_page_nums[0]}-{chunk_page_nums[-1]}"
                batches.append(
                    BatchPayload(
                        batch_id=batch_id,
                        batch_type="scanned",
                        target_question_numbers=[],
                        page_indices=[p.page_index for p in chunk],
                        page_numbers=chunk_page_nums,
                        text_content=chunk_text,
                        neighboring_prev_context=prev_ctx,
                        neighboring_next_context=next_ctx,
                        has_visuals=True
                    )
                )
            return batches

        # For digital/vector documents: collect question candidates
        target_candidates: list[tuple[int, PageRepresentation]] = []
        target_end_q = (start_question + question_count - 1) if question_count else None
        for p_rep in active_pages:
            for cand in p_rep.candidates:
                if cand.candidate_number >= start_question:
                    if target_end_q is not None and cand.candidate_number > target_end_q:
                        continue
                    if question_count is None or len(target_candidates) < question_count:
                        target_candidates.append((cand.candidate_number, p_rep))

        # If candidates are empty (e.g. non-standard numbering), partition by page blocks
        if not target_candidates:
            # Fallback: group pages by text size
            for idx, p_rep in enumerate(active_pages):
                prev_ctx = page_map[p_rep.page_number - 1].raw_text[-300:] if p_rep.page_number - 1 in page_map else ""
                next_ctx = page_map[p_rep.page_number + 1].raw_text[:600] if p_rep.page_number + 1 in page_map else ""
                batch_type = cls.classify_page_complexity(p_rep)

                batches.append(
                    BatchPayload(
                        batch_id=f"batch_fallback_{idx + 1}_p{p_rep.page_number}",
                        batch_type=batch_type,
                        target_question_numbers=[],
                        page_indices=[p_rep.page_index],
                        page_numbers=[p_rep.page_number],
                        text_content=p_rep.raw_text,
                        neighboring_prev_context=prev_ctx,
                        neighboring_next_context=next_ctx,
                        has_visuals=len(p_rep.images) > 0 or p_rep.drawing_count > 0
                    )
                )
            return batches

        # Group candidates into adaptive batches
        curr_batch_cands: list[int] = []
        curr_batch_pages: set[int] = set()
        curr_type = "vector_text"

        for q_num, p_rep in target_candidates:
            p_type = cls.classify_page_complexity(p_rep)
            # Escalate batch type if a page has higher complexity
            if p_type == "visual_heavy":
                curr_type = "visual_heavy"
            elif p_type == "formula_heavy" and curr_type != "visual_heavy":
                curr_type = "formula_heavy"

            capacity = cls.get_batch_capacity(curr_type, custom_capacities)
            curr_batch_cands.append(q_num)
            curr_batch_pages.add(p_rep.page_number)

            # Check if capacity reached
            if len(curr_batch_cands) >= capacity:
                # Check continuation on page boundary to avoid splitting a split-question
                # If the last candidate in this batch continues to the next page, keep accumulating
                last_p_num = max(curr_batch_pages)
                next_p_rep = page_map.get(last_p_num + 1)
                last_p_rep = page_map.get(last_p_num)

                if last_p_rep and next_p_rep and detect_continuation_candidate(last_p_rep, next_p_rep):
                    # Continue accumulating next page's items to keep question together
                    continue

                cls._flush_batch(batches, curr_batch_cands, curr_batch_pages, curr_type, page_map)
                curr_batch_cands = []
                curr_batch_pages = set()
                curr_type = "vector_text"

        # Flush remaining candidates
        if curr_batch_cands:
            cls._flush_batch(batches, curr_batch_cands, curr_batch_pages, curr_type, page_map)

        return batches

    @classmethod
    def _flush_batch(
        cls,
        batches: list[BatchPayload],
        cands: list[int],
        page_nums: set[int],
        batch_type: str,
        page_map: dict[int, PageRepresentation]
    ) -> None:
        """Constructs and appends a single BatchPayload."""
        sorted_pages = sorted(page_nums)
        min_p = sorted_pages[0]
        max_p = sorted_pages[-1]

        # Combine text content from the pages
        text_parts = [
            f"=== TRANG {p} ===\n{page_map[p].raw_text}"
            for p in sorted_pages if p in page_map
        ]
        text_content = "\n\n".join(text_parts)

        # Context from boundary pages
        prev_ctx = ""
        if min_p > 1 and (min_p - 1) in page_map:
            prev_ctx = page_map[min_p - 1].raw_text[-300:]

        next_ctx = ""
        if (max_p + 1) in page_map:
            next_ctx = page_map[max_p + 1].raw_text[:600]

        has_vis = any(
            (len(page_map[p].images) > 0 or page_map[p].drawing_count > 0)
            for p in sorted_pages if p in page_map
        )

        batch_id = f"batch_{len(batches) + 1}_p{min_p}-{max_p}_cands{len(cands)}"
        batches.append(
            BatchPayload(
                batch_id=batch_id,
                batch_type=batch_type,
                target_question_numbers=cands,
                page_indices=[page_map[p].page_index for p in sorted_pages if p in page_map],
                page_numbers=sorted_pages,
                text_content=text_content,
                neighboring_prev_context=prev_ctx,
                neighboring_next_context=next_ctx,
                has_visuals=has_vis
            )
        )
