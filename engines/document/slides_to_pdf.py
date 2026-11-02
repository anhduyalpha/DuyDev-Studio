from __future__ import annotations
"""
slides_to_pdf.py - High-Performance Slide & Image Image-List to Vector/Raster PDF Compiler
Part of DuyDev Studio Academic Engines.
Converts a sequence of slide images into a unified, high-fidelity PDF document using PyMuPDF (fitz).
"""

import sys
import os
import json
import argparse
from pathlib import Path

# Try importing fitz (PyMuPDF)
try:
    import fitz
except ImportError:
    fitz = None

try:
    from PIL import Image
except ImportError:
    Image = None

def compile_images_to_pdf(image_paths: list[str], output_pdf_path: str, title: str = "Presentation") -> dict:
    if not image_paths:
        return {"success": False, "error": "No images provided"}

    output_path = Path(output_pdf_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    valid_images = [Path(p).resolve() for p in image_paths if Path(p).exists() and Path(p).stat().st_size > 0]
    if not valid_images:
        return {"success": False, "error": "None of the provided image files exist on disk"}

    # Method 1: PyMuPDF (Fastest, zero quality degradation)
    if fitz is not None:
        try:
            doc = fitz.open()
            for img_path in valid_images:
                img_doc = fitz.open(str(img_path))
                pdf_bytes = img_doc.convert_to_pdf()
                img_doc.close()

                img_pdf = fitz.open("pdf", pdf_bytes)
                doc.insert_pdf(img_pdf)
                img_pdf.close()

            doc.set_metadata({
                "title": title,
                "author": "DuyDev Studio - Academic Engine",
                "creator": "SlideShare/Academic Downloader",
                "producer": "PyMuPDF"
            })
            doc.save(str(output_path), garbage=3, deflate=True)
            doc.close()
            return {
                "success": True,
                "outputPath": str(output_path),
                "pageCount": len(valid_images),
                "fileSizeBytes": output_path.stat().st_size
            }
        except Exception as e:
            # Fallback to Pillow if PyMuPDF encountered an issue
            pass

    # Method 2: Pillow fallback
    if Image is not None:
        try:
            pil_images = []
            first_image = None
            for p in valid_images:
                img = Image.open(str(p))
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                if first_image is None:
                    first_image = img
                else:
                    pil_images.append(img)

            if first_image:
                first_image.save(
                    str(output_path),
                    "PDF",
                    resolution=100.0,
                    save_all=True,
                    append_images=pil_images
                )
                return {
                    "success": True,
                    "outputPath": str(output_path),
                    "pageCount": len(valid_images),
                    "fileSizeBytes": output_path.stat().st_size
                }
        except Exception as e:
            return {"success": False, "error": f"Pillow compile failed: {str(e)}"}

    return {"success": False, "error": "Neither PyMuPDF nor Pillow is available"}

def main():
    parser = argparse.ArgumentParser(description="Compile slide images to PDF")
    parser.add_argument("--images-json", required=True, help="Path to JSON file containing list of image paths")
    parser.add_argument("--output", required=True, help="Output PDF file path")
    parser.add_argument("--title", default="Document", help="Document title")

    args = parser.parse_args()

    try:
        with open(args.images_json, "r", encoding="utf-8") as f:
            images = json.load(f)

        res = compile_images_to_pdf(images, args.output, args.title)
        print(json.dumps(res))
        sys.exit(0 if res.get("success") else 1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
