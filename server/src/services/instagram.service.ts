/**
 * Instagram Service - Multi-tier Video & Photo Extractor & Stream Manager
 * Native port of n8n Instagram Downloader workflow with Tier 1 Cookieless Embed,
 * Anonymous GraphQL, SSRF Guard, Bounded TTL Cache, and Hardened yt-dlp.
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { execFile } from 'child_process';
import { FastifyReply } from 'fastify';
import { InstagramVideoData, InstagramMediaItem } from '../schemas/instagram.schema.js';
import { StorageManager } from '../storage/storage.manager.js';
import { resolvedStoragePaths } from '../config/env.config.js';
import { DriveService } from './drive.service.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { validateSafeMediaUrl } from '../api/middleware/security.middleware.js';
import { BoundedTtlCache, expandRedirectUrl, findExistingDriveMatch } from './shared/media-url-cache.js';
import {
  extractBalancedJsonAt,
  streamTranscodedMp3,
  tryCobaltResolver,
  unescapeMediaJsonUrl
} from './shared/media-extractor.helper.js';

export const INSTAGRAM_ALLOWED_HOSTS = ['instagram.com', 'instagr.am', 'cdninstagram.com', 'fbcdn.net'];
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DEFAULT_ASBD_ID = '129477';
const DEFAULT_IG_APP_ID = '936619743392459';
const DEFAULT_LSD_TOKEN = 'AVqbxe3J_YA';

/**
 * Safely cancels unconsumed response streams to prevent Undici connection and socket leaks
 */
async function cancelResponseBody(res?: Response | null): Promise<void> {
  if (res?.body && typeof (res.body as any).cancel === 'function') {
    try {
      await (res.body as any).cancel();
    } catch {}
  }
}

export class InstagramService {
  private static readonly mediaCache = new BoundedTtlCache<InstagramVideoData>(200, 10 * 60 * 1000);

  /**
   * Clears in-memory resolution cache (for testing and administrative maintenance)
   */
  static clearCache(): void {
    InstagramService.mediaCache.clear();
  }

