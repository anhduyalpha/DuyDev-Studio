/**
 * YouTube Service - High-Performance Video & Audio Downloader & Streamer
 * Uses yt-dlp + ffmpeg for pristine 1080p/4K MP4 video & 320kbps MP3 audio extraction.
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { YouTubeVideoData, YouTubeDownloadResult } from '../schemas/youtube.schema.js';
import { StorageManager } from '../storage/storage.manager.js';
import { resolvedStoragePaths } from '../config/env.config.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);

// Cache for recent video metadata lookups (TTL 10 minutes)
interface CacheEntry {
  data: YouTubeVideoData;
  expiresAt: number;
}
const metadataCache = new Map<string, CacheEntry>();

export class YouTubeService {
  /**
   * Cleans and normalizes raw text input to a valid YouTube URL
   */
  static extractUrl(rawText: string): string {
    const trimmed = (rawText || '').trim();
    const urlMatch = trimmed.match(
      /(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}[^\s"'>]*/i
    );
    if (!urlMatch) {
      throw new BadRequestError('Liên kết không hợp lệ. Vui lòng dán liên kết YouTube hợp lệ (ví dụ: https://youtube.com/watch?v=... hoặc https://youtu.be/...).');
    }
    let url = urlMatch[0];
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    return url;
  }

  /**
   * Sanitizes filename for safe filesystem storage
   */
  static sanitizeFilename(name: string): string {
    return name
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 150);
  }

  /**
   * Resolves YouTube video metadata via yt-dlp
   */
  static async resolve(rawUrl: string): Promise<YouTubeVideoData> {
    const cleanUrl = this.extractUrl(rawUrl);

    // Check memory cache
    const cached = metadataCache.get(cleanUrl);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const { stdout } = await execFileAsync(
        'yt-dlp',
        ['--dump-json', '--no-playlist', '--no-warnings', cleanUrl],
        { timeout: 20000, maxBuffer: 10 * 1024 * 1024 }
      );

      const json = JSON.parse(stdout.trim());

      // Parse available video qualities
      const formats = Array.isArray(json.formats) ? json.formats : [];
      const heights = new Set<number>();
      for (const f of formats) {
        if (f.vcodec !== 'none' && typeof f.height === 'number' && f.height > 0) {
          heights.add(f.height);
        }
      }

      const availableQualities: string[] = [];
      const standardOrder = [1080, 720, 480, 360, 240];
      for (const h of standardOrder) {
        if (Array.from(heights).some(val => val >= h)) {
          availableQualities.push(`${h}p`);
        }
      }
      if (availableQualities.length === 0) {
        availableQualities.push('720p', '360p');
      }

      const videoData: YouTubeVideoData = {
        id: json.id || 'unknown',
        title: json.title || 'YouTube Video',
        description: (json.description || '').substring(0, 300),
        uploader: json.uploader || json.channel || 'Kênh YouTube',
        uploaderId: json.uploader_id,
        uploaderUrl: json.uploader_url,
        channel: json.channel,
        channelUrl: json.channel_url,
        duration: typeof json.duration === 'number' ? json.duration : 0,
        durationString: json.duration_string || '0:00',
        thumbnail: json.thumbnail || `https://i.ytimg.com/vi/${json.id}/hqdefault.jpg`,
        viewCount: typeof json.view_count === 'number' ? json.view_count : 0,
        likeCount: typeof json.like_count === 'number' ? json.like_count : undefined,
        webpageUrl: json.webpage_url || cleanUrl,
        availableQualities,
        hasAudioOnly: true
      };

      // Store in cache (10 mins)
      metadataCache.set(cleanUrl, {
        data: videoData,
        expiresAt: Date.now() + 10 * 60 * 1000
      });

      return videoData;
    } catch (err: any) {
      logger.error({ err: err?.message, cleanUrl }, 'Failed to resolve YouTube video with yt-dlp');
      const errStr = err?.message || '';
      if (errStr.includes('Video unavailable') || errStr.includes('Private video')) {
        throw new BadRequestError('Video này ở chế độ riêng tư hoặc không khả dụng.');
      }
      if (errStr.includes('Sign in to confirm your age')) {
        throw new BadRequestError('Video bị giới hạn độ tuổi trên YouTube, không thể tải về công khai.');
      }
      throw new BadRequestError(`Không thể lấy thông tin video YouTube: ${errStr.split('\n')[0].substring(0, 120)}`);
    }
  }

  /**
   * Downloads video or audio from YouTube via yt-dlp + ffmpeg
   */
  static async download(options: {
    url: string;
    type?: 'video' | 'audio';
    quality?: string;
    customFilename?: string;
    saveToDrive?: boolean;
  }): Promise<YouTubeDownloadResult> {
    const cleanUrl = this.extractUrl(options.url);
    const type = options.type || 'video';
    const quality = options.quality || (type === 'video' ? '720p' : 'mp3');
    const saveToDrive = Boolean(options.saveToDrive);

    // Step 1: Resolve metadata
    const meta = await this.resolve(cleanUrl);

    // Step 2: Determine output paths
    const safeTitle = this.sanitizeFilename(options.customFilename || meta.title);
    const ext = type === 'audio' ? (quality === 'm4a' ? 'm4a' : 'mp3') : 'mp4';
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const finalFileName = `${safeTitle} [${meta.id}_${quality}]_${uniqueId}.${ext}`;

    const targetDir = saveToDrive
      ? path.join(resolvedStoragePaths.drive, 'youtube')
      : path.join(resolvedStoragePaths.temp, 'youtube');

    await fsPromises.mkdir(targetDir, { recursive: true });

    const outputPath = path.join(targetDir, finalFileName);
    const outputTemplate = path.join(targetDir, `${safeTitle} [${meta.id}_${quality}]_${uniqueId}.%(ext)s`);

    // Step 3: Build yt-dlp arguments
    const args: string[] = ['--no-playlist', '--no-warnings', '-o', outputTemplate];

    if (type === 'audio') {
      if (quality === 'm4a') {
        args.push('-f', 'ba[ext=m4a]/ba', '-x', '--audio-format', 'm4a');
      } else {
        // MP3 high quality (0 = 320kbps VBR/CBR)
        args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
      }
    } else {
      // Video MP4 with audio
      let formatSelector = 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b / best';
      if (quality === '1080p') {
        formatSelector = 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4] / bv*[height<=1080]+ba/b[height<=1080] / best';
      } else if (quality === '720p') {
        formatSelector = 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4] / bv*[height<=720]+ba/b[height<=720] / best';
      } else if (quality === '480p') {
        formatSelector = 'bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4] / best';
      } else if (quality === '360p') {
        formatSelector = 'bv*[height<=360][ext=mp4]+ba[ext=m4a]/b[height<=360][ext=mp4] / best';
      }
      args.push('-f', formatSelector, '--merge-output-format', 'mp4');
    }

    args.push(cleanUrl);

    logger.info({ args, finalFileName }, 'Executing yt-dlp download task');

    try {
      await execFileAsync('yt-dlp', args, {
        timeout: 180000, // 3 minutes timeout for heavy videos
        maxBuffer: 20 * 1024 * 1024
      });

      // Verify file existence (sometimes yt-dlp outputs exact extension)
      let actualFilePath = outputPath;
      if (!fs.existsSync(actualFilePath)) {
        // Find any file matching the uniqueId in targetDir
        const files = await fsPromises.readdir(targetDir);
        const matched = files.find(f => f.includes(uniqueId));
        if (matched) {
          actualFilePath = path.join(targetDir, matched);
        } else {
          throw new Error('Tệp tải về không tìm thấy trên hệ thống đĩa sau khi hoàn tất.');
        }
      }

      const stat = await fsPromises.stat(actualFilePath);
      const actualFileName = path.basename(actualFilePath);
      const relPath = saveToDrive
        ? path.posix.join('drive', 'youtube', actualFileName)
        : path.posix.join('temp', 'youtube', actualFileName);

      const downloadUrl = `/api/v1/youtube/stream/${encodeURIComponent(actualFileName)}?download=true`;
      const viewUrl = `/api/v1/youtube/stream/${encodeURIComponent(actualFileName)}`;

      // Register file in SQLite FileRecord / History for searchability and persistence
      if (saveToDrive) {
        try {
          await prisma.fileRecord.create({
            data: {
              originalName: actualFileName,
              storagePath: relPath,
              sizeBytes: BigInt(stat.size),
              mimeType: type === 'audio' ? (ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg') : 'video/mp4',
              hashSha256: crypto.createHash('sha256').update(actualFileName + stat.size).digest('hex'),
              purpose: 'PROCESSED_ARTIFACT',
              expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000)
            }
          });
        } catch (dbErr) {
          logger.warn({ dbErr }, 'Non-fatal: could not create FileRecord in SQLite');
        }
      }

      return {
        fileName: actualFileName,
        relPath,
        downloadUrl,
        viewUrl,
        sizeBytes: stat.size,
        type,
        format: ext,
        quality,
        title: meta.title,
        videoId: meta.id,
        savedToDrive: saveToDrive
      };
    } catch (err: any) {
      logger.error({ err: err?.message, cleanUrl }, 'yt-dlp download failed');
      throw new BadRequestError(`Quá trình tải về thất bại: ${err?.message?.split('\n')[0] || 'Lỗi không xác định'}`);
    }
  }

  /**
   * Resolves absolute file path for an existing downloaded YouTube file
   */
  static getDownloadedFilePath(filename: string): string {
    const cleanName = path.basename(filename);
    const driveCandidate = path.join(resolvedStoragePaths.drive, 'YouTube', cleanName);
    if (fs.existsSync(driveCandidate)) {
      return driveCandidate;
    }
    const tempCandidate = path.join(resolvedStoragePaths.temp, 'youtube', cleanName);
    if (fs.existsSync(tempCandidate)) {
      return tempCandidate;
    }
    throw new NotFoundError('Tệp không tồn tại hoặc đã hết hạn.');
  }
}
