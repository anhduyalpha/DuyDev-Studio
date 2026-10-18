#!/usr/bin/env python3
"""
dork_generator.py - Generates targeted OSINT search dorks, regional localized queries,
country-specific forum searches, and multi-engine reverse image trace URLs.
"""

import sys
import json
import re
import urllib.parse

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def detect_language_region(text: str) -> str:
    """Detect language/region based on unicode character distributions."""
    if not text:
        return "en"
    
    # CJK Unified Ideographs (Chinese)
    if re.search(r'[\u4e00-\u9fff]', text):
        # Check if contains Japanese Hiragana/Katakana
        if re.search(r'[\u3040-\u30ff]', text):
            return "ja"
        return "zh"
    
    # Japanese kana
    if re.search(r'[\u3040-\u30ff]', text):
        return "ja"
    
    # Korean Hangul
    if re.search(r'[\uac00-\ud7af]', text):
        return "ko"
        
    # Russian Cyrillic
    if re.search(r'[\u0400-\u04ff]', text):
        return "ru"
        
    # Vietnamese specific accented characters
    if re.search(r'[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', text, re.IGNORECASE):
        return "vi"
        
    return "en"

def generate_reverse_engine_urls(image_url: str = None) -> dict:
    """Generate direct reverse image search URLs across major engines."""
    urls = {}
    if image_url:
        encoded = urllib.parse.quote(image_url, safe='')
        urls["Google_Lens"] = f"https://lens.google.com/uploadbyurl?url={encoded}"
        urls["Yandex_Images"] = f"https://yandex.com/images/search?rpt=imageview&url={encoded}"
        urls["Bing_Visual"] = f"https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIIRP&sbisrc=UrlPaste&q=imgurl:{encoded}"
        urls["TinEye"] = f"https://tineye.com/search?url={encoded}"
        urls["Baidu_Image"] = f"https://graph.baidu.com/details?isfromtyn=1&app_id=1011&image={encoded}"
        urls["SauceNAO"] = f"https://saucenao.com/search.php?db=999&url={encoded}"
        urls["TraceMoe"] = f"https://trace.moe/?url={encoded}"
    else:
        urls["Google_Lens_Upload"] = "https://images.google.com/"
        urls["Yandex_Images_Upload"] = "https://yandex.com/images/"
        urls["Bing_Visual_Upload"] = "https://www.bing.com/visualsearch"
        urls["TinEye_Upload"] = "https://tineye.com/"
        urls["Baidu_Image_Upload"] = "https://images.baidu.com/"
        urls["SauceNAO_Upload"] = "https://saucenao.com/"
        urls["TraceMoe_Upload"] = "https://trace.moe/"
    return urls

