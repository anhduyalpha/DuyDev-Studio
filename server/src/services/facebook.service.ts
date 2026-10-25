/**
 * Facebook Service - Multi-tier Video Extractor & Stream Manager
 * Native port of n8n Facebook Downloader workflow.
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
import { FacebookVideoData, FacebookMediaFormat } from '../schemas/facebook.schema.js';
import { StorageManager } from '../storage/storage.manager.js';
import { resolvedStoragePaths } from '../config/env.config.js';
import { DriveService } from './drive.service.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class FacebookService {
  /**
   * Cleans and validates raw text to a valid Facebook URL
   */
  static extractUrl(rawText: string): string {
    const trimmed = (rawText || '').trim();
    const urlMatch = trimmed.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?(?:facebook\.com|fb\.watch|fb\.gg)[^\s"'>]*/i);
    if (!urlMatch) {
      throw new BadRequestError('Liên kết không hợp lệ. Vui lòng dán liên kết Facebook hoặc FB Watch hợp lệ.');
    }
    return urlMatch[0];
  }

  /**
   * Resolves Facebook video metadata using multi-tier strategy
   */
  static async resolveVideo(rawInput: string): Promise<FacebookVideoData> {
    const targetUrl = this.extractUrl(rawInput);
    logger.info({ targetUrl }, '[Facebook] Resolving video metadata...');

    // Extract fallback ID
    const reelMatch = targetUrl.match(/reel(?:s)?\/([a-zA-Z0-9_-]+)/i);
    const watchMatch = targetUrl.match(/[?&]v=(\d+)/i);
    const postMatch = targetUrl.match(/videos\/(\d+)/i);
    const fallbackId = (reelMatch?.[1] || watchMatch?.[1] || postMatch?.[1] || `fb_${Date.now()}`);

    let resolvedData: FacebookVideoData | null = null;

    // --- Tier 1: Open Resolver / RapidAPI if configured ---
    try {
      const apiResult = await this.tryApiExtraction(targetUrl, fallbackId);
      if (apiResult) {
        resolvedData = apiResult;
        logger.info({ id: resolvedData.id }, '[Facebook] Resolved via Tier 1 API');
      }
    } catch (e: any) {
      logger.debug({ err: e?.message }, '[Facebook] Tier 1 API skipped');
    }

    // --- Tier 2: yt-dlp CLI ---
    if (!resolvedData) {
      try {
        const ytdlpResult = await this.tryYtdlpExtraction(targetUrl, fallbackId);
        if (ytdlpResult) {
          resolvedData = ytdlpResult;
          logger.info({ id: resolvedData.id }, '[Facebook] Resolved via Tier 2 yt-dlp');
        }
      } catch (ytErr: any) {
        logger.warn({ err: ytErr?.message }, '[Facebook] Tier 2 yt-dlp failed');
      }
    }

    if (!resolvedData) {
      throw new BadRequestError('Không thể lấy thông tin video Facebook này. Video có thể đang ở chế độ riêng tư, trong nhóm kín hoặc đã bị xóa.');
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
      '--no-warnings',
      '--no-check-certificates',
      targetUrl
    ], { timeout: 20000, maxBuffer: 15 * 1024 * 1024 });

    const json = JSON.parse(stdout.trim());
    const id = String(json.id || fallbackId);
    const title = (json.title || json.description || `Facebook Video ${id}`).substring(0, 150);
    const cover = json.thumbnail || '';
    const duration = Number(json.duration || 0);
    const author = {
      name: json.uploader || json.channel || 'Facebook User',
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
      author,
      cover,
      duration,
      formats,
      videoHdUrl: videoHdUrl || undefined,
      videoSdUrl: videoSdUrl || videoHdUrl,
      extractor: 'ytdlp'
    };
  }

  /**
   * Proxies Facebook video stream to client with HTTP 206 Partial Content support
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
      'Referer': 'https://www.facebook.com/'
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
      const safeName = filename || 'facebook_video.mp4';
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
      for (const file of files) {
        if (file.isDirectory() || !file.name.endsWith('.mp4')) continue;

        const videoDiskPath = path.join(fbDir, file.name);
        if (!fs.existsSync(videoDiskPath)) continue;

        let isMatch = false;
        let meta: any = null;
        const metaPath = path.join(fbDir, `${file.name.replace(/\.[^.]+$/, '')}.meta.json`);

        if (fs.existsSync(metaPath)) {
          try {
            meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf8'));
          } catch {}
        }

        if (cleanId && ((meta?.facebookVideoId && String(meta.facebookVideoId) === cleanId) || file.name.includes(cleanId.slice(-10)))) {
          isMatch = true;
        }

        if (!isMatch && normInputUrl && meta?.originalUrl) {
          const normMetaUrl = meta.originalUrl.split('?')[0].replace(/\/$/, '').toLowerCase();
          if (normMetaUrl === normInputUrl) isMatch = true;
        }

        if (isMatch) {
          const stat = await fsPromises.stat(videoDiskPath);
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
    } catch {}

    return { exists: false };
  }

  /**
   * Saves video stream directly into DD Studio Drive (`/data/storage/drive/facebook/`)
   */
  static async saveToDrive(
    mediaUrl: string,
    title = 'facebook_video',
    id = '',
    originalUrl = '',
    cover = '',
    author?: any,
    duration?: number,
    quality = 'HD',
    overwrite = false
  ): Promise<{ success: boolean; fileName: string; relPath: string; sizeBytes: number; fileId: string; metadata?: any }> {
    if (!mediaUrl) {
      throw new BadRequestError('Không tìm thấy đường dẫn video để lưu');
    }

    const fbDir = path.join(resolvedStoragePaths.drive, 'facebook');
    if (!fs.existsSync(fbDir)) {
      await fsPromises.mkdir(fbDir, { recursive: true });
    }

    const sanitizedTitle = (title || 'video')
      .replace(/[\\/:*?"<>|#@$%^&*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 60)
      .trim()
      .replace(/^_+|_+$/g, '');

    const cleanId = (id || Date.now().toString(36)).slice(-10);
    const fileName = `[Facebook]_${sanitizedTitle || 'clip'}_${cleanId}.mp4`;
    const targetFilePath = path.join(fbDir, fileName);

    if (overwrite && fs.existsSync(targetFilePath)) {
      await StorageManager.unlinkSafe(targetFilePath);
      await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.meta.json'));
      await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.thumb.jpg'));
    }

    logger.info({ fileName, targetFilePath }, '[Facebook] Saving video directly to Studio Drive...');

    // Download stream to disk
    const upstreamRes = await fetch(mediaUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Referer': 'https://www.facebook.com/'
      },
      signal: AbortSignal.timeout(120000)
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      throw new BadRequestError(`Không thể tải video từ nguồn Facebook: HTTP ${upstreamRes.status}`);
    }

    const fileStream = fs.createWriteStream(targetFilePath);
    const hash = crypto.createHash('sha256');
    let byteCount = 0;

    const meter = new (class extends Readable {
      _read() {}
    })();

    const webStream = Readable.fromWeb(upstreamRes.body as any);
    webStream.on('data', (chunk: Buffer) => {
      byteCount += chunk.length;
      hash.update(chunk);
    });

    await pipeline(webStream, fileStream);

    const hashSha256 = hash.digest('hex');

    // Download and cache thumbnail
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

    const authorName = typeof author === 'string' ? author : (author?.name || 'Facebook User');

    const metadata = {
      facebookVideoId: id || cleanId,
      originalUrl: originalUrl || '',
      title: title || 'Facebook Video',
      author: authorName,
      thumbnail: thumbnailDataUri || cover || '',
      duration: duration || 0,
      quality: quality || 'HD',
      savedAt: new Date().toISOString()
    };

    const metaPath = targetFilePath.replace(/\.[^.]+$/, '.meta.json');
    await fsPromises.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

    // Register file in Prisma SQLite
    const fileId = crypto.randomUUID();
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
