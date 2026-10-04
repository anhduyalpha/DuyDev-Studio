"""
Rich Asset Extractor Module (TASK-01)
Extracts embedded raster images, vector drawings, diagrams, and tables directly from PDF pages.
Guarantees source provenance, content hashing, and non-destructive image preservation.
"""

import hashlib
import logging
import os
from typing import Optional

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from .models import AssetRecord, AssetType, ExtractionMethod

logger = logging.getLogger("engines.quiz.assets.extractor")


class RichAssetExtractor:
    """
    High-fidelity asset extraction engine.
    Extracts original embedded raster images and clusters vector drawing regions into high-resolution crops.
    """

    def __init__(self, output_dir: str, dpi: int = 250, padding: float = 4.0) -> None:
        self.output_dir = os.path.abspath(output_dir)
        self.dpi = dpi
        self.padding = padding
        os.makedirs(self.output_dir, exist_ok=True)

    def extract_all(
        self,
        doc: fitz.Document,
        page_numbers: Optional[list[int]] = None
    ) -> list[AssetRecord]:
        """
        Extracts all rich visual assets across specified 1-based page numbers.
        If page_numbers is None, processes the entire document.
        """
        if page_numbers is None:
            target_pages = list(range(1, len(doc) + 1))
        else:
            target_pages = [p for p in page_numbers if 1 <= p <= len(doc)]

        all_assets: list[AssetRecord] = []
        for pno in target_pages:
            try:
                page_assets = self.extract_page_assets(doc, pno)
                all_assets.extend(page_assets)
            except Exception as ex:
                logger.error(f"Failed extracting assets on page {pno}: {ex}")
                all_assets.append(
                    AssetRecord(
                        asset_id=f"asset_p{pno}_err",
                        type=AssetType.UNKNOWN_VISUAL,
                        source_page=pno,
                        bbox=(0.0, 0.0, 0.0, 0.0),
                        path="",
                        sha256="",
                        width=0,
                        height=0,
                        extraction_method=ExtractionMethod.CROP,
                        confidence=0.0,
                        error=str(ex)
                    )
                )

        return all_assets

    def extract_page_assets(
        self,
        doc: fitz.Document,
        page_number: int
    ) -> list[AssetRecord]:
        """
        Extracts raster and vector assets for a single PDF page.
        """
        page_idx = page_number - 1
        if page_idx < 0 or page_idx >= len(doc):
            raise IndexError(f"Page number {page_number} is out of document range (1..{len(doc)})")

        page = doc[page_idx]
        page_w = float(page.rect.width)
        page_h = float(page.rect.height)

        records: list[AssetRecord] = []
        extracted_bboxes: list[tuple[float, float, float, float]] = []

        # ---------------------------------------------------------
        # 1. Embedded Raster Images Extraction
        # ---------------------------------------------------------
        raw_images = page.get_images(full=True)
        for img_idx, img_info in enumerate(raw_images):
            xref = img_info[0]
            img_rects = page.get_image_rects(xref)
            if not img_rects:
                continue

            for rect_idx, r in enumerate(img_rects):
                # Filter out tiny 1x1 tracking or line artifacts
                if r.width < 5.0 or r.height < 5.0:
                    continue

                bbox = (float(r.x0), float(r.y0), float(r.x1), float(r.y1))
                asset_id = f"asset_p{page_number}_img_{xref}_{rect_idx}"
                filename = f"{asset_id}.png"
                img_path = os.path.join(self.output_dir, filename)

                try:
                    # Attempt native pixmap extraction from xref first
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n >= 5:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    pix.save(img_path)
                    w, h = pix.width, pix.height
                    method = ExtractionMethod.EMBEDDED
                except Exception as ex_native:
                    logger.debug(f"Direct pixmap extraction failed for xref {xref}, falling back to page crop: {ex_native}")
                    try:
                        clip_rect = fitz.Rect(
                            max(0.0, bbox[0] - 2.0),
                            max(0.0, bbox[1] - 2.0),
                            min(page_w, bbox[2] + 2.0),
                            min(page_h, bbox[3] + 2.0)
                        )
                        pix = page.get_pixmap(clip=clip_rect, dpi=self.dpi)
                        pix.save(img_path)
                        w, h = pix.width, pix.height
                        method = ExtractionMethod.CROP
                    except Exception as ex_crop:
                        logger.warning(f"Could not extract or crop image xref {xref} on page {page_number}: {ex_crop}")
                        records.append(
                            AssetRecord(
                                asset_id=asset_id,
                                type=AssetType.RASTER,
                                source_page=page_number,
                                bbox=bbox,
                                path="",
                                sha256="",
                                width=0,
                                height=0,
                                extraction_method=ExtractionMethod.EMBEDDED,
                                confidence=0.0,
                                error=str(ex_crop)
                            )
                        )
                        continue

                # Calculate SHA-256 content hash
                with open(img_path, "rb") as f:
                    sha256_hash = hashlib.sha256(f.read()).hexdigest()

                records.append(
                    AssetRecord(
                        asset_id=asset_id,
                        type=AssetType.RASTER,
                        source_page=page_number,
                        bbox=bbox,
                        path=os.path.abspath(img_path),
                        sha256=sha256_hash,
                        width=w,
                        height=h,
                        extraction_method=method,
                        confidence=1.0
                    )
                )
                extracted_bboxes.append(bbox)

        # ---------------------------------------------------------
        # 2. Vector Drawings & Diagram Region Clustering
        # ---------------------------------------------------------
        drawings = page.get_drawings()
        candidate_rects: list[fitz.Rect] = []

        for d in drawings:
            r = d.get("rect")
            if not r:
                continue

            # Give zero-dimension strokes (lines) a minimum dimension based on stroke width
            stroke_w = max(1.0, float(d.get("width", 1.0) or 1.0))
            rx0, ry0, rx1, ry1 = float(r.x0), float(r.y0), float(r.x1), float(r.y1)
            if rx1 <= rx0:
                rx0 -= stroke_w / 2.0
                rx1 += stroke_w / 2.0
            if ry1 <= ry0:
                ry0 -= stroke_w / 2.0
                ry1 += stroke_w / 2.0
            r = fitz.Rect(rx0, ry0, rx1, ry1)

            # Filter full-page border frames
            if r.width >= page_w * 0.88 and r.height >= page_h * 0.88:
                continue

            # Filter header/footer horizontal dividing rules
            if r.width >= page_w * 0.70 and r.height <= 2.5:
                continue

            # Filter vertical margin rules
            if r.height >= page_h * 0.70 and r.width <= 2.5:
                continue

            # Filter drawings completely inside an existing extracted raster image
            is_inside_raster = any(
                (eb[0] - 2.0 <= r.x0 and eb[1] - 2.0 <= r.y0 and eb[2] + 2.0 >= r.x1 and eb[3] + 2.0 >= r.y1)
                for eb in extracted_bboxes
            )
            if is_inside_raster:
                continue

            candidate_rects.append(r)

        if candidate_rects:
            clusters = self._cluster_rects(candidate_rects, gap_x=25.0, gap_y=20.0)
            for c_idx, c_rect in enumerate(clusters):
                # Filter out small isolated tick marks or bullets
                if c_rect.width < 15.0 and c_rect.height < 15.0:
                    continue

                # Filter out clusters that substantially overlap with an already extracted raster image
                c_bbox = (c_rect.x0, c_rect.y0, c_rect.x1, c_rect.y1)
                overlaps_raster = False
                for eb in extracted_bboxes:
                    ix0 = max(c_bbox[0], eb[0])
                    iy0 = max(c_bbox[1], eb[1])
                    ix1 = min(c_bbox[2], eb[2])
                    iy1 = min(c_bbox[3], eb[3])
                    if ix1 > ix0 and iy1 > iy0:
                        inter_area = (ix1 - ix0) * (iy1 - iy0)
                        min_area = min(
                            max(1.0, (c_bbox[2] - c_bbox[0]) * (c_bbox[3] - c_bbox[1])),
                            max(1.0, (eb[2] - eb[0]) * (eb[3] - eb[1]))
                        )
                        if inter_area / min_area > 0.65:
                            overlaps_raster = True
                            break
                if overlaps_raster:
                    continue

                # Ensure minimum dimensions for meaningful visual content
                if c_rect.width >= 18.0 and c_rect.height >= 12.0:
                    # Apply safe padding
                    x0 = max(0.0, c_rect.x0 - self.padding)
                    y0 = max(0.0, c_rect.y0 - self.padding)
                    x1 = min(page_w, c_rect.x1 + self.padding)
                    y1 = min(page_h, c_rect.y1 + self.padding)

                    clip_rect = fitz.Rect(x0, y0, x1, y1)
                    asset_id = f"asset_p{page_number}_vec_{c_idx}_{int(x0)}_{int(y0)}"
                    filename = f"{asset_id}.png"
                    crop_path = os.path.join(self.output_dir, filename)

                    try:
                        pix = page.get_pixmap(clip=clip_rect, dpi=self.dpi)
                        pix.save(crop_path)
                        with open(crop_path, "rb") as f:
                            sha256_hash = hashlib.sha256(f.read()).hexdigest()

                        # Classify vector region based on aspect and size
                        asset_type = AssetType.DIAGRAM_REGION if (c_rect.width > 40 and c_rect.height > 25) else AssetType.VECTOR_REGION

                        records.append(
                            AssetRecord(
                                asset_id=asset_id,
                                type=asset_type,
                                source_page=page_number,
                                bbox=(float(x0), float(y0), float(x1), float(y1)),
                                path=os.path.abspath(crop_path),
                                sha256=sha256_hash,
                                width=pix.width,
                                height=pix.height,
                                extraction_method=ExtractionMethod.CROP,
                                confidence=0.95
                            )
                        )
                        extracted_bboxes.append((float(x0), float(y0), float(x1), float(y1)))
                    except Exception as ex_vec:
                        logger.warning(f"Failed cropping vector region on page {page_number}: {ex_vec}")

        return records

    @staticmethod
    def _cluster_rects(
        rects: list[fitz.Rect],
        gap_x: float = 15.0,
        gap_y: float = 15.0
    ) -> list[fitz.Rect]:
        """
        Clusters spatially adjacent rectangles using connected component merging.
        """
        if not rects:
            return []

        # Disjoint-set data structure
        parent = list(range(len(rects)))

        def find(i: int) -> int:
            path = []
            while parent[i] != i:
                path.append(i)
                i = parent[i]
            for node in path:
                parent[node] = i
            return i

        def union(i: int, j: int) -> None:
            root_i = find(i)
            root_j = find(j)
            if root_i != root_j:
                parent[root_i] = root_j

        n = len(rects)
        for i in range(n):
            ri = rects[i]
            for j in range(i + 1, n):
                rj = rects[j]
                # Check if ri and rj are within proximity threshold
                h_dist = max(0.0, max(ri.x0, rj.x0) - min(ri.x1, rj.x1))
                v_dist = max(0.0, max(ri.y0, rj.y0) - min(ri.y1, rj.y1))

                if h_dist <= gap_x and v_dist <= gap_y:
                    union(i, j)

        # Merge clusters into unified bounding boxes
        clusters_map: dict[int, fitz.Rect] = {}
        for i in range(n):
            root = find(i)
            if root not in clusters_map:
                clusters_map[root] = fitz.Rect(rects[i])
            else:
                clusters_map[root] = clusters_map[root] | rects[i]

        return list(clusters_map.values())
