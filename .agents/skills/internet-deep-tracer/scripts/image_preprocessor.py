#!/usr/bin/env python3
"""
image_preprocessor.py - Preprocesses images and videos for deep internet tracing.
Extracts perceptual hashes, EXIF, un-mirrors, crops letterboxes, generates specialized
crop probes (face, attire, center, edges, high-contrast) and extracts video keyframes.
"""

import sys
import os
import json
import hashlib
import subprocess
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance, ImageFilter

def compute_hashes(img: Image.Image) -> dict:
    """Compute perceptual difference hash (dHash), average hash (aHash), and MD5."""
    # dHash (Difference Hash) - robust against scaling and brightness changes
    gray = img.convert('L').resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(gray.getdata())
    diff = []
    for row in range(8):
        for col in range(8):
            diff.append(pixels[row * 9 + col] > pixels[row * 9 + col + 1])
    dhash = hex(int(''.join(['1' if v else '0' for v in diff]), 2))[2:].zfill(16)

    # aHash (Average Hash)
    small = img.convert('L').resize((8, 8), Image.Resampling.LANCZOS)
    small_pixels = list(small.getdata())
    avg = sum(small_pixels) / 64.0
    ahash = hex(int(''.join(['1' if p > avg else '0' for p in small_pixels]), 2))[2:].zfill(16)

    return {"dhash": dhash, "ahash": ahash}

def extract_exif(img: Image.Image) -> dict:
    """Extract raw EXIF metadata without external dependencies."""
    exif_data = {}
    try:
        raw_exif = img.getexif()
        if raw_exif:
            for tag_id, value in raw_exif.items():
                tag_name = str(tag_id)
                if isinstance(value, (str, int, float)):
                    exif_data[tag_name] = value
                elif isinstance(value, bytes):
                    exif_data[tag_name] = value.decode('utf-8', errors='ignore')
    except Exception as e:
        exif_data["error"] = str(e)
    return exif_data

