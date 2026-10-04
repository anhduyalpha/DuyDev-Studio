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
    GraphObject
)

logger = logging.getLogger("engines.quiz.graph.object_graph")


class AmbiguityCandidateChoice(BaseModel):
    selected_question_number: int
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
        """
        if not self.asset_records:
            return {}

        attachments_map: dict[str, list[RichElementAttachment]] = {q.id: [] for q in questions}

        # Step 1: Establish question spatial spans (page, y_start, y_end)
        question_spans = self._resolve_question_spans(questions)

        # Step 2: For each asset, determine matching candidate question(s)
        asset_claims: dict[str, list[tuple[str, float, AssociationRole]]] = {}

        for asset_id, asset in self.asset_records.items():
            if asset.error or not asset.path:
                continue

            ap = asset.source_page
            a_x0, a_y0, a_x1, a_y1 = asset.bbox

            matching_questions: list[tuple[str, float, AssociationRole]] = []

            for q in questions:
                span = question_spans.get(q.id)
                if not span:
                    continue

                q_start_p = span["start_page"]
                q_end_p = span["end_page"]
                q_y_start = span["y_start"]
                q_y_end = span["y_end"]

                # Check if asset is on the question's active page(s)
                if ap == q_start_p:
                    # Same page evaluation
                    y_max = q_y_end if q_start_p == q_end_p else 1200.0  # open bottom if cross-page
                    # Asset is inside the vertical span of this question
                    if (a_y0 >= q_y_start - 10.0 and a_y1 <= y_max + 10.0) or (
                        # Or partially overlapping with question vertical range
                        not (a_y1 < q_y_start or a_y0 > y_max)
                    ):
                        role = self._determine_role(q.stem, asset.type)
                        conf = self._calculate_confidence(q.stem, (q_y_start, y_max), (a_y0, a_y1))
                        matching_questions.append((q.id, conf, role))

                elif ap == q_end_p and q_end_p > q_start_p:
                    # Cross-page continuation on page N+1
                    if a_y1 <= q_y_end + 10.0:
                        role = self._determine_role(q.stem, asset.type)
                        conf = self._calculate_confidence(q.stem, (0.0, q_y_end), (a_y0, a_y1))
                        matching_questions.append((q.id, conf, role))

            asset_claims[asset_id] = matching_questions

        # Step 3: Resolve claims (unambiguous vs ambiguous)
        for asset_id, claims in asset_claims.items():
            asset = self.asset_records[asset_id]
            if not claims:
                logger.debug(f"Asset {asset_id} on page {asset.source_page} not associated to any question.")
                continue

            if len(claims) == 1:
                # Unambiguous association
                q_id, conf, role = claims[0]
                attachments_map[q_id].append(
                    RichElementAttachment(
                        asset_id=asset_id,
                        role=role,
                        position="after_stem",
                        confidence=conf,
                        asset_record=asset
                    )
                )
            else:
                # Ambiguity detected (2 or more candidate questions claim the same asset)
                assigned_q_id = None
                assigned_role = claims[0][2]
                assigned_conf = 0.85

                candidate_qs = [q for q in questions if q.id in [c[0] for c in claims]]

                # Attempt selective AI resolution if provider is available
                if ai_provider is not None:
                    try:
                        resolved_q = self._resolve_ambiguity_via_ai(
                            ai_provider=ai_provider,
                            asset=asset,
                            candidates=candidate_qs
                        )
                        if resolved_q:
                            assigned_q_id = resolved_q.id
                            assigned_conf = 0.95
                    except Exception as ex_ai:
                        logger.warning(f"AI ambiguity resolver failed for asset {asset_id}: {ex_ai}")

                # Fallback to closest question stem above the asset
                if not assigned_q_id:
                    # Sort candidates by distance from question start to asset top
                    def candidate_distance(q_item: ReconstructedQuestion) -> float:
                        sp = question_spans.get(q_item.id, {})
                        if sp.get("start_page") == asset.source_page:
                            return abs(asset.bbox[1] - sp.get("y_start", 0.0))
                        return 9999.0

                    best_q = min(candidate_qs, key=candidate_distance)
                    assigned_q_id = best_q.id
                    assigned_conf = 0.70

                attachments_map[assigned_q_id].append(
                    RichElementAttachment(
                        asset_id=asset_id,
                        role=assigned_role,
                        position="after_stem",
                        confidence=assigned_conf,
                        asset_record=asset
                    )
                )

        return attachments_map

    def _resolve_question_spans(
        self,
        questions: list[ReconstructedQuestion]
    ) -> dict[str, dict[str, Any]]:
        """
        Determines vertical (y_start, y_end) and page boundaries for each question.
        """
        spans: dict[str, dict[str, Any]] = {}
        page_heights: dict[int, float] = {
            rep.page_number: float(rep.height) for rep in self.doc_reps
        }

        # Index question candidates by (page_number, candidate_number)
        candidates_by_page_num: dict[tuple[int, int], QuestionCandidate] = {}
        for rep in self.doc_reps:
            for c in rep.candidates:
                candidates_by_page_num[(rep.page_number, c.candidate_number)] = c

        # Find starting position for each question
        q_locs: list[dict[str, Any]] = []
        for q in questions:
            primary_p = q.source_pages[0] if q.source_pages else 1
            y_start = 50.0  # default top margin

            # 1. Match QuestionCandidate by source_number
            cand = candidates_by_page_num.get((primary_p, q.source_number))
            if not cand and q.source_pages:
                for p in q.source_pages:
                    cand = candidates_by_page_num.get((p, q.source_number))
                    if cand:
                        primary_p = p
                        break

            if cand:
                y_start = float(cand.y_pos)
            else:
                # 2. Text block search for marker
                marker_re = re.compile(rf"\b(Câu|Bài)\s+{q.source_number}\b", re.IGNORECASE)
                for obj in self.page_objects.get(primary_p, []):
                    if obj.type == ObjectType.TEXT_BLOCK and obj.content and marker_re.search(obj.content):
                        y_start = float(obj.bbox[1])
                        break

            q_locs.append({
                "id": q.id,
                "source_number": q.source_number,
                "start_page": primary_p,
                "y_start": y_start,
                "source_pages": q.source_pages or [primary_p]
            })

        # Calculate y_end based on subsequent questions
        for i, loc in enumerate(q_locs):
            q_id = loc["id"]
            p_start = loc["start_page"]
            y_start = loc["y_start"]
            pages = loc["source_pages"]
            p_end = pages[-1] if len(pages) > 1 else p_start

            # Find next question on p_start
            next_q_same_page = None
            for j in range(i + 1, len(q_locs)):
                if q_locs[j]["start_page"] == p_start:
                    next_q_same_page = q_locs[j]
                    break

            if next_q_same_page:
                y_end = float(next_q_same_page["y_start"])
            else:
                # Last question on this page
                y_end = page_heights.get(p_start, 842.0) - 40.0

            spans[q_id] = {
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
        """
        cand_summaries = [
            f"- Câu {q.source_number}: {q.stem[:120]}"
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

        import hashlib
        from engines.quiz.quiz_cache import read_json, write_json, is_provider_cache_enabled
        ambiguity_key = f"ai_ambiguity_{hashlib.sha256(prompt.encode('utf-8')).hexdigest()}"
        cached = read_json(ambiguity_key) if is_provider_cache_enabled(ai_provider) else None
        if cached and isinstance(cached, dict):
            try:
                resp = AmbiguityCandidateChoice.model_validate(cached)
                if hasattr(ai_provider, "tracker") and hasattr(ai_provider.tracker, "record_cache_hit"):
                    ai_provider.tracker.record_cache_hit(1)
                for q in candidates:
                    if q.source_number == resp.selected_question_number:
                        return q
            except Exception:
                pass

        try:
            resp = ai_provider.generate_structured(
                task_name="resolve_asset_ambiguity",
                user_prompt=prompt,
                system_prompt="You are an exam layout parser. Choose the correct question number for the given asset.",
                schema=AmbiguityCandidateChoice,
                temperature=0.0
            )
            if is_provider_cache_enabled(ai_provider):
                write_json(ambiguity_key, resp.model_dump())
            for q in candidates:
                if q.source_number == resp.selected_question_number:
                    return q
        except Exception as ex:
            logger.debug(f"Selective Agnes ambiguity resolution threw: {ex}")

        return None
