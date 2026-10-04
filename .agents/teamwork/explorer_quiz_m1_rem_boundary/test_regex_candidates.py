import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

# Current mcq_parser.py regexes
CUR_BOUNDARY = re.compile(r"(?:^|\n)(?=(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+))", re.I)
CUR_NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*[\.\:\)]", re.I)

# Proposed regexes (NUM only vs BOUNDARY + NUM)
PROPOSED_NUM_C1 = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*(?:[\.\:\)]|\s+)", re.I)
PROPOSED_NUM_C3 = re.compile(r"^\s*(?:Câu\s*)?(\d+)(?:\s*[\.\:\)]|\s+|$)", re.I)

# Enhanced BOUNDARY that also supports ')'
ENHANCED_BOUNDARY = re.compile(r"(?:^|\n)[ \t]*(?=(?:Câu\s*\d+[\.\:\)\s]|\b\d+[\.\:]\s+))", re.I)

def simulate_pipeline(text, boundary_re, num_re, guard_include_paren=False):
    splits = boundary_re.split(text)
    extracted = []
    guard_re = (
        re.compile(r"^(?:Câu\s*\d+[\.\:\)\s]|\b\d+[\.\:]\s+)", re.I)
        if guard_include_paren
        else re.compile(r"^(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+)", re.I)
    )
    for s in splits:
        seg = s.strip()
        if not seg:
            continue
        if not guard_re.match(seg):
            continue
        num_m = num_re.match(seg)
        if not num_m:
            continue
        extracted.append((int(num_m.group(1)), seg[:30]))
    return extracted

tests = {
    "Standard dot": "Câu 1. Dung dịch quỳ tím\nA. HCl\nB. NaOH\nC. NaCl\nD. H2O",
    "Colon": "Câu 2: Nguyên tử khối Oxi\nA. 16\nB. 32\nC. 8\nD. 64",
    "Parenthesis on Câu": "Câu 3) Kim loại nhẹ nhất\nA. Li\nB. Na\nC. K\nD. Cs",
    "Space only (Câu 14 )": "Câu 14 Tìm x biết 2x + 1 = 5:\nA. x = 2\nB. x = 3\nC. x = 4\nD. x = 5",
    "Bare number with dot": "5. Dung dịch nào\nA. HCl\nB. NaOH\nC. NaCl\nD. H2O",
    "Bare number with colon": "6: Nguyên tử khối\nA. 16\nB. 32\nC. 8\nD. 64",
    "Bare number space only": "14 Tìm x biết 2x + 1 = 5:\nA. x = 2\nB. x = 3\nC. x = 4\nD. x = 5",
    "Indented Câu": "   Câu 7. Thụt lề đầu dòng\nA. 1\nB. 2\nC. 3\nD. 4",
    "Mixed case câu": "câu 8. Chữ thường\nA. 1\nB. 2\nC. 3\nD. 4",
    "Uppercase CÂU": "CÂU 9. Chữ hoa\nA. 1\nB. 2\nC. 3\nD. 4",
    "Multiple spaces": "Câu   10   Nhiều space\nA. 1\nB. 2\nC. 3\nD. 4",
    "Stem starting with number": "Câu 11. Cho 50 gam dung dịch X:\nA. 1\nB. 2\nC. 3\nD. 4",
    "Stem with 1) statement": "Câu 12. Cho các mệnh đề:\n1) Mệnh đề 1\n2) Mệnh đề 2\nA. 1\nB. 2\nC. 3\nD. 4",
    "Two questions sequentially": "Câu 1. Câu một\nA. 1\nB. 2\nC. 3\nD. 4\n\nCâu 2 Tìm x\nA. 1\nB. 2\nC. 3\nD. 4"
}

for name, doc in tests.items():
    cur = simulate_pipeline(doc, CUR_BOUNDARY, CUR_NUM)
    chal = simulate_pipeline(doc, CUR_BOUNDARY, PROPOSED_NUM_C1)
    c3 = simulate_pipeline(doc, CUR_BOUNDARY, PROPOSED_NUM_C3)
    enh = simulate_pipeline(doc, ENHANCED_BOUNDARY, PROPOSED_NUM_C3, guard_include_paren=True)
    print(f"=== {name} ===")
    print(f"  Current:  {cur}")
    print(f"  Chall:    {chal}")
    print(f"  C3:       {c3}")
    print(f"  Enhanced: {enh}")