def crop_letterbox(img: Image.Image, tolerance: int = 15) -> Image.Image:
    """Remove black bars (letterboxing/pillarboxing) commonly added in video re-uploads."""
    gray = img.convert('L')
    w, h = gray.size
    
    def is_black(p):
        return p <= tolerance

    # Top border
    top = 0
    for y in range(h // 4):
        row = [gray.getpixel((x, y)) for x in range(0, w, max(1, w // 20))]
        if all(is_black(p) for p in row):
            top = y
        else:
            break

    # Bottom border
    bottom = h
    for y in range(h - 1, h - (h // 4), -1):
        row = [gray.getpixel((x, y)) for x in range(0, w, max(1, w // 20))]
        if all(is_black(p) for p in row):
            bottom = y
        else:
            break

    # Left border
    left = 0
    for x in range(w // 4):
        col = [gray.getpixel((x, y)) for y in range(0, h, max(1, h // 20))]
        if all(is_black(p) for p in col):
            left = x
        else:
            break

    # Right border
    right = w
    for x in range(w - 1, w - (w // 4), -1):
        col = [gray.getpixel((x, y)) for y in range(0, h, max(1, h // 20))]
        if all(is_black(p) for p in col):
            right = x
        else:
            break

    if (right - left >= 50) and (bottom - top >= 50):
        if top > 0 or bottom < h or left > 0 or right < w:
            return img.crop((left, top, right, bottom))
    return img

def extract_video_keyframes(video_path: str, output_dir: str) -> list:
    """Use ffmpeg to extract keyframes at scene changes or intervals."""
    os.makedirs(output_dir, exist_ok=True)
    out_pattern = os.path.join(output_dir, "keyframe_%03d.jpg")
    
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vf", "select='gt(scene,0.4)',scale=720:-1",
        "-vsync", "vfr", "-frames:v", "5",
        out_pattern
    ]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20)
    except Exception:
        pass

    frames = sorted([os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.startswith("keyframe_")])
    if not frames:
        fallback_cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-vf", "fps=0.5,scale=720:-1",
            "-frames:v", "4",
            out_pattern
        ]
        try:
            subprocess.run(fallback_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20)
            frames = sorted([os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.startswith("keyframe_")])
        except Exception:
            pass

    return frames

def preprocess_media(file_path: str, work_dir: str) -> dict:
    """Preprocess image or video, generating forensic metadata and targeted search probe variants."""
    os.makedirs(work_dir, exist_ok=True)
    p = Path(file_path)
    if not p.exists():
        return {"error": f"File not found: {file_path}"}

    ext = p.suffix.lower()
    is_video = ext in ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.ts']

    result = {
        "source_path": str(p.resolve()),
        "filename": p.name,
        "is_video": is_video,
        "probes": []
    }

    # Calculate SHA256 of original file
    with open(p, "rb") as f:
        file_bytes = f.read()
        result["file_sha256"] = hashlib.sha256(file_bytes).hexdigest()
        result["file_size_bytes"] = len(file_bytes)

    if is_video:
        frames_dir = os.path.join(work_dir, "extracted_keyframes")
        keyframes = extract_video_keyframes(str(p), frames_dir)
        result["extracted_keyframes"] = keyframes
        target_img_path = keyframes[0] if keyframes else None
    else:
        target_img_path = str(p)

    if not target_img_path or not os.path.exists(target_img_path):
        return result

    try:
        with Image.open(target_img_path) as raw_img:
            img = ImageOps.exif_transpose(raw_img)
            w, h = img.size
            result["dimensions"] = {"width": w, "height": h, "aspect_ratio": round(w / max(1, h), 2)}
            result["exif"] = extract_exif(raw_img)
            result["hashes"] = compute_hashes(img)

            # Probe 1: Normalized original (JPEG)
            p1_path = os.path.join(work_dir, "probe_original.jpg")
            img.convert('RGB').save(p1_path, "JPEG", quality=92)
            result["probes"].append({"type": "original", "path": p1_path, "purpose": "Standard full visual search"})

            # Probe 2: Cropped letterbox/pillarbox
            cropped = crop_letterbox(img)
            if cropped.size != img.size:
                p2_path = os.path.join(work_dir, "probe_unletterboxed.jpg")
                cropped.convert('RGB').save(p2_path, "JPEG", quality=92)
                result["probes"].append({"type": "unletterboxed", "path": p2_path, "purpose": "Visual search without black borders"})

            base_img = cropped if cropped.size != img.size else img
            bw, bh = base_img.size

            # Probe 3: Flipped / Un-mirrored (TikTok/re-upload anti-copyright bypass)
            flipped = ImageOps.mirror(base_img)
            p3_path = os.path.join(work_dir, "probe_unmirrored.jpg")
            flipped.convert('RGB').save(p3_path, "JPEG", quality=92)
            result["probes"].append({"type": "unmirrored", "path": p3_path, "purpose": "Reverse search for horizontally flipped reposts"})

            # Probe 4: Head & Face Crop (top 40% vertical, center 80% horizontal)
            face_box = (int(bw * 0.1), 0, int(bw * 0.9), int(bh * 0.42))
            if face_box[2] > face_box[0] + 40 and face_box[3] > face_box[1] + 40:
                p4_path = os.path.join(work_dir, "probe_face_head.jpg")
                base_img.crop(face_box).convert('RGB').save(p4_path, "JPEG", quality=92)
                result["probes"].append({"type": "face_head", "path": p4_path, "purpose": "Facial identity and hairstyle visual pivot"})

            # Probe 5: Torso & Attire Crop (middle 30% to 80% vertical - costume, waistbands, logos)
            attire_box = (int(bw * 0.05), int(bh * 0.28), int(bw * 0.95), int(bh * 0.82))
            if attire_box[2] > attire_box[0] + 40 and attire_box[3] > attire_box[1] + 40:
                p5_path = os.path.join(work_dir, "probe_torso_attire.jpg")
                base_img.crop(attire_box).convert('RGB').save(p5_path, "JPEG", quality=92)
                result["probes"].append({"type": "torso_attire", "path": p5_path, "purpose": "Costume, waistbands, embroidery, and gear match"})

            # Probe 6: Tight Center Crop (center 60% box)
            center_box = (int(bw * 0.2), int(bh * 0.2), int(bw * 0.8), int(bh * 0.8))
            p6_path = os.path.join(work_dir, "probe_center_tight.jpg")
            base_img.crop(center_box).convert('RGB').save(p6_path, "JPEG", quality=92)
            result["probes"].append({"type": "center_tight", "path": p6_path, "purpose": "Center focal object search without background distractions"})

            # Probe 7: High-Contrast Grayscale (defeats heavy color-grading filters)
            gray = base_img.convert('L')
            enhancer = ImageEnhance.Contrast(gray)
            hc_gray = enhancer.enhance(1.8)
            p7_path = os.path.join(work_dir, "probe_high_contrast.jpg")
            hc_gray.convert('RGB').save(p7_path, "JPEG", quality=90)
            result["probes"].append({"type": "high_contrast", "path": p7_path, "purpose": "Color grading / filter bypass"})

            # Probe 8: Edge & Text Isolation (highlights text, waistband typography, and brand badges)
            edge_img = gray.filter(ImageFilter.FIND_EDGES)
            p8_path = os.path.join(work_dir, "probe_edges_text.jpg")
            edge_img.convert('RGB').save(p8_path, "JPEG", quality=90)
            result["probes"].append({"type": "edges_text", "path": p8_path, "purpose": "Waistband text, embroidery, and brand symbol OCR"})

    except Exception as e:
        result["error"] = str(e)

    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python image_preprocessor.py <image_or_video_path> [work_dir]"}))
        sys.exit(1)

    input_file = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(input_file), ".trace_tmp")
    output = preprocess_media(input_file, out_dir)
    print(json.dumps(output, indent=2, ensure_ascii=False))
