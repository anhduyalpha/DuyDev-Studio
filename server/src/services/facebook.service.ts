/**
 * Facebook Service - Multi-tier Video Extractor & Stream Manager
 * Native port of n8n Facebook Downloader workflow.
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable, Transform } from 'stream';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { FastifyReply } from 'fastify';
import { FacebookVideoData, FacebookMediaFormat } from '../schemas/facebook.schema.js';
import { StorageManager } from '../storage/storage.manager.js';
import { resolvedStoragePaths } from '../config/env.config.js';
import { DriveService } from './drive.service.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { validateSafeMediaUrl } from '../api/middleware/security.middleware.js';

const execFileAsync = promisify(execFile);
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class FacebookService {
  private static photoFallbackUrls = new Map<string, string>();

  private static rememberPhotoFallback(mediaId: string, scontentUri: string): void {
    if (!mediaId || !scontentUri) return;
    if (this.photoFallbackUrls.size >= 500) {
      const oldestKey = this.photoFallbackUrls.keys().next().value;
      if (oldestKey) this.photoFallbackUrls.delete(oldestKey);
    }
    this.photoFallbackUrls.set(mediaId, scontentUri);
  }

  private static formatCleanTitle(rawText: string, authorName: string, defaultLabel = 'Bài viết'): string {
    const singleLine = (rawText || '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (singleLine) {
      return singleLine.length > 85 ? `${singleLine.slice(0, 82).trim()}...` : singleLine;
    }
    return authorName && authorName !== 'Facebook User'
      ? `${authorName} - ${defaultLabel}`
      : `Facebook ${defaultLabel}`;
  }

  /**
   * Cleans and validates raw text to a valid Facebook URL
   */
  static extractUrl(rawText: string): string {
    let trimmed = (rawText || '').trim();
    if (!trimmed) {
      throw new BadRequestError('Liên kết không hợp lệ. Vui lòng dán liên kết Facebook hoặc FB Watch hợp lệ.');
    }

    // Auto-prepend https:// if protocol-less
    if (/^(?:[a-zA-Z0-9_-]+\.)?(?:facebook\.com|fb\.watch|fb\.com|fb\.gg)(?:\/|$)/i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    const urlMatch = trimmed.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?(?:facebook\.com|fb\.watch|fb\.com|fb\.gg)[^\s"'<>]+/i);
    if (!urlMatch) {
      throw new BadRequestError('Liên kết không hợp lệ. Vui lòng dán liên kết Facebook hoặc FB Watch hợp lệ.');
    }

    // Strip trailing punctuation
    let cleanUrl = urlMatch[0].replace(/[.,;!?)"'\]>]+$/, '');

    // Strip tracking parameters
    try {
      const parsed = new URL(cleanUrl);
      const trackingParams = [
        'fbclid',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
        'mibextid',
        'rdid',
        'hrc',
        'refsrc',
        '_rdr'
      ];
      for (const p of trackingParams) {
        parsed.searchParams.delete(p);
      }
      return parsed.toString();
    } catch {
      return cleanUrl;
    }
  }

  /**
   * Helper to decode HTML entities (including 32-bit emojis)
   */
  private static decodeHtmlEntities(str: string): string {
    if (!str) return '';
    return str
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        try {
          return String.fromCodePoint(parseInt(hex, 16));
        } catch {
          return '';
        }
      })
      .replace(/&#(\d+);/g, (_, dec) => {
        try {
          return String.fromCodePoint(parseInt(dec, 10));
        } catch {
          return '';
        }
      })
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#064;/g, '@');
  }

  /**
   * Resolves Facebook video or post metadata using multi-tier strategy
   */
  static async resolveVideo(rawInput: string): Promise<FacebookVideoData> {
    const targetUrl = this.extractUrl(rawInput);
    logger.info({ targetUrl }, '[Facebook] Resolving media metadata...');

    // Extract fallback ID
    const shareMatch = targetUrl.match(/share\/(?:p\/|v\/|r\/)?([a-zA-Z0-9_-]+)/i);
    const reelMatch = targetUrl.match(/reel(?:s)?\/([a-zA-Z0-9_-]+)/i);
    const watchMatch = targetUrl.match(/[?&]v=(\d+)/i);
    const postMatch = targetUrl.match(/(?:posts|videos|photos)\/([a-zA-Z0-9_-]+)/i);
    const photoMatch = targetUrl.match(/[?&]fbid=(\d+)/i);
    const fallbackId = (shareMatch?.[1] || reelMatch?.[1] || watchMatch?.[1] || postMatch?.[1] || photoMatch?.[1] || `fb_${Date.now()}`);

    let resolvedData: FacebookVideoData | null = null;

    // Fast-path Tier 1: Try fast OpenGraph crawler (~300ms) for all links first
    try {
      const postResult = await this.tryPostExtraction(targetUrl, fallbackId);
      if (postResult && (postResult.videoHdUrl || postResult.formats.length > 0 || postResult.images?.length)) {
        resolvedData = postResult;
        logger.info({ id: resolvedData.id, mediaType: resolvedData.mediaType }, '[Facebook] Resolved via Fast OpenGraph Extractor');
      }
    } catch (postErr: any) {
      logger.debug({ err: postErr?.message }, '[Facebook] Fast OpenGraph extraction skipped');
    }

    // Fallback Tier 2: Open Resolver / RapidAPI if configured
    if (!resolvedData) {
      try {
        const apiResult = await this.tryApiExtraction(targetUrl, fallbackId);
        if (apiResult) {
          resolvedData = apiResult;
          logger.info({ id: resolvedData.id }, '[Facebook] Resolved via Tier 2 API');
        }
      } catch (e: any) {
        logger.debug({ err: e?.message }, '[Facebook] Tier 2 API skipped');
      }
    }

    // Fallback Tier 3: yt-dlp CLI (with --no-playlist)
    if (!resolvedData) {
      try {
        const ytdlpResult = await this.tryYtdlpExtraction(targetUrl, fallbackId);
        if (ytdlpResult) {
          resolvedData = ytdlpResult;
          logger.info({ id: resolvedData.id }, '[Facebook] Resolved via Tier 3 yt-dlp');
        }
      } catch (ytErr: any) {
        logger.warn({ err: ytErr?.message }, '[Facebook] Tier 3 yt-dlp failed');
      }
    }

    if (!resolvedData) {
      throw new BadRequestError('Không thể lấy thông tin bài viết hoặc video Facebook này. Nội dung có thể đang ở chế độ riêng tư, trong nhóm kín hoặc đã bị xóa.');
    }

    // Check Drive duplication
    const existing = await this.checkExistingInDrive(resolvedData.id, targetUrl);
    resolvedData.existingInDrive = existing.exists ? existing.item : null;

    return resolvedData;
  }

  /**
   * Tier 1: Try public API endpoint (mirroring n8n RapidAPI request)
   */
  private static async tryApiExtraction(targetUrl: string, fallbackId: string): Promise<FacebookVideoData | null> {
    // If RAPIDAPI_KEY is available in environment
    const apiKey = process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY;
    if (!apiKey) return null;

    try {
      const formData = new FormData();
      formData.append('url', targetUrl);

      const res = await fetch('https://facebook-video-downloader11.p.rapidapi.com/index.php', {
        method: 'POST',
        headers: {
          'x-rapidapi-host': 'facebook-video-downloader11.p.rapidapi.com',
          'x-rapidapi-key': apiKey
        },
        body: formData,
        signal: AbortSignal.timeout(8000)
      });

      if (!res.ok) return null;
      const data = await res.json() as any;
      if (data.error) return null;

      const medias = Array.isArray(data.medias) ? data.medias : [];
      if (medias.length === 0) return null;

      const formats: FacebookMediaFormat[] = medias.map((m: any) => ({
        quality: m.quality || 'sd',
        label: (m.quality || 'SD').toUpperCase(),
        url: m.url,
        ext: m.extension || 'mp4'
      }));

      const hdMedia = formats.find(f => f.quality.toLowerCase().includes('hd'));
      const sdMedia = formats.find(f => f.quality.toLowerCase().includes('sd')) || formats[0];

      return {
        id: String(data.id || fallbackId),
        title: data.title || 'Facebook Video',
        author: {
          name: data.author || 'Facebook'
        },
        cover: data.thumbnail || '',
        duration: Number(data.duration || 0),
        formats,
        videoHdUrl: hdMedia?.url,
        videoSdUrl: sdMedia?.url,
        extractor: 'resolver'
      };
    } catch {
      return null;
    }
  }

  /**
   * Tier 2: Local yt-dlp CLI
   */
  private static async tryYtdlpExtraction(targetUrl: string, fallbackId: string): Promise<FacebookVideoData | null> {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      targetUrl
    ], { timeout: 20000, maxBuffer: 15 * 1024 * 1024 });

    const json = JSON.parse(stdout.trim());
    const id = String(json.id || fallbackId);
    const authorName = json.uploader || json.channel || 'Facebook User';
    const rawCaption = (json.description || json.title || '').trim();
    const title = this.formatCleanTitle(json.title || rawCaption, authorName, 'Video');
    const cover = json.thumbnail || '';
    const duration = Number(json.duration || 0);
    const author = {
      name: authorName,
      id: json.uploader_id
    };

    const formats: FacebookMediaFormat[] = [];
    let videoHdUrl: string | undefined;
    let videoSdUrl: string | undefined;

    if (Array.isArray(json.formats)) {
      // Find direct progressive video formats or best combined
      const mp4Formats = json.formats.filter((f: any) => f.url && (f.ext === 'mp4' || f.vcodec !== 'none'));

      // Look for HD format (720p+)
      const hdFmt = mp4Formats.find((f: any) => (f.height && f.height >= 720) || (f.format_id && f.format_id.includes('hd')));
      if (hdFmt) {
        videoHdUrl = hdFmt.url;
        formats.push({
          quality: 'hd',
          label: `HD (${hdFmt.height || 720}p)`,
          url: hdFmt.url,
          sizeBytes: hdFmt.filesize || undefined,
          ext: 'mp4'
        });
      }

      // Look for SD format (<720p)
      const sdFmt = mp4Formats.find((f: any) => (f.height && f.height < 720) || (f.format_id && f.format_id.includes('sd'))) || mp4Formats[0];
      if (sdFmt) {
        videoSdUrl = sdFmt.url;
        formats.push({
          quality: 'sd',
          label: `SD (${sdFmt.height || 360}p)`,
          url: sdFmt.url,
          sizeBytes: sdFmt.filesize || undefined,
          ext: 'mp4'
        });
      }
    }

    if (!videoHdUrl && !videoSdUrl && json.url) {
      videoSdUrl = json.url;
      formats.push({
        quality: 'sd',
        label: 'Chuẩn',
        url: json.url,
        ext: 'mp4'
      });
    }

    return {
      id,
      title,
      caption: rawCaption || undefined,
      author,
      cover,
      duration,
      formats,
      videoHdUrl: videoHdUrl || undefined,
      videoSdUrl: videoSdUrl || videoHdUrl,
      mediaType: 'video',
      extractor: 'ytdlp'
    };
  }

  /**
   * Tier 1 / Universal Post, Album, Reel & Video Extractor:
   * Combines Facebook OpenGraph crawler and Desktop Comet SSR JSON extraction in parallel.
   */
  private static async tryPostExtraction(targetUrl: string, fallbackId: string): Promise<FacebookVideoData | null> {
    try {
      logger.info({ targetUrl }, '[Facebook] Attempting dual OpenGraph + Comet SSR extraction...');

      const [ogSettled, cometSettled] = await Promise.allSettled([
        fetch(targetUrl, {
          headers: {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(10000)
        }).then(async (r) => ({ ok: r.ok, url: r.url, html: r.ok ? await r.text() : '' })),
        fetch(targetUrl, {
          headers: {
            'User-Agent': DEFAULT_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Upgrade-Insecure-Requests': '1'
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(10000)
        }).then(async (r) => ({ ok: r.ok, url: r.url, html: r.ok ? await r.text() : '' }))
      ]);

      const ogRes = ogSettled.status === 'fulfilled' ? ogSettled.value : { ok: false, url: '', html: '' };
      const cometRes = cometSettled.status === 'fulfilled' ? cometSettled.value : { ok: false, url: '', html: '' };

      if (!ogRes.html && !cometRes.html) {
        return null;
      }

      const finalUrl = cometRes.url || ogRes.url || targetUrl;
      const html = ogRes.html || cometRes.html;

      const isVideoOrReelUrl =
        /(?:\/reel(?:s)?\/|\/watch(?:\/|\?|$)|\/videos\/|\/share\/(?:r|v)\/|fb\.watch)/i.test(targetUrl) ||
        /(?:\/reel(?:s)?\/|\/watch(?:\/|\?|$)|\/videos\/)/i.test(finalUrl);

      // Extract story_fbid so we NEVER mistake a story/post ID for a photo media_id
      const storyFbidMatch =
        finalUrl.match(/story_fbid=(\d+)/i) ||
        targetUrl.match(/story_fbid=(\d+)/i) ||
        html.match(/story_fbid=(\d+)/i);
      const storyFbid = storyFbidMatch?.[1] || '';

      const getMeta = (sourceHtml: string, prop: string): string => {
        if (!sourceHtml) return '';
        const m =
          sourceHtml.match(new RegExp(`<meta\\s+(?:property|name)=["'](?:og:|twitter:)?${prop}["']\\s+content=["']([^"']+)["']`, 'i')) ||
          sourceHtml.match(new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+(?:property|name)=["'](?:og:|twitter:)?${prop}["']`, 'i'));
        return m ? this.decodeHtmlEntities(m[1]) : '';
      };

      const ogTitle = getMeta(ogRes.html, 'title') || getMeta(cometRes.html, 'title');
      const ogDesc = getMeta(ogRes.html, 'description') || getMeta(cometRes.html, 'description');
      const ogImage = getMeta(ogRes.html, 'image') || getMeta(cometRes.html, 'image');
      const ogVideo =
        getMeta(ogRes.html, 'video') ||
        getMeta(ogRes.html, 'video:url') ||
        getMeta(ogRes.html, 'video:secure_url') ||
        getMeta(cometRes.html, 'video');

      // Parse Comet SSR JSON blocks for full untruncated caption, exact author, album photos, and progressive video URLs
      const cometAuthors: string[] = [];
      const storyMessages: string[] = [];
      const fallbackMessages: string[] = [];
      const storyPhotosMap = new Map<string, string>();
      const fallbackPhotosMap = new Map<string, string>();
      const cometVideosMap = new Map<string, { id?: string; hd?: string; sd?: string; durationSec?: number; thumb?: string }>();
      let hasVideoAttachment = false;

      if (cometRes.html) {
        const scriptBlocks = Array.from(
          cometRes.html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)
        ).map((m) => m[1]);

        const walkComet = (obj: any, inComment = false, inMainAttachment = false): void => {
          if (!obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) {
            for (const item of obj) walkComet(item, inComment, inMainAttachment);
            return;
          }

          // Comment attachments in Facebook Relay use style_type_renderer; skip them for post photos
          const nextInComment = inComment || Boolean(obj.style_type_renderer);
          const hasStoryActors = Array.isArray(obj.actors) && Boolean(obj.actors[0]?.name);

          if (hasStoryActors && !nextInComment) {
            cometAuthors.push(String(obj.actors[0].name));
            if (obj.message && typeof obj.message.text === 'string' && obj.message.text.trim()) {
              storyMessages.push(obj.message.text.trim());
            }
          } else if (!nextInComment && obj.message && typeof obj.message.text === 'string' && obj.message.text.trim()) {
            fallbackMessages.push(obj.message.text.trim());
          }

          // Photo node extraction (strictly outside comment attachments)
          if (!nextInComment && (obj.__typename === 'Photo' || obj.__isMedia === 'Photo')) {
            const pid = obj.id ? String(obj.id) : '';
            const imgUri =
              obj.photo_image?.uri ||
              obj.viewer_image?.uri ||
              obj.massive_image?.uri ||
              obj.image?.uri ||
              obj.large_share_image?.uri ||
              '';
            if (pid && /^\d+$/.test(pid) && pid !== storyFbid && imgUri) {
              this.rememberPhotoFallback(pid, imgUri);
              if (inMainAttachment) {
                if (!storyPhotosMap.has(pid)) storyPhotosMap.set(pid, imgUri);
              } else {
                if (!fallbackPhotosMap.has(pid)) fallbackPhotosMap.set(pid, imgUri);
              }
            }
          }

          // Video node extraction
          if (!nextInComment && (obj.__typename === 'Video' || obj.__isMedia === 'Video')) {
            if (inMainAttachment || isVideoOrReelUrl) {
              hasVideoAttachment = true;
            }
            const vid = obj.id ? String(obj.id) : 'default_video';
            const hd = obj.browser_native_hd_url || obj.playable_url_quality_hd || obj.hd_src || undefined;
            const sd = obj.browser_native_sd_url || obj.playable_url || obj.sd_src || undefined;
            const durationSec = obj.playable_duration_in_ms
              ? Math.round(Number(obj.playable_duration_in_ms) / 1000)
              : undefined;
            const thumb = obj.preferred_thumbnail?.image?.uri || obj.thumbnailImage?.uri || undefined;

            if (hd || sd || durationSec || thumb) {
              const prev = cometVideosMap.get(vid) || { id: vid };
              cometVideosMap.set(vid, {
                id: vid,
                hd: prev.hd || hd,
                sd: prev.sd || sd,
                durationSec: prev.durationSec || durationSec,
                thumb: prev.thumb || thumb
              });
            }
          }

          // Comet videoDeliveryLegacyFields / videoDeliveryResponseFragment
          if (obj.videoDeliveryLegacyFields || obj.videoDeliveryResponseFragment) {
            const vdf = obj.videoDeliveryLegacyFields || obj.videoDeliveryResponseFragment;
            const vid = vdf.id ? String(vdf.id) : 'default_video';
            const hd = vdf.browser_native_hd_url || vdf.hd_src || undefined;
            const sd = vdf.browser_native_sd_url || vdf.sd_src || undefined;
            let durationSec: number | undefined;
            if (typeof vdf.dash_manifest_xml_string === 'string') {
              const durMatch = vdf.dash_manifest_xml_string.match(/mediaPresentationDuration="PT([\d.]+)S"/i);
              if (durMatch) durationSec = Math.round(parseFloat(durMatch[1]));
            }
            if (hd || sd) {
              const prev = cometVideosMap.get(vid) || { id: vid };
              cometVideosMap.set(vid, {
                id: vid,
                hd: prev.hd || hd,
                sd: prev.sd || sd,
                durationSec: prev.durationSec || durationSec,
                thumb: prev.thumb
              });
            }
          }

          for (const key of Object.keys(obj)) {
            const childInMainAttachment = inMainAttachment || (key === 'attachments' && (hasStoryActors || Boolean(obj.message)));
            walkComet(obj[key], nextInComment, childInMainAttachment);
          }
        };

        for (const block of scriptBlocks) {
          try {
            walkComet(JSON.parse(block));
          } catch {}
        }
      }

      if (!ogTitle && !ogDesc && !ogImage && !ogVideo && cometAuthors.length === 0 && storyPhotosMap.size === 0 && cometVideosMap.size === 0) {
        return null;
      }

      // Resolve primary ID from URL
      const reelOrVideoIdMatch =
        finalUrl.match(/(?:reel(?:s)?|videos)\/(\d+)/i) ||
        targetUrl.match(/(?:reel(?:s)?|videos)\/(\d+)/i) ||
        finalUrl.match(/[?&]v=(\d+)/i) ||
        targetUrl.match(/[?&]v=(\d+)/i);
      const idMatch =
        reelOrVideoIdMatch ||
        finalUrl.match(/(?:posts|photos|share\/(?:p|v|r)|share)\/([0-9a-zA-Z_-]+)/i) ||
        finalUrl.match(/(?:[?&]|&amp;)fbid=(\d+)/i);
      const postId = idMatch?.[1] || storyFbid || fallbackId;

      const authorName = cometAuthors[0] || ogTitle || 'Facebook User';
      const fullCaption = (storyMessages[0] || ( !isVideoOrReelUrl && fallbackMessages[0] ) || ogDesc || '').trim();
      const displayTitle = this.formatCleanTitle(
        fullCaption || ogDesc,
        authorName,
        isVideoOrReelUrl ? 'Video' : 'Bài viết'
      );

      // 1. Check for Video streams (from Comet SSR, OpenGraph, or regex in HTML)
      let hdUrl = ogVideo && ogVideo.startsWith('http') ? ogVideo : '';
      let sdUrl = '';
      let videoDuration = 0;
      let videoThumb = ogImage || '';

      const matchedCometVideo =
        cometVideosMap.get(postId) ||
        cometVideosMap.get(fallbackId) ||
        Array.from(cometVideosMap.values()).find((v) => v.hd || v.sd);

      if (matchedCometVideo && (isVideoOrReelUrl || hasVideoAttachment || storyPhotosMap.size === 0)) {
        hdUrl = matchedCometVideo.hd || hdUrl;
        sdUrl = matchedCometVideo.sd || sdUrl;
        videoDuration = matchedCometVideo.durationSec || 0;
        videoThumb = videoThumb || matchedCometVideo.thumb || '';
      }

      if (!hdUrl && !sdUrl) {
        const combinedHtml = `${ogRes.html}\n${cometRes.html}`;
        const hdMatch = combinedHtml.match(/(?:hd_src|browser_native_hd_url)["']?:\s*["'](https:[^"']+)["']/i);
        const sdMatch = combinedHtml.match(/(?:sd_src|browser_native_sd_url)["']?:\s*["'](https:[^"']+)["']/i);
        if (hdMatch) {
          hdUrl = hdMatch[1].replace(/\\u0026/g, '&').replace(/\\u0025/g, '%').replace(/\\\//g, '/');
        }
        if (sdMatch) {
          sdUrl = sdMatch[1].replace(/\\u0026/g, '&').replace(/\\u0025/g, '%').replace(/\\\//g, '/');
        }
      }

      if (hdUrl || sdUrl) {
        const formats: FacebookMediaFormat[] = [];
        if (hdUrl) {
          formats.push({
            quality: 'hd',
            label: 'HD Video',
            url: hdUrl,
            ext: 'mp4'
          });
        }
        if (sdUrl && sdUrl !== hdUrl) {
          formats.push({
            quality: 'sd',
            label: 'SD Video',
            url: sdUrl,
            ext: 'mp4'
          });
        }

        return {
          id: matchedCometVideo?.id && matchedCometVideo.id !== 'default_video' ? matchedCometVideo.id : postId,
          title: displayTitle,
          caption: fullCaption,
          author: { name: authorName },
          cover: videoThumb,
          duration: videoDuration,
          formats,
          videoHdUrl: hdUrl || sdUrl,
          videoSdUrl: sdUrl || hdUrl,
          mediaType: 'video',
          extractor: 'scraper'
        };
      }

      // CRITICAL GUARD: If the link is a Reel/Video URL or has a Video attachment, NEVER return a static thumbnail image!
      // Returning null here allows Tier 2 (API) and Tier 3 (yt-dlp) to extract the actual video stream.
      if (isVideoOrReelUrl || hasVideoAttachment) {
        logger.info({ targetUrl, finalUrl }, '[Facebook] Video/Reel link detected without direct SSR stream; deferring to yt-dlp');
        return null;
      }

      // 2. Photo / Post Extraction
      const activePhotosMap = storyPhotosMap.size > 0 ? storyPhotosMap : fallbackPhotosMap;
      const images: Array<{ id?: string; url: string; label?: string }> = [];

      if (activePhotosMap.size > 0) {
        let idx = 1;
        for (const [fid] of activePhotosMap.entries()) {
          images.push({
            id: fid,
            url: `https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=${fid}`,
            label: `Ảnh ${idx++}`
          });
        }
      } else {
        // Fallback to OpenGraph media_id or query ?fbid= (strictly excluding story_fbid!)
        const rawPhotoIds = [
          ...Array.from(html.matchAll(/media_id=(\d+)/gi)).map((m) => m[1]),
          ...Array.from(html.matchAll(/(?:[?&]|&amp;)fbid=(\d+)/gi)).map((m) => m[1])
        ].filter((fid) => fid && fid !== storyFbid);

        const uniquePhotoIds = Array.from(new Set(rawPhotoIds));
        if (uniquePhotoIds.length > 0) {
          for (let i = 0; i < uniquePhotoIds.length; i++) {
            const fid = uniquePhotoIds[i];
            images.push({
              id: fid,
              url: `https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=${fid}`,
              label: `Ảnh ${i + 1}`
            });
          }
        } else if (ogImage && !ogImage.includes(`media_id=${storyFbid}`)) {
          images.push({
            url: ogImage,
            label: 'Ảnh bài viết'
          });
        }
      }

      if (images.length > 0) {
        const formats: FacebookMediaFormat[] = images.map((img, idx) => ({
          quality: `photo_${idx + 1}`,
          label: img.label || `Ảnh ${idx + 1}`,
          url: img.url,
          ext: 'jpg'
        }));

        const safeCover =
          ogImage && (!storyFbid || !ogImage.includes(`media_id=${storyFbid}`))
            ? ogImage
            : images[0].url;

        return {
          id: postId,
          title: displayTitle,
          caption: fullCaption,
          author: { name: authorName },
          cover: safeCover,
          duration: 0,
          formats,
          mediaType: 'image',
          images,
          extractor: 'scraper'
        };
      }

      return null;
    } catch (err: any) {
      logger.warn({ err: err?.message }, '[Facebook] Post extraction encountered an error');
      return null;
    }
  }

  /**
   * Proxies Facebook video or image stream to client with HTTP 206 Partial Content support
   */
  static async proxyStream(
    targetUrl: string,
    download: boolean,
    filename: string,
    rangeHeader: string | undefined,
    reply: FastifyReply
  ): Promise<any> {
    try {
      validateSafeMediaUrl(targetUrl, ['fbcdn.net', 'facebook.com', 'fbsbx.com']);
    } catch (e: any) {
      throw new BadRequestError(e.message || 'URL không hợp lệ (SSRF Guard)');
    }

    const isFbLookaside = targetUrl.includes('lookaside.fbsbx.com');
    const headers: Record<string, string> = {
      'User-Agent': isFbLookaside ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' : DEFAULT_UA,
      'Referer': 'https://www.facebook.com/'
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    let upstreamRes = await fetch(targetUrl, {
      headers,
      signal: AbortSignal.timeout(60000)
    });

    const initialContentType = upstreamRes.headers.get('content-type') || '';
    if (isFbLookaside && (!upstreamRes.ok || initialContentType.includes('text/html'))) {
      const mediaIdMatch = targetUrl.match(/media_id=(\d+)/i);
      const fallbackUrl = mediaIdMatch ? this.photoFallbackUrls.get(mediaIdMatch[1]) : undefined;
      if (fallbackUrl) {
        logger.info({ mediaId: mediaIdMatch?.[1] }, '[Facebook] Lookaside returned HTML/error; falling back to scontent CDN URI');
        upstreamRes = await fetch(fallbackUrl, {
          headers: {
            'User-Agent': DEFAULT_UA,
            'Referer': 'https://www.facebook.com/'
          },
          signal: AbortSignal.timeout(60000)
        });
      } else if (initialContentType.includes('text/html')) {
        throw new BadRequestError('Không thể tải hình ảnh từ Facebook (liên kết media_id không phải là ảnh hợp lệ).');
      }
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      throw new BadRequestError(`Không thể kết nối đến nội dung Facebook: HTTP ${upstreamRes.status}`);
    }

    const upstreamType = upstreamRes.headers.get('content-type');
    const cleanFilename = (filename || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const isImage = isFbLookaside || upstreamType?.startsWith('image/') || cleanFilename.endsWith('.jpg') || cleanFilename.endsWith('.png');
    const defaultMime = isImage ? 'image/jpeg' : 'video/mp4';
    const responseMime = upstreamType && !upstreamType.includes('text/html') ? upstreamType : defaultMime;

    reply.status(upstreamRes.status);
    reply.header('Content-Type', responseMime);
    reply.header('Accept-Ranges', 'bytes');

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) reply.header('Content-Length', contentLength);

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) reply.header('Content-Range', contentRange);

    if (download) {
      const safeName = cleanFilename || (isImage ? 'facebook_photo.jpg' : 'facebook_video.mp4');
      const encodedName = encodeURIComponent(safeName);
      const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
      reply.header('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    } else {
      reply.header('Content-Disposition', 'inline');
    }

    if (!upstreamRes.body) {
      return reply.send(Buffer.alloc(0));
    }

    const nodeReadable = Readable.fromWeb(upstreamRes.body as any);
    return reply.send(nodeReadable);
  }

  /**
   * Checks if video already exists in DD Studio Drive (`/data/storage/drive/facebook/`)
   */
  static async checkExistingInDrive(
    videoId?: string,
    originalUrl?: string
  ): Promise<{ exists: boolean; item?: any }> {
    const fbDir = path.join(resolvedStoragePaths.drive, 'facebook');
    if (!fs.existsSync(fbDir)) {
      return { exists: false };
    }

    const cleanId = (videoId || '').trim();
    const normInputUrl = (originalUrl || '').split('?')[0].replace(/\/$/, '').toLowerCase();
    if (!cleanId && !normInputUrl) return { exists: false };

    try {
      const files = await fsPromises.readdir(fbDir, { withFileTypes: true });
      const mediaFiles = files.filter(f => !f.isDirectory() && (f.name.endsWith('.mp4') || f.name.endsWith('.jpg') || f.name.endsWith('.png')));

      // Fast check: direct filename match on videoId
      for (const file of mediaFiles) {
        if (cleanId && (file.name.includes(cleanId) || (cleanId.length >= 8 && file.name.includes(cleanId.slice(-8))))) {
          const mediaDiskPath = path.join(fbDir, file.name);
          const stat = await fsPromises.stat(mediaDiskPath).catch(() => null);
          if (stat) {
            const metaPath = path.join(fbDir, `${file.name.replace(/\.[^.]+$/, '')}.meta.json`);
            let meta: any = null;
            if (fs.existsSync(metaPath)) {
              try {
                meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf8'));
              } catch {}
            }
            return {
              exists: true,
              item: {
                fileName: file.name,
                relPath: `/facebook/${file.name}`,
                sizeBytes: stat.size,
                title: meta?.title || file.name,
                thumbnail: meta?.thumbnail,
                duration: meta?.duration,
                updatedAt: stat.mtime.toISOString()
              }
            };
          }
        }
      }

      // Parallel batch check for metadata files
      const metaEntries = files
        .filter(f => !f.isDirectory() && f.name.endsWith('.meta.json'))
        .slice(0, 40);

      const loadedMetas = await Promise.all(
        metaEntries.map(async (me) => {
          try {
            const raw = await fsPromises.readFile(path.join(fbDir, me.name), 'utf8');
            return { name: me.name, meta: JSON.parse(raw) };
          } catch {
            return null;
          }
        })
      );

      for (const entry of loadedMetas) {
        if (!entry || !entry.meta) continue;
        const meta = entry.meta;
        let isMatch = false;

        if (cleanId && String(meta.facebookVideoId) === cleanId) {
          isMatch = true;
        }

        if (!isMatch && normInputUrl && meta.originalUrl) {
          const normMetaUrl = meta.originalUrl.split('?')[0].replace(/\/$/, '').toLowerCase();
          if (normMetaUrl === normInputUrl) isMatch = true;
        }

        if (isMatch) {
          const baseName = entry.name.replace(/\.meta\.json$/, '');
          for (const ext of ['.mp4', '.jpg', '.png']) {
            const candidatePath = path.join(fbDir, `${baseName}${ext}`);
            if (fs.existsSync(candidatePath)) {
              const stat = await fsPromises.stat(candidatePath);
              return {
                exists: true,
                item: {
                  fileName: `${baseName}${ext}`,
                  relPath: `/facebook/${baseName}${ext}`,
                  sizeBytes: stat.size,
                  title: meta.title || `${baseName}${ext}`,
                  thumbnail: meta.thumbnail,
                  duration: meta.duration,
                  updatedAt: stat.mtime.toISOString()
                }
              };
            }
          }
        }
      }
    } catch {}

    return { exists: false };
  }

  /**
   * Saves video or image stream directly into DD Studio Drive (`/data/storage/drive/facebook/`)
   */
  static async saveToDrive(
    mediaUrl: string,
    title = 'facebook_media',
    id = '',
    originalUrl = '',
    cover = '',
    author?: any,
    duration?: number,
    quality = 'HD',
    overwrite = false,
    mediaType = 'video',
    ext?: string
  ): Promise<{ success: boolean; fileName: string; relPath: string; sizeBytes: number; fileId: string; metadata?: any }> {
    if (!mediaUrl) {
      throw new BadRequestError('Không tìm thấy đường dẫn nội dung để lưu');
    }

    try {
      validateSafeMediaUrl(mediaUrl, ['fbcdn.net', 'facebook.com', 'fbsbx.com']);
    } catch (e: any) {
      throw new BadRequestError(e.message || 'URL không hợp lệ (SSRF Guard)');
    }

    const fbDir = path.join(resolvedStoragePaths.drive, 'facebook');
    if (!fs.existsSync(fbDir)) {
      await fsPromises.mkdir(fbDir, { recursive: true });
    }

    const isImage = mediaType === 'image' || mediaUrl.includes('lookaside.fbsbx.com') || ext === 'jpg' || ext === 'png';
    const resolvedExt = (ext || (isImage ? 'jpg' : 'mp4')).replace(/^\./, '');

    const sanitizedTitle = (title || (isImage ? 'photo' : 'video'))
      .replace(/[\\/:*?"<>|#@$%^&*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 60)
      .trim()
      .replace(/^_+|_+$/g, '');

    const cleanId = (id || Date.now().toString(36)).slice(-10);
    const fileName = `[Facebook]_${sanitizedTitle || (isImage ? 'photo' : 'clip')}_${cleanId}.${resolvedExt}`;
    const targetFilePath = path.join(fbDir, fileName);

    if (overwrite && fs.existsSync(targetFilePath)) {
      await StorageManager.unlinkSafe(targetFilePath);
      await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.meta.json'));
      await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.thumb.jpg'));
    }

    logger.info({ fileName, targetFilePath }, '[Facebook] Saving media directly to Studio Drive...');

    // Download stream to disk
    const isFbLookaside = mediaUrl.includes('lookaside.fbsbx.com');
    const downloadHeaders: Record<string, string> = {
      'User-Agent': isFbLookaside ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' : DEFAULT_UA,
      'Referer': 'https://www.facebook.com/'
    };

    let upstreamRes = await fetch(mediaUrl, {
      headers: downloadHeaders,
      signal: AbortSignal.timeout(120000)
    });

    const saveContentType = upstreamRes.headers.get('content-type') || '';
    if (isFbLookaside && (!upstreamRes.ok || saveContentType.includes('text/html'))) {
      const mediaIdMatch = mediaUrl.match(/media_id=(\d+)/i);
      const fallbackUrl = mediaIdMatch ? this.photoFallbackUrls.get(mediaIdMatch[1]) : undefined;
      if (fallbackUrl) {
        upstreamRes = await fetch(fallbackUrl, {
          headers: {
            'User-Agent': DEFAULT_UA,
            'Referer': 'https://www.facebook.com/'
          },
          signal: AbortSignal.timeout(120000)
        });
      } else if (saveContentType.includes('text/html')) {
        throw new BadRequestError('Không thể tải hình ảnh từ nguồn Facebook (media_id không hợp lệ).');
      }
    }

    if (!upstreamRes.ok || !upstreamRes.body) {
      throw new BadRequestError(`Không thể tải nội dung từ nguồn Facebook: HTTP ${upstreamRes.status}`);
    }

    const fileStream = fs.createWriteStream(targetFilePath);
    const hash = crypto.createHash('sha256');
    let byteCount = 0;

    const tracker = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        byteCount += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      }
    });

    await pipeline(Readable.fromWeb(upstreamRes.body as any), tracker, fileStream);

    const hashSha256 = hash.digest('hex');

    // Download and cache thumbnail
    let thumbnailDataUri = '';
    if (cover && cover.startsWith('http')) {
      try {
        const coverUa = cover.includes('lookaside.fbsbx.com') ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' : DEFAULT_UA;
        const coverRes = await fetch(cover, {
          headers: { 'User-Agent': coverUa },
          signal: AbortSignal.timeout(10000)
        });
        if (coverRes.ok) {
          const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
          const contentType = coverRes.headers.get('content-type') || (isImage ? 'image/jpeg' : 'image/jpeg');
          thumbnailDataUri = `data:${contentType};base64,${coverBuffer.toString('base64')}`;
          const thumbPath = targetFilePath.replace(/\.[^.]+$/, '.thumb.jpg');
          await fsPromises.writeFile(thumbPath, coverBuffer).catch(() => {});
        }
      } catch {}
    }

    const authorName = typeof author === 'string' ? author : (author?.name || 'Facebook User');

    const metadata = {
      facebookVideoId: id || cleanId,
      originalUrl: originalUrl || '',
      title: title || (isImage ? 'Facebook Photo' : 'Facebook Video'),
      author: authorName,
      thumbnail: thumbnailDataUri || cover || '',
      duration: duration || 0,
      quality: quality || (isImage ? 'HD Photo' : 'HD'),
      mediaType: isImage ? 'image' : 'video',
      savedAt: new Date().toISOString()
    };

    const metaPath = targetFilePath.replace(/\.[^.]+$/, '.meta.json');
    await fsPromises.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

    // Register file in Prisma SQLite
    const fileId = crypto.randomUUID();
    const mimeType = isImage ? (resolvedExt === 'png' ? 'image/png' : 'image/jpeg') : 'video/mp4';
    try {
      await prisma.fileRecord.create({
        data: {
          id: fileId,
          purpose: 'PROCESSED',
          originalName: fileName,
          storagePath: targetFilePath,
          mimeType,
          sizeBytes: BigInt(byteCount),
          hashSha256,
          isPurged: false,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });
    } catch (e: any) {
      logger.warn({ err: e?.message }, '[Facebook] Could not create prisma record; file saved to disk');
    }

    DriveService.invalidateStatsCache();

    return {
      success: true,
      fileName,
      relPath: `facebook/${fileName}`,
      sizeBytes: byteCount,
      fileId,
      metadata
    };
  }
}
