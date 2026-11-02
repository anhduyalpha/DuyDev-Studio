/**
 * researchgate.service.ts - ResearchGate Scientific Publication & Paper Extractor
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

export interface ResearchGateResolveResult {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  doi?: string;
  journal?: string;
  publicationDate?: string;
  pdfUrl?: string;
  coverUrl?: string;
  originalUrl: string;
}

export class ResearchGateService {
  static extractUrl(rawText: string): string {
    let trimmed = (rawText || '').trim();
    if (!trimmed) {
      throw new BadRequestError('Vui lòng cung cấp liên kết ResearchGate hợp lệ.');
    }

    if (/^(?:[a-zA-Z0-9_-]+\.)?researchgate\.net(?:\/|$)/i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    const match = trimmed.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?researchgate\.net\/[^\s"'<>]+/i);
    if (!match) {
      throw new BadRequestError('Liên kết không phải là ResearchGate. Vui lòng kiểm tra lại URL.');
    }

    return match[0].replace(/[.,;!?)"'\]>]+$/, '');
  }

  static async resolvePublication(rawUrl: string): Promise<ResearchGateResolveResult> {
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
        throw new BadRequestError(`Không thể truy cập ResearchGate (HTTP ${res.status}). Bài viết có thể bị giới hạn hoặc yêu cầu đăng nhập.`);
      }

      const html = await res.text();

      // 1. Title extraction
      let title = '';
      const titleCite = html.match(/<meta\s+name=["']citation_title["']\s+content=["']([^"']+)["']/i);
      const titleOg = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      const titleTag = html.match(/<title>([^<]+)<\/title>/i);
      if (titleCite && titleCite[1]) title = titleCite[1].trim();
      else if (titleOg && titleOg[1]) title = titleOg[1].trim();
      else if (titleTag && titleTag[1]) title = titleTag[1].replace(/\s*\(PDF\).*/i, '').replace(/\s*-\s*ResearchGate.*/i, '').trim();
      if (!title) title = 'ResearchGate Scientific Publication';

      // 2. Authors extraction
      const authors: string[] = [];
      const authorMatches = html.matchAll(/<meta\s+name=["']citation_author["']\s+content=["']([^"']+)["']/gi);
      for (const m of authorMatches) {
        if (m[1]) authors.push(m[1].trim());
      }
      if (authors.length === 0) {
        const authorOg = html.match(/<meta\s+property=["']og:article:author["']\s+content=["']([^"']+)["']/i);
        if (authorOg && authorOg[1]) authors.push(authorOg[1].trim());
        else authors.push('ResearchGate Scientists');
      }

      // 3. DOI extraction
      let doi: string | undefined = undefined;
      const doiMatch = html.match(/<meta\s+name=["']citation_doi["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/doi\.org\/(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/i);
      if (doiMatch && doiMatch[1]) {
        doi = doiMatch[1].trim();
      }

      // 4. Abstract extraction
      let abstract = '';
      const abstractMatch = html.match(/<div[^>]*class=["'][^"']*nova-legacy-e-text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                            html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
      if (abstractMatch && abstractMatch[1]) {
        abstract = abstractMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // 5. PDF Full-Text Link
      let pdfUrl: string | undefined = undefined;
      const pdfCite = html.match(/<meta\s+name=["']citation_pdf_url["']\s+content=["']([^"']+)["']/i);
      if (pdfCite && pdfCite[1] && pdfCite[1].startsWith('http')) {
        pdfUrl = pdfCite[1].trim();
      }

      // Fallback via OpenAlex / Unpaywall if DOI is available
      if (!pdfUrl && doi) {
        try {
          const oaRes = await fetch(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`, {
            headers: { 'User-Agent': DEFAULT_UA },
            signal: AbortSignal.timeout(6000)
          });
          if (oaRes.ok) {
            const oaData = await oaRes.json() as any;
            if (oaData?.open_access?.oa_url) {
              pdfUrl = oaData.open_access.oa_url;
            } else if (oaData?.best_oa_location?.pdf_url) {
              pdfUrl = oaData.best_oa_location.pdf_url;
            }
          }
        } catch (_) {}
      }

      // Fallback via title search on OpenAlex
      if (!pdfUrl) {
        try {
          const cleanTitle = encodeURIComponent(title.slice(0, 100));
          const searchRes = await fetch(`https://api.openalex.org/works?filter=title.search:${cleanTitle}`, {
            headers: { 'User-Agent': DEFAULT_UA },
            signal: AbortSignal.timeout(6000)
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json() as any;
            const primary = searchData.results?.[0];
            if (primary?.best_oa_location?.pdf_url) {
              pdfUrl = primary.best_oa_location.pdf_url;
            } else if (primary?.open_access?.oa_url) {
              pdfUrl = primary.open_access.oa_url;
            }
          }
        } catch (_) {}
      }

      const coverUrl = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] || '';
      const journal = html.match(/<meta\s+name=["']citation_journal_title["']\s+content=["']([^"']+)["']/i)?.[1];
      const publicationDate = html.match(/<meta\s+name=["']citation_publication_date["']\s+content=["']([^"']+)["']/i)?.[1];

      // Publication ID
      const idMatch = url.match(/publication\/(\d+)/i) || url.match(/\/([^\/?#]+)(?:\?|$)/);
      const id = idMatch ? idMatch[1] : crypto.createHash('md5').update(url).digest('hex').slice(0, 10);

      return {
        id,
        title,
        authors,
        abstract,
        doi,
        journal,
        publicationDate,
        pdfUrl,
        coverUrl,
        originalUrl: url
      };
    } catch (err: any) {
      if (err instanceof BadRequestError) throw err;
      logger.error({ err, url }, '[ResearchGateService] Failed to resolve publication');
      throw new BadRequestError(`Lỗi phân tích ResearchGate: ${err.message || 'Không xác định'}`);
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
    const driveDir = path.join(resolvedStoragePaths.drive, 'researchgate');
    await fsPromises.mkdir(driveDir, { recursive: true });

    const cleanTitle = (title || 'Scientific Publication')
      .replace(/[<>:"/\\|?*]/g, '_')
      .trim()
      .slice(0, 80);
    const fileName = `[ResearchGate]_${cleanTitle}_${id.slice(-8)}.pdf`;
    const targetPath = path.join(driveDir, fileName);

    if (overwrite && fs.existsSync(targetPath)) {
      await StorageManager.unlinkSafe(targetPath);
      await StorageManager.unlinkSafe(targetPath.replace(/\.pdf$/, '.meta.json'));
    }

    const resolved = await this.resolvePublication(originalUrl || url);
    const pdfSourceUrl = resolved.pdfUrl || url;

    const ALLOWED_RG_HOSTS = ['researchgate.net', 'rgcdn.net', 'openalex.org', 'unpaywall.org', 'doi.org', 'wiley.com', 'springer.com', 'sciencedirect.com', 'nature.com', 'ieee.org', 'mdpi.com', 'frontiersin.org'];
    const safeUrl = validateSafeMediaUrl(pdfSourceUrl, ALLOWED_RG_HOSTS);
    const res = await fetch(safeUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'application/pdf,*/*'
      },
      signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) {
      throw new BadRequestError(`Không thể tải tệp PDF từ máy chủ tài liệu (HTTP ${res.status}).`);
    }

    const fileStream = fs.createWriteStream(targetPath);
    const readable = Readable.fromWeb(res.body as any);
    await pipeline(readable, fileStream);

    const stat = await fsPromises.stat(targetPath);

    // Save metadata sidecar
    const metadata = {
      toolId: 'researchgate-downloader',
      id,
      title,
      authors: resolved.authors,
      doi: resolved.doi,
      journal: resolved.journal,
      abstract: resolved.abstract,
      originalUrl: originalUrl || url,
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
      drivePath: `/researchgate/${fileName}`,
      fileName,
      size: stat.size
    };
  }

  static async checkExistingInDrive(id: string, url?: string): Promise<{ exists: boolean; drivePath?: string; fileName?: string }> {
    const driveDir = path.join(resolvedStoragePaths.drive, 'researchgate');
    if (!fs.existsSync(driveDir)) return { exists: false };

    const files = await fsPromises.readdir(driveDir);
    const targetFile = files.find(f => f.endsWith('.pdf') && f.includes(id.slice(-8)));

    if (targetFile) {
      return {
        exists: true,
        drivePath: `/researchgate/${targetFile}`,
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
    const ALLOWED_RG_HOSTS = ['researchgate.net', 'rgcdn.net', 'openalex.org', 'unpaywall.org', 'doi.org', 'wiley.com', 'springer.com', 'sciencedirect.com', 'nature.com', 'ieee.org', 'mdpi.com', 'frontiersin.org'];
    const safeUrl = validateSafeMediaUrl(url, ALLOWED_RG_HOSTS);

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
    const encodedFilename = encodeURIComponent(filename || 'researchgate_paper.pdf');
    replyHeaders['Content-Disposition'] = `${disposition}; filename*=UTF-8''${encodedFilename}`;

    reply.code(upstreamRes.status);
    reply.headers(replyHeaders);

    const readable = Readable.fromWeb(upstreamRes.body as any);
    return reply.send(readable);
  }
}
