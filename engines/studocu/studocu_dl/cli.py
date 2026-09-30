# -*- coding: utf-8 -*-
"""
studocu_dl.cli
==============
Giao diện dòng lệnh CLI cho Studocu Downloader.
"""

import argparse
import asyncio
import sys

from .engine import StudocuDownloader


def parse_arguments() -> argparse.Namespace:
    """Định nghĩa và phân tích các tham số dòng lệnh."""
    parser = argparse.ArgumentParser(
        prog="studocu-dl",
        description="Studocu Downloader CLI - Tải toàn bộ tài liệu Studocu sang PDF A4 Vector và Markdown.",
    )
    parser.add_argument(
        "url",
        nargs="?",
        default=None,
        help="URL tài liệu Studocu cần tải (ví dụ: https://www.studocu.com/...)",
    )
    parser.add_argument(
        "-f",
        "--format",
        choices=["pdf", "md", "both"],
        default="pdf",
        help="Định dạng xuất: pdf (mặc định), md, hoặc both.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="downloads",
        help="Thư mục lưu file đầu ra (mặc định: ./downloads).",
    )
    parser.add_argument(
        "-b",
        "--browser",
        default=None,
        help="Đường dẫn tùy chỉnh đến file thực thi chrome.exe hoặc msedge.exe.",
    )
    parser.add_argument(
        "-t",
        "--timeout",
        type=int,
        default=50,
        help="Thời gian tối đa chờ trang nạp hoàn tất tính bằng giây (mặc định: 50).",
    )
    parser.add_argument(
        "--show-browser",
        action="store_true",
        default=False,
        help="Hiển thị cửa sổ Chrome trực tiếp trên màn hình (mặc định chạy ẩn hoàn toàn ngoài màn hình).",
    )
    parser.add_argument(
        "-c",
        "--cookie",
        default=None,
        help="Chuỗi cookie hoặc đường dẫn file cookies để vượt Cloudflare (ví dụ: 'cf_clearance=...').",
    )
    parser.add_argument(
        "--profile-dir",
        default=None,
        help="Thư mục hồ sơ lưu trữ session/cookies của trình duyệt để tái sử dụng.",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        default=False,
        help="Bật nhật ký chi tiết và hiển thị traceback lỗi kỹ thuật khi gặp sự cố.",
    )

    return parser.parse_args()


def main() -> int:
    """Điểm nhập thực thi chính của CLI."""
    # Đảm bảo in UTF-8 mượt mà trên console Windows
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    args = parse_arguments()

    url = args.url
    if not url:
        print("==================================================", flush=True)
        print("   ALPHA STUDOCU DOWNLOADER CLI (v2.2)", flush=True)
        print("==================================================", flush=True)
        try:
            url = input("👉 Dán link tài liệu Studocu cần tải: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nĐã hủy.", flush=True)
            return 0

    if not url:
        print("[ERROR] Chưa nhập URL tài liệu.", flush=True)
        return 1

    downloader = StudocuDownloader(
        url=url,
        output_dir=args.output,
        fmt=args.format,
        browser_path=args.browser,
        timeout=args.timeout,
        show_browser=args.show_browser,
        verbose=args.verbose,
        cookie=args.cookie,
        profile_dir=args.profile_dir,
    )

    try:
        report = asyncio.run(downloader.run())
        print("\n" + "=" * 52, flush=True)
        print("✅ TẢI TÀI LIỆU THÀNH CÔNG!", flush=True)
        print("=" * 52, flush=True)
        print(f"📖 Tiêu đề: {report.get('title')}", flush=True)
        if "pdf" in report:
            pdf_info = report["pdf"]
            print(f"📄 File PDF : {pdf_info['path']}", flush=True)
            print(f"📊 Số trang : {pdf_info['pages']} trang | Dung lượng: {pdf_info['size_mb']} MB", flush=True)
        if "md" in report:
            md_info = report["md"]
            print(f"📝 File MD  : {md_info['path']}", flush=True)
            print(f"📊 Dung lượng: {md_info['size_kb']} KB", flush=True)
        print(f"⏱️  Tổng thời gian: {report.get('elapsed_sec')} giây", flush=True)
        print("=" * 52 + "\n", flush=True)
        return 0
    except Exception as e:
        print("\n" + "=" * 56, flush=True)
        print("❌ THẤT BẠI KHI TẢI TÀI LIỆU", flush=True)
        print("=" * 56, flush=True)
        print(f"Chi tiết lỗi:\n  {e}\n", flush=True)
        if args.verbose:
            import traceback
            print("--- TRACEBACK KỸ THUẬT (VERBOSE) ---", flush=True)
            traceback.print_exc()
            print("-------------------------------------\n", flush=True)
        print("💡 Hướng dẫn khắc phục:", flush=True)
        print("  1. Kiểm tra lại kết nối mạng Internet hoặc thử tắt/đổi VPN/Proxy.", flush=True)
        print("  2. Thử chạy kèm cờ '--show-browser' nếu Cloudflare yêu cầu giải captcha thủ công.", flush=True)
        print("  3. Thêm cờ '-v' hoặc '--verbose' để xem đầy đủ log kỹ thuật chi tiết.", flush=True)
        print("=" * 56 + "\n", flush=True)
        return 1
