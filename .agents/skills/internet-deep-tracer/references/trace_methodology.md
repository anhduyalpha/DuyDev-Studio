# 5-Stage Internet Deep Tracing Methodology

## Stage 1: Intake & Forensic Normalization
1. **Hash & Fingerprint**:
   - Compute SHA-256 for exact cryptographic matches.
   - Compute perceptual difference hash (dHash) and average hash (aHash) to identify altered, resized, or re-compressed duplicates.
2. **De-Obfuscation**:
   - Video re-uploaders frequently add black borders (letterboxing), crop aspect ratios, or mirror videos horizontally to bypass content ID.
   - Run `image_preprocessor.py` to auto-crop black borders and generate an un-mirrored probe variant (`probe_unmirrored.jpg`).
3. **Keyframe Extraction**:
   - If given a video clip, extract 3-5 equidistant or scene-change keyframes using ffmpeg. Never trace just frame 0 (which is often a black fade or thumbnail bait).

## Stage 2: Multi-Engine Visual Traversal
1. Always test at least 3 distinct visual search engines:
   - **Google Lens** for general context and OCR text detection.
   - **Yandex Images** for human faces, exact background matching, and finding obscure Russian/Asian mirrors.
   - **TinEye** sorted by *Oldest* to pinpoint the original creator and earliest upload date.
2. If the subject is East Asian or anime-styled, pivot to **Baidu** or **Trace.moe** / **SauceNAO**.

## Stage 3: Watermark & Text Extraction
1. Inspect corners and lower third for:
   - TikTok ID / Douyin ID (`@username`)
   - Telegram channel watermarks (`t.me/...`)
   - Twitter / X handle
   - TV channel bugs or streaming platform logos (Netflix, Bilibili, iQIYI)
2. Extract all keywords, subtitle phrases, and distinctive background text.

## Stage 4: Cross-Platform OSINT Pivots & Video Sniffing
1. Convert extracted text and usernames into targeted search dorks using `dork_generator.py`:
   - Exact phrase video search: `"extracted phrase" (video OR full OR clip)`
   - Social hubs: `site:youtube.com OR site:tiktok.com OR site:bilibili.com`
   - Community leaks: `site:reddit.com OR site:t.me OR site:vk.com`
2. For each discovered media page, extract direct stream manifests or run `yt-dlp --dump-json` to capture upload date, uploader, full duration, and highest available resolution.

## Stage 5: Structured Dossier Assembly (`found/`)
1. Create `./found/` directory containing:
   - `metadata.json`: Machine-readable forensic hashes, all discovered URLs, timestamps, and confidence scores.
   - `sources.csv`: Tabular spreadsheet for instant export and filtering.
   - `report.md`: Human-readable investigative dossier with direct links, uploader profiles, and provenance conclusion.
   - `media/`: Original reference image/video, search probes, and keyframe stills.