def generate_video_dorks(query: str, entities: list = None, region: str = None) -> list:
    """
    Generate targeted video search dorks localized to regional forums,
    Asian video hubs, Telegram networks, and archive repositories.
    """
    clean_q = query.strip(' "\'')
    entities = entities or []
    detected_region = region or detect_language_region(f"{query} {' '.join(entities)}")
    
    dorks = []
    
    # 1. Global video exact search
    dorks.append({
        "category": "Exact Match Video (Global)",
        "region": "global",
        "dork": f'"{clean_q}" (video OR clip OR full OR mp4 OR watch)',
        "purpose": "Find direct mentions of query alongside video assets"
    })

    # 2. Regional / Country-specific forums & platforms
    if detected_region == "zh":
        dorks.extend([
            {
                "category": "Chinese Social & Video Portals",
                "region": "zh",
                "dork": f'"{clean_q}" (site:bilibili.com OR site:weibo.com OR site:douyin.com OR site:xiaohongshu.com OR site:kuaishou.com)',
                "purpose": "Mainland Chinese mainstream UGC and video channels"
            },
            {
                "category": "Chinese Forums & Tieba",
                "region": "zh",
                "dork": f'"{clean_q}" (site:tieba.baidu.com OR site:zhihu.com OR site:douban.com) (视频 OR 资源 OR 完整版 OR 拳击)',
                "purpose": "Baidu Tieba threads, Zhihu discussions, and Douban posts"
            },
            {
                "category": "Chinese Twitter Video Archives & Mirrors",
                "region": "zh",
                "dork": f'"{clean_q}" (site:monsnode.com OR site:twi-dl.net OR site:sotwe.com OR site:urvideo.net)',
                "purpose": "Twitter/X video syndication and crawler archives"
            },
            {
                "category": "Chinese Telegram Leak Channels",
                "region": "zh",
                "dork": f'site:t.me/s/ "{clean_q}" (视频 OR 完整版 OR 网盘 OR 拳击)',
                "purpose": "Public Telegram channel posts with media previews"
            },
            {
                "category": "Chinese Adult & Model Leak Archives",
                "region": "zh",
                "dork": f'"{clean_q}" (site:91porn.com OR site:hjd2048.com OR site:51cg.fun OR site:chigua.com OR site:t66y.com)',
                "purpose": "Chinese model photoshoot, cosplay, and influencer leak databases"
            }
        ])
    elif detected_region == "ja":
        dorks.extend([
            {
                "category": "Japanese Forums & 5channel",
                "region": "ja",
                "dork": f'"{clean_q}" (site:5ch.net OR site:2ch.net OR site:chiebukuro.yahoo.co.jp) (動画 OR 保存)',
                "purpose": "Japanese 5channel threads and Yahoo Chiebukuro inquiries"
            },
            {
                "category": "Japanese Video Mirrors",
                "region": "ja",
                "dork": f'"{clean_q}" (site:nicovideo.jp OR site:video.fc2.com OR site:monsnode.com OR site:twidouga.net)',
                "purpose": "Japanese video archives, NicoNico, and Twitter tool mirrors"
            }
        ])
    elif detected_region == "ko":
        dorks.extend([
            {
                "category": "Korean Communities & Portals",
                "region": "ko",
                "dork": f'"{clean_q}" (site:dcinside.com OR site:arca.live OR site:theqoo.net OR site:fmkorea.com) (영상 OR 풀버전)',
                "purpose": "Korean community boards (DC Inside, ArcaLive, TheQoo, FMKorea)"
            }
        ])
    elif detected_region == "ru":
        dorks.extend([
            {
                "category": "Russian Social & Archives",
                "region": "ru",
                "dork": f'"{clean_q}" (site:vk.com OR site:rutube.ru OR site:ok.ru OR site:t.me/s/) (видео OR скачать)',
                "purpose": "VKontakte groups, Rutube clips, and Russian Telegram channels"
            }
        ])
    elif detected_region == "vi":
        dorks.extend([
            {
                "category": "Vietnamese Forums & Social",
                "region": "vi",
                "dork": f'"{clean_q}" (site:voz.vn OR site:facebook.com OR site:tiktok.com OR site:t.me/s/) (clip OR full OR lộ OR link)',
                "purpose": "Voz forums, Facebook public groups, and Vietnamese Telegram channels"
            }
        ])

    # 3. Underground communities, Reddit, and global Telegram
    dorks.append({
        "category": "Underground & Community Aggregators",
        "region": "global",
        "dork": f'"{clean_q}" (site:reddit.com OR site:t.me/s/ OR site:vk.com OR site:coomer.su OR site:erome.com)',
        "purpose": "Reddit threads, public Telegram channels, and independent model archives"
    })
    
    # 4. Direct stream manifests & cloud storage shares
    dorks.append({
        "category": "Cloud & Direct Stream Links",
        "region": "global",
        "dork": f'"{clean_q}" (site:drive.google.com OR site:mega.nz OR site:bunkr.is OR inurl:m3u8 OR filetype:mp4)',
        "purpose": "Direct download shares, Bunkr hosts, Drive folders, or raw HLS manifests"
    })
    
    # 5. Entity-specific pivots (e.g. detected usernames, watermarks, tags)
    for ent in entities:
        ent_clean = ent.strip(' @#')
        if len(ent_clean) >= 2:
            dorks.append({
                "category": f"Entity Pivot: {ent_clean}",
                "region": detected_region,
                "dork": f'("{ent_clean}" OR inurl:"{ent_clean}") (video OR profile OR post OR 视频 OR clip)',
                "purpose": f"Track author/uploader handle across social platforms"
            })
            
    return dorks

def build_osint_packet(query: str, image_url: str = None, entities: list = None) -> dict:
    """Build full localized OSINT search packet for investigative workflows."""
    region = detect_language_region(f"{query} {' '.join(entities or [])}")
    return {
        "query": query,
        "detected_region": region,
        "image_url": image_url,
        "reverse_search_engines": generate_reverse_engine_urls(image_url),
        "video_dorks": generate_video_dorks(query, entities, region)
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python dork_generator.py <query_or_keyword> [image_url] [entity1,entity2...]"}))
        sys.exit(1)

    q = sys.argv[1]
    img = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2].startswith("http") else None
    ents = sys.argv[3].split(",") if len(sys.argv) > 3 else []
    packet = build_osint_packet(q, img, ents)
    print(json.dumps(packet, indent=2, ensure_ascii=False))
