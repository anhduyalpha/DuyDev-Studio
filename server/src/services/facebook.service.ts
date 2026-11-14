/**
 * Facebook Service - Multi-tier Video Extractor & Stream Manager
 * Fast-Race Scraper (Comet vs Mobile vs Plugins), MPD DASH Muxer,
 * Redirect Expansion with SSRF Guard, BoundedTtlCache, and Hardened yt-dlp.
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable, Transform } from 'stream';
import { execFile, spawn } from 'child_process';
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
import { BoundedTtlCache, expandRedirectUrl, findExistingDriveMatch } from './shared/media-url-cache.js';

const execFileAsync = promisify(execFile);
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const FB_EXTERNAL_HIT_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const FB_ALLOWED_HOSTS = ['facebook.com', 'fb.watch', 'fb.com', 'fb.gg', 'fbsbx.com', 'm.facebook.com', 'mbasic.facebook.com', 'web.facebook.com', 'www.facebook.com'];

export class FacebookService {
  private static readonly mediaCache = new BoundedTtlCache<FacebookVideoData>(200, 10 * 60 * 1000);
  private static readonly dashTokenCache = new BoundedTtlCache<{ videoUrl: string; audioUrl: string }>(500, 15 * 60 * 1000);
  private static photoFallbackUrls = new Map<string, string>();

  static clearCache(): void {
    this.mediaCache.clear();
    this.dashTokenCache.clear();
    this.photoFallbackUrls.clear();
  }

  static setDashTokenForTesting(token: string, entry: { videoUrl: string; audioUrl: string }): void {
    this.dashTokenCache.set(token, entry);
  }

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
      .replace(/&#39;/g, "'")
      .replace(/&#064;/g, '@');
  }

  /**
   * Parses dash_manifest_xml_string and extracts highest-bandwidth video and audio tracks,
   * minting an opaque server-side token stored in dashTokenCache.
   */
  private static parseDashManifest(
    dashXml: string
  ): {
    formats: FacebookMediaFormat[];
    durationSec?: number;
    dashToken?: string;
    dashUrl?: string;
  } | null {
    if (!dashXml || typeof dashXml !== 'string') return null;

    const unescapedXml = this.decodeHtmlEntities(
      dashXml
        .replace(/\\u0026/g, '&')
        .replace(/\\u0025/g, '%')
        .replace(/\\u003c/g, '<')
        .replace(/\\u003e/g, '>')
        .replace(/\\\//g, '/')
    );

    let durationSec: number | undefined;
    const durMatch = unescapedXml.match(/mediaPresentationDuration="PT([\d.]+)S"/i);
    if (durMatch) {
      durationSec = Math.round(parseFloat(durMatch[1]));
    }

    interface TrackRep {
      id: string;
      bandwidth: number;
      width?: number;
      height?: number;
      url: string;
      mimeType?: string;
    }

    const videoReps: TrackRep[] = [];
    const audioReps: TrackRep[] = [];

    const adaptSets = unescapedXml.match(/<AdaptationSet[\s\S]*?<\/AdaptationSet>/gi) || [unescapedXml];

    for (const setXml of adaptSets) {
      const setMime = (setXml.match(/mimeType=["']([^"']+)["']/i)?.[1] || '').toLowerCase();
      const setContentType = (setXml.match(/contentType=["']([^"']+)["']/i)?.[1] || '').toLowerCase();
      const isVideoSet = setMime.startsWith('video') || setContentType === 'video';
      const isAudioSet = setMime.startsWith('audio') || setContentType === 'audio';

      const repMatches = setXml.matchAll(/<Representation([^>]*)>([\s\S]*?)<\/Representation>/gi);
      for (const repMatch of repMatches) {
        const attrs = repMatch[1] || '';
        const repBody = repMatch[2] || '';

        const id = attrs.match(/\bid=["']([^"']+)["']/i)?.[1] || `rep_${Date.now()}`;
        const bandwidth = parseInt(attrs.match(/\bbandwidth=["'](\d+)["']/i)?.[1] || '0', 10);
        const width = attrs.match(/\bwidth=["'](\d+)["']/i)?.[1]
          ? parseInt(attrs.match(/\bwidth=["'](\d+)["']/i)![1], 10)
          : undefined;
        const height = attrs.match(/\bheight=["'](\d+)["']/i)?.[1]
          ? parseInt(attrs.match(/\bheight=["'](\d+)["']/i)![1], 10)
          : undefined;
        const repMime = (attrs.match(/\bmimeType=["']([^"']+)["']/i)?.[1] || '').toLowerCase();

        const baseUrls = Array.from(repBody.matchAll(/<BaseURL[^>]*>([\s\S]*?)<\/BaseURL>/gi)).map((b) =>
          this.decodeHtmlEntities(b[1].trim())
        );

        if (baseUrls.length === 0 || !baseUrls[0].startsWith('http')) continue;
        const url = baseUrls[0];

        const isAudio = isAudioSet || repMime.startsWith('audio') || (!isVideoSet && id.toLowerCase().includes('audio'));
        const isVideo = !isAudio && (isVideoSet || repMime.startsWith('video') || Boolean(height || width));

        if (isVideo) {
          videoReps.push({ id, bandwidth, width, height, url, mimeType: repMime || 'video/mp4' });
        } else if (isAudio) {
          audioReps.push({ id, bandwidth, url, mimeType: repMime || 'audio/mp4' });
        }
      }
    }

    if (videoReps.length === 0 || audioReps.length === 0) {
      return null;
    }

    // Sort video by bandwidth descending (or height descending)
    videoReps.sort((a, b) => (b.bandwidth || (b.height || 0) * 1000) - (a.bandwidth || (a.height || 0) * 1000));
    // Sort audio by bandwidth descending
    audioReps.sort((a, b) => b.bandwidth - a.bandwidth);

    const bestAudio = audioReps[0];
    const formats: FacebookMediaFormat[] = [];

    // Create format for best video (and optional second tier SD if available)
    const selectedVideos = [videoReps[0]];
    const lowerVideo = videoReps.find(
      (v) => (v.height && v.height < (videoReps[0].height || 720)) || (v.bandwidth < videoReps[0].bandwidth * 0.7)
    );
    if (lowerVideo && lowerVideo.url !== videoReps[0].url) {
      selectedVideos.push(lowerVideo);
    }

    let primaryToken = '';
    for (const v of selectedVideos) {
      const token = crypto.randomBytes(16).toString('hex');
      if (!primaryToken) primaryToken = token;

      this.dashTokenCache.set(token, {
        videoUrl: v.url,
        audioUrl: bestAudio.url
      });

      const isHd = (v.height && v.height >= 720) || v.bandwidth > 1500000;
      const label = v.height
        ? `${isHd ? 'HD' : 'SD'} (${v.height}p)`
        : `${isHd ? 'HD Video' : 'SD Video'} (DASH)`;

      formats.push({
        quality: isHd ? 'hd' : 'sd',
        label,
        url: `dash://${token}`,
        dashToken: token,
        ext: 'mp4'
      });
    }

    return {
      formats,
      durationSec,
      dashToken: primaryToken,
      dashUrl: `dash://${primaryToken}`
    };
  }

  /**
   * Resolves Facebook video or post metadata using multi-tier strategy
   */
  static async resolveVideo(rawInput: string): Promise<FacebookVideoData> {
    const initialUrl = this.extractUrl(rawInput);

    // Check memory cache first
    const cached = this.mediaCache.get(initialUrl);
    if (cached) {
      logger.debug({ initialUrl }, '[Facebook] Served media metadata from cache');
      return cached;
    }

    logger.info({ initialUrl }, '[Facebook] Resolving media metadata...');

    // Expand shortlink or share redirect if applicable
    let targetUrl = initialUrl;
    if (/(?:facebook\.com\/share\/(?:[rvp]\/|[a-zA-Z0-9_-]+\/?)|fb\.watch\/|fb\.com\/)/i.test(initialUrl)) {
      try {
        const expanded = await expandRedirectUrl(
          initialUrl,
          (candidateUrl) => {
            let parsed: URL;
            try {
              parsed = new URL(candidateUrl);
            } catch {
              return false;
            }
            const host = parsed.hostname.toLowerCase();
            const isFb = FB_ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
            if (!isFb) return false;
            return candidateUrl;
          },
          {
            maxHops: 5,
            timeoutMs: 4000,
            allowedHosts: FB_ALLOWED_HOSTS
          }
        );
        if (expanded && expanded !== initialUrl) {
          targetUrl = this.extractUrl(expanded);
          logger.info({ initialUrl, targetUrl }, '[Facebook] Expanded short/share link to canonical destination');
        }
      } catch (err: any) {
        logger.debug({ err: err?.message }, '[Facebook] Share redirect expansion skipped; continuing');
      }
    }

    // Check cache again with expanded URL
    const cachedExpanded = this.mediaCache.get(targetUrl);
    if (cachedExpanded) {
      this.mediaCache.set(initialUrl, cachedExpanded);
      return cachedExpanded;
    }

    // Extract fallback ID
    const shareMatch = targetUrl.match(/share\/(?:p\/|v\/|r\/)?([a-zA-Z0-9_-]+)/i);
    const reelMatch = targetUrl.match(/reel(?:s)?\/([a-zA-Z0-9_-]+)/i);
    const watchMatch = targetUrl.match(/[?&]v=(\d+)/i);
    const postMatch = targetUrl.match(/(?:posts|videos|photos)\/([a-zA-Z0-9_-]+)/i);
    const photoMatch = targetUrl.match(/[?&]fbid=(\d+)/i);
    const fallbackId = (shareMatch?.[1] || reelMatch?.[1] || watchMatch?.[1] || postMatch?.[1] || photoMatch?.[1] || `fb_${Date.now()}`);

    let resolvedData: FacebookVideoData | null = null;

    // Fast-path Tier 1: Promise.any fast-race across scrapers
    try {
      const fastResult = await this.tryFastRaceExtraction(targetUrl, fallbackId);
      if (
        fastResult &&
        ((fastResult.formats && fastResult.formats.length > 0) ||
          (fastResult.images && fastResult.images.length > 0) ||
          fastResult.videoHdUrl ||
          fastResult.videoSdUrl)
      ) {
        resolvedData = fastResult;
        logger.info({ id: resolvedData.id, mediaType: resolvedData.mediaType }, '[Facebook] Resolved via Tier 1 Fast-Race Extractor');
      }
    } catch (e: any) {
      logger.debug({ err: e?.message }, '[Facebook] Fast-race extraction skipped');
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

    // Fallback Tier 3: yt-dlp CLI (with --no-playlist, --socket-timeout 12, --retries 2)
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

    // Cache successful resolution in BoundedTtlCache
    this.mediaCache.set(initialUrl, resolvedData);
    if (targetUrl !== initialUrl) {
      this.mediaCache.set(targetUrl, resolvedData);
    }

    return resolvedData;
  }

  /**
   * Fast-race Tier 1: Promise.any race between Comet Desktop, Mobile, and Plugins scrapers
   * Aborts losing branches immediately once the fastest valid branch resolves.
   */
  private static async tryFastRaceExtraction(
    targetUrl: string,
    fallbackId: string
  ): Promise<FacebookVideoData | null> {
    const controllers = [
      new AbortController(),
      new AbortController(),
      new AbortController()
    ];

    const timeoutIds = controllers.map((ctrl) =>
      setTimeout(() => {
        try { ctrl.abort(); } catch {}
      }, 5500)
    );

    try {
      const branches = [
        this.extractViaComet(targetUrl, fallbackId, controllers[0].signal),
        this.extractViaMobile(targetUrl, fallbackId, controllers[1].signal),
        this.extractViaPlugins(targetUrl, fallbackId, controllers[2].signal)
      ];

      const fastestResult = await Promise.any(branches);

      if (
        fastestResult &&
        ((fastestResult.formats && fastestResult.formats.length > 0) ||
          (fastestResult.images && fastestResult.images.length > 0) ||
          fastestResult.videoHdUrl ||
          fastestResult.videoSdUrl)
      ) {
        // Immediately abort losing branches
        for (const ctrl of controllers) {
          try { ctrl.abort(); } catch {}
        }
        return fastestResult;
      }
      throw new Error('Fast race produced no valid media');
    } catch {
      return null;
    } finally {
      for (const t of timeoutIds) {
        clearTimeout(t);
      }
    }
  }

  /**
   * Branch 1: Desktop Comet SSR + OpenGraph scraper
   */
  private static async extractViaComet(
    targetUrl: string,
    fallbackId: string,
    signal: AbortSignal
  ): Promise<FacebookVideoData> {
    logger.info({ targetUrl }, '[Facebook] Attempting dual OpenGraph + Comet SSR extraction...');

    const fetchHtml = async (ua: string): Promise<{ ok: boolean; url: string; html: string }> => {
      try {
        const r = await fetch(targetUrl, {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Upgrade-Insecure-Requests': '1'
          },
          redirect: 'follow',
          signal
        });

        if (!r.ok) {
          if (r.body && typeof r.body.cancel === 'function') {
            try { await r.body.cancel(); } catch {}
          }
          return { ok: false, url: r.url, html: '' };
        }

        return { ok: true, url: r.url, html: await r.text() };
      } catch (err: any) {
        return { ok: false, url: targetUrl, html: '' };
      }
    };

    const [ogRes, cometRes] = await Promise.all([
      fetchHtml(FB_EXTERNAL_HIT_UA),
      fetchHtml(DEFAULT_UA)
    ]);

    if (!ogRes.html && !cometRes.html) {
      throw new Error('Comet and OpenGraph fetches returned empty bodies');
    }

    const finalUrl = cometRes.url || ogRes.url || targetUrl;
    const html = cometRes.html || ogRes.html;

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

    // Parse Comet SSR JSON blocks
    const cometAuthors: string[] = [];
    const storyMessages: string[] = [];
    const fallbackMessages: string[] = [];
    const storyPhotosMap = new Map<string, string>();
    const fallbackPhotosMap = new Map<string, string>();
    const cometVideosMap = new Map<string, { id?: string; hd?: string; sd?: string; durationSec?: number; thumb?: string; dashXml?: string }>();
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

        // Photo node extraction
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
              thumb: prev.thumb || thumb,
              dashXml: prev.dashXml
            });
          }
        }

        // Comet videoDeliveryLegacyFields / videoDeliveryResponseFragment
        if (obj.videoDeliveryLegacyFields || obj.videoDeliveryResponseFragment) {
          const vdf = obj.videoDeliveryLegacyFields || obj.videoDeliveryResponseFragment;
          const vid = vdf.id ? String(vdf.id) : 'default_video';
          const hd = vdf.browser_native_hd_url || vdf.hd_src || undefined;
          const sd = vdf.browser_native_sd_url || vdf.sd_src || undefined;
          const dashXml = typeof vdf.dash_manifest_xml_string === 'string' ? vdf.dash_manifest_xml_string : undefined;
          let durationSec: number | undefined;
          if (dashXml) {
            const durMatch = dashXml.match(/mediaPresentationDuration="PT([\d.]+)S"/i);
            if (durMatch) durationSec = Math.round(parseFloat(durMatch[1]));
          }
          if (hd || sd || dashXml) {
            const prev = cometVideosMap.get(vid) || { id: vid };
            cometVideosMap.set(vid, {
              id: vid,
              hd: prev.hd || hd,
              sd: prev.sd || sd,
              durationSec: prev.durationSec || durationSec,
              thumb: prev.thumb,
              dashXml: prev.dashXml || dashXml
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
      throw new Error('Comet extraction found zero metadata or media elements');
    }

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
    const fullCaption = (storyMessages[0] || (!isVideoOrReelUrl && fallbackMessages[0]) || ogDesc || '').trim();
    const displayTitle = this.formatCleanTitle(
      fullCaption || ogDesc,
      authorName,
      isVideoOrReelUrl ? 'Video' : 'Bài viết'
    );

    // 1. Check for Video streams (from Comet SSR, OpenGraph, regex, or DASH)
    let hdUrl = ogVideo && ogVideo.startsWith('http') ? ogVideo : '';
    let sdUrl = '';
    let videoDuration = 0;
    let videoThumb = ogImage || '';
    let matchedDashXml: string | undefined;

    const matchedCometVideo =
      cometVideosMap.get(postId) ||
      cometVideosMap.get(fallbackId) ||
      Array.from(cometVideosMap.values()).find((v) => v.hd || v.sd || v.dashXml);

    if (matchedCometVideo && (isVideoOrReelUrl || hasVideoAttachment || storyPhotosMap.size === 0)) {
      hdUrl = matchedCometVideo.hd || hdUrl;
      sdUrl = matchedCometVideo.sd || sdUrl;
      videoDuration = matchedCometVideo.durationSec || 0;
      videoThumb = videoThumb || matchedCometVideo.thumb || '';
      matchedDashXml = matchedCometVideo.dashXml;
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

    const formats: FacebookMediaFormat[] = [];

    // Parse DASH manifest if available (crucial when video has zero progressive URLs)
    let dashMuxResult: ReturnType<typeof FacebookService.parseDashManifest> = null;
    if (matchedDashXml) {
      dashMuxResult = this.parseDashManifest(matchedDashXml);
      if (dashMuxResult && dashMuxResult.formats.length > 0) {
        formats.push(...dashMuxResult.formats);
        if (!hdUrl && dashMuxResult.dashUrl) {
          hdUrl = dashMuxResult.dashUrl;
        }
        if (!sdUrl && dashMuxResult.dashUrl) {
          sdUrl = dashMuxResult.dashUrl;
        }
        if (!videoDuration && dashMuxResult.durationSec) {
          videoDuration = dashMuxResult.durationSec;
        }
      }
    }

    if (hdUrl && !hdUrl.startsWith('dash://')) {
      formats.push({
        quality: 'hd',
        label: 'HD Video',
        url: hdUrl,
        ext: 'mp4'
      });
    }
    if (sdUrl && sdUrl !== hdUrl && !sdUrl.startsWith('dash://')) {
      formats.push({
        quality: 'sd',
        label: 'SD Video',
        url: sdUrl,
        ext: 'mp4'
      });
    }

    if (formats.length > 0 || hdUrl || sdUrl) {
      const primaryUrl = hdUrl || sdUrl || formats[0]?.url;
      const secondaryUrl = sdUrl || hdUrl || formats[0]?.url;

      return {
        id: matchedCometVideo?.id && matchedCometVideo.id !== 'default_video' ? matchedCometVideo.id : postId,
        title: displayTitle,
        caption: fullCaption,
        author: { name: authorName },
        cover: videoThumb,
        duration: videoDuration,
        formats,
        videoHdUrl: primaryUrl,
        videoSdUrl: secondaryUrl,
        mediaType: 'video',
        extractor: 'scraper'
      };
    }

    // Guard: If it's a Video/Reel URL or video attachment without streams, throw to let other branches/tiers run
    if (isVideoOrReelUrl || hasVideoAttachment) {
      throw new Error('Comet detected Video/Reel without direct stream or DASH manifest');
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
      const photoFormats: FacebookMediaFormat[] = images.map((img, idx) => ({
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
        formats: photoFormats,
        mediaType: 'image',
        images,
        extractor: 'scraper'
      };
    }

    throw new Error('Zero video or photo media found in Comet extraction');
  }

  /**
   * Branch 2: Mobile Facebook scraper (mbasic / m.facebook.com)
   */
  private static async extractViaMobile(
    targetUrl: string,
    fallbackId: string,
    signal: AbortSignal
  ): Promise<FacebookVideoData> {
    let mobileUrl = targetUrl;
    try {
      const u = new URL(targetUrl);
      u.hostname = 'mbasic.facebook.com';
      mobileUrl = u.toString();
    } catch {
      mobileUrl = targetUrl;
    }

    const res = await fetch(mobileUrl, {
      headers: {
        'User-Agent': MOBILE_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow',
      signal
    });

    if (!res.ok) {
      if (res.body && typeof res.body.cancel === 'function') {
        try { await res.body.cancel(); } catch {}
      }
      throw new Error(`Mobile Facebook request failed: HTTP ${res.status}`);
    }

    const html = await res.text();
    if (!html) throw new Error('Mobile Facebook returned empty response body');

    // Extract video links from data-store or <video> tags or redirect hrefs
    let videoUrl = '';
    const dataStoreMatch = html.match(/data-store=["'](\{[^"']*\})["']/i);
    if (dataStoreMatch) {
      try {
        const parsed = JSON.parse(this.decodeHtmlEntities(dataStoreMatch[1]));
        if (parsed.videoURL && typeof parsed.videoURL === 'string') {
          videoUrl = parsed.videoURL;
        }
      } catch {}
    }

    if (!videoUrl) {
      const videoTagMatch = html.match(/<video[^>]+src=["'](https:[^"']+)["']/i);
      if (videoTagMatch) {
        videoUrl = videoTagMatch[1];
      }
    }

    if (!videoUrl) {
      const redirectHrefMatch = html.match(/href=["'](\/video_redirect\/\?src=[^"']+)["']/i);
      if (redirectHrefMatch) {
        try {
          const u = new URL(redirectHrefMatch[1], 'https://mbasic.facebook.com');
          const srcParam = u.searchParams.get('src');
          if (srcParam && srcParam.startsWith('http')) {
            videoUrl = srcParam;
          }
        } catch {}
      }
    }

    if (!videoUrl) {
      const rawSrcMatch = html.match(/(?:sd_src|hd_src|videoURL)["']?:\s*["'](https:[^"']+)["']/i);
      if (rawSrcMatch) {
        videoUrl = rawSrcMatch[1];
      }
    }

    if (!videoUrl) {
      throw new Error('Mobile Facebook page contained zero extractable video streams');
    }

    const cleanVideoUrl = this.decodeHtmlEntities(
      videoUrl.replace(/\\u0026/g, '&').replace(/\\u0025/g, '%').replace(/\\\//g, '/')
    );

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const rawTitle = titleMatch ? this.decodeHtmlEntities(titleMatch[1]).trim() : '';

    const formats: FacebookMediaFormat[] = [
      {
        quality: 'sd',
        label: 'SD Video',
        url: cleanVideoUrl,
        ext: 'mp4'
      }
    ];

    return {
      id: fallbackId,
      title: rawTitle || 'Facebook Video',
      author: { name: 'Facebook User' },
      cover: '',
      duration: 0,
      formats,
      videoSdUrl: cleanVideoUrl,
      videoHdUrl: cleanVideoUrl,
      mediaType: 'video',
      extractor: 'scraper'
    };
  }

  /**
   * Branch 3: Plugins video.php scraper (https://www.facebook.com/plugins/video.php?href=...)
   */
  private static async extractViaPlugins(
    targetUrl: string,
    fallbackId: string,
    signal: AbortSignal
  ): Promise<FacebookVideoData> {
    const pluginsUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(targetUrl)}&show_text=0`;
    const res = await fetch(pluginsUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.facebook.com/'
      },
      redirect: 'follow',
      signal
    });

    if (!res.ok) {
      if (res.body && typeof res.body.cancel === 'function') {
        try { await res.body.cancel(); } catch {}
      }
      throw new Error(`Plugins endpoint failed: HTTP ${res.status}`);
    }

    const html = await res.text();
    if (!html) throw new Error('Plugins endpoint returned empty HTML');

    let hdUrl = '';
    let sdUrl = '';
    let dashXml: string | undefined;
    let authorName = 'Facebook User';
    let durationSec = 0;

    // Check for videoData JSON or dash manifest
    const videoDataMatch = html.match(/(?:videoData|params)["']?:\s*(\{[^;]+?\})\s*[,;]/i);
    if (videoDataMatch) {
      try {
        const vd = JSON.parse(videoDataMatch[1]);
        if (vd.hd_src) hdUrl = vd.hd_src;
        if (vd.sd_src) sdUrl = vd.sd_src;
        if (vd.dash_manifest_xml_string) dashXml = vd.dash_manifest_xml_string;
        if (vd.duration) durationSec = Math.round(Number(vd.duration) / 1000);
      } catch {}
    }

    if (!hdUrl) {
      const hdMatch = html.match(/(?:hd_src|browser_native_hd_url)["']?:\s*["'](https:[^"']+)["']/i);
      if (hdMatch) hdUrl = hdMatch[1];
    }

    if (!sdUrl) {
      const sdMatch = html.match(/(?:sd_src|browser_native_sd_url)["']?:\s*["'](https:[^"']+)["']/i);
      if (sdMatch) sdUrl = sdMatch[1];
    }

    if (!dashXml) {
      const dashMatch = html.match(/dash_manifest_xml_string["']?:\s*["'](<MPD[\s\S]*?<\/MPD>)["']/i);
      if (dashMatch) dashXml = dashMatch[1];
    }

    // Author
    const authorMatch = html.match(/class=["'][^"']*_23n-[^"']*["'][^>]*><a[^>]*>([^<]+)<\/a>/i);
    if (authorMatch) authorName = this.decodeHtmlEntities(authorMatch[1]).trim();

    const cleanHdUrl = hdUrl ? this.decodeHtmlEntities(hdUrl.replace(/\\u0026/g, '&').replace(/\\u0025/g, '%').replace(/\\\//g, '/')) : '';
    const cleanSdUrl = sdUrl ? this.decodeHtmlEntities(sdUrl.replace(/\\u0026/g, '&').replace(/\\u0025/g, '%').replace(/\\\//g, '/')) : '';

    const formats: FacebookMediaFormat[] = [];

    if (dashXml) {
      const dashMux = this.parseDashManifest(dashXml);
      if (dashMux && dashMux.formats.length > 0) {
        formats.push(...dashMux.formats);
        if (!durationSec && dashMux.durationSec) durationSec = dashMux.durationSec;
      }
    }

    if (cleanHdUrl) {
      formats.push({
        quality: 'hd',
        label: 'HD Video',
        url: cleanHdUrl,
        ext: 'mp4'
      });
    }

    if (cleanSdUrl && cleanSdUrl !== cleanHdUrl) {
      formats.push({
        quality: 'sd',
        label: 'SD Video',
        url: cleanSdUrl,
        ext: 'mp4'
      });
    }

    if (formats.length === 0 && !cleanHdUrl && !cleanSdUrl) {
      throw new Error('Plugins endpoint contained zero video streams or DASH manifest');
    }

    return {
      id: fallbackId,
      title: `${authorName} - Video`,
      author: { name: authorName },
      cover: '',
      duration: durationSec,
      formats,
      videoHdUrl: cleanHdUrl || cleanSdUrl || formats[0]?.url,
      videoSdUrl: cleanSdUrl || cleanHdUrl || formats[0]?.url,
      mediaType: 'video',
      extractor: 'scraper'
    };
  }

  /**
   * Tier 2: Try public API endpoint (RapidAPI)
   */
  private static async tryApiExtraction(targetUrl: string, fallbackId: string): Promise<FacebookVideoData | null> {
    const apiKey = process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY;
    if (!apiKey) return null;

    try {
      const res = await fetch(`https://facebook-reel-and-video-downloader.p.rapidapi.com/app/main.php?url=${encodeURIComponent(targetUrl)}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'facebook-reel-and-video-downloader.p.rapidapi.com'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) {
        if (res.body && typeof res.body.cancel === 'function') {
          try { await res.body.cancel(); } catch {}
        }
        return null;
      }

      const data = (await res.json()) as any;
      if (!data?.success && !data?.links) return null;

      const medias = Array.isArray(data.links) ? data.links : [];
      if (medias.length === 0) return null;

      const formats: FacebookMediaFormat[] = medias.map((m: any) => ({
        quality: m.quality || 'sd',
        label: (m.quality || 'SD').toUpperCase(),
        url: m.url,
        ext: m.extension || 'mp4'
      }));

      const hdMedia = formats.find((f) => f.quality.toLowerCase().includes('hd'));
      const sdMedia = formats.find((f) => f.quality.toLowerCase().includes('sd')) || formats[0];

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
   * Tier 3: Local hardened yt-dlp CLI
   */
  private static async tryYtdlpExtraction(targetUrl: string, fallbackId: string): Promise<FacebookVideoData | null> {
    const args = [
      '--dump-json',
      '--no-playlist',
      '--socket-timeout', '12',
      '--retries', '2',
      '--no-warnings',
      '--no-check-certificates'
    ];

    const cookiesFile = process.env.FB_COOKIES_FILE?.trim();
    if (cookiesFile && fs.existsSync(cookiesFile)) {
      args.push('--cookies', cookiesFile);
    }
    args.push(targetUrl);

    const { stdout } = await execFileAsync('yt-dlp', args, { timeout: 20000, maxBuffer: 15 * 1024 * 1024 });

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
      const mp4Formats = json.formats.filter((f: any) => f.url && (f.ext === 'mp4' || f.vcodec !== 'none'));

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
   * Proxies Facebook video or image stream to client with HTTP 206 Partial Content support,
   * or dynamically muxes server-tokenized DASH split streams (video+audio) via ffmpeg copy.
   */
  static async proxyStream(
    targetUrl: string,
    download: boolean,
    filename: string,
    rangeHeader: string | undefined,
    reply: FastifyReply
  ): Promise<any> {
    const isDash = targetUrl.startsWith('dash://');

    if (isDash) {
      const dashToken = targetUrl.replace('dash://', '').trim();
      const entry = this.dashTokenCache.get(dashToken);
      if (!entry) {
        throw new BadRequestError('DASH token không hợp lệ hoặc đã hết hạn');
      }

      try {
        validateSafeMediaUrl(entry.videoUrl, ['fbcdn.net', 'facebook.com', 'fbsbx.com']);
        validateSafeMediaUrl(entry.audioUrl, ['fbcdn.net', 'facebook.com', 'fbsbx.com']);
      } catch (e: any) {
        throw new BadRequestError(e.message || 'URL không hợp lệ (SSRF Guard)');
      }

      const cleanFilename = (filename || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
      const safeName = cleanFilename || 'facebook_video.mp4';
      const encodedName = encodeURIComponent(safeName);
      const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');

      reply.status(200);
      reply.header('Content-Type', 'video/mp4');
      if (download) {
        reply.header('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
      } else {
        reply.header('Content-Disposition', 'inline');
      }

      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', entry.videoUrl,
        '-i', entry.audioUrl,
        '-c', 'copy',
        '-movflags', 'frag_keyframe+empty_moov',
        '-f', 'mp4',
        'pipe:1'
      ]);

      const cleanupFfmpeg = () => {
        try {
          if (!ffmpeg.killed) {
            ffmpeg.kill('SIGKILL');
          }
        } catch {}
      };

      if (reply.raw) {
        reply.raw.on('close', cleanupFfmpeg);
      }
      if ((reply as any).request?.raw) {
        (reply as any).request.raw.on('close', cleanupFfmpeg);
      }

      ffmpeg.on('error', (err) => {
        logger.warn({ err: err.message }, '[Facebook] ffmpeg DASH stream error');
        cleanupFfmpeg();
      });

      return reply.send(ffmpeg.stdout);
    }

    try {
      validateSafeMediaUrl(targetUrl, ['fbcdn.net', 'facebook.com', 'fbsbx.com']);
    } catch (e: any) {
      throw new BadRequestError(e.message || 'URL không hợp lệ (SSRF Guard)');
    }

    const isFbLookaside = targetUrl.includes('lookaside.fbsbx.com');
    const headers: Record<string, string> = {
      'User-Agent': isFbLookaside ? FB_EXTERNAL_HIT_UA : DEFAULT_UA,
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
   * using findExistingDriveMatch with worker pool of 8.
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
      // 1. Fast check: direct filename check
      const files = await fsPromises.readdir(fbDir, { withFileTypes: true }).catch(() => []);
      if (cleanId) {
        const directMatch = files.find(
          (f) =>
            !f.isDirectory() &&
            (f.name.endsWith('.mp4') || f.name.endsWith('.jpg') || f.name.endsWith('.png')) &&
            (f.name.includes(cleanId) || (cleanId.length >= 8 && f.name.includes(cleanId.slice(-8))))
        );
        if (directMatch) {
          const fullPath = path.join(fbDir, directMatch.name);
          const stat = await fsPromises.stat(fullPath).catch(() => null);
          if (stat) {
            const metaPath = path.join(fbDir, `${directMatch.name.replace(/\.[^.]+$/, '')}.meta.json`);
            let meta: any = null;
            if (fs.existsSync(metaPath)) {
              try {
                meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf8'));
              } catch {}
            }
            return {
              exists: true,
              item: {
                fileName: directMatch.name,
                relPath: `/facebook/${directMatch.name}`,
                sizeBytes: stat.size,
                title: meta?.title || directMatch.name,
                thumbnail: meta?.thumbnail,
                duration: meta?.duration,
                updatedAt: stat.mtime.toISOString()
              }
            };
          }
        }
      }

      // 2. Worker pool scan for *.meta.json files via findExistingDriveMatch
      const match = await findExistingDriveMatch(
        fbDir,
        async (meta, metaFileName) => {
          let isMatch = false;
          if (
            cleanId &&
            ((meta?.facebookVideoId && String(meta.facebookVideoId) === cleanId) ||
              metaFileName.includes(cleanId) ||
              (cleanId.length >= 8 && metaFileName.includes(cleanId.slice(-8))))
          ) {
            isMatch = true;
          }

          if (!isMatch && normInputUrl && meta?.originalUrl) {
            const normMetaUrl = meta.originalUrl.split('?')[0].replace(/\/$/, '').toLowerCase();
            if (normMetaUrl === normInputUrl) isMatch = true;
          }

          if (!isMatch) return false;

          const baseName = metaFileName.replace(/\.meta\.json$/, '');
          for (const ext of ['.mp4', '.jpg', '.png']) {
            const mediaDiskPath = path.join(fbDir, `${baseName}${ext}`);
            if (fs.existsSync(mediaDiskPath)) {
              const stat = await fsPromises.stat(mediaDiskPath);
              return {
                fileName: `${baseName}${ext}`,
                relPath: `/facebook/${baseName}${ext}`,
                sizeBytes: stat.size,
                title: meta?.title || `${baseName}${ext}`,
                thumbnail: meta?.thumbnail,
                duration: meta?.duration,
                updatedAt: stat.mtime.toISOString()
              };
            }
          }
          return false;
        },
        8
      );

      return match ? { exists: true, item: match } : { exists: false };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Saves video or image stream directly into DD Studio Drive (`/data/storage/drive/facebook/`)
   * Supports server-tokenized DASH split streams via ffmpeg muxing into temporary file before rename.
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

    const isDash = mediaUrl.startsWith('dash://');
    let dashEntry: { videoUrl: string; audioUrl: string } | undefined;

    if (isDash) {
      const dashToken = mediaUrl.replace('dash://', '').trim();
      dashEntry = this.dashTokenCache.get(dashToken);
      if (!dashEntry) {
        throw new BadRequestError('DASH token không hợp lệ hoặc đã hết hạn');
      }
      try {
        validateSafeMediaUrl(dashEntry.videoUrl, ['fbcdn.net', 'facebook.com', 'fbsbx.com']);
        validateSafeMediaUrl(dashEntry.audioUrl, ['fbcdn.net', 'facebook.com', 'fbsbx.com']);
      } catch (e: any) {
        throw new BadRequestError(e.message || 'URL không hợp lệ (SSRF Guard)');
      }
    } else {
      try {
        validateSafeMediaUrl(mediaUrl, ['fbcdn.net', 'facebook.com', 'fbsbx.com']);
      } catch (e: any) {
        throw new BadRequestError(e.message || 'URL không hợp lệ (SSRF Guard)');
      }
    }

    const fbDir = path.join(resolvedStoragePaths.drive, 'facebook');
    if (!fs.existsSync(fbDir)) {
      await fsPromises.mkdir(fbDir, { recursive: true });
    }

    const isImage = !isDash && (mediaType === 'image' || mediaUrl.includes('lookaside.fbsbx.com') || ext === 'jpg' || ext === 'png');
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

    logger.info({ fileName, targetFilePath, isDash }, '[Facebook] Saving media directly to Studio Drive...');

    let byteCount = 0;
    let hashSha256 = '';

    if (isDash && dashEntry) {
      const tmpPath = path.join(fbDir, `.tmp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp4`);
      try {
        await new Promise<void>((resolve, reject) => {
          const ffmpeg = spawn('ffmpeg', [
            '-y',
            '-i', dashEntry!.videoUrl,
            '-i', dashEntry!.audioUrl,
            '-c', 'copy',
            '-movflags', '+faststart',
            tmpPath
          ]);

          let stderr = '';
          ffmpeg.stderr.on('data', (d) => { stderr += d.toString(); });
          ffmpeg.on('error', reject);
          ffmpeg.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg DASH mux failed with code ${code}: ${stderr.slice(-300)}`));
          });
        });

        const stat = await fsPromises.stat(tmpPath);
        byteCount = stat.size;

        // Streaming SHA-256 computation to prevent Node buffer/heap spikes on large media
        const hash = crypto.createHash('sha256');
        await new Promise<void>((res, rej) => {
          const stream = fs.createReadStream(tmpPath);
          stream.on('data', (chunk) => hash.update(chunk));
          stream.on('end', () => res());
          stream.on('error', (err) => rej(err));
        });
        hashSha256 = hash.digest('hex');

        await fsPromises.rename(tmpPath, targetFilePath);
      } catch (muxErr) {
        if (fs.existsSync(tmpPath)) {
          await fsPromises.unlink(tmpPath).catch(() => {});
        }
        throw muxErr;
      }
    } else {
      const isFbLookaside = mediaUrl.includes('lookaside.fbsbx.com');
      const downloadHeaders: Record<string, string> = {
        'User-Agent': isFbLookaside ? FB_EXTERNAL_HIT_UA : DEFAULT_UA,
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

      const tracker = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          byteCount += chunk.length;
          hash.update(chunk);
          callback(null, chunk);
        }
      });

      await pipeline(Readable.fromWeb(upstreamRes.body as any), tracker, fileStream);
      hashSha256 = hash.digest('hex');
    }

    // Download and cache thumbnail
    let thumbnailDataUri = '';
    if (cover && cover.startsWith('http')) {
      try {
        const coverUa = cover.includes('lookaside.fbsbx.com') ? FB_EXTERNAL_HIT_UA : DEFAULT_UA;
        const coverRes = await fetch(cover, {
          headers: { 'User-Agent': coverUa },
          signal: AbortSignal.timeout(10000)
        });
        if (coverRes.ok) {
          const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
          const contentType = coverRes.headers.get('content-type') || 'image/jpeg';
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
