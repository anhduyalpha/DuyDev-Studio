/**
 * Instagram Service - Multi-tier Video & Photo Extractor & Stream Manager
 * Native port of n8n Instagram Downloader workflow.
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { FastifyReply } from 'fastify';
import { InstagramVideoData, InstagramMediaItem } from '../schemas/instagram.schema.js';
import { StorageManager } from '../storage/storage.manager.js';
import { resolvedStoragePaths } from '../config/env.config.js';
import { DriveService } from './drive.service.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class InstagramService {
  /**
   * Cleans and validates raw text to a valid Instagram URL
   */
  static extractUrl(rawText: string): string {
    let trimmed = (rawText || '').trim();
    if (!trimmed) {
      throw new BadRequestError('Liên kết không hợp lệ. Vui lòng dán liên kết Instagram Post, Reel hoặc Story hợp lệ.');
    }

    // Auto-prepend https:// if protocol-less
    if (/^(?:[a-zA-Z0-9_-]+\.)?instagram\.com(?:\/|$)/i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?instagram\.com\/(?:p|reel|reels|tv|stories)\/[a-zA-Z0-9_-]+[^\s"'<>]+/i);
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
   * Resolves Instagram video or post metadata using multi-tier strategy
   */
  static async resolveVideo(rawInput: string): Promise<InstagramVideoData> {
    const targetUrl = this.extractUrl(rawInput);
    logger.info({ targetUrl }, '[Instagram] Resolving video metadata...');

    const codeMatch = targetUrl.match(/(?:p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/i);
    const fallbackId = codeMatch?.[1] || `ig_${Date.now()}`;

    let resolvedData: InstagramVideoData | null = null;

    // --- Tier 1: RapidAPI if configured ---
    try {
      const apiResult = await this.tryApiExtraction(targetUrl, fallbackId);
      if (apiResult) {
        resolvedData = apiResult;
        logger.info({ id: resolvedData.id }, '[Instagram] Resolved via Tier 1 API');
      }
    } catch (e: any) {
      logger.debug({ err: e?.message }, '[Instagram] Tier 1 API skipped');
    }

    // --- Tier 2: yt-dlp CLI ---
    if (!resolvedData) {
      try {
        const ytdlpResult = await this.tryYtdlpExtraction(targetUrl, fallbackId);
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

    // Check Drive duplication
    const existing = await this.checkExistingInDrive(resolvedData.id, targetUrl);
    resolvedData.existingInDrive = existing.exists ? existing.item : null;

    return resolvedData;
  }

  /**
   * Tier 1: Try RapidAPI endpoint (matching n8n node)
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

      if (!res.ok) return null;
      const data = await res.json() as any;
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

      const primaryVideo = items.find(i => i.type === 'video');
      const primaryImage = items.find(i => i.type === 'image');

      return {
        id: String(data.id || fallbackId),
        title: data.title || 'Instagram Media',
        caption: data.title || '',
        author: {
          username: data.author || 'Instagram User'
        },
        cover: data.thumbnail || (items[0]?.thumbnail || items[0]?.url || ''),
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
    const rawLines = (stdout || '').trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
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
   * Tier 2: Local yt-dlp CLI
   */
  private static async tryYtdlpExtraction(targetUrl: string, fallbackId: string): Promise<InstagramVideoData | null> {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--dump-json',
      '--no-warnings',
      '--no-check-certificates',
      targetUrl
    ], { timeout: 20000, maxBuffer: 15 * 1024 * 1024 });

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

    for (const entry of entries) {
      let mediaItemUrl = '';
      let isVideo = false;
      const entryCover = entry.thumbnail || cover;

      if (entry.url) {
        mediaItemUrl = entry.url;
        isVideo = entry.ext === 'mp4' || (Boolean(entry.vcodec) && entry.vcodec !== 'none');
      } else if (Array.isArray(entry.formats) && entry.formats.length > 0) {
        const videoFmt = entry.formats
          .filter((f: any) => f.url && (f.ext === 'mp4' || (f.vcodec && f.vcodec !== 'none')))
          .pop();

        if (videoFmt?.url) {
          mediaItemUrl = videoFmt.url;
          isVideo = true;
        } else {
          const anyFmt = entry.formats.filter((f: any) => f.url).pop() || entry.formats[entry.formats.length - 1];
          if (anyFmt?.url) {
            mediaItemUrl = anyFmt.url;
            isVideo = anyFmt.ext === 'mp4' || (Boolean(anyFmt.vcodec) && anyFmt.vcodec !== 'none');
          }
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

    const primaryVideo = medias.find(m => m.type === 'video');
    const primaryImage = medias.find(m => m.type === 'image');

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
    reply: FastifyReply
  ): Promise<any> {
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_UA,
      'Referer': 'https://www.instagram.com/'
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers,
      signal: AbortSignal.timeout(60000)
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
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
   */
  static async checkExistingInDrive(
    videoId?: string,
    originalUrl?: string
  ): Promise<{ exists: boolean; item?: any }> {
    const igDir = path.join(resolvedStoragePaths.drive, 'instagram');
    if (!fs.existsSync(igDir)) {
      return { exists: false };
    }

    const cleanId = (videoId || '').trim();
    const normInputUrl = (originalUrl || '').split('?')[0].replace(/\/$/, '').toLowerCase();
    if (!cleanId && !normInputUrl) return { exists: false };

    try {
      const files = await fsPromises.readdir(igDir, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory() || (!file.name.endsWith('.mp4') && !file.name.endsWith('.jpg') && !file.name.endsWith('.webp'))) continue;

        const mediaDiskPath = path.join(igDir, file.name);
        if (!fs.existsSync(mediaDiskPath)) continue;

        let isMatch = false;
        let meta: any = null;
        const metaPath = path.join(igDir, `${file.name.replace(/\.[^.]+$/, '')}.meta.json`);

        if (fs.existsSync(metaPath)) {
          try {
            meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf8'));
          } catch {}
        }

        if (cleanId && ((meta?.instagramId && String(meta.instagramId) === cleanId) || file.name.includes(cleanId.slice(-10)))) {
          isMatch = true;
        }

        if (!isMatch && normInputUrl && meta?.originalUrl) {
          const normMetaUrl = meta.originalUrl.split('?')[0].replace(/\/$/, '').toLowerCase();
          if (normMetaUrl === normInputUrl) isMatch = true;
        }

        if (isMatch) {
          const stat = await fsPromises.stat(mediaDiskPath);
          return {
            exists: true,
            item: {
              fileName: file.name,
              relPath: `/instagram/${file.name}`,
              sizeBytes: stat.size,
              title: meta?.title || file.name,
              thumbnail: meta?.thumbnail,
              duration: meta?.duration,
              updatedAt: stat.mtime.toISOString()
            }
          };
        }
      }
    } catch {}

    return { exists: false };
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
  ): Promise<{ success: boolean; fileName: string; relPath: string; sizeBytes: number; fileId: string; metadata?: any }> {
    if (!mediaUrl) {
      throw new BadRequestError('Không tìm thấy đường dẫn tệp để lưu');
    }

    const igDir = path.join(resolvedStoragePaths.drive, 'instagram');
    if (!fs.existsSync(igDir)) {
      await fsPromises.mkdir(igDir, { recursive: true });
    }

    logger.info({ mediaUrl, title }, '[Instagram] Saving media directly to Studio Drive...');

    const upstreamRes = await fetch(mediaUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Referer': 'https://www.instagram.com/'
      },
      signal: AbortSignal.timeout(120000)
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      throw new BadRequestError(`Không thể tải nội dung từ Instagram: HTTP ${upstreamRes.status}`);
    }

    const upstreamContentType = upstreamRes.headers.get('content-type') || '';
    const isImage = (mediaType === 'image') ||
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
        }
      } catch {}
    }

    const authorUsername = typeof author === 'string' ? author : (author?.username || 'instagram_user');

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
