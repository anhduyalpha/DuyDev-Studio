/**
 * slideshare.service.ts - SlideShare Presentation Extractor & PDF Compiler
 * Part of DuyDev Studio Academic Suite.
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
import { resolvedStoragePaths } from '../config/env.config.js';
import { StorageManager } from '../storage/storage.manager.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { validateSafeMediaUrl } from '../api/middleware/security.middleware.js';

const execFileAsync = promisify(execFile);
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface SlideShareResolveResult {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  slideCount: number;
  slideImages: string[];
  pdfDownloadUrl?: string;
  originalUrl: string;
}

export class SlideShareService {
  static extractUrl(rawText: string): string {
    let trimmed = (rawText || '').trim();
    if (!trimmed) {
      throw new BadRequestError('Vui lòng cung cấp liên kết SlideShare hợp lệ.');
    }

    if (/^(?:[a-zA-Z0-9_-]+\.)?slideshare\.net(?:\/|$)/i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    const match = trimmed.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?slideshare\.net\/[^\s"'<>]+/i);
    if (!match) {
      throw new BadRequestError('Liên kết không phải là SlideShare. Vui lòng kiểm tra lại URL.');
    }

    return match[0].replace(/[.,;!?)"'\]>]+$/, '');
  }

  static async resolvePresentation(rawUrl: string): Promise<SlideShareResolveResult> {
    const url = this.extractUrl(rawUrl);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': DEFAULT_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) {
        throw new BadRequestError(`Không thể truy cập SlideShare (HTTP ${res.status}). Bài viết có thể bị xóa hoặc riêng tư.`);
      }

      const html = await res.text();

      // 1. Extract Title
      let title = '';
      const titleOg = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      const titleTag = html.match(/<title>([^<]+)<\/title>/i);
      if (titleOg && titleOg[1]) title = titleOg[1].trim();
      else if (titleTag && titleTag[1]) title = titleTag[1].replace(/\s*-\s*SlideShare.*/i, '').trim();
      if (!title) title = 'SlideShare Presentation';

      // 2. Extract Author
      let author = 'SlideShare Author';
      const authorMatch = html.match(/<span[^>]*class=["'][^"']*author[^"']*["'][^>]*>([^<]+)<\/span>/i) ||
                          html.match(/"author":\s*\{[^}]*"name":\s*"([^"]+)"/i) ||
                          html.match(/by\s+<a[^>]*>([^<]+)<\/a>/i);
      if (authorMatch && authorMatch[1]) {
        author = authorMatch[1].trim();
      }

      // 3. Extract Description
      let description = '';
      const descOg = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                     html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      if (descOg && descOg[1]) description = descOg[1].trim();

      // 4. Extract Cover / Thumbnail
      let coverUrl = '';
      const imageOg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (imageOg && imageOg[1]) coverUrl = imageOg[1].trim();

      // 5. Extract Slides or Embed Image sequence
      const slideImages: string[] = [];
      const imgRegex = /https:\/\/image\.slidesharecdn\.com\/[a-zA-Z0-9_\-\.\/]+-slide-\d+-[a-zA-Z0-9_\.]+/g;
      const matches = html.match(imgRegex);
      if (matches) {
        const unique = Array.from(new Set(matches));
        // Sort slides by index
        unique.sort((a, b) => {
          const idxA = parseInt(a.match(/slide-(\d+)/)?.[1] || '0', 10);
          const idxB = parseInt(b.match(/slide-(\d+)/)?.[1] || '0', 10);
          return idxA - idxB;
        });
        slideImages.push(...unique);
      }

      // Fallback: check picture sources or data-full-url
      if (slideImages.length === 0 && coverUrl) {
        slideImages.push(coverUrl);
      }

      // Generate stable presentation ID
      const idMatch = url.match(/\/([^\/?#]+)(?:\?|$)/);
      const id = idMatch ? idMatch[1] : crypto.createHash('md5').update(url).digest('hex').slice(0, 12);

      return {
        id,
        title,
        author,
        description,
        coverUrl,
        slideCount: Math.max(slideImages.length, 1),
        slideImages,
        originalUrl: url
      };
    } catch (err: any) {
      if (err instanceof BadRequestError) throw err;
      logger.error({ err, url }, '[SlideShareService] Failed to resolve presentation');
      throw new BadRequestError(`Lỗi phân tích SlideShare: ${err.message || 'Không xác định'}`);
    }
  }

  static async saveToDrive(
    url: string,
    title: string,
    id: string,
    originalUrl?: string,
    cover?: string,
    author?: string,
    overwrite?: boolean
  ): Promise<{ drivePath: string; fileName: string; size: number }> {
    const driveDir = path.join(resolvedStoragePaths.drive, 'slideshare');
    await fsPromises.mkdir(driveDir, { recursive: true });

    const cleanTitle = (title || 'Presentation')
      .replace(/[<>:"/\\|?*]/g, '_')
      .trim()
      .slice(0, 80);
    const fileName = `[SlideShare]_${cleanTitle}_${id.slice(-8)}.pdf`;
    const targetPath = path.join(driveDir, fileName);

    if (overwrite && fs.existsSync(targetPath)) {
      await StorageManager.unlinkSafe(targetPath);
      await StorageManager.unlinkSafe(targetPath.replace(/\.pdf$/, '.meta.json'));
    }

    // Resolve slide images to compile PDF
    const resolved = await this.resolvePresentation(originalUrl || url);
    const tempDir = path.join(resolvedStoragePaths.temp, `slideshare_${Date.now()}_${id}`);
    await fsPromises.mkdir(tempDir, { recursive: true });

    const downloadedImages: string[] = [];

    try {
      // Download slides in parallel batches of 5
      const imagesToFetch = resolved.slideImages.slice(0, 100);
      for (let i = 0; i < imagesToFetch.length; i += 5) {
        const batch = imagesToFetch.slice(i, i + 5);
        await Promise.all(
          batch.map(async (imgUrl, batchIdx) => {
            const idx = i + batchIdx;
            const imgPath = path.join(tempDir, `slide_${String(idx).padStart(4, '0')}.jpg`);
            try {
              const r = await fetch(imgUrl, {
                headers: { 'User-Agent': DEFAULT_UA },
                signal: AbortSignal.timeout(10000)
              });
              if (r.ok) {
                const buf = Buffer.from(await r.arrayBuffer());
                await fsPromises.writeFile(imgPath, buf);
                downloadedImages.push(imgPath);
              }
            } catch {}
          })
        );
      }

      downloadedImages.sort();

      if (downloadedImages.length === 0) {
        throw new BadRequestError('Không thể tải các trang slide để ghép thành tệp PDF.');
      }

      // Compile to PDF using Python PyMuPDF engine
      const manifestPath = path.join(tempDir, 'images.json');
      await fsPromises.writeFile(manifestPath, JSON.stringify(downloadedImages), 'utf8');

      const engineScript = path.resolve(process.cwd(), 'engines/document/slides_to_pdf.py');
      const pyCmd = process.platform === 'win32' ? 'python' : 'python3';

      await execFileAsync(pyCmd, [
        engineScript,
        '--images-json', manifestPath,
        '--output', targetPath,
        '--title', title || resolved.title
      ]);

      const stat = await fsPromises.stat(targetPath);

      // Write .meta.json sidecar
      const metadata = {
        toolId: 'slideshare-downloader',
        id,
        title,
        author: author || resolved.author,
        originalUrl: originalUrl || url,
        slideCount: downloadedImages.length,
        thumbnail: cover || resolved.coverUrl,
        savedAt: new Date().toISOString()
      };
      await fsPromises.writeFile(targetPath.replace(/\.pdf$/, '.meta.json'), JSON.stringify(metadata, null, 2), 'utf8');

      // Register file in Prisma
      try {
        await prisma.fileRecord.create({
          data: {
            id: crypto.randomUUID(),
            purpose: 'PROCESSED',
            originalName: fileName,
            storagePath: targetPath,
            mimeType: 'application/pdf',
            sizeBytes: BigInt(stat.size),
            hashSha256: crypto.createHash('sha256').update(String(id)).digest('hex'),
            isPurged: false,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          }
        });
      } catch (_) {}

      return {
        drivePath: `/slideshare/${fileName}`,
        fileName,
        size: stat.size
      };
    } finally {
      // Clean up temp images
      fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  static async checkExistingInDrive(id: string, url?: string): Promise<{ exists: boolean; drivePath?: string; fileName?: string }> {
    const driveDir = path.join(resolvedStoragePaths.drive, 'slideshare');
    if (!fs.existsSync(driveDir)) return { exists: false };

    const files = await fsPromises.readdir(driveDir);
    const targetFile = files.find(f => f.endsWith('.pdf') && f.includes(id.slice(-8)));

    if (targetFile) {
      return {
        exists: true,
        drivePath: `/slideshare/${targetFile}`,
        fileName: targetFile
      };
    }

    return { exists: false };
  }

  static async proxyStream(
    url: string,
    isDownload: boolean,
    filename: string,
    rangeHeader: string | undefined,
    reply: FastifyReply
  ): Promise<void> {
    const ALLOWED_SLIDESHARE_HOSTS = ['slidesharecdn.com', 'slideshare.net', 'licdn.com', 'linkedin.com'];
    const safeUrl = validateSafeMediaUrl(url, ALLOWED_SLIDESHARE_HOSTS);

    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_UA
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(safeUrl, { headers });
    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      throw new BadRequestError(`Upstream media fetch failed with status ${upstreamRes.status}`);
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/pdf';
    const contentLength = upstreamRes.headers.get('content-length');
    const contentRange = upstreamRes.headers.get('content-range');

    const replyHeaders: Record<string, string | number> = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    };

    if (contentLength) replyHeaders['Content-Length'] = contentLength;
    if (contentRange) replyHeaders['Content-Range'] = contentRange;

    const disposition = isDownload ? 'attachment' : 'inline';
    const encodedFilename = encodeURIComponent(filename || 'slideshare_presentation.pdf');
    replyHeaders['Content-Disposition'] = `${disposition}; filename*=UTF-8''${encodedFilename}`;

    reply.code(upstreamRes.status);
    reply.headers(replyHeaders);

    const readable = Readable.fromWeb(upstreamRes.body as any);
    return reply.send(readable);
  }
}
