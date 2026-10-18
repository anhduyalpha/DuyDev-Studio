#!/usr/bin/env python3
"""
deep_tracer.py - Master Orchestrator for Internet Deep Tracing.
Searches, scrapes, resolves video streams, downloads playable media directly into 'found/videos/',
probes technical stream specs with ffprobe, and bundles all findings into a structured 'found/' dossier.
"""

import sys
import os
import json
import csv
import re
import time
import shutil
import base64
import urllib.request
import urllib.parse
import subprocess
from datetime import datetime
from pathlib import Path

# Local helpers
try:
    from image_preprocessor import preprocess_media
    from dork_generator import build_osint_packet
except ImportError:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.append(script_dir)
    from image_preprocessor import preprocess_media
    from dork_generator import build_osint_packet

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def probe_local_video(file_path: str) -> dict:
    """Probe a local video file with ffprobe for exact duration, resolution, codecs, and bitrate."""
    info = {"local_path": file_path, "valid": False}
    try:
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate",
            "-of", "json", file_path
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if proc.returncode == 0 and proc.stdout.strip():
            data = json.loads(proc.stdout)
            streams = data.get("streams", [])
            fmt = data.get("format", {})
            info["valid"] = True
            info["duration"] = round(float(fmt.get("duration", 0)), 2)
            info["size_bytes"] = int(fmt.get("size", os.path.getsize(file_path)))
            info["bitrate"] = int(fmt.get("bit_rate", 0)) if fmt.get("bit_rate") else None
            
            for s in streams:
                if s.get("width") and s.get("height"):
                    info["resolution"] = f"{s.get('width')}x{s.get('height')}"
                    info["video_codec"] = s.get("codec_name")
                    info["frame_rate"] = s.get("r_frame_rate")
                elif s.get("codec_name") and "audio_codec" not in info:
                    info["audio_codec"] = s.get("codec_name")
    except Exception as e:
        info["error"] = str(e)
    return info

