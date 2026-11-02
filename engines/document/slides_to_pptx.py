from __future__ import annotations
"""
slides_to_pptx.py - High-Performance Slide Image to PowerPoint (.pptx) Compiler
Part of DuyDev Studio Academic Suite.
Converts a sequence of slide images into a genuine, widescreen/standard PowerPoint (.pptx) presentation.
"""

import sys
import os
import io
import json
import argparse
from pathlib import Path

try:
    import pptx
    from pptx.util import Inches
except ImportError:
    pptx = None

try:
    from PIL import Image
except ImportError:
    Image = None

def compile_images_to_pptx(image_paths: list[str], output_pptx_path: str, title: str = "Presentation") -> dict:
    if not image_paths:
        return {"success": False, "error": "No images provided"}

    if pptx is None:
        return {"success": False, "error": "python-pptx library is not installed"}

    if Image is None:
        return {"success": False, "error": "Pillow (PIL) library is not installed"}

    output_path = Path(output_pptx_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    valid_images = [Path(p).resolve() for p in image_paths if Path(p).exists() and Path(p).stat().st_size > 0]
    if not valid_images:
        return {"success": False, "error": "None of the provided image files exist on disk"}

    try:
        prs = pptx.Presentation()

        # Detect aspect ratio from first image
        with Image.open(str(valid_images[0])) as first_img:
            w, h = first_img.size
            is_widescreen = (w / max(h, 1)) >= 1.55

        if is_widescreen:
            # 16:9 Widescreen standard
            prs.slide_width = Inches(13.333)
            prs.slide_height = Inches(7.5)
        else:
            # 4:3 Standard
            prs.slide_width = Inches(10.0)
            prs.slide_height = Inches(7.5)

        blank_layout = prs.slide_layouts[6]

        for img_path in valid_images:
            slide = prs.slides.add_slide(blank_layout)

            # Convert image to clean JPEG in-memory stream (guarantees compatibility with WebP/PNG/etc)
            with Image.open(str(img_path)) as pil_img:
                img_stream = io.BytesIO()
                if pil_img.mode != "RGB":
                    converted = pil_img.convert("RGB")
                    converted.save(img_stream, format="JPEG", quality=95)
                else:
                    pil_img.save(img_stream, format="JPEG", quality=95)
                img_stream.seek(0)

                slide.shapes.add_picture(
                    img_stream,
                    0,
                    0,
                    width=prs.slide_width,
                    height=prs.slide_height
                )

        prs.save(str(output_path))

        return {
            "success": True,
            "outputPath": str(output_path),
            "slideCount": len(valid_images),
            "fileSizeBytes": output_path.stat().st_size
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to compile PPTX: {str(e)}"}

def main():
    parser = argparse.ArgumentParser(description="Compile slide images to PowerPoint (.pptx)")
    parser.add_argument("--images-json", required=True, help="Path to JSON file containing list of image paths")
    parser.add_argument("--output", required=True, help="Output PPTX file path")
    parser.add_argument("--title", default="Presentation", help="Presentation title")

    args = parser.parse_args()

    try:
        with open(args.images_json, "r", encoding="utf-8") as f:
            images = json.load(f)

        res = compile_images_to_pptx(images, args.output, args.title)
        print(json.dumps(res))
        sys.exit(0 if res.get("success") else 1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
