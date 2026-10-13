/**
 * TikTok Service - Multi-tier Video & Audio Extractor & Stream Manager
 * Native replacement for n8n TikTok Downloader workflow.
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
import { TikTokVideoData } from '../schemas/tiktok.schema.js';
import { StorageManager } from '../storage/storage.manager.js';
import { resolvedStoragePaths } from '../config/env.config.js';
import { DriveService } from './drive.service.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class TikTokService {
  /**
   * Cleans and normalizes raw text input to a TikTok URL
   */
  static extractUrl(rawText: string): string {
    const trimmed = (rawText || '').trim();
    const urlMatch = trimmed.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?(?:tiktok\.com|douyin\.com)[^\s"'>]*/i);
    if (!urlMatch) {
      throw new BadRequestError('Liên kết không hợp lệ. Vui lòng dán liên kết TikTok hoặc Douyin hợp lệ.');
    }
    return urlMatch[0];
  }

  /**
   * Expands short TikTok URLs (vt.tiktok.com, vm.tiktok.com) to canonical video URL
   */
  static async expandUrl(rawUrl: string): Promise<string> {
    const cleanUrl = this.extractUrl(rawUrl);
    if (!cleanUrl.includes('vt.tiktok.com') && !cleanUrl.includes('vm.tiktok.com')) {
      return cleanUrl;
    }

    try {
      const res = await fetch(cleanUrl, {
        method: 'GET',
        headers: { 'User-Agent': DEFAULT_UA },
        redirect: 'follow',
        signal: AbortSignal.timeout(6000)
      });
      return res.url || cleanUrl;
    } catch (err: any) {
      logger.warn({ err: err?.message, cleanUrl }, 'Failed to expand short TikTok URL; falling back to original');
      return cleanUrl;
    }
  }

  /**
   * Multi-tier resolution:
   * Tier 1: Direct SSR HTML parser (exact logic from user's n8n workflow)
   * Tier 2: TikWM direct resolver (returns high-speed CDN playAddr, HD playAddr & MP3)
   * Tier 3: Local yt-dlp CLI
   */
  static async resolveVideo(rawInput: string): Promise<TikTokVideoData> {
    const targetUrl = await this.expandUrl(rawInput);
    logger.info({ targetUrl }, '[TikTok] Resolving video...');

    // Extract ID from URL if present
    const idMatch = targetUrl.match(/\/video\/(\d+)/i) || targetUrl.match(/item\/(\d+)/i);
    const videoIdFallback = idMatch ? idMatch[1] : `tt_${Date.now()}`;

    // --- Tier 1: SSR Extraction (Native n8n Scrape) ---
    try {
      const ssrResult = await this.trySsrExtraction(targetUrl, videoIdFallback);
      if (ssrResult) {
        logger.info({ id: ssrResult.id }, '[TikTok] Successfully resolved via Tier 1 SSR parser');
        return ssrResult;
      }
    } catch (ssrErr: any) {
      logger.debug({ err: ssrErr?.message }, '[TikTok] Tier 1 SSR parser bypassed/failed');
    }

    // --- Tier 2: Direct High-Speed Resolver (TikWM) ---
    try {
      const resolverResult = await this.tryTikwmResolver(targetUrl, videoIdFallback);
      if (resolverResult) {
        logger.info({ id: resolverResult.id }, '[TikTok] Successfully resolved via Tier 2 Resolver API');
        return resolverResult;
      }
    } catch (resErr: any) {
      logger.warn({ err: resErr?.message }, '[TikTok] Tier 2 Resolver API failed, falling back to Tier 3');
    }

    // --- Tier 3: yt-dlp CLI ---
    try {
      const ytdlpResult = await this.tryYtdlpExtraction(targetUrl, videoIdFallback);
      if (ytdlpResult) {
        logger.info({ id: ytdlpResult.id }, '[TikTok] Successfully resolved via Tier 3 yt-dlp');
        return ytdlpResult;
      }
    } catch (ytErr: any) {
      logger.error({ err: ytErr?.message }, '[TikTok] Tier 3 yt-dlp extraction failed');
    }

    throw new BadRequestError('Không thể trích xuất video TikTok này. Video có thể đang ở chế độ riêng tư, bị xóa hoặc bị giới hạn khu vực.');
  }

  /**
   * Tier 1: SSR HTML Scraping (matching n8n node 2 & 3)
   */
  private static async trySsrExtraction(targetUrl: string, fallbackId: string): Promise<TikTokVideoData | null> {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Check for Slardar WAF challenge page
    if (html.includes('_wafchallengeid') || html.includes('Please wait...')) {
      return null;
    }

    let itemStruct: any = null;

    // Check __UNIVERSAL_DATA_FOR_REHYDRATION__
    const matchUni = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/);
    if (matchUni) {
      try {
        const parsed = JSON.parse(matchUni[1]);
        itemStruct = parsed?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
      } catch {}
    }

    // Check SIGI_STATE
    if (!itemStruct) {
      const matchSigi = html.match(/<script id="SIGI_STATE" type="application\/json">([\s\S]*?)<\/script>/);
      if (matchSigi) {
        try {
          const parsed = JSON.parse(matchSigi[1]);
          const itemModule = parsed?.ItemModule;
          const firstKey = itemModule ? Object.keys(itemModule)[0] : null;
          if (firstKey) itemStruct = itemModule[firstKey];
        } catch {}
      }
    }

    if (!itemStruct || !itemStruct.video?.playAddr) {
      return null;
    }

    const videoUrl = itemStruct.video.playAddr;
    const id = itemStruct.id || fallbackId;
    const title = itemStruct.desc || `TikTok Video ${id}`;
    const author = {
      uniqueId: itemStruct.author?.uniqueId || itemStruct.author?.id || 'tiktok_user',
      nickname: itemStruct.author?.nickname || itemStruct.author?.uniqueId || 'Người dùng TikTok',
      avatar: itemStruct.author?.avatarThumb || itemStruct.author?.avatarMedium || ''
    };
    const cover = itemStruct.video?.cover || itemStruct.video?.originCover || '';
    const duration = Number(itemStruct.video?.duration || 0);
    const audioUrl = itemStruct.music?.playUrl || '';
    const stats = {
      views: Number(itemStruct.stats?.playCount || 0),
      likes: Number(itemStruct.stats?.diggCount || 0),
      comments: Number(itemStruct.stats?.commentCount || 0),
      shares: Number(itemStruct.stats?.shareCount || 0)
    };

    return {
      id,
      title,
      author,
      cover,
      duration,
      videoUrl,
      audioUrl,
      stats,
      extractor: 'ssr'
    };
  }

  /**
   * Tier 2: TikWM API Resolver
   */
  private static async tryTikwmResolver(targetUrl: string, fallbackId: string): Promise<TikTokVideoData | null> {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`;
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': DEFAULT_UA },
      signal: AbortSignal.timeout(7000)
    });

    if (!res.ok) return null;
    const json = await res.json() as any;

    if (json.code !== 0 || !json.data) {
      return null;
    }

    const d = json.data;
    const id = String(d.id || fallbackId);
    const title = d.title || `TikTok Video ${id}`;
    const author = {
      uniqueId: d.author?.unique_id || d.author?.id || 'tiktok_user',
      nickname: d.author?.nickname || d.author?.unique_id || 'Người dùng TikTok',
      avatar: d.author?.avatar || ''
    };
    const cover = d.cover || d.origin_cover || '';
    const duration = Number(d.duration || 0);

    // Make sure play URLs are absolute
    const ensureAbsolute = (u?: string) => {
      if (!u) return '';
      if (u.startsWith('http')) return u;
      return `https://www.tikwm.com${u}`;
    };

    const videoUrl = ensureAbsolute(d.play);
    const videoHdUrl = ensureAbsolute(d.hdplay);
    const audioUrl = ensureAbsolute(d.music);

    const stats = {
      views: Number(d.play_count || 0),
      likes: Number(d.digg_count || 0),
      comments: Number(d.comment_count || 0),
      shares: Number(d.share_count || 0)
    };

    return {
      id,
      title,
      author,
      cover,
      duration,
      videoUrl,
      videoHdUrl: videoHdUrl && videoHdUrl !== videoUrl ? videoHdUrl : undefined,
      audioUrl: audioUrl || undefined,
      stats,
      extractor: 'resolver'
    };
  }

  /**
   * Tier 3: Local yt-dlp CLI
   */
  private static async tryYtdlpExtraction(targetUrl: string, fallbackId: string): Promise<TikTokVideoData | null> {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--dump-json',
      '--no-warnings',
      '--no-check-certificates',
      targetUrl
    ], { timeout: 15000 });

    const info = JSON.parse(stdout);
    if (!info) return null;

    const id = String(info.id || fallbackId);
    const title = info.title || info.description || `TikTok Video ${id}`;
    const author = {
      uniqueId: info.uploader_id || info.uploader || 'tiktok_user',
      nickname: info.channel || info.uploader || 'Người dùng TikTok',
      avatar: ''
    };
    const cover = info.thumbnail || '';
    const duration = Number(info.duration || 0);

    // Pick best direct format
    const videoUrl = info.url || (info.formats && info.formats[info.formats.length - 1]?.url) || '';
    const stats = {
      views: Number(info.view_count || 0),
      likes: Number(info.like_count || 0),
      comments: Number(info.comment_count || 0),
      shares: Number(info.repost_count || 0)
    };

    return {
      id,
      title,
      author,
      cover,
      duration,
      videoUrl,
      stats,
      extractor: 'ytdlp'
    };
  }

  /**
   * Proxies CDN media stream with Range requests (HTTP 206) and proper Referer
   */
  static async proxyStream(
    targetUrl: string,
    download: boolean,
    filename: string,
    rangeHeader: string | undefined,
    reply: FastifyReply
  ): Promise<void> {
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': DEFAULT_UA,
      'Referer': 'https://www.tiktok.com/'
    };

    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers: upstreamHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(60000)
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      throw new BadRequestError(`Upstream CDN responded with error: ${upstreamRes.status} ${upstreamRes.statusText}`);
    }

    // Forward status (200 or 206)
    reply.status(upstreamRes.status);

    // Forward streaming headers
    const contentType = upstreamRes.headers.get('content-type') || (filename.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4');
    reply.header('Content-Type', contentType);
    reply.header('Accept-Ranges', 'bytes');

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) {
      reply.header('Content-Length', contentLength);
    }

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) {
      reply.header('Content-Range', contentRange);
    }

    if (download) {
      const safeName = filename || 'tiktok_video.mp4';
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
   * Saves TikTok video stream directly into DD Studio Drive (`/data/storage/drive/tiktok/`)
   */
  static async saveToDrive(
    mediaUrl: string,
    title = 'tiktok_video',
    id = ''
  ): Promise<{ success: boolean; fileName: string; relPath: string; sizeBytes: number; fileId: string }> {
    // 1. Target directory
    const tiktokDir = path.join(resolvedStoragePaths.drive, 'tiktok');
    if (!fs.existsSync(tiktokDir)) {
      await fsPromises.mkdir(tiktokDir, { recursive: true });
    }

    // 2. Clean and build safe filename
    const sanitizedTitle = (title || 'video')
      .replace(/[\\/:*?"<>|#@$%^&*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 60)
      .trim()
      .replace(/^_+|_+$/g, '');

    const cleanId = (id || Date.now().toString(36)).slice(-10);
    const fileName = `[TikTok]_${sanitizedTitle || 'clip'}_${cleanId}.mp4`;
    const targetFilePath = path.join(tiktokDir, fileName);

    logger.info({ fileName, targetFilePath }, '[TikTok] Saving video directly to Studio Drive...');

    // 3. Fetch from upstream with streaming pipeline
    const upstreamRes = await fetch(mediaUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Referer': 'https://www.tiktok.com/'
      },
      signal: AbortSignal.timeout(120000)
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      throw new BadRequestError(`Không thể tải video từ TikTok CDN (Mã lỗi: ${upstreamRes.status})`);
    }

    const hash = crypto.createHash('sha256');
    let byteCount = 0;

    const hashingStream = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        byteCount += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      }
    });

    const fileWriteStream = fs.createWriteStream(targetFilePath, { highWaterMark: 4 * 1024 * 1024 });
    const nodeReadable = Readable.fromWeb(upstreamRes.body as any);

    try {
      await pipeline(nodeReadable, hashingStream, fileWriteStream);
    } catch (err: any) {
      await StorageManager.unlinkSafe(targetFilePath);
      throw new BadRequestError(`Lỗi ghi tệp video vào Drive: ${err?.message}`);
    }

    if (byteCount === 0) {
      await StorageManager.unlinkSafe(targetFilePath);
      throw new BadRequestError('Video tải về có dung lượng 0 byte');
    }

    const hashSha256 = hash.digest('hex');
    const fileId = `fil_tt_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;

    // 4. Index in Prisma FileRecord
    try {
      await prisma.fileRecord.create({
        data: {
          id: fileId,
          purpose: 'PROCESSED',
          originalName: fileName,
          storagePath: targetFilePath,
          mimeType: 'video/mp4',
          sizeBytes: BigInt(byteCount),
          hashSha256,
          isPurged: false,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // permanent 1 year
        }
      });
    } catch (dbErr: any) {
      logger.warn({ err: dbErr?.message }, '[TikTok] Could not create prisma fileRecord; disk file is preserved');
    }

    // 5. Invalidate Drive telemetry cache
    DriveService.invalidateStatsCache();

    return {
      success: true,
      fileName,
      relPath: `tiktok/${fileName}`,
      sizeBytes: byteCount,
      fileId
    };
  }
}
