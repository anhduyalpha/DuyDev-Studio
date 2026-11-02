/**
 * academia.service.ts - Academia.edu Research Paper & Thesis Extractor
 * Part of DuyDev Studio Academic Suite.
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { FastifyReply } from 'fastify';
import { resolvedStoragePaths } from '../config/env.config.js';
import { StorageManager } from '../storage/storage.manager.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { validateSafeMediaUrl } from '../api/middleware/security.middleware.js';

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface AcademiaResolveResult {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  pdfUrl?: string;
  coverUrl?: string;
  pageCount?: number;
  publicationDate?: string;
  originalUrl: string;
}

export class AcademiaService {
  static extractUrl(rawText: string): string {
    let trimmed = (rawText || '').trim();
    if (!trimmed) {
      throw new BadRequestError('Vui lòng cung cấp liên kết Academia.edu hợp lệ.');
    }

    if (/^(?:[a-zA-Z0-9_-]+\.)?academia\.edu(?:\/|$)/i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    const match = trimmed.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?academia\.edu\/[^\s"'<>]+/i);
    if (!match) {
      throw new BadRequestError('Liên kết không phải là Academia.edu. Vui lòng kiểm tra lại URL.');
    }

    return match[0].replace(/[.,;!?)"'\]>]+$/, '');
  }

  static async resolvePaper(rawUrl: string): Promise<AcademiaResolveResult> {
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
        throw new BadRequestError(`Không thể truy cập Academia.edu (HTTP ${res.status}). Tài liệu có thể đã bị xóa hoặc giới hạn.`);
      }

      const html = await res.text();

      // 1. Title extraction
      let title = '';
      const titleCite = html.match(/<meta\s+name=["']citation_title["']\s+content=["']([^"']+)["']/i);
      const titleOg = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      const titleTag = html.match(/<title>([^<]+)<\/title>/i);
      if (titleCite && titleCite[1]) title = titleCite[1].trim();
      else if (titleOg && titleOg[1]) title = titleOg[1].trim();
      else if (titleTag && titleTag[1]) title = titleTag[1].replace(/\s*-\s*Academia\.edu.*/i, '').trim();
      if (!title) title = 'Academia Research Paper';

      // 2. Authors extraction
      const authors: string[] = [];
      const authorMatches = html.matchAll(/<meta\s+name=["']citation_author["']\s+content=["']([^"']+)["']/gi);
      for (const m of authorMatches) {
        if (m[1]) authors.push(m[1].trim());
      }
      if (authors.length === 0) {
        const singleAuthor = html.match(/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i);
        if (singleAuthor && singleAuthor[1]) authors.push(singleAuthor[1].trim());
        else authors.push('Academia Researcher');
      }

      // 3. Abstract extraction
      let abstract = '';
      const abstractMatch = html.match(/<div[^>]*class=["'][^"']*abstract[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                            html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
      if (abstractMatch && abstractMatch[1]) {
        abstract = abstractMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // 4. PDF Download URL extraction
      let pdfUrl: string | undefined = undefined;
      const pdfCite = html.match(/<meta\s+name=["']citation_pdf_url["']\s+content=["']([^"']+)["']/i);
      if (pdfCite && pdfCite[1] && pdfCite[1].startsWith('http')) {
        pdfUrl = pdfCite[1].trim();
      }

      // If not directly available in citation meta, check data-swp or download button
      if (!pdfUrl) {
        const downloadBtn = html.match(/href=["'](https?:\/\/[^"']*\.pdf[^"']*)["']/i) ||
                            html.match(/data-download-url=["']([^"']+)["']/i);
        if (downloadBtn && downloadBtn[1]) {
          pdfUrl = downloadBtn[1];
        }
      }

      // 5. OpenAlex Fallback Resolver if PDF is paywalled/unlinked
      if (!pdfUrl) {
        try {
          const cleanTitle = encodeURIComponent(title.slice(0, 100));
          const oaRes = await fetch(`https://api.openalex.org/works?filter=title.search:${cleanTitle}`, {
            headers: { 'User-Agent': DEFAULT_UA },
            signal: AbortSignal.timeout(6000)
          });
          if (oaRes.ok) {
            const oaData = await oaRes.json() as any;
            const primaryWork = oaData.results?.[0];
            if (primaryWork?.open_access?.oa_url) {
              pdfUrl = primaryWork.open_access.oa_url;
            } else if (primaryWork?.best_oa_location?.pdf_url) {
              pdfUrl = primaryWork.best_oa_location.pdf_url;
            }
          }
        } catch (_) {}
      }

      // Cover / Preview Thumbnail
      let coverUrl = '';
      const imgOg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (imgOg && imgOg[1]) coverUrl = imgOg[1].trim();

      const pubDate = html.match(/<meta\s+name=["']citation_publication_date["']\s+content=["']([^"']+)["']/i)?.[1];

      // Document ID
      const idMatch = url.match(/\/(\d+)\//) || url.match(/\/([^\/?#]+)(?:\?|$)/);
      const id = idMatch ? idMatch[1] : crypto.createHash('md5').update(url).digest('hex').slice(0, 10);

      return {
        id,
        title,
        authors,
        abstract,
        pdfUrl,
        coverUrl,
        publicationDate: pubDate,
        originalUrl: url
      };
    } catch (err: any) {
      if (err instanceof BadRequestError) throw err;
      logger.error({ err, url }, '[AcademiaService] Failed to resolve paper');
      throw new BadRequestError(`Lỗi phân tích Academia: ${err.message || 'Không xác định'}`);
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
    const driveDir = path.join(resolvedStoragePaths.drive, 'academia');
    await fsPromises.mkdir(driveDir, { recursive: true });

    const cleanTitle = (title || 'Research Paper')
      .replace(/[<>:"/\\|?*]/g, '_')
      .trim()
      .slice(0, 80);
    const fileName = `[Academia]_${cleanTitle}_${id.slice(-8)}.pdf`;
    const targetPath = path.join(driveDir, fileName);

    if (overwrite && fs.existsSync(targetPath)) {
      await StorageManager.unlinkSafe(targetPath);
      await StorageManager.unlinkSafe(targetPath.replace(/\.pdf$/, '.meta.json'));
    }

    // Resolve paper to find direct PDF URL
    const resolved = await this.resolvePaper(originalUrl || url);
    const pdfSourceUrl = resolved.pdfUrl || url;

    const ALLOWED_ACADEMIA_HOSTS = ['academia.edu', 'academia-assets.com', 'openalex.org', 'unpaywall.org', 'cloudfront.net', 'amazonaws.com', 'core.ac.uk'];
    const safeUrl = validateSafeMediaUrl(pdfSourceUrl, ALLOWED_ACADEMIA_HOSTS);
    const res = await fetch(safeUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'application/pdf,*/*'
      },
      signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) {
      throw new BadRequestError(`Không thể tải tệp PDF từ nguồn tài liệu (HTTP ${res.status}).`);
    }

    const fileStream = fs.createWriteStream(targetPath);
    const readable = Readable.fromWeb(res.body as any);
    await pipeline(readable, fileStream);

    const stat = await fsPromises.stat(targetPath);

    // Save metadata sidecar
    const metadata = {
      toolId: 'academia-downloader',
      id,
      title,
      authors: resolved.authors,
      originalUrl: originalUrl || url,
      abstract: resolved.abstract,
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
      drivePath: `/academia/${fileName}`,
      fileName,
      size: stat.size
    };
  }

  static async checkExistingInDrive(id: string, url?: string): Promise<{ exists: boolean; drivePath?: string; fileName?: string }> {
    const driveDir = path.join(resolvedStoragePaths.drive, 'academia');
    if (!fs.existsSync(driveDir)) return { exists: false };

    const files = await fsPromises.readdir(driveDir);
    const targetFile = files.find(f => f.endsWith('.pdf') && f.includes(id.slice(-8)));

    if (targetFile) {
      return {
        exists: true,
        drivePath: `/academia/${targetFile}`,
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
    const ALLOWED_ACADEMIA_HOSTS = ['academia.edu', 'academia-assets.com', 'openalex.org', 'unpaywall.org', 'cloudfront.net', 'amazonaws.com', 'core.ac.uk'];
    const safeUrl = validateSafeMediaUrl(url, ALLOWED_ACADEMIA_HOSTS);

    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_UA
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(safeUrl, { headers });
    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      throw new BadRequestError(`Upstream PDF fetch failed with status ${upstreamRes.status}`);
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
    const encodedFilename = encodeURIComponent(filename || 'academia_paper.pdf');
    replyHeaders['Content-Disposition'] = `${disposition}; filename*=UTF-8''${encodedFilename}`;

    reply.code(upstreamRes.status);
    reply.headers(replyHeaders);

    const readable = Readable.fromWeb(upstreamRes.body as any);
    return reply.send(readable);
  }
}