def resolve_monsnode_video_url(page_or_redirect_url: str) -> str:
    """Resolve a Monsnode page or redirect link to direct video.twimg.com MP4 URL."""
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'}
    try:
        req = urllib.request.Request(page_or_redirect_url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            
            # Check for redirect.php?v=...
            v_match = re.search(r'redirect\.php\?v=(\d+)', html)
            v_id = v_match.group(1) if v_match else None
            if not v_id:
                # If page is already redirect.php or twjn.php
                m2 = re.search(r'v=(\d+)', page_or_redirect_url)
                if m2:
                    v_id = m2.group(1)

            if v_id:
                twjn_url = f"https://monsnode.com/twjn.php?v={v_id}"
                req2 = urllib.request.Request(twjn_url, headers=headers)
                with urllib.request.urlopen(req2, timeout=12) as resp2:
                    twjn_html = resp2.read().decode('utf-8', errors='ignore')
                    atob_match = re.search(r"atob\(['\"]([^'\"]+)['\"]\)", twjn_html)
                    if atob_match:
                        raw_b64 = atob_match.group(1)
                        decoded = base64.b64decode(raw_b64).decode('utf-8', errors='ignore')
                        if "video.twimg.com" in decoded or ".mp4" in decoded:
                            return decoded
    except Exception:
        pass
    return None

def download_video_stream(source_url: str, output_dir: str, prefix_num: int = 1, slug: str = "clip") -> dict:
    """
    Download a video stream into output_dir/videos/ and return inspection metadata.
    Handles direct MP4s, Twitter CDN links, Monsnode pages, and yt-dlp supported portals.
    """
    videos_dir = Path(output_dir) / "videos"
    videos_dir.mkdir(parents=True, exist_ok=True)
    
    clean_slug = re.sub(r'[^a-zA-Z0-9_\-]', '_', slug).strip('_')[:35]
    dest_filename = f"{prefix_num:02d}_{clean_slug}.mp4"
    dest_path = str(videos_dir / dest_filename)

    # 1. Resolve Monsnode
    target_url = source_url
    if "monsnode.com" in source_url:
        resolved = resolve_monsnode_video_url(source_url)
        if resolved:
            target_url = resolved

    # 2. Direct HTTP download for MP4 / video.twimg.com
    if any(ext in target_url.lower() for ext in ['.mp4', '.m4v', 'video.twimg.com']):
        try:
            req = urllib.request.Request(
                target_url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                with open(dest_path, "wb") as f:
                    while True:
                        chunk = resp.read(65536)
                        if not chunk:
                            break
                        f.write(chunk)
            
            probe = probe_local_video(dest_path)
            return {
                "downloaded": True,
                "local_file": dest_filename,
                "local_path": dest_path,
                "resolved_stream_url": target_url,
                "probe": probe
            }
        except Exception as e:
            pass

    # 3. Universal yt-dlp fallback
    try:
        cmd = [
            "yt-dlp",
            "--no-playlist",
            "--no-warnings",
            "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "-o", dest_path,
            target_url
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if proc.returncode == 0 and os.path.exists(dest_path) and os.path.getsize(dest_path) > 1024:
            probe = probe_local_video(dest_path)
            return {
                "downloaded": True,
                "local_file": dest_filename,
                "local_path": dest_path,
                "resolved_stream_url": target_url,
                "probe": probe
            }
    except Exception:
        pass

    return {"downloaded": False, "source_url": source_url}

def probe_video_url(url: str) -> dict:
    """Probe a media URL using yt-dlp to extract titles, formats, uploader, and metadata."""
    info = {"url": url, "valid": False}
    try:
        cmd = ["yt-dlp", "--dump-json", "--no-warnings", "--no-playlist", url]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if proc.returncode == 0 and proc.stdout.strip():
            data = json.loads(proc.stdout)
            info["valid"] = True
            info["title"] = data.get("title")
            info["uploader"] = data.get("uploader") or data.get("channel")
            info["uploader_url"] = data.get("uploader_url")
            info["upload_date"] = data.get("upload_date")
            info["duration"] = data.get("duration")
            info["view_count"] = data.get("view_count")
            info["thumbnail"] = data.get("thumbnail")
            info["resolution"] = f"{data.get('width', '')}x{data.get('height', '')}"
            info["extractor"] = data.get("extractor")
    except Exception as e:
        info["error"] = str(e)
    return info

def create_found_bundle(
    target_input: str,
    output_dir: str = "found",
    discovered_items: list = None,
    entities: list = None,
    summary_notes: str = "",
    download_videos: bool = True
) -> str:
    """
    Assembles all intelligence, assets, and source links into the structured 'found/' dossier.
    Automatically downloads all discovered playable video clips into found/videos/ and probes them.
    """
    found_path = Path(output_dir)
    media_dir = found_path / "media"
    videos_dir = found_path / "videos"
    found_path.mkdir(parents=True, exist_ok=True)
    media_dir.mkdir(parents=True, exist_ok=True)
    videos_dir.mkdir(parents=True, exist_ok=True)

    discovered_items = discovered_items or []
    entities = entities or []
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. Media Preprocessing (if input is file)
    preprocessed_data = {}
    if os.path.exists(target_input):
        src_path = Path(target_input)
        copied_src = media_dir / f"reference_{src_path.name}"
        if not copied_src.exists() or str(copied_src.resolve()) != str(src_path.resolve()):
            shutil.copy2(src_path, copied_src)
        
        preprocessed_data = preprocess_media(str(copied_src), str(media_dir / "probes"))

    # 2. Probe & Download Discovered Video Links
    probed_results = []
    dl_count = 1
    for item in discovered_items:
        url = item.get("url") if isinstance(item, dict) else item
        title = item.get("title", f"video_{dl_count}") if isinstance(item, dict) else f"video_{dl_count}"
        
        entry = dict(item) if isinstance(item, dict) else {"url": url, "title": title}

        # Check if already has local file
        local_file = entry.get("local_path")
        if local_file and os.path.exists(local_file):
            entry["download_status"] = "Ready"
            entry["probe"] = probe_local_video(local_file)
        elif download_videos and url:
            # Attempt auto-download
            slug = entry.get("title") or f"clip_{dl_count}"
            dl_res = download_video_stream(url, output_dir, prefix_num=dl_count, slug=slug)
            if dl_res.get("downloaded"):
                entry["local_path"] = dl_res.get("local_path")
                entry["local_file"] = dl_res.get("local_file")
                entry["download_status"] = "Downloaded"
                entry["resolved_stream_url"] = dl_res.get("resolved_stream_url")
                entry["probe"] = dl_res.get("probe")
                dl_count += 1
            else:
                entry["download_status"] = "Web Only / Shielded"

        # Metadata probe via yt-dlp if web-accessible
        if not entry.get("probe") and url and any(d in url for d in ['youtube.com', 'youtu.be', 'tiktok.com', 'bilibili.com', 'vimeo.com', 'twitter.com', 'x.com']):
            yt_info = probe_video_url(url)
            entry.update({k: v for k, v in yt_info.items() if v and k not in entry})

        probed_results.append(entry)

    # 3. Write metadata.json
    meta = {
        "investigation_timestamp": timestamp_str,
        "query_or_input": target_input,
        "entities": entities,
        "forensic_media": preprocessed_data,
        "total_sources_found": len(probed_results),
        "results": probed_results,
        "summary": summary_notes
    }
    with open(found_path / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    # 4. Write sources.csv
    with open(found_path / "sources.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Index", "Title", "Local Video File", "Duration (s)", "Resolution", "Platform / Extractor", "URL", "Status"])
        for idx, r in enumerate(probed_results, 1):
            pb = r.get("probe", {})
            dur = pb.get("duration") or r.get("duration", "N/A")
            res = pb.get("resolution") or r.get("resolution", "N/A")
            writer.writerow([
                idx,
                r.get("title", "N/A"),
                r.get("local_file", "None"),
                dur,
                res,
                r.get("extractor", r.get("platform", "Web")),
                r.get("url", ""),
                r.get("download_status", "Web Link")
            ])

    # 5. Write report.md
    report_lines = [
        "# Internet Deep Trace Dossier (Báo Cáo Điều Tra & Truy Vết Toàn Diện)",
        f"**Thời gian điều tra**: `{timestamp_str}`  ",
        f"**Đối tượng truy vết**: `{target_input}`  ",
        f"**Tổng số nguồn/video tìm thấy**: `{len(probed_results)}`  ",
        "",
        "---",
        "",
        "## 1. Dữ Liệu Pháp Y Hình Ảnh & Các Biến Thể Crop (Media Forensics)"
    ]

    if preprocessed_data:
        report_lines.append(f"- **SHA-256**: `{preprocessed_data.get('file_sha256', 'N/A')}`")
        hashes = preprocessed_data.get("hashes", {})
        report_lines.append(f"- **dHash (Difference Hash)**: `{hashes.get('dhash', 'N/A')}`")
        report_lines.append(f"- **aHash (Average Hash)**: `{hashes.get('ahash', 'N/A')}`")
        dims = preprocessed_data.get("dimensions", {})
        if dims:
            report_lines.append(f"- **Độ phân giải gốc**: `{dims.get('width')}x{dims.get('height')}` (Tỉ lệ: `{dims.get('aspect_ratio')}`)")
        
        probes = preprocessed_data.get("probes", [])
        if probes:
            report_lines.append("- **Các biến thể dò tìm (Multi-Crop & Filter Probes)**:")
            for pb in probes:
                report_lines.append(f"  * **`{pb.get('type')}`** ({pb.get('purpose', '')}): `{pb.get('path')}`")
    else:
        report_lines.append("*(Truy vết dựa trên Text Query hoặc Web URL)*")

    report_lines.extend([
        "",
        "---",
        "",
        "## 2. Kho Video Tải Về Trực Tiếp & Nguồn Khám Phá (Downloaded Video Assets)",
        ""
    ])

    if probed_results:
        for idx, r in enumerate(probed_results, 1):
            title = r.get("title") or r.get("url")
            url = r.get("url")
            local_file = r.get("local_file")
            local_path = r.get("local_path")
            pb = r.get("probe", {})
            dur = f"{pb.get('duration')}s" if pb.get("duration") else (f"{r.get('duration')}s" if r.get("duration") else "N/A")
            res = pb.get("resolution") or r.get("resolution") or "N/A"
            vcodec = pb.get("video_codec", "N/A")
            platform = r.get("extractor", r.get("platform", "Web"))
            status = r.get("download_status", "Web Link")

            report_lines.append(f"### {idx}. {title}")
            if local_path and os.path.exists(local_path):
                # Normalized path for markdown link
                f_link = f"file:///{Path(local_path).resolve().as_posix()}"
                report_lines.append(f"- **Tệp video nội bộ**: [▶ Xem trực tiếp `{local_file}`]({f_link}) (Kích thước: `{round(os.path.getsize(local_path)/1024/1024, 2)} MB`)")
            report_lines.extend([
                f"- **Trạng thái**: `{status}`",
                f"- **Nền tảng / Máy chủ**: `{platform}`",
                f"- **Thời lượng**: `{dur}` | **Độ phân giải**: `{res}` | **Codec**: `{vcodec}`",
                f"- **Liên kết nguồn web**: [{url}]({url})" if url else "- **Liên kết nguồn web**: `N/A`",
                ""
            ])
    else:
        report_lines.append("*(Chưa có liên kết video trực tiếp)*")

    report_lines.extend([
        "---",
        "",
        "## 3. Tổng Hợp Manh Mối & Đánh Giá Nguồn Gốc (Provenance Synthesis)",
        summary_notes if summary_notes else "Đã tổng hợp toàn bộ manh mối và tải video về thư mục `./found/videos/`. Kiểm tra `sources.csv` và `metadata.json` để lấy danh sách đầy đủ."
    ])

    with open(found_path / "report.md", "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))

    return str(found_path.resolve())

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "usage": "python deep_tracer.py <image_or_query> [output_dir] [urls_or_json_results]"
        }))
        sys.exit(1)

    target = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "found"
    items = []
    if len(sys.argv) > 3:
        try:
            items = json.loads(sys.argv[3])
        except Exception:
            items = [{"url": sys.argv[3]}]

    bundle_dir = create_found_bundle(target, out, items)
    print(json.dumps({"status": "success", "found_dir": bundle_dir}, ensure_ascii=False))
