"""
DD Studio - Unified Converter CLI Bridge 2.0
Usage: python convert_cli.py --input <path> --target <ext> --output-dir <dir> [options]
"""
import argparse
import asyncio
import os
import sys
import json

# Import pre-pulled converters
sys.path.append(os.path.dirname(__file__))
from fastapi_app.converters.images import convert_image
from fastapi_app.converters.video import convert_media
from fastapi_app.converters.docs import convert_doc
from fastapi_app.converters.docx_converter import convert_docx, convert_text_doc
from fastapi_app.converters.pdf import convert_pdf
from fastapi_app.converters.pptx_converter import convert_pptx
from fastapi_app.converters.archive import convert_archive


def emit_progress(percentage: int, stage: str):
    """Outputs single-line JSON progress for BullMQ/Fastify SSE streaming."""
    msg = json.dumps({"progress": percentage, "stage": stage})
    print(msg, flush=True)


async def main():
    parser = argparse.ArgumentParser(description="DD Studio Unified Converter CLI Bridge")
    parser.add_argument("--input", required=True, help="Input file path")
    parser.add_argument("--target", required=True, help="Target format extension")
    parser.add_argument("--output-dir", required=True, help="Output directory")
    parser.add_argument("--quality", default="high", help="Quality: high, medium, low, or 10-100")
    parser.add_argument("--width", type=int, default=None, help="Target width in pixels")
    parser.add_argument("--height", type=int, default=None, help="Target height in pixels")
    parser.add_argument("--resolution", default=None, help="Video resolution: 1080p, 720p, 480p, original")
    parser.add_argument("--fps", default=None, help="Video framerate: 30, 60, original")
    parser.add_argument("--bitrate", default=None, help="Audio bitrate: 320k, 192k, 128k")
    args = parser.parse_args()

    input_path = os.path.abspath(args.input)
    output_dir = os.path.abspath(args.output_dir)
    target_ext = args.target.lower().lstrip('.')
    source_ext = os.path.splitext(input_path)[1].lower().lstrip('.')

    if not os.path.exists(input_path):
        err_res = {"success": False, "error": f"Không tìm thấy tệp đầu vào: {input_path}"}
        print(json.dumps(err_res), flush=True)
        sys.stderr.write(f"Tệp không tồn tại: {input_path}\n")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    emit_progress(10, f"Đang chuẩn bị chuyển đổi từ {source_ext.upper()} sang {target_ext.upper()}")

    image_exts = {'jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif', 'ico', 'gif', 'svg', 'avif', 'heic', 'heif'}
    media_exts = {'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp', 'mpeg', 'mpg', 'ts',
                  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'aiff', 'opus', 'ac3', 'amr', 'm4r'}
    archive_exts = {'zip', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz'}
    text_doc_exts = {'md', 'markdown', 'txt', 'html', 'htm', 'rtf'}
    text_doc_targets = {'pdf', 'docx', 'doc', 'html', 'htm', 'txt', 'md', 'markdown'}

    emit_progress(35, "Đang xử lý trong engine chuyển đổi")

    try:
        if source_ext == 'gif' and target_ext in ['mp4', 'webm', 'avi', 'mkv', 'mov']:
            res = await convert_media(
                input_path, output_dir, target_ext, args.quality, args.resolution, args.fps, args.bitrate, emit_progress
            )
        elif source_ext in image_exts:
            res = await convert_image(
                input_path, output_dir, target_ext, args.quality, args.width, args.height
            )
        elif source_ext == 'pdf':
            res = await convert_pdf(input_path, output_dir, target_ext)
        elif source_ext in ['docx', 'doc']:
            res = await convert_docx(input_path, output_dir, target_ext)
        elif source_ext in ['pptx', 'ppt']:
            res = await convert_pptx(input_path, output_dir, target_ext)
        elif source_ext in text_doc_exts and target_ext in text_doc_targets:
            res = await convert_text_doc(input_path, output_dir, target_ext)
        elif source_ext in media_exts:
            res = await convert_media(
                input_path, output_dir, target_ext, args.quality, args.resolution, args.fps, args.bitrate, emit_progress
            )
        elif source_ext in archive_exts:
            res = await convert_archive(input_path, output_dir, target_ext)
        else:
            res = await convert_doc(input_path, output_dir, target_ext)
    except Exception as exc:
        res = {"success": False, "error": str(exc)}

    if res and res.get("success"):
        emit_progress(95, "Đang lưu trữ tệp kết quả")
        emit_progress(100, "Chuyển đổi hoàn tất")
        print(json.dumps(res), flush=True)
        sys.exit(0)
    else:
        err_msg = res.get("error", "Lỗi chuyển đổi không xác định") if res else "Không nhận được phản hồi từ engine"
        emit_progress(100, f"Chuyển đổi thất bại: {err_msg}")
        print(json.dumps(res or {"success": False, "error": err_msg}), flush=True)
        sys.stderr.write(f"Lỗi: {err_msg}\n")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
