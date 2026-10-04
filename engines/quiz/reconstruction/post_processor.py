"""
Post-Processing Engine Module
Normalizes reconstructed questions:
1. Deduplication via SHA-1 stem hashing
2. Sequential renumbering (start_question .. start_question + N - 1)
3. Stable sorting by source page and original sequence
4. Provenance preservation
"""

import hashlib
import re
from typing import Optional
from .models import ReconstructedQuestion


def normalize_stem_for_dedup(stem: str) -> str:
    """
    Strips HTML tags, KaTeX markers, and excess whitespace to generate a canonical stem signature.
    """
    clean = re.sub(r"<[^>]+>", "", stem)
    clean = re.sub(r"[\$\s\r\n\t\.,;:\?!]", "", clean).lower()
    return clean


def post_process_questions(
    questions: list[ReconstructedQuestion],
    start_question: int = 1,
    expected_count: Optional[int] = None
) -> list[ReconstructedQuestion]:
    """
    Deduplicates, sorts, renumbers, and verifies question records.
    """
    if not questions:
        return []

    # 1. Deduplication using SHA-1 hash of canonical stem
    seen_hashes: set[str] = set()
    deduped: list[ReconstructedQuestion] = []

    for q in questions:
        canonical = normalize_stem_for_dedup(q.stem)
        stem_hash = hashlib.sha1(canonical.encode("utf-8")).hexdigest()

        if stem_hash in seen_hashes:
            continue

        seen_hashes.add(stem_hash)
        deduped.append(q)

    # 2. Stable Sort: by primary source page and original source_number
    def sort_key(q: ReconstructedQuestion):
        primary_page = q.source_pages[0] if q.source_pages else 9999
        return (primary_page, q.source_number)

    deduped.sort(key=sort_key)

    # 3. Truncate to expected_count if specified and over-collected
    if expected_count is not None and expected_count > 0:
        deduped = deduped[:expected_count]

    # 4. Sequential Renumbering and Stable ID Generation
    processed: list[ReconstructedQuestion] = []
    for idx, q in enumerate(deduped):
        seq_num = start_question + idx
        primary_page = q.source_pages[0] if q.source_pages else 1
        stem_hash = hashlib.sha1(q.stem.encode("utf-8")).hexdigest()[:8]
        stable_id = f"q_p{primary_page}_num{seq_num}_{stem_hash}"

        updated_q = q.model_copy(
            update={
                "id": stable_id,
                "number": seq_num
            }
        )
        processed.append(updated_q)

    return processed
