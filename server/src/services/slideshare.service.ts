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

function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const candidateVenvs = [
    '/home/anhduy/dd-studio/engines/document/venv/bin/python',
    '/home/anhduy/dd-studio/engines/document/venv/bin/python3',
    '/home/anhduy/dd-studio/engines/converter/file_conversor_core/venv/bin/python'
  ];
  for (const v of candidateVenvs) {
    if (fs.existsSync(v)) return v;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function resolveSlidesToPdfEngine(): string {
  const candidates = [
    path.resolve(process.cwd(), 'engines/document/slides_to_pdf.py'),
    path.resolve(process.cwd(), '../engines/document/slides_to_pdf.py'),
    path.resolve(process.cwd(), '../../engines/document/slides_to_pdf.py'),
    '/home/anhduy/dd-studio/engines/document/slides_to_pdf.py'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function resolveSlidesToPptxEngine(): string {
  const candidates = [
    path.resolve(process.cwd(), 'engines/document/slides_to_pptx.py'),
    path.resolve(process.cwd(), '../engines/document/slides_to_pptx.py'),
    path.resolve(process.cwd(), '../../engines/document/slides_to_pptx.py'),
    '/home/anhduy/dd-studio/engines/document/slides_to_pptx.py'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

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

      // 1. Try parsing Next.js __NEXT_DATA__ payload (standard for modern SlideShare)
      let title = '';
      let author = 'SlideShare Author';
      let description = '';
      let coverUrl = '';
      const slideImages: string[] = [];
      let totalSlides = 0;

      const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (nextDataMatch) {
        try {
          const nextJson = JSON.parse(nextDataMatch[1]);
          const slideshow = nextJson.props?.pageProps?.slideshow;
          if (slideshow) {
            if (slideshow.title) title = String(slideshow.title).trim();
            if (slideshow.user?.name || slideshow.user?.login || slideshow.username) {
              author = String(slideshow.user?.name || slideshow.user?.login || slideshow.username).trim();
            }
            if (slideshow.description) description = String(slideshow.description).trim();
            totalSlides = Number(slideshow.totalSlides) || 0;

            const slides = slideshow.slides;
            if (slides && slides.host && slides.imageLocation && totalSlides > 0) {
              const sizes: Array<{ quality?: number; width?: number }> = Array.isArray(slides.imageSizes) ? slides.imageSizes : [];
              const bestSize = sizes.find(s => s.width === 2048) || sizes.find(s => s.width === 1024) || sizes[sizes.length - 1];
              const quality = bestSize?.quality || 75;
              const width = bestSize?.width || 2048;
              const slideSlug = slides.title || 'slide';

              for (let i = 1; i <= totalSlides; i++) {
                slideImages.push(`${slides.host}/${slides.imageLocation}/${quality}/${slideSlug}-${i}-${width}.jpg`);
              }

              if (slideImages.length > 0) {
                coverUrl = slideImages[0];
              }
            }
          }
        } catch (e) {
          logger.warn({ err: e }, '[SlideShareService] Failed to parse __NEXT_DATA__ JSON payload');
        }
      }

      // 2. Fallbacks for Title, Author, Description, Cover if not found in __NEXT_DATA__
      if (!title) {
        const titleOg = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
        const titleTag = html.match(/<title>([^<]+)<\/title>/i);
        if (titleOg && titleOg[1]) title = titleOg[1].trim();
        else if (titleTag && titleTag[1]) title = titleTag[1].replace(/\s*-\s*SlideShare.*/i, '').trim();
        if (!title) title = 'SlideShare Presentation';
      }

      if (author === 'SlideShare Author') {
        const authorMatch = html.match(/<span[^>]*class=["'][^"']*author[^"']*["'][^>]*>([^<]+)<\/span>/i) ||
                            html.match(/"author":\s*\{[^}]*"name":\s*"([^"]+)"/i) ||
                            html.match(/by\s+<a[^>]*>([^<]+)<\/a>/i);
        if (authorMatch && authorMatch[1]) {
          author = authorMatch[1].trim();
        }
      }

      if (!description) {
        const descOg = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
        if (descOg && descOg[1]) description = descOg[1].trim();
      }

      if (!coverUrl) {
        const imageOg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        if (imageOg && imageOg[1]) coverUrl = imageOg[1].trim();
      }

      // 3. Fallback regex for legacy static HTML slide images
      if (slideImages.length === 0) {
        const imgRegex = /https:\/\/image\.slidesharecdn\.com\/[a-zA-Z0-9_\-\.\/]+-slide-\d+-[a-zA-Z0-9_\.]+/g;
        const matches = html.match(imgRegex);
        if (matches) {
          const unique = Array.from(new Set(matches));
          unique.sort((a, b) => {
            const idxA = parseInt(a.match(/slide-(\d+)/)?.[1] || '0', 10);
            const idxB = parseInt(b.match(/slide-(\d+)/)?.[1] || '0', 10);
            return idxA - idxB;
          });
          slideImages.push(...unique);
        }
      }

      // 4. Final Fallback: if no slides extracted at all, use cover image
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
        slideCount: Math.max(slideImages.length, totalSlides, 1),
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
  ): Promise<{
    drivePath: string;
    fileName: string;
    size: number;
    pptxDrivePath?: string;
    pptxFileName?: string;
    pptxSize?: number;
  }> {
    const driveDir = path.join(resolvedStoragePaths.drive, 'slideshare');
    await fsPromises.mkdir(driveDir, { recursive: true });

    const cleanTitle = (title || 'Presentation')
      .replace(/[<>:"/\\|?*]/g, '_')
      .trim()
      .slice(0, 80);
    const pdfFileName = `[SlideShare]_${cleanTitle}_${id.slice(-8)}.pdf`;
    const pptxFileName = `[SlideShare]_${cleanTitle}_${id.slice(-8)}.pptx`;
    const targetPdfPath = path.join(driveDir, pdfFileName);
    const targetPptxPath = path.join(driveDir, pptxFileName);

    if (overwrite) {
      if (fs.existsSync(targetPdfPath)) {
        await StorageManager.unlinkSafe(targetPdfPath);
        await StorageManager.unlinkSafe(targetPdfPath.replace(/\.pdf$/, '.meta.json'));
      }
      if (fs.existsSync(targetPptxPath)) {
        await StorageManager.unlinkSafe(targetPptxPath);
        await StorageManager.unlinkSafe(targetPptxPath.replace(/\.pptx$/, '.meta.json'));
      }
    }

    // Resolve slide images to compile PDF & PPTX
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
        throw new BadRequestError('Không thể tải các trang slide để ghép thành tệp PDF / PPTX.');
      }

      const manifestPath = path.join(tempDir, 'images.json');
      await fsPromises.writeFile(manifestPath, JSON.stringify(downloadedImages), 'utf8');

      const pyCmd = resolvePythonBin();

      // 1. Compile to PDF using PyMuPDF / Pillow
      const pdfEngineScript = resolveSlidesToPdfEngine();
      await execFileAsync(pyCmd, [
        pdfEngineScript,
        '--images-json', manifestPath,
        '--output', targetPdfPath,
        '--title', title || resolved.title
      ]);

      const pdfStat = await fsPromises.stat(targetPdfPath);

      // Write PDF .meta.json sidecar
      const pdfMetadata = {
        toolId: 'slideshare-downloader',
        id,
        title,
        format: 'pdf',
        author: author || resolved.author,
        originalUrl: originalUrl || url,
        slideCount: downloadedImages.length,
        thumbnail: cover || resolved.coverUrl,
        savedAt: new Date().toISOString()
      };
      await fsPromises.writeFile(targetPdfPath.replace(/\.pdf$/, '.meta.json'), JSON.stringify(pdfMetadata, null, 2), 'utf8');

      // Register PDF in Prisma
      try {
        await prisma.fileRecord.create({
          data: {
            id: crypto.randomUUID(),
            purpose: 'PROCESSED',
            originalName: pdfFileName,
            storagePath: targetPdfPath,
            mimeType: 'application/pdf',
            sizeBytes: BigInt(pdfStat.size),
            hashSha256: crypto.createHash('sha256').update(String(id)).digest('hex'),
            isPurged: false,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          }
        });
      } catch (_) {}

      // 2. Compile to genuine PowerPoint (.pptx) using python-pptx
      let pptxDrivePath: string | undefined = undefined;
      let pptxSize: number | undefined = undefined;

      try {
        const pptxEngineScript = resolveSlidesToPptxEngine();
        await execFileAsync(pyCmd, [
          pptxEngineScript,
          '--images-json', manifestPath,
          '--output', targetPptxPath,
          '--title', title || resolved.title
        ]);

        if (fs.existsSync(targetPptxPath)) {
          const pptxStat = await fsPromises.stat(targetPptxPath);
          pptxDrivePath = `/slideshare/${pptxFileName}`;
          pptxSize = pptxStat.size;

          // Write PPTX .meta.json sidecar
          const pptxMetadata = {
            toolId: 'slideshare-downloader',
            id,
            title,
            format: 'pptx',
            author: author || resolved.author,
            originalUrl: originalUrl || url,
            slideCount: downloadedImages.length,
            thumbnail: cover || resolved.coverUrl,
            savedAt: new Date().toISOString()
          };
          await fsPromises.writeFile(targetPptxPath.replace(/\.pptx$/, '.meta.json'), JSON.stringify(pptxMetadata, null, 2), 'utf8');

          // Register PPTX in Prisma
          try {
            await prisma.fileRecord.create({
              data: {
                id: crypto.randomUUID(),
                purpose: 'PROCESSED',
                originalName: pptxFileName,
                storagePath: targetPptxPath,
                mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                sizeBytes: BigInt(pptxStat.size),
                hashSha256: crypto.createHash('sha256').update(String(id) + '_pptx').digest('hex'),
                isPurged: false,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              }
            });
          } catch (_) {}
        }
      } catch (err: any) {
        logger.warn({ err }, '[SlideShareService] Non-critical PPTX compilation warning');
      }

      return {
        drivePath: `/slideshare/${pdfFileName}`,
        fileName: pdfFileName,
        size: pdfStat.size,
        pptxDrivePath,
        pptxFileName: pptxDrivePath ? pptxFileName : undefined,
        pptxSize
      };
    } finally {
      // Clean up temp images
      fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  static async checkExistingInDrive(id: string, url?: string): Promise<{
    exists: boolean;
    drivePath?: string;
    fileName?: string;
    pptxDrivePath?: string;
    pptxFileName?: string;
  }> {
    const driveDir = path.join(resolvedStoragePaths.drive, 'slideshare');
    if (!fs.existsSync(driveDir)) return { exists: false };

    const files = await fsPromises.readdir(driveDir);
    const pdfFile = files.find(f => f.endsWith('.pdf') && f.includes(id.slice(-8)));
    const pptxFile = files.find(f => f.endsWith('.pptx') && f.includes(id.slice(-8)));

    if (pdfFile || pptxFile) {
      return {
        exists: true,
        drivePath: pdfFile ? `/slideshare/${pdfFile}` : (pptxFile ? `/slideshare/${pptxFile}` : undefined),
        fileName: pdfFile || pptxFile,
        pptxDrivePath: pptxFile ? `/slideshare/${pptxFile}` : undefined,
        pptxFileName: pptxFile
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
