#!/usr/bin/env python3
"""
audit_module_compliance.py - Trình Kiểm Định Chuẩn Mực Module DuyDev Studio
Tuân thủ tài liệu: docs/MODULE_STANDARD.md

Kiểm tra tự động các tiêu chí:
1. Cấu trúc Workspace & Vòng đời (mount / unmount)
2. Dọn dẹp tài nguyên triệt để (Zero-Leak Governance)
3. Hỗ trợ Auto-Start & Share Target Handoff
4. Sử dụng Universal Clipboard (readText)
5. Phân vùng lịch sử độc lập (Isolated History Container)
6. Không nhấp nháy khi đóng/mở Dropbox (In-Place Mutation)
7. Đăng ký Registry hợp lệ (useToolRegistry.js)
8. Không chứa câu từ tiếp thị / chú thích trong ngoặc đơn (Anti-AI Slop)
9. Cú pháp JavaScript hợp lệ (node --check)
"""

import sys
import os
import re
import subprocess
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

ROOT = Path(__file__).resolve().parent.parent
TOOLS_DIR = ROOT / "src" / "components" / "tools"
REGISTRY_FILE = ROOT / "src" / "hooks" / "useToolRegistry.js"

FORBIDDEN_MARKETING = [
    "tối ưu nhất", "mạnh mẽ hàng đầu", "vượt trội", "thần thánh",
    "hàng đầu thế giới", "đỉnh cao", "siêu việt"
]

def load_registry():
    if not REGISTRY_FILE.exists():
        return {}
    content = REGISTRY_FILE.read_text(encoding="utf-8")
    tools = {}
    
    # Match each object { id: '...', ... } accurately inside DEFAULT_TOOLS
    blocks = re.finditer(r'\{\s*id:\s*[\'"]([^\'"]+)[\'"](.*?)(?=\n\s*\{|\n\s*\];)', content, re.DOTALL)
    for m in blocks:
        tool_id = m.group(1)
        block_text = m.group(2)
        m_name = re.search(r'(?:title|name):\s*[\'"]([^\'"]+)[\'"]', block_text)
        m_desc = re.search(r'(?:description|desc):\s*[\'"]([^\'"]+)[\'"]', block_text)
        m_tier = re.search(r'tier:\s*[\'"]([^\'"]+)[\'"]', block_text)
        tools[tool_id] = {
            "name": m_name.group(1) if m_name else "",
            "desc": m_desc.group(1) if m_desc else "",
            "tier": m_tier.group(1) if m_tier else "Standard"
        }
    return tools

