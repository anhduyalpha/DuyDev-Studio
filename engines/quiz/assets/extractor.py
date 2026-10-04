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


def normalize_image_to_renderer_safe(img_path: str) -> tuple[int, int]:
    """
    Normalizes any image format (RGBA, CMYK, palette, 1-bit, alpha mask)
    into a renderer-safe RGB PNG composited over an opaque pure white background.
    Returns (width, height).
    """
    if not os.path.isfile(img_path) or os.path.getsize(img_path) == 0:
        return 0, 0
    try:
        from PIL import Image
        with Image.open(img_path) as im:
            w, h = im.size
            if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
                rgba = im.convert("RGBA")
                # Composite over pure white opaque background
                bg = Image.new("RGB", rgba.size, (255, 255, 255))
                bg.paste(rgba, mask=rgba.split()[3])
                bg.save(img_path, format="PNG")
                return w, h
            elif im.mode != "RGB":
                rgb = im.convert("RGB")
                rgb.save(img_path, format="PNG")
                return w, h
            return w, h
    except Exception as ex:
        logger.warning(f"Failed normalizing image {img_path}: {ex}")
        return 0, 0


def is_black_or_blank_image(img_path: str, max_black_ratio: float = 0.90, min_mean_lum: float = 12.0) -> bool:
    """
    Detects if an image is predominantly a black rectangle or completely blank/solid.
    Returns True if image is corrupt/black/blank.
    """
    if not os.path.isfile(img_path) or os.path.getsize(img_path) < 100:
        return True
    try:
        from PIL import Image, ImageStat
        with Image.open(img_path) as im:
            rgb = im.convert("RGB")
            stat = ImageStat.Stat(rgb)
            # Check mean luminance
            mean_lum = sum(stat.mean) / 3.0
            if mean_lum < min_mean_lum:
                # Overwhelmingly black (< 12 on 0-255 scale)
                return True

            # Check variance (if variance < 0.5, completely solid uniform color)
            var_lum = sum(stat.var) / 3.0
            if var_lum < 0.5:
                return True

            # Check ratio of black pixels (R < 20, G < 20, B < 20)
            hist = rgb.histogram()
            total_pixels = max(1, im.width * im.height)
            dark_r = sum(hist[0:20])
            dark_g = sum(hist[256:276])
            dark_b = sum(hist[512:532])
            dark_ratio = min(dark_r, dark_g, dark_b) / total_pixels
            if dark_ratio > max_black_ratio:
                return True

            return False
    except Exception as ex:
        logger.warning(f"Error checking black/blank image for {img_path}: {ex}")
        return True


def validate_image_asset(img_path: str, min_w: int = 10, min_h: int = 10) -> bool:
    """
    Strict validation for visual asset:
    - File exists
    - Non zero-byte
    - Valid dimensions >= min_w, min_h
    - Decoded pixels valid
    - Not a black or blank placeholder
    """
    if not os.path.isfile(img_path) or os.path.getsize(img_path) < 100:
        return False
    try:
        from PIL import Image
        with Image.open(img_path) as im:
            if im.width < min_w or im.height < min_h:
                return False
        return not is_black_or_blank_image(img_path)
    except Exception:
        return False


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

                success = False
                w, h = 0, 0
                method = ExtractionMethod.EMBEDDED

                # PRIORITY 1: Native embedded extraction with SMask & colorspace normalization
                try:
                    pix = fitz.Pixmap(doc, xref)
                    # If image has an SMask xref, combine it
                    smask = img_info[1] if len(img_info) > 1 else 0
                    if smask > 0:
                        try:
                            mask = fitz.Pixmap(doc, smask)
                            if pix.width == mask.width and pix.height == mask.height:
                                pix = fitz.Pixmap(pix, mask)
                        except Exception as ex_mask:
                            logger.debug(f"Failed combining smask {smask} for xref {xref}: {ex_mask}")

                    # Convert CMYK/non-RGB to RGB
                    if pix.n >= 5 or pix.colorspace != fitz.csRGB:
                        pix = fitz.Pixmap(fitz.csRGB, pix)

                    pix.save(img_path)
                    norm_w, norm_h = normalize_image_to_renderer_safe(img_path)
                    w, h = norm_w or pix.width, norm_h or pix.height

                    # Validate extracted image
                    if validate_image_asset(img_path, min_w=10, min_h=10):
                        success = True
                        method = ExtractionMethod.EMBEDDED
                    else:
                        logger.warning(f"Embedded extraction for xref {xref} produced invalid/black image. Triggering high-res crop fallback.")
                except Exception as ex_native:
                    logger.debug(f"Direct pixmap extraction failed for xref {xref}: {ex_native}")

                # PRIORITY 2: High-resolution source-page crop with opaque white background fallback
                if not success:
                    try:
                        clip_rect = fitz.Rect(
                            max(0.0, bbox[0] - 2.0),
                            max(0.0, bbox[1] - 2.0),
                            min(page_w, bbox[2] + 2.0),
                            min(page_h, bbox[3] + 2.0)
                        )
                        # Render with white opaque background (alpha=False)
                        pix = page.get_pixmap(clip=clip_rect, dpi=self.dpi, alpha=False)
                        pix.save(img_path)
                        norm_w, norm_h = normalize_image_to_renderer_safe(img_path)
                        w, h = norm_w or pix.width, norm_h or pix.height
                        if validate_image_asset(img_path, min_w=10, min_h=10):
                            success = True
                            method = ExtractionMethod.CROP
                        else:
                            logger.warning(f"High-res crop fallback also failed validation for xref {xref} on page {page_number}")
                    except Exception as ex_crop:
                        logger.warning(f"High-res crop fallback failed for xref {xref} on page {page_number}: {ex_crop}")

                if not success:
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
                            error="Image extraction resulted in corrupt or black placeholder"
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
                        pix = page.get_pixmap(clip=clip_rect, dpi=self.dpi, alpha=False)
                        pix.save(crop_path)
                        norm_w, norm_h = normalize_image_to_renderer_safe(crop_path)
                        if not validate_image_asset(crop_path, min_w=10, min_h=10):
                            logger.debug(f"Vector crop {asset_id} failed validation (blank/black), skipping.")
                            continue

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
                                width=norm_w or pix.width,
                                height=norm_h or pix.height,
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
