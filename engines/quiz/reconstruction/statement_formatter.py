"""
Statement Formatter Module
Detects and structures multi-statement questions (e.g. 'Cho các phát biểu sau: a)... b)... c)... d)... Số phát biểu đúng là:')
into clean semantic blocks (lead-in, statement items, conclusion) for GD&ĐT examination standards.
"""

from __future__ import annotations

import html
import re
from typing import Optional, TypedDict


class StatementItem(TypedDict):
    label: str
    text: str


class ParsedStatementQuestion(TypedDict):
    lead_in: str
    statements: list[StatementItem]
    conclusion: str


ITEMS_TERMS = r"(?:phát\s*biểu|nhận\s*định|mệnh\s*đề|câu|thí\s*nghiệm|chất|phản\s*ứng|trường\s*hợp|phương\s*trình|kết\s*luận|ý)"

# Matches statement markers:
# 1. a), b), c), d) or a., b., c., d.
# 2. (a), (b), (c), (d)
# 3. (1), (2), (3), (4) or 1), 2), 3), 4) or 1., 2., 3., 4.
# 4. (I), (II), (III), (IV) or I), II), III) or I., II., III. or (i), (ii)
# 5. Dash / bullet points: -, •, *, +
STATEMENT_SPLIT_REGEX = re.compile(
    r"(?:^|\n|\s{2,}|\.\s+|(?<=:)\s*)(?:(\(?([a-eA-E]|\d{1,2}|[IVXivx]{1,4})\))|([a-eA-E]|\d{1,2}|[IVXivx]{1,4})\.|([-•*+]))\s+",
    re.UNICODE
)

CONCLUSION_PATTERNS = [
    re.compile(
        rf"(?:(?<=\.)\s*|(?<=;)\s*|^|\n|\s{{2,}}|\,\s*)((?:Số|Có\s+bao\s+nhiêu|Hỏi\s+có\s+bao\s+nhiêu)\s+{ITEMS_TERMS}\s*(?:đúng|sai|không\s*đúng|thỏa\s*mãn|phù\s*hợp|xảy\s*ra|tạo\s*thành|sinh\s*ra|kết\s*tủa)?\s*(?:là|gồm)?.*$)",
        re.IGNORECASE
    ),
    re.compile(
        rf"(?:(?<=\.)\s*|(?<=;)\s*|^|\n|\s{{2,}}|\,\s*)((?:Liệt\s*kê|Các|Những)\s+{ITEMS_TERMS}\s*(?:đúng|sai|không\s*đúng|thỏa\s*mãn|phù\s*hợp|xảy\s*ra)\s*(?:là|gồm).*$)",
        re.IGNORECASE
    ),
    re.compile(
        rf"(?:(?<=\.)\s*|(?<=;)\s*|^|\n|\s{{2,}}|\,\s*)((?:Số\s+lượng\s+{ITEMS_TERMS}|Số\s+ý\s+(?:đúng|sai)).*?$)",
        re.IGNORECASE
    ),
    re.compile(
        rf"(?:(?<=\.)\s*|(?<=;)\s*|^|\n|\s{{2,}}|\,\s*)((?:Trong\s+các\s+{ITEMS_TERMS}\s+trên,?\s*(?:số|có\s+bao\s+nhiêu)\s+{ITEMS_TERMS}?).*?$)",
        re.IGNORECASE
    ),
]


def parse_statement_question(stem: str) -> Optional[ParsedStatementQuestion]:
    """
    Parses a question stem into structured lead_in, statements list, and conclusion.
    Returns None if the stem does not represent a multi-statement question.
    """
    if not stem or not stem.strip():
        return None

    text = stem.strip()

    # Must contain indicative keywords for statement questions
    if not re.search(r"(?:phát\s*biểu|mệnh\s*đề|nhận\s*định|thí\s*nghiệm|chất|phản\s*ứng|trường\s*hợp|thông\s*tin|bước\s*sau|sau\s*đây)", text, re.IGNORECASE):
        # Also check if conclusion exists
        has_conclusion = any(p.search(text) for p in CONCLUSION_PATTERNS)
        if not has_conclusion:
            return None

    # Find statement markers in text
    matches = list(STATEMENT_SPLIT_REGEX.finditer(text))
    if len(matches) < 2:
        return None

    # Group matches and check sequence validity
    first_match = matches[0]
    lead_in = text[:first_match.start()].strip()
    if lead_in.endswith(":"):
        lead_in = lead_in[:-1].strip() + ":"

    statements: list[StatementItem] = []

    for i, m in enumerate(matches):
        raw_label = m.group(1) or (m.group(3) + "." if m.group(3) else None) or m.group(4)
        raw_label = (raw_label or "").strip()

        start_content = m.end()
        end_content = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start_content:end_content].strip()

        statements.append({
            "label": raw_label,
            "text": content
        })

    if not statements:
        return None

    # Check the last statement for an embedded conclusion question
    conclusion = ""
    last_stmt = statements[-1]
    last_stmt_text = last_stmt["text"]

    for pat in CONCLUSION_PATTERNS:
        m_concl = pat.search(last_stmt_text)
        if m_concl:
            conclusion = m_concl.group(1).strip()
            last_stmt["text"] = last_stmt_text[:m_concl.start()].strip()
            break

    # If conclusion was not found with regex, check last line of text if it looks like a question
    if not conclusion:
        lines = [line.strip() for line in last_stmt_text.splitlines() if line.strip()]
        if len(lines) > 1 and re.search(r"(?:là\s*bao\s*nhiêu|là\s*\:?$|\?|\bla\b)", lines[-1], re.IGNORECASE):
            conclusion = lines[-1]
            last_stmt["text"] = " ".join(lines[:-1]).strip()

    return {
        "lead_in": lead_in,
        "statements": statements,
        "conclusion": conclusion
    }


def format_stem_html(stem: str) -> str:
    """
    Renders question stem into semantic HTML. If it is a statement question,
    returns indented list markup; otherwise returns clean stem.
    """
    if not stem:
        return ""

    from engines.quiz.text_utils import clean_image_markers
    clean_stem = clean_image_markers(stem)

    parsed = parse_statement_question(clean_stem)
    if not parsed or not parsed["statements"]:
        return clean_stem

    lead_in_html = f'<div class="q-lead-in">{parsed["lead_in"]}</div>' if parsed["lead_in"] else ""

    stmt_items_html = []
    for s in parsed["statements"]:
        stmt_items_html.append(
            f'<div class="q-statement-item">'
            f'<span class="q-stmt-label">{html.escape(s["label"])}</span>'
            f'<span class="q-stmt-text">{s["text"]}</span>'
            f'</div>'
        )

    stmt_list_html = f'<div class="q-statement-list">{"".join(stmt_items_html)}</div>'
    concl_html = f'<div class="q-conclusion">{parsed["conclusion"]}</div>' if parsed["conclusion"] else ""

    return f'{lead_in_html}{stmt_list_html}{concl_html}'
