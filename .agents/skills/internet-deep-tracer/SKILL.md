---
name: internet-deep-tracer
description: Specialist in autonomous internet OSINT tracing, multi-engine reverse image/video search, digital media provenance tracking, regional forum dorking, and direct media downloading into './found/videos/'. Recursively traces reference images, video keyframes, actor/creator queries, cropped screenshots, watermarks, and perceptual hashes (pHash/dHash) across Google Lens, Yandex, Bing Visual, TinEye, Baidu, Sogou, Trace.moe, Reddit, Telegram, X (Twitter), TikTok, Bilibili, and video streaming archives. Features automatic regional linguistic detection (Chinese, Japanese, Korean, Russian, Vietnamese, Global) to query localized forums (Tieba, Weibo, 5channel, DC Inside, VK, Voz) and an autonomous stream extractor that pulls playable MP4 video files directly into './found/videos/'.
---

# Internet Deep Tracer Protocol

## 1. Overview & Core Mission
The **Internet Deep Tracer** autonomously tracks down the origins, extended cuts, re-uploads, high-resolution masters, and provenance of any image, video snippet, or investigative text query.

It eliminates blind manual searching by applying an autonomous multi-stage forensic pipeline:
1. **Forensic Multi-Crop Preprocessing**: Calculates cryptographic (SHA-256) and perceptual hashes (dHash, aHash), un-mirrors horizontally flipped media, generates 7 distinct crop probes (face/head, torso/attire, center-tight, high-contrast, edge-text isolation), and extracts video keyframes.
2. **Multi-Engine Visual Reverse Search**: Queries Google Lens, Yandex Images, Bing Visual Search, TinEye, Baidu, and Anime/Illustration databases.
3. **Linguistic & Regional Forum Dorking**: Detects query language/region (Chinese, Japanese, Korean, Russian, Vietnamese, Global) and automatically pivots into country-specific forums (Tieba, Weibo, 5channel, DC Inside, VK, Voz, Telegram).
4. **Autonomous Video Stream Extraction & Download**: Directly resolves video stream URLs (direct MP4, Twitter CDN `video.twimg.com`, Monsnode base64 token decoders, and `yt-dlp` platforms) and downloads playable `.mp4` video files into `./found/videos/`.
5. **Dossier & Technical Audit**: Probes downloaded files via `ffprobe` (duration, resolution, codecs, bitrate) and packages all assets into a structured `./found/` directory with clickable links and spreadsheets.

---

## 2. Directory Structure of `./found/`
Every investigation must assemble its output inside a dedicated folder:
```
found/
├── report.md           # Executive dossier with source links, uploader profiles, and timeline
├── metadata.json       # Structured JSON of all technical findings, hashes, and URLs
├── sources.csv         # Exportable spreadsheet of all discovered videos and links
├── videos/             # Downloaded playable local video files (.mp4)
│   ├── 01_<title>.mp4
│   └── 02_<title>.mp4
└── media/              # Stored visual evidence
    ├── reference_*     # Local copy of original input
    ├── probes/         # Multi-crop, un-mirrored, and normalized search probes
    └── extracted_keyframes/ # Video stills (if input was a video clip)
```

---

## 3. Step-by-Step Execution Workflow

### Stage 1: Input Intake & Multi-Crop Probe Generation
Run the media preprocessor to inspect dimensions, compute perceptual hashes, crop black borders, and generate probe variants:
```bash
python .agents/skills/internet-deep-tracer/scripts/image_preprocessor.py "<input_image_or_video_path>" "./found/media/probes"
```
The script generates 7 specialized probes:
- `probe_original.jpg`: Standard full visual search
- `probe_unmirrored.jpg`: Reverse search for horizontally flipped reposts (anti-copyright bypass)
- `probe_face_head.jpg`: Facial identity and hairstyle visual pivot
- `probe_torso_attire.jpg`: Costume, waistbands, embroidery, brand logos, and sports gear
- `probe_center_tight.jpg`: Center focal object search without background distractions
- `probe_high_contrast.jpg`: Grayscale contrast enhancement (filter/color-grading bypass)
- `probe_edges_text.jpg`: High-pass edge filter to isolate text and printed logos

### Stage 2: Multi-Engine Visual Traversal
Generate reverse search URLs across all major visual engines:
```bash
python .agents/skills/internet-deep-tracer/scripts/dork_generator.py "<query_or_topic>" "<image_url_or_empty>"
```
- **Google Lens**: Primary for general entity recognition and OCR text extraction.
- **Yandex Images**: Crucial for human faces, scene match, and obscure international forums.
- **TinEye**: Sort by **Oldest** to uncover the earliest indexed appearance on the internet.
- **Baidu / Sogou**: Essential if content originated on Chinese social media (Douyin, Kuaishou, Bilibili, Weibo).
- **Trace.moe / SauceNAO**: Dedicated for anime, manga, and 2D illustrations.

### Stage 3: Linguistic Regional Dorking & Platform Pivots
The dork generator automatically analyzes characters to determine regional context:
- **Chinese (`zh`)**: Targets Tieba (`tieba.baidu.com`), Weibo (`weibo.com`), Bilibili, Douyin, Xiaohongshu, Telegram Chinese channels (`t.me/s/`), Twitter archives (`monsnode.com`, `twi-dl.net`, `sotwe.com`), and Chinese model/leak archives.
- **Japanese (`ja`)**: Targets 5channel (`5ch.net`), Yahoo Chiebukuro, NicoNico, and Japanese Twitter tools (`twidouga.net`, `monsnode.com`).
- **Korean (`ko`)**: Targets DC Inside (`dcinside.com`), ArcaLive (`arca.live`), TheQoo (`theqoo.net`), and Naver Cafe.
- **Russian (`ru`)**: Targets VKontakte (`vk.com`), Rutube (`rutube.ru`), and Russian Telegram channels.
- **Vietnamese (`vi`)**: Targets Voz (`voz.vn`), Facebook public groups, and Vietnamese Telegram channels.
- **Global (`en`)**: Targets Reddit, Twitter/X, YouTube, TikTok, Mega, Drive, and Bunkr.

### Stage 4: Video Stream Resolution & Local Download
Download discovered playable media directly into `./found/videos/`:
```bash
python .agents/skills/internet-deep-tracer/scripts/deep_tracer.py "<input_file_or_query>" "found" '<json_array_of_discovered_urls>'
```
- Automatically resolves Monsnode base64 tokens (`twjn.php?v=...`) to direct Twitter CDN `.mp4` URLs.
- Automatically handles direct MP4/M4V streams with spoofed headers.
- Uses `yt-dlp` fallback for hundreds of supported streaming portals.
- Executes `ffprobe` to inspect duration, resolution, codecs, and bitrate on all downloaded clips.

### Stage 5: Review the Dossier
Open `found/report.md` for a comprehensive overview with clickable local links:
```markdown
- **Tệp video nội bộ**: [▶ Xem trực tiếp `01_azhu_boxing_720x960.mp4`](file:///C:/Users/.../found/videos/01_azhu_boxing_720x960.mp4)
```

---

## 4. Strict Investigative Rules
- **Deliver Local Playable Media**: Whenever video streams or archive player pages are uncovered, download the files directly into `found/videos/` so the user does not have to click through ad-shorteners or broken links.
- **Multi-Crop Search**: If a full image returns weak or generic results, search using `probe_face_head.jpg` or `probe_torso_attire.jpg`.
- **Compile Into `found/`**: Always leave a clean, complete `./found/` directory with `report.md`, `metadata.json`, `sources.csv`, `media/`, and `videos/`.