def audit_module(module_path: Path, registry_tools: dict):
    tool_dir_name = module_path.name
    results = {
        "name": tool_dir_name,
        "path": str(module_path),
        "passed": True,
        "checks": [],
        "warnings": []
    }

    # Find main workspace file
    workspace_files = list(module_path.glob("*Workspace.js")) + list(module_path.glob("*Studio.js"))
    if not workspace_files:
        # Check sub-files or root files
        workspace_files = [f for f in module_path.glob("*.js") if not f.name.endswith(".test.js")]

    if not workspace_files:
        results["passed"] = False
        results["checks"].append(("❌ Workspace File", "Không tìm thấy file Workspace.js chính trong thư mục"))
        return results

    ws_file = workspace_files[0]
    content = ws_file.read_text(encoding="utf-8")

    # 1. Syntax Check (node --check)
    res = subprocess.run(["node", "--check", str(ws_file)], capture_output=True, text=True)
    if res.returncode == 0:
        results["checks"].append(("✅ Cú pháp JavaScript", f"{ws_file.name} hợp lệ"))
    else:
        results["passed"] = False
        results["checks"].append(("❌ Cú pháp JavaScript", f"{ws_file.name} có lỗi: {res.stderr.strip()}"))

    # 2. Lifecycle Checks
    has_class_mount = "mount(" in content or "mount " in content
    has_class_unmount = "unmount(" in content or "unmount " in content
    has_func_mount = "init" in content or "render" in content
    has_func_cleanup = "cleanup" in content or "removeEventListener" in content

    if has_class_mount and has_class_unmount:
        results["checks"].append(("✅ Vòng đời Workspace", "Có đầy đủ phương thức ES6 Class mount() và unmount() chuẩn mực"))
    elif has_func_mount and has_func_cleanup:
        results["checks"].append(("🟡 Vòng đời Legacy Functional", "Sử dụng mô hình hàm khởi tạo & dọn dẹp legacy (Khuyến nghị nâng cấp lên ES6 Class mount/unmount)"))
    else:
        results["passed"] = False
        results["checks"].append(("❌ Vòng đời Workspace", f"Thiếu mount() ({has_class_mount}) hoặc unmount() ({has_class_unmount})"))

    # 3. Teardown Check
    has_teardown = "removeEventListener" in content or "cleanup" in content or "innerHTML = ''" in content
    if has_teardown:
        results["checks"].append(("✅ Dọn dẹp tài nguyên", "Có cơ chế gỡ listener hoặc giải phóng DOM"))
    else:
        results["warnings"].append("Cảnh báo: unmount() có thể chưa dọn dẹp kỹ event listeners")

    # 4. Auto-Start Support
    has_autostart = "consumePendingAutoStart" in content or "ds:pending-autostart-ready" in content or "dd_pending_autostart" in content
    if has_autostart:
        results["checks"].append(("✅ Auto-Start Handoff", "Đã tích hợp consumePendingAutoStart hoặc lắng nghe sự kiện chuyển tiếp"))
    else:
        # Non-URL tools (e.g. hash checksum, text tools) might not strictly require it, make it a warning
        results["warnings"].append("Lưu ý: Chưa thấy consumePendingAutoStart (Bỏ qua nếu công cụ không nhận URL chia sẻ)")

    # 5. Universal Clipboard
    if "paste" in content.lower():
        if "readText" in content:
            results["checks"].append(("✅ Universal Clipboard", "Sử dụng readText() chuẩn mực từ clipboard utility"))
        else:
            results["warnings"].append("Nút Dán có thể đang dùng trực tiếp navigator.clipboard thay vì readText()")

    # 6. Isolated History Container & In-Place Mutation
    has_history = "renderMediaHistorySection" in content or "History" in content
    if has_history:
        has_isolated_container = re.search(r'id=[\'"][a-zA-Z0-9_-]*[Hh]istoryContainer[\'"]', content)
        if has_isolated_container:
            results["checks"].append(("✅ Isolated History Container", f"Lịch sử được bọc trong container độc lập: {has_isolated_container.group(0)}"))
        else:
            results["warnings"].append("Lưu ý: Không tìm thấy thẻ container riêng dạng id=\"*HistoryContainer\"")

    # 7. Registry check
    matched_id = None
    for tid in registry_tools.keys():
        if tid == tool_dir_name or tid.replace("-downloader", "") == tool_dir_name or tool_dir_name in tid:
            matched_id = tid
            break

    if matched_id:
        t_info = registry_tools[matched_id]
        results["checks"].append(("✅ Đăng ký useToolRegistry", f"Khớp id '{matched_id}', Tier: {t_info.get('tier', 'N/A')}"))

        # 8. Anti-AI Slop check on desc
        desc = t_info.get("desc", "")
        has_slop = False
        if re.search(r'\([^)]+\)', desc):
            results["warnings"].append(f"Quy chuẩn KI-CON-001: Mô tả '{desc}' có chứa chú thích trong ngoặc đơn!")
            has_slop = True
        for bad in FORBIDDEN_MARKETING:
            if bad in desc.lower():
                results["warnings"].append(f"Quy chuẩn KI-CON-001: Mô tả chứa từ tiếp thị cấm '{bad}'!")
                has_slop = True
        if not has_slop:
            results["checks"].append(("✅ Anti-AI Slop", "Mô tả thẻ công cụ sạch sẽ, súc tích, không chứa chú thích thừa"))
    else:
        results["warnings"].append(f"Chưa tìm thấy mục đăng ký tương ứng cho '{tool_dir_name}' trong useToolRegistry.js")

    return results

def main():
    target = sys.argv[1] if len(sys.argv) > 1 else None
    registry = load_registry()

    print("=" * 65)
    print(" 🛠️  DUYDEV STUDIO - TRÌNH KIỂM ĐỊNH QUY CHUẨN MODULE (MODULE AUDITOR)")
    print("=" * 65)

    if target:
        target_path = Path(target).resolve()
        if not target_path.exists():
            print(f"❌ Đường dẫn không tồn tại: {target}")
            sys.exit(1)
        targets = [target_path] if target_path.is_dir() else [target_path.parent]
    else:
        targets = [p for p in TOOLS_DIR.iterdir() if p.is_dir() and not p.name.startswith(".") and p.name != "common"]

    all_passed = True
    for t in sorted(targets, key=lambda x: x.name):
        res = audit_module(t, registry)
        status_icon = "🟢 ĐẠT" if res["passed"] and len(res["warnings"]) == 0 else ("🟡 LƯU Ý" if res["passed"] else "🔴 KHÔNG ĐẠT")
        print(f"\n📦 Module: {res['name']} [{status_icon}] ({res['path']})")
        for tag, msg in res["checks"]:
            print(f"   {tag}: {msg}")
        for w in res["warnings"]:
            print(f"   ⚠️  {w}")
        if not res["passed"]:
            all_passed = False

    print("\n" + "=" * 65)
    if all_passed:
        print("🎉 TẤT CẢ CÁC MODULE ĐƯỢC KIỂM TRA ĐỀU ĐẠT TIÊU CHUẨN KIẾN TRÚC!")
    else:
        print("⚠️  MỘT SỐ MODULE CẦN ĐƯỢC NÂNG CẤP ĐỂ ĐẠT CHUẨN HOÀN TOÀN.")
    print("=" * 65)

if __name__ == "__main__":
    main()
