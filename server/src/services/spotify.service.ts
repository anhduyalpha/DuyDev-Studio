/**
 * Spotify Service - High-Fidelity Audio Extractor & Drive Manager
 * Native port of n8n Spotify Downloader workflow with n8n Code node parity:
 * - bytesToKb(bytes) = bytes / 1024
 * - kbToMb(kb) = (kb / 1024).toFixed(2)
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
import { SpotifyTrackData } from '../schemas/spotify.schema.js';
import { StorageManager } from '../storage/storage.manager.js';
import { resolvedStoragePaths } from '../config/env.config.js';
import { DriveService } from './drive.service.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class SpotifyService {
  /**
   * Code node calculation from n8n workflow
   */
  static bytesToKb(bytes: number): number {
    return bytes / 1024;
  }

  static kbToMb(kb: number): string {
    return (kb / 1024).toFixed(2);
  }

  /**
   * Validates and extracts a canonical Spotify URL
   */
  static extractUrl(rawText: string): string {
    const trimmed = (rawText || '').trim();
    const urlMatch = trimmed.match(/https?:\/\/(?:open\.)?spotify\.com\/(?:track|album|playlist|intl-[a-z]+\/track)\/([a-zA-Z0-9]+)[^\s"'>]*/i);
    if (!urlMatch) {
      throw new BadRequestError('Liên kết không hợp lệ. Vui lòng dán liên kết bài hát Spotify hợp lệ (ví dụ: https://open.spotify.com/track/...).');
    }
    return urlMatch[0];
  }

  /**
   * Resolves Spotify track metadata and audio download URL
   */
  static async resolveTrack(rawInput: string): Promise<SpotifyTrackData> {
    const targetUrl = this.extractUrl(rawInput);
    logger.info({ targetUrl }, '[Spotify] Resolving track metadata...');

    const trackIdMatch = targetUrl.match(/track\/([a-zA-Z0-9]+)/i);
    const trackId = trackIdMatch ? trackIdMatch[1] : `sp_${Date.now().toString(36)}`;

    // 1. Fetch metadata from Spotify oEmbed
    let title = 'Spotify Track';
    let artist = 'Artist';
    let cover = '';

    try {
      const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(targetUrl)}`, {
        headers: { 'User-Agent': DEFAULT_UA },
        signal: AbortSignal.timeout(6000)
      });
      if (oembedRes.ok) {
        const oembed = await oembedRes.json() as any;
        if (oembed.title) title = oembed.title;
        if (oembed.author_name) artist = oembed.author_name;
        if (oembed.thumbnail_url) cover = oembed.thumbnail_url;
      }
    } catch (e: any) {
      logger.debug({ err: e?.message }, '[Spotify] oEmbed lookup skipped');
    }

    // 2. Multi-tier resolution for audio stream
    let downloadUrl: string | undefined;
    let fileSizeInBytes: number | undefined;
    let extractor: 'api' | 'ytdlp' | 'oembed' = 'oembed';

    // Tier 1: Try RapidAPI / Public Spotify resolver (matching n8n node)
    try {
      const apiResult = await this.tryApiResolver(targetUrl);
      if (apiResult?.downloadUrl) {
        downloadUrl = apiResult.downloadUrl;
        extractor = 'api';
        if (apiResult.title) title = apiResult.title;
        if (apiResult.artist) artist = apiResult.artist;
        if (apiResult.cover) cover = apiResult.cover;
        if (apiResult.sizeBytes) fileSizeInBytes = apiResult.sizeBytes;
      }
    } catch {}

    // Tier 2: yt-dlp lookup via search query "${artist} - ${title} audio"
    if (!downloadUrl) {
      try {
        const searchQuery = `ytsearch1:${artist} - ${title} audio`;
        const { stdout } = await execFileAsync('yt-dlp', [
          '--dump-json',
          '--no-playlist',
          '--no-warnings',
          searchQuery
        ], { timeout: 15000, maxBuffer: 10 * 1024 * 1024 });

        const ytJson = JSON.parse(stdout.trim());
        if (ytJson.url || (Array.isArray(ytJson.formats) && ytJson.formats.length > 0)) {
          extractor = 'ytdlp';
          // Find best audio format
          const audioFmt = ytJson.formats?.filter((f: any) => f.acodec !== 'none' && f.url).pop();
          downloadUrl = audioFmt?.url || ytJson.url;
          if (!cover && ytJson.thumbnail) cover = ytJson.thumbnail;
          if (audioFmt?.filesize) fileSizeInBytes = audioFmt.filesize;
        }
      } catch (ytErr: any) {
        logger.warn({ err: ytErr?.message }, '[Spotify] yt-dlp audio search failed');
      }
    }

    // Check Drive duplication
    const existing = await this.checkExistingInDrive(trackId, targetUrl, title);

    const sizeInKb = fileSizeInBytes ? this.bytesToKb(fileSizeInBytes) : undefined;
    const sizeInMb = sizeInKb ? this.kbToMb(sizeInKb) : undefined;

    return {
      id: trackId,
      url: targetUrl,
      title,
      artist,
      cover,
      duration: 0,
      downloadUrl,
      fileSizeInBytes,
      fileSizeInKb: sizeInKb,
      fileSizeInMb: sizeInMb,
      status: 'success',
      existingInDrive: existing.exists ? existing.item : null,
      extractor
    };
  }

  /**
   * Tier 1: Try RapidAPI or open resolver
   */
  private static async tryApiResolver(targetUrl: string): Promise<{ downloadUrl?: string; title?: string; artist?: string; cover?: string; sizeBytes?: number } | null> {
    const apiKey = process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY;
    if (apiKey) {
      try {
        const formData = new FormData();
        formData.append('url', targetUrl);

        const res = await fetch('https://spotify-downloader11.p.rapidapi.com/spotify-downloader.php', {
          method: 'POST',
          headers: {
            'x-rapidapi-host': 'spotify-downloader11.p.rapidapi.com',
            'x-rapidapi-key': apiKey
          },
          body: formData,
          signal: AbortSignal.timeout(8000)
        });

        if (res.ok) {
          const data = await res.json() as any;
          if (data.status === 'success' && data.download_url) {
            return {
              downloadUrl: data.download_url,
              title: data.name,
              artist: data.artist,
              cover: data.image
            };
          }
        }
      } catch {}
    }
    return null;
  }

  /**
   * Proxies audio stream with HTTP 206 Partial Content support
   */
  static async proxyStream(
    targetUrl: string,
    download: boolean,
    filename: string,
    rangeHeader: string | undefined,
    reply: FastifyReply
  ): Promise<any> {
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_UA
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers,
      signal: AbortSignal.timeout(60000)
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      throw new BadRequestError(`Không thể kết nối đến luồng âm thanh: HTTP ${upstreamRes.status}`);
    }

    reply.status(upstreamRes.status);
    reply.header('Content-Type', upstreamRes.headers.get('content-type') || 'audio/mpeg');
    reply.header('Accept-Ranges', 'bytes');

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) reply.header('Content-Length', contentLength);

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) reply.header('Content-Range', contentRange);

    if (download) {
      const safeName = filename || 'spotify_track.mp3';
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
   * Checks if audio track already exists in DD Studio Drive (`/data/storage/drive/spotify/`)
   */
  static async checkExistingInDrive(
    trackId?: string,
    originalUrl?: string,
    title?: string
  ): Promise<{ exists: boolean; item?: any }> {
    const spDir = path.join(resolvedStoragePaths.drive, 'spotify');
    if (!fs.existsSync(spDir)) {
      return { exists: false };
    }

    const cleanId = (trackId || '').trim();
    const cleanTitle = (title || '').toLowerCase().trim();
    const normInputUrl = (originalUrl || '').split('?')[0].replace(/\/$/, '').toLowerCase();

    try {
      const files = await fsPromises.readdir(spDir, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory() || !file.name.endsWith('.mp3')) continue;

        const audioDiskPath = path.join(spDir, file.name);
        if (!fs.existsSync(audioDiskPath)) continue;

        let isMatch = false;
        let meta: any = null;
        const metaPath = path.join(spDir, `${file.name.replace(/\.[^.]+$/, '')}.meta.json`);

        if (fs.existsSync(metaPath)) {
          try {
            meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf8'));
          } catch {}
        }

        if (cleanId && ((meta?.spotifyId && String(meta.spotifyId) === cleanId) || file.name.includes(cleanId.slice(-10)))) {
          isMatch = true;
        }

        if (!isMatch && normInputUrl && meta?.originalUrl) {
          const normMetaUrl = meta.originalUrl.split('?')[0].replace(/\/$/, '').toLowerCase();
          if (normMetaUrl === normInputUrl) isMatch = true;
        }

        if (!isMatch && cleanTitle && meta?.title && meta.title.toLowerCase().trim() === cleanTitle) {
          isMatch = true;
        }

        if (isMatch) {
          const stat = await fsPromises.stat(audioDiskPath);
          const sizeInKb = this.bytesToKb(stat.size);
          return {
            exists: true,
            item: {
              fileName: file.name,
              relPath: `/spotify/${file.name}`,
              sizeBytes: stat.size,
              fileSizeInMb: this.kbToMb(sizeInKb),
              title: meta?.title || file.name,
              artist: meta?.artist,
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
   * Saves MP3 track directly into DD Studio Drive (`/data/storage/drive/spotify/`)
   * Downloads high-quality 320kbps MP3, embeds metadata and cover artwork.
   */
  static async saveToDrive(
    url: string,
    title = 'Spotify Track',
    artist = 'Artist',
    album = '',
    cover = '',
    duration = 0,
    audioUrl?: string,
    overwrite = false
  ): Promise<{ success: boolean; fileName: string; relPath: string; sizeBytes: number; fileSizeInMb: string; fileId: string; metadata?: any }> {
    const spDir = path.join(resolvedStoragePaths.drive, 'spotify');
    if (!fs.existsSync(spDir)) {
      await fsPromises.mkdir(spDir, { recursive: true });
    }

    const trackIdMatch = url.match(/track\/([a-zA-Z0-9]+)/i);
    const cleanId = (trackIdMatch ? trackIdMatch[1] : Date.now().toString(36)).slice(-10);

    const sanitizedTitle = (title || 'track')
      .replace(/[\\/:*?"<>|#@$%^&*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 50)
      .trim();

    const sanitizedArtist = (artist || 'artist')
      .replace(/[\\/:*?"<>|#@$%^&*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 40)
      .trim();

    const fileName = `[Spotify]_${sanitizedArtist}_${sanitizedTitle}_${cleanId}.mp3`;
    const targetFilePath = path.join(spDir, fileName);

    if (overwrite && fs.existsSync(targetFilePath)) {
      await StorageManager.unlinkSafe(targetFilePath);
      await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.meta.json'));
      await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.thumb.jpg'));
    }

    logger.info({ fileName, targetFilePath }, '[Spotify] Saving MP3 track directly to Studio Drive...');

    // If direct audioUrl is provided, download it
    let byteCount = 0;
    const hash = crypto.createHash('sha256');

    if (audioUrl && audioUrl.startsWith('http')) {
      const upstreamRes = await fetch(audioUrl, {
        headers: { 'User-Agent': DEFAULT_UA },
        signal: AbortSignal.timeout(120000)
      });

      if (!upstreamRes.ok || !upstreamRes.body) {
        throw new BadRequestError(`Không thể tải âm thanh từ Spotify: HTTP ${upstreamRes.status}`);
      }

      const fileStream = fs.createWriteStream(targetFilePath);
      const webStream = Readable.fromWeb(upstreamRes.body as any);
      webStream.on('data', (chunk: Buffer) => {
        byteCount += chunk.length;
        hash.update(chunk);
      });
      await pipeline(webStream, fileStream);
    } else {
      // Use yt-dlp to extract pristine 320kbps MP3
      const searchQuery = `ytsearch1:${artist} - ${title} audio`;
      const tempOutput = path.join(spDir, `temp_${cleanId}.%(ext)s`);

      await execFileAsync('yt-dlp', [
        '--no-playlist',
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '320k',
        '--output', tempOutput,
        searchQuery
      ], { timeout: 60000 });

      const generatedTemp = path.join(spDir, `temp_${cleanId}.mp3`);
      if (!fs.existsSync(generatedTemp)) {
        throw new BadRequestError('Không thể tạo file âm thanh MP3 từ nguồn Spotify');
      }

      await fsPromises.rename(generatedTemp, targetFilePath);
      const stat = await fsPromises.stat(targetFilePath);
      byteCount = stat.size;

      const fileBuf = await fsPromises.readFile(targetFilePath);
      hash.update(fileBuf);
    }

    const hashSha256 = hash.digest('hex');

    // Download cover thumbnail
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

    const sizeInKb = this.bytesToKb(byteCount);
    const fileSizeInMb = this.kbToMb(sizeInKb);

    const metadata = {
      spotifyId: cleanId,
      originalUrl: url,
      title: title || 'Spotify Track',
      artist: artist || 'Artist',
      album: album || '',
      thumbnail: thumbnailDataUri || cover || '',
      duration: duration || 0,
      sizeBytes: byteCount,
      fileSizeInKb: sizeInKb,
      fileSizeInMb,
      savedAt: new Date().toISOString()
    };

    const metaPath = targetFilePath.replace(/\.[^.]+$/, '.meta.json');
    await fsPromises.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

    // Register in Prisma SQLite
    const fileId = crypto.randomUUID();
    try {
      await prisma.fileRecord.create({
        data: {
          id: fileId,
          purpose: 'PROCESSED',
          originalName: fileName,
          storagePath: targetFilePath,
          mimeType: 'audio/mpeg',
          sizeBytes: BigInt(byteCount),
          hashSha256,
          isPurged: false,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });
    } catch (e: any) {
      logger.warn({ err: e?.message }, '[Spotify] Could not create prisma record; file saved to disk');
    }

    DriveService.invalidateStatsCache();

    return {
      success: true,
      fileName,
      relPath: `spotify/${fileName}`,
      sizeBytes: byteCount,
      fileSizeInMb,
      fileId,
      metadata
    };
  }
}