  /**
   * Cleans and validates raw text to a valid Instagram URL
   */
  static extractUrl(rawText: string): string {
    let trimmed = (rawText || '').trim();
    if (!trimmed) {
      throw new BadRequestError('Liên kết không hợp lệ. Vui lòng dán liên kết Instagram Post, Reel hoặc Story hợp lệ.');
    }

    // Auto-prepend https:// if protocol-less
    if (/^(?:[a-zA-Z0-9_-]+\.)?(?:instagram\.com|instagr\.am)(?:\/|$)/i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    const urlMatch = trimmed.match(
      /(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv|stories|share)(?:\/[a-zA-Z0-9_-]+)*[^\s"'<>]+/i
    );
    if (!urlMatch) {
      throw new BadRequestError('Liên kết không hợp lệ. Vui lòng dán liên kết Instagram Post, Reel hoặc Story hợp lệ.');
    }

    let matched = urlMatch[0];
    if (!/^https?:\/\//i.test(matched)) {
      matched = `https://${matched}`;
    }

    // Strip trailing punctuation
    let cleanUrl = matched.replace(/[.,;!?)"'\]>]+$/, '');

    // Strip tracking parameters
    try {
      const parsed = new URL(cleanUrl);
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'igsh', 'igshid', 'mibextid'];
      for (const p of trackingParams) {
        parsed.searchParams.delete(p);
      }
      cleanUrl = parsed.toString();
    } catch {
      // Keep cleanUrl as is
    }

    return cleanUrl;
  }

  /**
   * Expands shortlinks (instagr.am) and share redirects (instagram.com/share/...) with SSRF validation
   */
  private static async expandRedirectIfNeeded(url: string): Promise<string> {
    if (url.includes('/share/') || url.includes('instagr.am')) {
      const expanded = await expandRedirectUrl(
        url,
        (u) => validateSafeMediaUrl(u, INSTAGRAM_ALLOWED_HOSTS),
        {
          allowedHosts: INSTAGRAM_ALLOWED_HOSTS,
          timeoutMs: 4000
        }
      );
      return this.extractUrl(expanded);
    }
    return url;
  }

  /**
   * Resolves Instagram video or post metadata using multi-tier strategy (Alias of resolveMedia)
   */
  static async resolveVideo(rawInput: string): Promise<InstagramVideoData> {
    return this.resolveMedia(rawInput);
  }

  /**
   * Resolves Instagram media (Video, Reel, Image, Carousel) using cookieless Tier 1 and hardened yt-dlp Tier 2
   */
  static async resolveMedia(rawInput: string): Promise<InstagramVideoData> {
    let targetUrl = this.extractUrl(rawInput);
    targetUrl = await this.expandRedirectIfNeeded(targetUrl);

    logger.info({ targetUrl }, '[Instagram] Resolving media metadata...');

    const codeMatch = targetUrl.match(/(?:p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/i);
    const shortcode = codeMatch?.[1] || `ig_${Date.now()}`;
    let canonicalType = 'p';
    if (codeMatch) {
      const rawType = codeMatch[0].split('/')[0].toLowerCase();
      canonicalType = rawType === 'reels' ? 'reel' : rawType;
    }
    const canonicalUrl = `https://www.instagram.com/${canonicalType}/${shortcode}/`;
    validateSafeMediaUrl(canonicalUrl, INSTAGRAM_ALLOWED_HOSTS);

    const cacheKey = `${canonicalType}:${shortcode}`;
    const hasVideoItem = (d: InstagramVideoData | null | undefined): boolean =>
      Boolean(d && (d.videoUrl || d.medias?.some((m) => m.type === 'video')));
    const acceptCandidate = (d: InstagramVideoData | null | undefined): InstagramVideoData | null => {
      if (!d) return null;
      // Reels are strictly videos — never accept a poster-only image downgrade from scraping tiers
      if (canonicalType === 'reel' && !hasVideoItem(d)) {
        logger.debug({ shortcode }, '[Instagram] Rejected image-only result for Reel; escalating tier');
        return null;
      }
      return d;
    };

    // 1. Check Bounded TTL Cache
    const cached = acceptCandidate(this.mediaCache.get(cacheKey));
    if (cached) {
      logger.info({ cacheKey }, '[Instagram] Cache hit');
      const existing = await this.checkExistingInDrive(cached.id, targetUrl);
      return {
        ...cached,
        existingInDrive: existing.exists ? existing.item : null
      };
    }

    let resolvedData: InstagramVideoData | null = null;
    let extractedLsd: string | null = null;

    // --- Tier 1A: Cookieless Embed HTML / Captioned Parser (timeout 4.5s) ---
    try {
      const embedRes = await this.tryEmbedExtraction(shortcode, canonicalType);
      if (embedRes) {
        resolvedData = acceptCandidate(embedRes.data);
        extractedLsd = embedRes.lsd;
        if (resolvedData) {
          logger.info({ id: resolvedData.id }, '[Instagram] Resolved via Tier 1A Embed');
        }
      }
    } catch (err: any) {
      logger.debug({ err: err?.message }, '[Instagram] Tier 1A embed failed or skipped');
    }

    // --- Tier 1B: Anonymous Web GraphQL Fallback (timeout 4.5s) ---
    if (!resolvedData) {
      try {
        const gqlRes = acceptCandidate(await this.tryAnonymousGraphqlExtraction(shortcode, canonicalType, extractedLsd));
        if (gqlRes) {
          resolvedData = gqlRes;
          logger.info({ id: resolvedData.id }, '[Instagram] Resolved via Tier 1B Anonymous GraphQL');
        }
      } catch (err: any) {
        logger.debug({ err: err?.message }, '[Instagram] Tier 1B GraphQL failed or skipped');
      }
    }

    // --- Tier 1C: RapidAPI if configured ---
    if (!resolvedData) {
      try {
        const apiResult = acceptCandidate(await this.tryApiExtraction(targetUrl, shortcode));
        if (apiResult) {
          resolvedData = apiResult;
          logger.info({ id: resolvedData.id }, '[Instagram] Resolved via Tier 1C RapidAPI');
        }
      } catch (e: any) {
        logger.debug({ err: e?.message }, '[Instagram] Tier 1C API skipped');
      }
    }

    // --- Tier 1D: Optional Cobalt Gateway Fallback (if COBALT_API_URL configured) ---
    if (!resolvedData) {
      try {
        const cobaltRes = acceptCandidate(await this.tryCobaltFallback(canonicalUrl, shortcode));
        if (cobaltRes) {
          resolvedData = cobaltRes;
          logger.info({ id: resolvedData.id }, '[Instagram] Resolved via Tier 1D Cobalt');
        }
      } catch (e: any) {
        logger.debug({ err: e?.message }, '[Instagram] Tier 1D Cobalt skipped');
      }
    }

    // --- Tier 2: Hardened yt-dlp CLI (timeout 22s) ---
    if (!resolvedData) {
      try {
        const ytdlpResult = acceptCandidate(await this.tryYtdlpExtraction(targetUrl, shortcode));
        if (ytdlpResult) {
          resolvedData = ytdlpResult;
          logger.info({ id: resolvedData.id }, '[Instagram] Resolved via Tier 2 yt-dlp');
        }
      } catch (ytErr: any) {
        logger.warn({ err: ytErr?.message }, '[Instagram] Tier 2 yt-dlp failed');
      }
    }

    if (!resolvedData) {
      throw new BadRequestError('Không thể lấy thông tin video Instagram này. Bài viết có thể đang ở chế độ riêng tư hoặc đã bị xóa.');
    }

    // Populate cache on successful resolution (NEVER cache failures!)
    if (canonicalType !== 'reel' || hasVideoItem(resolvedData)) {
      this.mediaCache.set(cacheKey, resolvedData);
    }

    // Check Drive duplication
    const existing = await this.checkExistingInDrive(resolvedData.id, targetUrl);
    resolvedData.existingInDrive = existing.exists ? existing.item : null;

    return resolvedData;
  }

  /**
   * Tier 1A: Fetch embed captioned page and extract media from JSON or DOM tags
   */
  private static async tryEmbedExtraction(
    shortcode: string,
    canonicalType: string
  ): Promise<{ data: InstagramVideoData | null; lsd: string | null } | null> {
    const embedUrl = canonicalType === 'reel'
      ? `https://www.instagram.com/reel/${shortcode}/embed/captioned/`
      : `https://www.instagram.com/p/${shortcode}/embed/captioned/`;

    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none'
    };

    let html = '';
    try {
      const res = await fetch(embedUrl, {
        headers,
        signal: AbortSignal.timeout(4500)
      });

      if (!res.ok) {
        await cancelResponseBody(res);
        // If reel embed returned non-200, try fallback post embed endpoint
        if (canonicalType === 'reel') {
          const altRes = await fetch(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, {
            headers,
            signal: AbortSignal.timeout(4500)
          });
          if (altRes.ok) {
            html = await altRes.text();
          } else {
            await cancelResponseBody(altRes);
          }
        }
        if (!html) return null;
      } else {
        html = await res.text();
      }
    } catch {
      return null;
    }

    return this.parseEmbedHtml(html, shortcode, canonicalType);
  }

  /**
   * Parses embed HTML for embedded JSON (window.__additionalDataLoaded / gql_data / ScheduledServerJS) or DOM fallback tags
   */
  private static parseEmbedHtml(
    html: string,
    shortcode: string,
    canonicalType = 'p'
  ): { data: InstagramVideoData | null; lsd: string | null } {
    // Extract LSD token if present
    const lsdMatch =
      html.match(/name="lsd"\s+value="([^"]+)"/) ||
      html.match(/"LSD",\s*\[\],\s*\{"token":"([^"]+)"\}/) ||
      html.match(/\["LSD",\[\],\{"token":"([^"]+)"\}\]/);
    const lsd = lsdMatch?.[1] || null;

    let mediaData: any = null;

    // 1. Check window.__additionalDataLoaded
    const addDataMatches = html.matchAll(/window\.__additionalDataLoaded\s*\(\s*[^,]+,\s*(\{[\s\S]*?\})\s*\);/g);
    for (const m of addDataMatches) {
      try {
        const parsed = JSON.parse(m[1]);
        if (parsed) {
          mediaData =
            parsed.shortcode_media ||
            parsed.xdt_shortcode_media ||
            parsed.graphql?.shortcode_media ||
            parsed.gql_data?.shortcode_media ||
            parsed.gql_data;
          if (mediaData) break;
        }
      } catch {}
    }

    // 2. Balanced JSON scan inside <script> tags for shortcode_media / ScheduledServerJS / Polaris media payloads
    if (!mediaData) {
      const markerRegex = /"(?:xdt_shortcode_media|shortcode_media|gql_data|gql_media)"\s*:\s*\{/g;
      const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      for (const sm of scriptMatches) {
        const content = sm[1];
        if (
          content.includes('shortcode_media') ||
          content.includes('xdt_shortcode_media') ||
          content.includes('gql_data') ||
          content.includes('video_versions') ||
          content.includes('carousel_media')
        ) {
          const jsonMatch = content.match(/(\{[\s\S]*"(?:shortcode_media|xdt_shortcode_media|gql_data)"[\s\S]*\})/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              mediaData =
                parsed.shortcode_media ||
                parsed.xdt_shortcode_media ||
                parsed.graphql?.shortcode_media ||
                parsed.gql_data?.shortcode_media ||
                parsed.gql_data ||
                parsed.data?.xdt_shortcode_media ||
                parsed.data?.shortcode_media;
              if (mediaData) break;
            } catch {}
          }

          let m: RegExpExecArray | null;
          markerRegex.lastIndex = 0;
          while ((m = markerRegex.exec(content)) !== null) {
            const braceIdx = content.indexOf('{', m.index + m[0].length - 1);
            const jsonSlice = extractBalancedJsonAt(content, braceIdx);
            if (jsonSlice) {
              try {
                const candidate = JSON.parse(jsonSlice);
                const resolved = candidate?.shortcode_media || candidate?.xdt_shortcode_media || candidate;
                if (resolved && (resolved.video_url || resolved.video_versions || resolved.display_url || resolved.carousel_media || resolved.edge_sidecar_to_children)) {
                  mediaData = resolved;
                  break;
                }
              } catch {}
            }
          }
          if (mediaData) break;
        }
      }
    }

    if (mediaData) {
      const formatted = this.formatShortcodeMedia(mediaData, shortcode, canonicalType);
      if (formatted) {
        return { data: formatted, lsd };
      }
    }

    // 3. Fallback: Extract inline video URLs (HTML <video>, og:video, or escaped script video_url/video_versions)
    const videoTagMatch =
      html.match(/<video[^>]+src=["']([^"']+)["']/i) ||
      html.match(/<video[^>]*>[\s\S]*?<source[^>]+src=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i);
    const scriptVideoMatch =
      html.match(/"video_url"\s*:\s*"((?:https?:|https?:\\\/\\\/)[^"]+)"/i) ||
      html.match(/"playback_video_url"\s*:\s*"((?:https?:|https?:\\\/\\\/)[^"]+)"/i) ||
      html.match(/"video_versions"\s*:\s*\[\s*\{[^}]*?"url"\s*:\s*"((?:https?:|https?:\\\/\\\/)[^"]+)"/i);

    const rawVideoUrl = videoTagMatch?.[1] || scriptVideoMatch?.[1];
    const videoUrl = rawVideoUrl ? unescapeMediaJsonUrl(rawVideoUrl) : undefined;

    // Detect if Instagram embed represents a video/reel post even when the raw MP4 URL wasn't hydrated in static HTML
    const hasVideoSignal =
      canonicalType === 'reel' ||
      /EmbeddedVideo|ExploreVideo|PlayIcon|Watch on Instagram|video_duration|"is_video"\s*:\s*true|"media_type"\s*:\s*2|"product_type"\s*:\s*"clips"|"video_versions"|"video_url"|"playback_video_url"|<video\b|og:video/i.test(
        html
      );

    if (hasVideoSignal && !videoUrl) {
      // Crucial fix: NEVER downgrade a Reel/Video embed to its poster <img> thumbnail in Tier 1A!
      return { data: null, lsd };
    }

    let imageUrl: string | undefined;
    const imgMatches = html.matchAll(/<img([^>]+)>/gi);
    for (const match of imgMatches) {
      const attrs = match[1];
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      if (!srcMatch) continue;
      const src = srcMatch[1].replace(/&amp;/g, '&');

      // Carefully exclude profile avatars and sprite icons
      const isAvatar =
        /avatar|profile|150x150|s150x150/i.test(src) ||
        /class=["'][^"']*(?:avatar|headeravatar)[^"']*["']/i.test(attrs);
      const isSprite =
        /sprite|glyph/i.test(src) ||
        /class=["'][^"']*(?:sprite|glyph)[^"']*["']/i.test(attrs);
      if (isAvatar || isSprite) continue;

      if (/EmbeddedMediaImage/i.test(attrs)) {
        imageUrl = src;
        break;
      }
      if (!imageUrl) {
        imageUrl = src;
      }
    }

    const captionMatch = html.match(
      /<div class=["'][^"']*(?:CaptionText|Caption)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );
    let caption = '';
    if (captionMatch) {
      caption = captionMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    const authorMatch =
      html.match(/<(?:span|a|div) class=["'][^"']*UsernameText[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|a|div)>/i) ||
      html.match(/<a class=["'][^"']*CaptionUsername[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    let authorUsername = '';
    if (authorMatch) {
      authorUsername = authorMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    if (videoUrl || imageUrl) {
      const isVideo = Boolean(videoUrl);
      const primaryUrl = videoUrl || imageUrl!;
      const items: InstagramMediaItem[] = [
        {
          type: isVideo ? 'video' : 'image',
          url: primaryUrl,
          thumbnail: imageUrl || videoUrl
        }
      ];

      return {
        data: {
          id: shortcode,
          title: caption ? caption.replace(/\r?\n/g, ' ').slice(0, 100) : `Instagram Post ${shortcode}`,
          caption: caption || '',
          author: {
            username: authorUsername || 'Instagram User'
          },
          cover: imageUrl || videoUrl || '',
          duration: 0,
          mediaType: isVideo ? 'video' : 'image',
          videoUrl: isVideo ? videoUrl : undefined,
          imageUrl: !isVideo ? imageUrl : undefined,
          medias: items,
          isCarousel: false,
          extractor: 'resolver'
        },
        lsd
      };
    }

    return { data: null, lsd };
  }

  /**
   * Tier 1B: Anonymous Web GraphQL Query with X-IG-App-ID and extracted LSD token
   */
  private static async tryAnonymousGraphqlExtraction(
    shortcode: string,
    canonicalType: string,
    lsdToken: string | null
  ): Promise<InstagramVideoData | null> {
    const lsd = lsdToken || DEFAULT_LSD_TOKEN;
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_UA,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-FB-LSD': lsd,
      'X-ASBD-ID': DEFAULT_ASBD_ID,
      'X-IG-App-ID': DEFAULT_IG_APP_ID,
      'Origin': 'https://www.instagram.com',
      'Referer': `https://www.instagram.com/${canonicalType}/${shortcode}/`,
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    };

    const attempts = [
      { endpoint: 'https://www.instagram.com/graphql/query/', docId: '8845758582119845' },
      { endpoint: 'https://www.instagram.com/api/graphql', docId: '10015901848480474' }
    ];

    for (const attempt of attempts) {
      const body = `variables=${encodeURIComponent(JSON.stringify({ shortcode }))}&doc_id=${attempt.docId}`;
      try {
        const res = await fetch(attempt.endpoint, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(4500)
        });

        if (!res.ok) {
          await cancelResponseBody(res);
          continue;
        }
        const json = (await res.json()) as any;
        const media = json?.data?.xdt_shortcode_media || json?.data?.shortcode_media;
        if (media) {
          const formatted = this.formatShortcodeMedia(media, shortcode, canonicalType);
          if (formatted) return formatted;
        }
      } catch {
        // Try next GraphQL endpoint/doc_id
      }
    }
    return null;
  }

  /**
   * Normalizes shortcode_media / xdt_shortcode_media / Polaris media node into InstagramVideoData
   */
  private static formatShortcodeMedia(
    media: any,
    fallbackShortcode: string,
    canonicalType = 'p'
  ): InstagramVideoData | null {
    if (!media) return null;

    const pickVideoUrl = (node: any): string => {
      if (node?.video_url) return unescapeMediaJsonUrl(String(node.video_url));
      if (Array.isArray(node?.video_versions) && node.video_versions.length > 0) {
        const sorted = [...node.video_versions]
          .filter((v: any) => v?.url)
          .sort((a: any, b: any) => (Number(b.width || 0) * Number(b.height || 0)) - (Number(a.width || 0) * Number(a.height || 0)));
        if (sorted[0]?.url) return unescapeMediaJsonUrl(String(sorted[0].url));
      }
      return '';
    };

    const pickImageUrl = (node: any): string => {
      const raw =
        node?.display_url ||
        node?.image_versions2?.candidates?.[0]?.url ||
        node?.thumbnail_src ||
        '';
      return raw ? unescapeMediaJsonUrl(String(raw)) : '';
    };

    const id = String(media.id || media.pk || fallbackShortcode);
    const caption = (
      media.edge_media_to_caption?.edges?.[0]?.node?.text ||
      media.caption?.text ||
      (typeof media.caption === 'string' ? media.caption : '') ||
      media.title ||
      ''
    ).trim();
    const title = media.title || caption.replace(/\r?\n/g, ' ').slice(0, 100) || `Instagram Media ${id}`;
    const cover = pickImageUrl(media);
    const duration = Number(media.video_duration || 0);

    const author = {
      username: media.owner?.username || media.user?.username || 'Instagram User',
      fullName: media.owner?.full_name || media.user?.full_name
    };

    const rawChildren = Array.isArray(media.edge_sidecar_to_children?.edges) && media.edge_sidecar_to_children.edges.length > 1
      ? media.edge_sidecar_to_children.edges.map((e: any) => e?.node).filter(Boolean)
      : Array.isArray(media.carousel_media) && media.carousel_media.length > 1
        ? media.carousel_media
        : null;

    if (rawChildren) {
      // Multi-item Carousel with mixed photo and video items; never substitute thumbnail JPG when a video lacks video_url
      let missingRequiredVideo = false;
      const items: InstagramMediaItem[] = rawChildren
        .map((node: any) => {
          const isVid = Boolean(node.is_video || node.media_type === 2 || node.video_url || (Array.isArray(node.video_versions) && node.video_versions.length > 0));
          const vidUrl = pickVideoUrl(node);
          if (isVid && !vidUrl) {
            missingRequiredVideo = true;
            return null;
          }
          const thumb = pickImageUrl(node) || cover;
          const url = isVid ? vidUrl : thumb;
          if (!url) return null;
          return {
            type: isVid ? ('video' as const) : ('image' as const),
            url,
            thumbnail: thumb || url
          };
        })
        .filter((i: InstagramMediaItem | null): i is InstagramMediaItem => Boolean(i && i.url));

      if (missingRequiredVideo) {
        return null;
      }

      if (items.length > 0) {
        const primaryVideo = items.find((i) => i.type === 'video');
        const primaryImage = items.find((i) => i.type === 'image');
        return {
          id,
          title,
          caption,
          author,
          cover: cover || items[0].thumbnail || items[0].url,
          duration,
          mediaType: 'carousel',
          videoUrl: primaryVideo?.url,
          imageUrl: primaryImage?.url,
          medias: items,
          isCarousel: true,
          extractor: 'resolver'
        };
      }
    }

    const expectsVideo = Boolean(
      canonicalType === 'reel' ||
      media.is_video ||
      media.media_type === 2 ||
      media.product_type === 'clips' ||
      media.video_url ||
      (Array.isArray(media.video_versions) && media.video_versions.length > 0)
    );
    const resolvedVideoUrl = pickVideoUrl(media);
    if (expectsVideo && !resolvedVideoUrl) {
      return null;
    }

    const mediaUrl = expectsVideo ? resolvedVideoUrl : cover;
    if (!mediaUrl) return null;

    const items: InstagramMediaItem[] = [
      {
        type: expectsVideo ? 'video' : 'image',
        url: mediaUrl,
        thumbnail: cover || mediaUrl
      }
    ];

    return {
      id,
      title,
      caption,
      author,
      cover: cover || mediaUrl,
      duration,
      mediaType: expectsVideo ? 'video' : 'image',
      videoUrl: expectsVideo ? mediaUrl : undefined,
      imageUrl: !expectsVideo ? mediaUrl : undefined,
      medias: items,
      isCarousel: false,
      extractor: 'resolver'
    };
  }

  /**
   * Tier 1D: Optional Cobalt Gateway fallback if COBALT_API_URL is configured
   */
  private static async tryCobaltFallback(canonicalUrl: string, shortcode: string): Promise<InstagramVideoData | null> {
    const cobalt = await tryCobaltResolver(canonicalUrl);
    if (!cobalt) return null;

    if (cobalt.picker && cobalt.picker.length > 0) {
      const items: InstagramMediaItem[] = cobalt.picker.map((p) => ({
        type: p.type === 'video' ? 'video' : 'image',
        url: p.url,
        thumbnail: p.thumb || p.url
      }));
      const primaryVideo = items.find((i) => i.type === 'video');
      const primaryImage = items.find((i) => i.type === 'image');
      return {
        id: shortcode,
        title: `Instagram Media ${shortcode}`,
        author: { username: 'Instagram User' },
        cover: items[0].thumbnail || items[0].url,
        duration: 0,
        mediaType: items.length > 1 ? 'carousel' : items[0].type,
        videoUrl: primaryVideo?.url,
        imageUrl: primaryImage?.url,
        medias: items,
        isCarousel: items.length > 1,
        extractor: 'cobalt'
      };
    }

    if (cobalt.url) {
      const isImg = /\.(jpe?g|png|webp)(\?|$)/i.test(cobalt.url);
      return {
        id: shortcode,
        title: cobalt.filename ? cobalt.filename.replace(/\.[^.]+$/, '') : `Instagram Media ${shortcode}`,
        author: { username: 'Instagram User' },
        cover: cobalt.url,
        duration: 0,
        mediaType: isImg ? 'image' : 'video',
        videoUrl: isImg ? undefined : cobalt.url,
        imageUrl: isImg ? cobalt.url : undefined,
        medias: [{ type: isImg ? 'image' : 'video', url: cobalt.url, thumbnail: cobalt.url }],
        isCarousel: false,
        extractor: 'cobalt'
      };
    }

    return null;
  }

  /**
   * Tier 1C: Try RapidAPI endpoint (matching n8n node)
   */
  private static async tryApiExtraction(targetUrl: string, fallbackId: string): Promise<InstagramVideoData | null> {
    const apiKey = process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY;
    if (!apiKey) return null;

    try {
      const formData = new FormData();
      formData.append('url', targetUrl);

      const res = await fetch('https://instagram-video-downloader13.p.rapidapi.com/index.php', {
        method: 'POST',
        headers: {
          'x-rapidapi-host': 'instagram-video-downloader13.p.rapidapi.com',
          'x-rapidapi-key': apiKey
        },
        body: formData,
        signal: AbortSignal.timeout(8000)
      });

      if (!res.ok) {
        await cancelResponseBody(res);
        return null;
      }
      const data = (await res.json()) as any;
      if (data.error) return null;

      const medias = Array.isArray(data.medias) ? data.medias : [];
      if (medias.length === 0) return null;

      const items: InstagramMediaItem[] = medias.map((m: any) => ({
        type: m.type === 'image' ? 'image' : 'video',
        url: m.url,
        thumbnail: m.thumbnail || data.thumbnail
      }));

      const isCarousel = items.length > 1;
      let mediaType: 'carousel' | 'video' | 'image' = 'video';
      if (isCarousel) {
        mediaType = 'carousel';
      } else if (items.length === 1 && items[0].type === 'image') {
        mediaType = 'image';
      } else {
        mediaType = 'video';
      }

      const primaryVideo = items.find((i) => i.type === 'video');
      const primaryImage = items.find((i) => i.type === 'image');

      return {
        id: String(data.id || fallbackId),
        title: data.title || 'Instagram Media',
        caption: data.title || '',
        author: {
          username: data.author || 'Instagram User'
        },
        cover: data.thumbnail || items[0]?.thumbnail || items[0]?.url || '',
        duration: Number(data.duration || 0),
        mediaType,
        videoUrl: primaryVideo?.url || (mediaType === 'video' ? items[0]?.url : undefined),
        imageUrl: primaryImage?.url || (mediaType === 'image' ? items[0]?.url : undefined),
        medias: items,
        isCarousel,
        extractor: 'resolver'
      };
    } catch {
      return null;
    }
  }

  /**
   * Helper to parse yt-dlp stdout supporting single JSON, multi-line NDJSON, and entries array
   */
  static parseYtdlpOutput(stdout: string): any[] {
    const rawLines = (stdout || '').trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsedEntries: any[] = [];

    for (const line of rawLines) {
      try {
        const item = JSON.parse(line);
        if (item && Array.isArray(item.entries)) {
          for (const subItem of item.entries) {
            if (subItem) parsedEntries.push(subItem);
          }
        } else if (item) {
          parsedEntries.push(item);
        }
      } catch (err: any) {
        logger.debug({ err: err?.message }, '[Instagram] Failed parsing yt-dlp stdout line as JSON');
      }
    }

    return parsedEntries;
  }

  /**
   * Tier 2: Hardened yt-dlp CLI fallback (--no-playlist, --socket-timeout 12, --retries 2, timeout 22s)
   */
  private static async tryYtdlpExtraction(targetUrl: string, fallbackId: string): Promise<InstagramVideoData | null> {
    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--socket-timeout',
      '12',
      '--retries',
      '2'
    ];

    const cookiesFile = process.env.IG_COOKIES_FILE?.trim();
    if (cookiesFile && fs.existsSync(cookiesFile)) {
      args.push('--cookies', cookiesFile);
    }

    args.push(targetUrl);

    const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile('yt-dlp', args, { timeout: 22000, maxBuffer: 15 * 1024 * 1024 }, (err, out, serr) => {
        if (err) reject(err);
        else resolve({ stdout: String(out || ''), stderr: String(serr || '') });
      });
    });

    const entries = this.parseYtdlpOutput(stdout);
    if (entries.length === 0) {
      return null;
    }

    const firstEntry = entries[0];
    const id = String(firstEntry.id || fallbackId);
    const caption = (firstEntry.description || firstEntry.title || `Instagram Reel ${id}`).substring(0, 200);
    const title = caption.replace(/\r?\n/g, ' ').slice(0, 100);
    const cover = firstEntry.thumbnail || '';
    const duration = Number(firstEntry.duration || 0);
    const author = {
      username: firstEntry.uploader || firstEntry.channel || 'Instagram User',
      fullName: firstEntry.uploader_id
    };

    const medias: InstagramMediaItem[] = [];
    let resolvedAudioUrl: string | undefined;

    for (const entry of entries) {
      let mediaItemUrl = '';
      let isVideo = false;
      const entryCover = entry.thumbnail || cover;

      if (Array.isArray(entry.formats) && entry.formats.length > 0) {
        const progressiveMp4 = entry.formats
          .filter(
            (f: any) =>
              f.url &&
              (f.ext === 'mp4' || !f.ext) &&
              f.vcodec &&
              f.vcodec !== 'none' &&
              f.acodec &&
              f.acodec !== 'none'
          )
          .sort((a: any, b: any) => Number(a.height || 0) - Number(b.height || 0))
          .pop();

        const anyVideoFmt = entry.formats
          .filter((f: any) => f.url && f.vcodec && f.vcodec !== 'none')
          .sort((a: any, b: any) => Number(a.height || 0) - Number(b.height || 0))
          .pop();

        const audioFmt = entry.formats.find(
          (f: any) => f.url && (!f.vcodec || f.vcodec === 'none') && f.acodec && f.acodec !== 'none'
        );
        if (audioFmt?.url && !resolvedAudioUrl) {
          resolvedAudioUrl = audioFmt.url;
        }

        if (progressiveMp4?.url) {
          mediaItemUrl = progressiveMp4.url;
          isVideo = true;
        } else if (anyVideoFmt?.url) {
          mediaItemUrl = anyVideoFmt.url;
          isVideo = true;
        }
      }

      if (!mediaItemUrl && entry.url) {
        mediaItemUrl = entry.url;
        isVideo =
          entry.ext === 'mp4' ||
          (Boolean(entry.video_ext) && entry.video_ext !== 'none') ||
          (Boolean(entry.vcodec) && entry.vcodec !== 'none') ||
          !/\.(jpe?g|png|webp)(\?|$)/i.test(entry.url);
      } else if (!mediaItemUrl && Array.isArray(entry.formats) && entry.formats.length > 0) {
        const anyFmt = entry.formats.filter((f: any) => f.url).pop();
        if (anyFmt?.url) {
          mediaItemUrl = anyFmt.url;
          isVideo = anyFmt.ext === 'mp4' || (Boolean(anyFmt.vcodec) && anyFmt.vcodec !== 'none');
        }
      }

      if (mediaItemUrl) {
        medias.push({
          type: isVideo ? 'video' : 'image',
          url: mediaItemUrl,
          thumbnail: entryCover
        });
      }
    }

    if (medias.length === 0) {
      return null;
    }

    const isCarousel = medias.length > 1;
    let mediaType: 'carousel' | 'video' | 'image' = 'video';
    if (isCarousel) {
      mediaType = 'carousel';
    } else if (medias.length === 1 && medias[0].type === 'image') {
      mediaType = 'image';
    } else {
      mediaType = 'video';
    }

    const primaryVideo = medias.find((m) => m.type === 'video');
    const primaryImage = medias.find((m) => m.type === 'image');

    return {
      id,
      title,
      caption,
      author,
      cover,
      duration,
      mediaType,
      videoUrl: primaryVideo?.url || (mediaType === 'video' ? medias[0]?.url : undefined),
      imageUrl: primaryImage?.url || (mediaType === 'image' ? medias[0]?.url : undefined),
      audioUrl: resolvedAudioUrl,
      medias,
      isCarousel,
      extractor: 'ytdlp'
    };
  }

  /**
   * Proxies media stream to client with HTTP 206 Partial Content support
   */
  static async proxyStream(
    targetUrl: string,
    download: boolean,
    filename: string,
    rangeHeader: string | undefined,
    reply: FastifyReply,
    format?: 'mp3'
  ): Promise<any> {
    validateSafeMediaUrl(targetUrl, ['cdninstagram.com', 'instagram.com', 'fbcdn.net']);

    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_UA,
      Referer: 'https://www.instagram.com/'
    };
    if (format === 'mp3') {
      return streamTranscodedMp3({ sourceUrl: targetUrl, headers, filename, reply });
    }
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers,
      signal: AbortSignal.timeout(60000)
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      await cancelResponseBody(upstreamRes);
      throw new BadRequestError(`Không thể kết nối đến luồng video: HTTP ${upstreamRes.status}`);
    }

    reply.status(upstreamRes.status);
    reply.header('Content-Type', upstreamRes.headers.get('content-type') || 'video/mp4');
    reply.header('Accept-Ranges', 'bytes');

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) reply.header('Content-Length', contentLength);

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) reply.header('Content-Range', contentRange);

    if (download) {
      const safeName = filename || 'instagram_video.mp4';
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
   * Checks if media already exists in DD Studio Drive (`/data/storage/drive/instagram/`)
   * Uses concurrent bounded worker pool scanning (*.meta.json) with early short-circuit.
   */
  static async checkExistingInDrive(
    videoId?: string,
    originalUrl?: string,
    driveDirOverride?: string
  ): Promise<{ exists: boolean; item?: any }> {
    const igDir = driveDirOverride || path.join(resolvedStoragePaths.drive, 'instagram');
    const cleanId = (videoId || '').trim();
    const normInputUrl = (originalUrl || '').split('?')[0].replace(/\/$/, '').toLowerCase();
    if (!cleanId && !normInputUrl) return { exists: false };

    try {
      const match = await findExistingDriveMatch(
        igDir,
        async (meta, metaFileName) => {
          let isMatch = false;
          if (
            cleanId &&
            ((meta?.instagramId && String(meta.instagramId) === cleanId) ||
              metaFileName.includes(cleanId.slice(-10)))
          ) {
            isMatch = true;
          }

          if (!isMatch && normInputUrl && meta?.originalUrl) {
            const normMetaUrl = meta.originalUrl.split('?')[0].replace(/\/$/, '').toLowerCase();
            if (normMetaUrl === normInputUrl) isMatch = true;
          }

          if (!isMatch) return false;

          // Find corresponding media file (.mp4, .jpg, .webp)
          const baseName = metaFileName.replace(/\.meta\.json$/, '');
          for (const ext of ['.mp4', '.jpg', '.webp']) {
            const mediaDiskPath = path.join(igDir, `${baseName}${ext}`);
            if (fs.existsSync(mediaDiskPath)) {
              const stat = await fsPromises.stat(mediaDiskPath);
              return {
                fileName: `${baseName}${ext}`,
                relPath: `/instagram/${baseName}${ext}`,
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
   * Saves media stream directly into DD Studio Drive (`/data/storage/drive/instagram/`)
   */
  static async saveToDrive(
    mediaUrl: string,
    title = 'instagram_media',
    id = '',
    originalUrl = '',
    cover = '',
    author?: any,
    duration?: number,
    overwrite = false,
    mediaType?: 'video' | 'image' | 'carousel'
  ): Promise<{
    success: boolean;
    fileName: string;
    relPath: string;
    sizeBytes: number;
    fileId: string;
    metadata?: any;
  }> {
    if (!mediaUrl) {
      throw new BadRequestError('Không tìm thấy đường dẫn tệp để lưu');
    }

    validateSafeMediaUrl(mediaUrl, ['cdninstagram.com', 'instagram.com', 'fbcdn.net']);

    const igDir = path.join(resolvedStoragePaths.drive, 'instagram');
    if (!fs.existsSync(igDir)) {
      await fsPromises.mkdir(igDir, { recursive: true });
    }

    logger.info({ mediaUrl, title }, '[Instagram] Saving media directly to Studio Drive...');

    const upstreamRes = await fetch(mediaUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        Referer: 'https://www.instagram.com/'
      },
      signal: AbortSignal.timeout(120000)
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      await cancelResponseBody(upstreamRes);
      throw new BadRequestError(`Không thể tải nội dung từ Instagram: HTTP ${upstreamRes.status}`);
    }

    const upstreamContentType = upstreamRes.headers.get('content-type') || '';
    const isImage =
      mediaType === 'image' ||
      upstreamContentType.startsWith('image/') ||
      /\.(jpe?g|png|webp)($|\?)/i.test(mediaUrl);

    const ext = isImage ? 'jpg' : 'mp4';
    const mimeType = isImage ? 'image/jpeg' : 'video/mp4';

    const sanitizedTitle = (title || (isImage ? 'photo' : 'video'))
      .replace(/[\\/:*?"<>|#@$%^&*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 60)
      .trim()
      .replace(/^_+|_+$/g, '');

    const cleanId = (id || Date.now().toString(36)).slice(-10);
    const fileName = `[Instagram]_${sanitizedTitle || (isImage ? 'photo' : 'reel')}_${cleanId}.${ext}`;
    const targetFilePath = path.join(igDir, fileName);

    if (overwrite && fs.existsSync(targetFilePath)) {
      await StorageManager.unlinkSafe(targetFilePath);
      await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.meta.json'));
      await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.thumb.jpg'));
    }

    const fileStream = fs.createWriteStream(targetFilePath);
    const hash = crypto.createHash('sha256');
    let byteCount = 0;

    const webStream = Readable.fromWeb(upstreamRes.body as any);
    webStream.on('data', (chunk: Buffer) => {
      byteCount += chunk.length;
      hash.update(chunk);
    });

    await pipeline(webStream, fileStream);

    const hashSha256 = hash.digest('hex');

    // Download thumbnail
    let thumbnailDataUri = '';
    if (cover && cover.startsWith('http')) {
      try {
        const coverRes = await fetch(cover, {
          headers: { 'User-Agent': DEFAULT_UA },
          signal: AbortSignal.timeout(10000)
        });
        if (coverRes.ok) {
          const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
          const contentType = coverRes.headers.get('content-type') || 'image/jpeg';
          thumbnailDataUri = `data:${contentType};base64,${coverBuffer.toString('base64')}`;
          const thumbPath = targetFilePath.replace(/\.[^.]+$/, '.thumb.jpg');
          await fsPromises.writeFile(thumbPath, coverBuffer).catch(() => {});
        } else {
          await cancelResponseBody(coverRes);
        }
      } catch {}
    }

    const authorUsername = typeof author === 'string' ? author : author?.username || 'instagram_user';

    const metadata = {
      instagramId: id || cleanId,
      originalUrl: originalUrl || '',
      title: title || (isImage ? 'Instagram Photo' : 'Instagram Video'),
      author: authorUsername,
      thumbnail: thumbnailDataUri || cover || '',
      duration: duration || 0,
      mediaType: isImage ? 'image' : 'video',
      savedAt: new Date().toISOString()
    };

    const metaPath = targetFilePath.replace(/\.[^.]+$/, '.meta.json');
    await fsPromises.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

    // Register in Prisma
    const fileId = crypto.randomUUID();
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
      logger.warn({ err: e?.message }, '[Instagram] Could not create prisma record; file saved to disk');
    }

    DriveService.invalidateStatsCache();

    return {
      success: true,
      fileName,
      relPath: `/instagram/${fileName}`,
      sizeBytes: byteCount,
      fileId,
      metadata
    };
  }
}
