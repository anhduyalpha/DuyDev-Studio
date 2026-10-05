"""
Document Object Graph Implementation (TASK-02)
Constructs a unified topological and geometric graph of document blocks, candidates, and visual assets.
Implements deterministic proximity/containment association, cross-page stitching, and selective AI resolution.
"""

import logging
import re
from typing import Optional, Any
from pydantic import BaseModel

from engines.quiz.perception.models import PageRepresentation, TextBlock, QuestionCandidate
from engines.quiz.reconstruction.models import ReconstructedQuestion
from engines.quiz.assets.models import AssetRecord, AssetType
from .models import (
    ObjectType,
    AssociationRole,
    RichElementAttachment,
    GraphObject,
    AssetOwnership
)

logger = logging.getLogger("engines.quiz.graph.object_graph")


class AmbiguityCandidateChoice(BaseModel):
    selected_question_number: Optional[int] = None
    owner_question_id: Optional[str] = None
    asset_id: Optional[str] = None
    role: str = "question_figure"
    confidence: float = 0.95


class DocumentObjectGraph:
    """
    Graph maintaining geometric relationships between text blocks, visual assets, and questions.
    Provides deterministic spatial association with Agnes fallback for ambiguous boundaries.
    """

    def __init__(
        self,
        objects: list[GraphObject],
        asset_records: dict[str, AssetRecord],
        doc_reps: list[PageRepresentation]
    ) -> None:
        self.objects = objects
        self.asset_records = asset_records
        self.doc_reps = doc_reps
        self.asset_ownership: dict[str, AssetOwnership] = {}

        # Group graph objects by 1-based page number
        self.page_objects: dict[int, list[GraphObject]] = {}
        for obj in self.objects:
            self.page_objects.setdefault(obj.page, []).append(obj)

        # Sort objects per page in natural reading order (y0, then x0)
        for pno in self.page_objects:
            self.page_objects[pno].sort(key=lambda o: (o.bbox[1], o.bbox[0]))

    @classmethod
    def build(
        cls,
        doc_reps: list[PageRepresentation],
        asset_records: list[AssetRecord]
    ) -> "DocumentObjectGraph":
        """
        Builds the unified object graph from perceptual page representations and extracted assets.
        """
        objects: list[GraphObject] = []
        assets_map: dict[str, AssetRecord] = {a.asset_id: a for a in asset_records}

        for rep in doc_reps:
            pno = rep.page_number
            order_idx = 0

            # 1. Text Blocks
            for b in rep.blocks:
                objects.append(
                    GraphObject(
                        id=f"text_p{pno}_b{b.block_index}",
                        page=pno,
                        bbox=b.bbox,
                        source_order=order_idx,
                        type=ObjectType.TEXT_BLOCK,
                        content=b.text
                    )
                )
                order_idx += 1

            # 2. Question Candidates
            for c in rep.candidates:
                objects.append(
                    GraphObject(
                        id=f"cand_p{pno}_num{c.candidate_number}",
                        page=pno,
                        bbox=c.bbox,
                        source_order=order_idx,
                        type=ObjectType.QUESTION_CANDIDATE,
                        content=f"{c.marker_text} (Candidate {c.candidate_number})"
                    )
                )
                order_idx += 1

        # 3. Visual Assets
        for a in asset_records:
            obj_type = ObjectType.IMAGE_ASSET
            if a.type in (AssetType.VECTOR_REGION, AssetType.DIAGRAM_REGION):
                obj_type = ObjectType.VECTOR_REGION
            elif a.type == AssetType.TABLE_REGION:
                obj_type = ObjectType.TABLE_REGION

            objects.append(
                GraphObject(
                    id=f"obj_{a.asset_id}",
                    page=a.source_page,
                    bbox=a.bbox,
                    source_order=9999,
                    type=obj_type,
                    asset_id=a.asset_id
                )
            )

        return cls(objects, assets_map, doc_reps)

    def associate_assets_to_questions(
        self,
        questions: list[ReconstructedQuestion],
        ai_provider: Optional[Any] = None
    ) -> dict[str, list[RichElementAttachment]]:
        """
        Associates extracted rich visual assets to individual ReconstructedQuestions.
        Returns a mapping from question.id -> list of RichElementAttachment.
        Enforces that each asset has an explicit owner and that questions only receive
        assets whose owner_question_id matches the question ID.
        """
        if not self.asset_records:
            return {}

        attachments_map: dict[str, list[RichElementAttachment]] = {q.id: [] for q in questions}

        # Step 1: Build comprehensive page layout anchors across all pages
        page_anchors = self._build_page_anchors(questions)

        # Step 2: Establish explicit ownership for each visual asset
        self.asset_ownership = {}

        for asset_id, asset in self.asset_records.items():
            if asset.error or not asset.path:
                continue

            ap = asset.source_page
            ax0, ay0, ax1, ay1 = asset.bbox
            a_h = max(1.0, ay1 - ay0)
            a_ymid = (ay0 + ay1) / 2.0

            p_height = next((float(r.height) for r in self.doc_reps if r.page_number == ap), 842.0)
            # Suppress running header (top <= 40pt) and footer (bottom >= p_height - 35pt)
            if ay1 <= 40.0 or ay0 >= p_height - 35.0:
                self.asset_ownership[asset_id] = AssetOwnership(
                    asset_id=asset_id,
                    source_page=ap,
                    bbox=asset.bbox,
                    owner_question_id=None,
                    role=AssociationRole.UNASSOCIATED,
                    confidence=0.99
                )
                continue

            anchors_on_p = page_anchors.get(ap, [])
            if not anchors_on_p:
                self.asset_ownership[asset_id] = AssetOwnership(
                    asset_id=asset_id,
                    source_page=ap,
                    bbox=asset.bbox,
                    owner_question_id=None,
                    role=AssociationRole.UNASSOCIATED,
                    confidence=0.0
                )
                continue

            # Calculate overlap with each anchor interval on page ap
            anchor_scores = []
            for anc in anchors_on_p:
                ys = anc["y_start"]
                ye = anc["y_end"]
                overlap = max(0.0, min(ay1, ye) - max(ay0, ys))
                overlap_ratio = overlap / a_h
                is_mid_in = (ys <= a_ymid < ye)
                anchor_scores.append({
                    "anchor": anc,
                    "overlap": overlap,
                    "overlap_ratio": overlap_ratio,
                    "is_mid_in": is_mid_in
                })

            positive_anchors = [
                s for s in anchor_scores
                if s["overlap_ratio"] > 0.15 or s["is_mid_in"]
            ]

            if not positive_anchors:
                def dist_to_anchor(s):
                    ys = s["anchor"]["y_start"]
                    ye = s["anchor"]["y_end"]
                    if a_ymid < ys:
                        return ys - a_ymid
                    elif a_ymid > ye:
                        return a_ymid - ye
                    return 0.0

                best_anc_score = min(anchor_scores, key=dist_to_anchor)
                positive_anchors = [best_anc_score]

            dominant_candidate = next((s for s in positive_anchors if s["overlap_ratio"] >= 0.75), None)
            if len(positive_anchors) == 1 or dominant_candidate is not None:
                best_s = dominant_candidate if dominant_candidate is not None else max(
                    positive_anchors, key=lambda s: (s["overlap_ratio"], s["is_mid_in"])
                )
                best_anc = best_s["anchor"]
                is_sec = str(best_anc["question_id"]).startswith("sec_")
                role = AssociationRole.UNASSOCIATED if is_sec else self._determine_role(best_anc["stem"], asset.type)
                conf = 0.95 if is_sec else self._calculate_confidence(
                    best_anc["stem"],
                    (best_anc["y_start"], best_anc["y_end"]),
                    (ay0, ay1)
                )

                self.asset_ownership[asset_id] = AssetOwnership(
                    asset_id=asset_id,
                    source_page=ap,
                    bbox=asset.bbox,
                    owner_question_id=best_anc["question_id"],
                    role=role,
                    confidence=conf
                )
            else:
                # Contested boundary between 2 or more anchors
                contested_active_qs = [
                    s["anchor"]["question_obj"]
                    for s in positive_anchors
                    if s["anchor"].get("question_obj")
                ]

                resolved_q_id = None
                resolved_role = AssociationRole.QUESTION_FIGURE
                resolved_conf = 0.85

                if len(contested_active_qs) >= 2 and ai_provider is not None:
                    try:
                        resolved_q = self._resolve_ambiguity_via_ai(
                            ai_provider=ai_provider,
                            asset=asset,
                            candidates=contested_active_qs
                        )
                        if resolved_q:
                            resolved_q_id = resolved_q.id
                            resolved_role = self._determine_role(resolved_q.stem, asset.type)
                            resolved_conf = 0.98
                    except Exception as ex_ai:
                        logger.warning(f"AI ambiguity resolver failed for asset {asset_id}: {ex_ai}")

                if not resolved_q_id:
                    # Deterministic fallback:
                    # 1. Visual cues
                    cue_anchors = [
                        s for s in positive_anchors
                        if any(k in s["anchor"]["stem"].lower() for k in ["hình vẽ", "hình bên", "sơ đồ", "bảng", "[image_ref"])
                    ]
                    if len(cue_anchors) == 1:
                        best_anc = cue_anchors[0]["anchor"]
                    else:
                        best_s = max(positive_anchors, key=lambda s: s["overlap_ratio"])
                        best_anc = best_s["anchor"]

                    is_sec = str(best_anc["question_id"]).startswith("sec_")
                    resolved_q_id = best_anc["question_id"]
                    resolved_role = AssociationRole.UNASSOCIATED if is_sec else self._determine_role(best_anc["stem"], asset.type)
                    resolved_conf = 0.95 if is_sec else 0.75

                self.asset_ownership[asset_id] = AssetOwnership(
                    asset_id=asset_id,
                    source_page=ap,
                    bbox=asset.bbox,
                    owner_question_id=resolved_q_id,
                    role=resolved_role,
                    confidence=resolved_conf
                )

        # Step 3: Populate attachments_map enforcing IR Invariant:
        # rich_elements = ONLY assets whose owner_question_id == question.id
        for asset_id, ownership in self.asset_ownership.items():
            owner_qid = ownership.owner_question_id
            if not owner_qid:
                continue

            matched_q = None
            for q in questions:
                if q.id == owner_qid or str(q.source_number) == str(owner_qid):
                    matched_q = q
                    break

            if matched_q:
                asset = self.asset_records[asset_id]
                attachments_map[matched_q.id].append(
                    RichElementAttachment(
                        asset_id=asset_id,
                        role=ownership.role,
                        position="after_stem",
                        confidence=ownership.confidence,
                        caption=asset.caption,
                        asset_record=asset,
                        owner_question_id=matched_q.id
                    )
                )

        for q_id in attachments_map:
            attachments_map[q_id].sort(
                key=lambda att: (
                    att.asset_record.source_page if att.asset_record else 0,
                    att.asset_record.bbox[1] if att.asset_record else 0.0,
                    att.asset_record.bbox[0] if att.asset_record else 0.0
                )
            )

        return attachments_map

    def get_asset_ownership(self) -> dict[str, AssetOwnership]:
        """Returns the dictionary of authoritative asset ownership records."""
        return self.asset_ownership

    def _build_page_anchors(
        self,
        questions: list[ReconstructedQuestion]
    ) -> dict[int, list[dict[str, Any]]]:
        """
        Builds ordered geometric anchors for every page in doc_reps.
        Includes active questions, external question candidates, and section headers.
        Computes accurate [y_start, y_end) vertical intervals, including cross-page continuations.
        """
        page_heights: dict[int, float] = {
            rep.page_number: float(rep.height) for rep in self.doc_reps
        }

        candidates_by_page_num: dict[tuple[int, int], QuestionCandidate] = {}
        for rep in self.doc_reps:
            for c in rep.candidates:
                candidates_by_page_num[(rep.page_number, c.candidate_number)] = c

        page_anchors: dict[int, list[dict[str, Any]]] = {}
        sorted_reps = sorted(self.doc_reps, key=lambda r: r.page_number)

        for rep in sorted_reps:
            pno = rep.page_number
            anchors: list[dict[str, Any]] = []
            seen_q_nums: set[int] = set()

            # 1. Active questions that start on this page
            for q in questions:
                primary_p = q.source_pages[0] if q.source_pages else 1
                if primary_p == pno:
                    cand = candidates_by_page_num.get((pno, q.source_number))
                    if cand:
                        y_start = float(cand.y_pos)
                        bbox = cand.bbox
                    else:
                        marker_re = re.compile(rf"\b(Câu|Bài)\s+{q.source_number}\b", re.IGNORECASE)
                        found_y = None
                        bbox = (50.0, 50.0, 550.0, 70.0)
                        for obj in self.page_objects.get(pno, []):
                            if obj.type == ObjectType.TEXT_BLOCK and obj.content and marker_re.search(obj.content):
                                found_y = float(obj.bbox[1])
                                bbox = obj.bbox
                                break
                        y_start = found_y if found_y is not None else 50.0

                    anchors.append({
                        "anchor_id": f"anchor_{q.id}",
                        "page": pno,
                        "y_start": y_start,
                        "question_id": q.id,
                        "question_number": q.source_number,
                        "question_obj": q,
                        "stem": q.stem,
                        "bbox": bbox,
                        "is_active": True,
                        "source_pages": q.source_pages or [pno]
                    })
                    seen_q_nums.add(q.source_number)

            # 2. External candidates detected by perception on this page
            for c in rep.candidates:
                if c.candidate_number not in seen_q_nums:
                    anchors.append({
                        "anchor_id": f"ext_cand_p{pno}_q{c.candidate_number}",
                        "page": pno,
                        "y_start": float(c.y_pos),
                        "question_id": f"ext_cand_p{pno}_q{c.candidate_number}",
                        "question_number": c.candidate_number,
                        "question_obj": None,
                        "stem": c.marker_text,
                        "bbox": c.bbox,
                        "is_active": False,
                        "source_pages": [pno]
                    })
                    seen_q_nums.add(c.candidate_number)

            # 3. Uncaptured question markers in text blocks
            q_marker_re = re.compile(r"\b(Câu|Bài)\s+(\d+)\b", re.IGNORECASE)
            for b in rep.blocks:
                m = q_marker_re.search(b.text)
                if m:
                    num = int(m.group(2))
                    if num not in seen_q_nums:
                        anchors.append({
                            "anchor_id": f"ext_block_p{pno}_q{num}",
                            "page": pno,
                            "y_start": float(b.bbox[1]),
                            "question_id": f"ext_block_p{pno}_q{num}",
                            "question_number": num,
                            "question_obj": None,
                            "stem": b.text[:80],
                            "bbox": b.bbox,
                            "is_active": False,
                            "source_pages": [pno]
                        })
                        seen_q_nums.add(num)

            # 4. Section headers as structural boundaries
            sec_header_re = re.compile(r"\b(PHẦN\s+[I|V|X]+|BÀI\s+TẬP\s+TỰ\s+LUẬN)\b", re.IGNORECASE)
            for b in rep.blocks:
                if sec_header_re.search(b.text):
                    by0 = float(b.bbox[1])
                    if not any(abs(a["y_start"] - by0) < 15.0 for a in anchors):
                        anchors.append({
                            "anchor_id": f"sec_p{pno}_b{b.block_index}",
                            "page": pno,
                            "y_start": by0,
                            "question_id": f"sec_p{pno}_b{b.block_index}",
                            "question_number": None,
                            "question_obj": None,
                            "stem": b.text[:80],
                            "bbox": b.bbox,
                            "is_active": False,
                            "source_pages": [pno]
                        })

            anchors.sort(key=lambda a: a["y_start"])
            page_anchors[pno] = anchors

        # Check cross-page continuation between adjacent pages
        for pno in sorted(page_anchors.keys()):
            prev_pno = pno - 1
            if prev_pno in page_anchors and page_anchors[prev_pno]:
                last_prev = page_anchors[prev_pno][-1]
                # Only questions can continue across page boundaries, not section headers
                if str(last_prev.get("question_id", "")).startswith("sec_"):
                    continue

                continues = False
                if last_prev.get("question_obj"):
                    q_obj = last_prev["question_obj"]
                    if pno in (q_obj.source_pages or []):
                        continues = True

                curr_anchors = page_anchors[pno]
                p_rep = next((r for r in self.doc_reps if r.page_number == pno), None)
                first_y = curr_anchors[0]["y_start"] if curr_anchors else page_heights.get(pno, 842.0)

                if not continues:
                    # Check if there is preceding content on page pno before first_y:
                    # 1. Any content text block starting before first_y and below header margin (40.0)
                    has_preceding_text = False
                    if p_rep:
                        for b in p_rep.blocks:
                            if b.block_index > 0 and b.bbox[1] < first_y - 5.0 and b.bbox[3] > 40.0:
                                has_preceding_text = True
                                break

                    # 2. Any visual asset on page pno located before first_y and below header margin
                    has_preceding_asset = False
                    for a in self.asset_records.values():
                        if a.source_page == pno and a.bbox[1] < first_y - 5.0 and a.bbox[3] > 40.0:
                            has_preceding_asset = True
                            break

                    # 3. Question numbering progression (first question on pno has number > last_prev question_number)
                    # and there is space before first_y
                    has_gap = False
                    if curr_anchors and last_prev.get("question_number"):
                        first_curr_num = curr_anchors[0].get("question_number")
                        if first_curr_num is not None and first_curr_num > last_prev["question_number"] and first_y > 80.0:
                            has_gap = True

                    # 4. If current page has NO anchors at all, but has text/assets
                    is_empty_page = not curr_anchors and (has_preceding_text or has_preceding_asset)

                    if has_preceding_text or has_preceding_asset or has_gap or is_empty_page:
                        continues = True

                if continues:
                    cont_anchor = {
                        "anchor_id": f"cont_{last_prev['anchor_id']}_p{pno}",
                        "page": pno,
                        "y_start": 0.0,
                        "question_id": last_prev["question_id"],
                        "question_number": last_prev.get("question_number"),
                        "question_obj": last_prev.get("question_obj"),
                        "stem": last_prev.get("stem", ""),
                        "bbox": (0.0, 0.0, 600.0, 0.0),
                        "is_active": last_prev.get("is_active", False),
                        "source_pages": last_prev.get("source_pages", [])
                    }
                    curr_anchors.insert(0, cont_anchor)
                    # Sync source_pages of question object if present
                    if last_prev.get("question_obj"):
                        q_obj = last_prev["question_obj"]
                        if pno not in (q_obj.source_pages or []):
                            q_obj.source_pages.append(pno)
                            q_obj.source_pages.sort()

            curr_anchors = page_anchors[pno]
            p_height = page_heights.get(pno, 842.0)
            for i, anc in enumerate(curr_anchors):
                if i + 1 < len(curr_anchors):
                    anc["y_end"] = curr_anchors[i + 1]["y_start"]
                else:
                    anc["y_end"] = p_height

        return page_anchors

    def _resolve_question_spans(
        self,
        questions: list[ReconstructedQuestion]
    ) -> dict[str, dict[str, Any]]:
        """
        Determines vertical (y_start, y_end) and page boundaries for each question.
        Maintained for backwards-compatibility.
        """
        page_anchors = self._build_page_anchors(questions)
        spans: dict[str, dict[str, Any]] = {}
        for q in questions:
            q_spans = []
            for pno, anchors in page_anchors.items():
                for anc in anchors:
                    if anc.get("question_id") == q.id:
                        q_spans.append((pno, anc["y_start"], anc["y_end"]))
            if q_spans:
                p_start = q_spans[0][0]
                p_end = q_spans[-1][0]
                y_start = q_spans[0][1]
                y_end = q_spans[-1][2]
            else:
                p_start = q.source_pages[0] if q.source_pages else 1
                p_end = q.source_pages[-1] if q.source_pages else p_start
                y_start = 50.0
                y_end = 800.0

            spans[q.id] = {
                "start_page": p_start,
                "end_page": p_end,
                "y_start": y_start,
                "y_end": y_end
            }
        return spans

    @staticmethod
    def _determine_role(stem: str, asset_type: AssetType) -> AssociationRole:
        """Determines semantic role of asset based on text cues and asset type."""
        lower_stem = stem.lower()
        if "sơ đồ" in lower_stem or "phản ứng" in lower_stem:
            return AssociationRole.REACTION_SCHEME
        if "bảng" in lower_stem:
            return AssociationRole.TABLE_FIGURE
        if asset_type == AssetType.TABLE_REGION:
            return AssociationRole.TABLE_FIGURE
        return AssociationRole.QUESTION_FIGURE

    @staticmethod
    def _calculate_confidence(
        stem: str,
        q_y_range: tuple[float, float],
        a_y_range: tuple[float, float]
    ) -> float:
        """Calculates confidence score based on containment and textual cues."""
        lower_stem = stem.lower()
        has_cue = any(
            cue in lower_stem
            for cue in ["hình vẽ", "hình bên", "sơ đồ bên", "sơ đồ sau", "bảng sau", "bảng bên", "đồ thị", "[image_ref"]
        )

        qy0, qy1 = q_y_range
        ay0, ay1 = a_y_range

        # Fully contained inside question vertical envelope
        if ay0 >= qy0 - 5.0 and ay1 <= qy1 + 5.0:
            return 0.99 if has_cue else 0.95

        # Partially overlapping
        return 0.90 if has_cue else 0.80

    def _resolve_ambiguity_via_ai(
        self,
        ai_provider: Any,
        asset: AssetRecord,
        candidates: list[ReconstructedQuestion]
    ) -> Optional[ReconstructedQuestion]:
        """
        Invokes selective Agnes resolver to assign an ambiguous asset to the correct question.
        Passes only relevant candidate stems and asset coordinates.
        Strictly validates that returned IDs or question numbers exist in the candidate list.
        NEVER allows Agnes to invent or reuse an unrelated asset.
        """
        cand_summaries = [
            f"- Câu {q.source_number} (ID: {q.id}): {q.stem[:120]}"
            for q in candidates
        ]
        prompt = (
            f"Analyze this visual asset and determine which examination question it belongs to.\n"
            f"Asset ID: {asset.asset_id}\n"
            f"Page: {asset.source_page}\n"
            f"Bounding Box: {asset.bbox}\n"
            f"Candidate Questions:\n" + "\n".join(cand_summaries) + "\n\n"
            f"Respond with JSON matching AmbiguityCandidateChoice schema."
        )

        def _validate_choice(resp_obj: AmbiguityCandidateChoice) -> Optional[ReconstructedQuestion]:
            # Agnes MUST return matching asset IDs and question IDs
            # NEVER allow Agnes to invent or reuse an unrelated asset
            if getattr(resp_obj, "asset_id", None) and resp_obj.asset_id != asset.asset_id:
                logger.warning(f"Agnes returned mismatched asset_id: {resp_obj.asset_id} != {asset.asset_id}")
                return None

            for q in candidates:
                if getattr(resp_obj, "owner_question_id", None) and q.id == resp_obj.owner_question_id:
                    return q
                if getattr(resp_obj, "selected_question_number", None) is not None and q.source_number == resp_obj.selected_question_number:
                    return q

            logger.warning(f"Agnes returned non-existent candidate question: {resp_obj}")
            return None

        import hashlib
        from engines.quiz.quiz_cache import read_json, write_json, is_provider_cache_enabled
        ambiguity_key = f"ai_ambiguity_{hashlib.sha256(prompt.encode('utf-8')).hexdigest()}"
        cached = read_json(ambiguity_key) if is_provider_cache_enabled(ai_provider) else None
        if cached and isinstance(cached, dict):
            try:
                resp = AmbiguityCandidateChoice.model_validate(cached)
                matched = _validate_choice(resp)
                if matched:
                    if hasattr(ai_provider, "tracker") and hasattr(ai_provider.tracker, "record_cache_hit"):
                        ai_provider.tracker.record_cache_hit(1)
                    return matched
            except Exception:
                pass

        try:
            resp = ai_provider.generate_structured(
                task_name="resolve_asset_ambiguity",
                user_prompt=prompt,
                system_prompt="You are an exam layout parser. Choose the correct question number for the given asset. You must return exact asset_id and owner_question_id.",
                schema=AmbiguityCandidateChoice,
                temperature=0.0
            )
            if is_provider_cache_enabled(ai_provider):
                write_json(ambiguity_key, resp.model_dump())

            return _validate_choice(resp)
        except Exception as ex:
            logger.debug(f"Selective Agnes ambiguity resolution threw: {ex}")

        return None

