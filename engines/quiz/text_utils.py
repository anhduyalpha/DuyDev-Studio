"""
Text utility functions for quiz pipeline:
- Section banner detection and stripping
- Image marker cleanup
"""

import re


def is_section_banner(text: str) -> bool:
    """
    Detect if text is a section divider or banner (e.g. 'PHẦN I', 'PHẦN II', 'PHẦN 1',
    'PHẦN II. Câu trắc nghiệm đúng sai.', 'CÂU TRẮC NGHIỆM ĐÚNG SAI', 'BẢNG ĐÁP ÁN', 'HƯỚNG DẪN GIẢI').
    Such banners are structural layout dividers and must never be extracted as images,
    nor merged into the preceding question's body.
    """
    if not text:
        return False
    t = text.strip()
    if re.match(r"^\s*(?:câu\s*\d+|\d+[\.\:])", t, re.IGNORECASE):
        return False
    if re.search(r"^\s*(?:[-•*]\s*)?PH[ẦAÀẢÃẠÂẦẤẨẪẬa-z\ufffd\W]*N\s*[:\.]?\s*(?:[IVXLCDM]+|\d+)", t, re.IGNORECASE):
        return True
    if re.search(r"tr[ắa\ufffd\W]?c\s*nghi[ệe\ufffd\W]?m\s*(?:[đd\ufffd\W]?[úu\ufffd\W]?ng\s*sai|nhi[ềe\ufffd\W]?u|tr[ảa\ufffd\W]?\s*l[ờo\ufffd\W]?i)", t, re.IGNORECASE):
        return True
    if re.search(r"^\s*(?:[-•*]\s*)?(?:B[ẢA\ufffd\W]?NG\s*Đ[ÁA\ufffd\W]?P\s*[ÁA\ufffd\W]?N|H[ƯU\ufffd\W]?ỚNG\s*D[ẪA\ufffd\W]?N\s*GI[ẢA\ufffd\W]?I|L[ỜO\ufffd\W]?I\s*GI[ẢA\ufffd\W]?I\s*CHI\s*TI[ẾE\ufffd\W]?T|Đ[ÁA\ufffd\W]?P\s*[ÁA\ufffd\W]?N\s*CHI\s*TI[ẾE\ufffd\W]?T)\b", t, re.IGNORECASE):
        return True
    if re.search(r"^\s*(?:[-•*]\s*)?(?:MỤC|MUC|CHUY[ÊE\ufffd\W]?N\s*Đ[ỀE\ufffd\W]?)\s*[:\.]?\s*(?:[IVXLCDM]+|\d+)", t, re.IGNORECASE):
        return True
    return False


def strip_section_banner(text: str) -> str:
    """Strip any trailing or embedded section divider banners from text."""
    if not text:
        return ""
    pattern = (
        r"(?:^|\n)\s*(?:(?:[-•*]\s*)?PH[ẦAÀẢÃẠÂẦẤẨẪẬa-z\ufffd\W]*N\s*[:\.]?\s*(?:[IVXLCDM]+|\d+)|"
        r"tr[ắa\ufffd\W]?c\s*nghi[ệe\ufffd\W]?m\s*(?:[đd\ufffd\W]?[úu\ufffd\W]?ng\s*sai|nhi[ềe\ufffd\W]?u|tr[ảa\ufffd\W]?\s*l[ờo\ufffd\W]?i)|"
        r"B[ẢA\ufffd\W]?NG\s*Đ[ÁA\ufffd\W]?P\s*[ÁA\ufffd\W]?N|H[ƯU\ufffd\W]?ỚNG\s*D[ẪA\ufffd\W]?N\s*GI[ẢA\ufffd\W]?I\b).*$"
    )
    return re.sub(pattern, "", str(text), flags=re.IGNORECASE | re.MULTILINE).strip()


def clean_image_markers(text: str) -> str:
    """Purge internal [IMAGE_REF: ...] markers from human-facing text."""
    if not text:
        return ""
    return re.sub(r"\[IMAGE_REF:\s*[^\]]+\]", "", str(text)).strip()
