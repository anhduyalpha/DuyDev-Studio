# Multi-Engine Reverse Image & Video Search Guide

## 1. Engine Capabilities Matrix

| Engine | Best For | Strengths | Weaknesses |
|---|---|---|---|
| **Google Lens** | Products, real-world objects, landmarks, general web pages | Massive index, multi-lingual OCR, entity detection | Aggressively blocks automated headless scraping without rotation |
| **Yandex Images** | Human faces, obscure people, movies, Russian/Asian media, exact scene match | Unmatched face/character recognition, deep forum indexing, uncropped match | Slower index updates for ultra-new social shorts (<6h old) |
| **Bing Visual Search** | Web shopping, duplicate visual stock, high-res mirrors | Direct crop adjustment UI, clean API endpoints | Smaller coverage on underground/niche forums |
| **TinEye** | Exact crops, chronological oldest discovery (original upload date) | Best sorting by "Oldest", "Biggest Image", "Most Changed" | Cannot match modified/mirrored/filtered images |
| **Baidu / Sogou** | Chinese internet, Douyin, Bilibili, Weibo, Xiaohongshu | Essential for Asian short videos, web drama screenshots, anime/manhua | Cluttered UI, Chinese text bias |
| **SauceNAO** | Anime, manga, pixiv illustrations, game CG | Extremely high precision database of Japanese/Asian artists | Useless for live-action human video |
| **Trace.moe** | Anime screenshots & video frames | Identifies exact Anime title, episode number, and timestamp (seconds) | Anime only |

---

## 2. Parameter Schemas for URL Pivots

- **Google Lens Direct By URL**:
  `https://lens.google.com/uploadbyurl?url={IMAGE_URL}`
- **Yandex By URL**:
  `https://yandex.com/images/search?rpt=imageview&url={IMAGE_URL}`
- **Bing Visual Search By URL**:
  `https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIIRP&sbisrc=UrlPaste&q=imgurl:{IMAGE_URL}`
- **TinEye Direct**:
  `https://tineye.com/search?url={IMAGE_URL}`
- **Trace.moe**:
  `https://trace.moe/?url={IMAGE_URL}`
