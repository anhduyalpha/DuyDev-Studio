/**
 * academic-stream.helper.ts - Shared SSRF Guard, OA Redirect Resolver,
 * and Streaming Helpers for Academic Services (Academia & ResearchGate).
 */

import { Readable } from 'node:stream';
import { FastifyReply } from 'fastify';
import { AppError, BadRequestError, ErrorCodes } from '../../lib/errors.js';
import { validateSafeMediaUrl } from '../../api/middleware/security.middleware.js';
import { expandRedirectUrl } from './media-url-cache.js';

export const DEFAULT_ACADEMIC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const ALLOWED_ACADEMIA_HOSTS = [
  'academia.edu',
  'academia-assets.com',
  'openalex.org',
  'unpaywall.org',
  'cloudfront.net',
  'amazonaws.com',
  'core.ac.uk',
  'arxiv.org',
  'biorxiv.org',
  'medrxiv.org',
  'nih.gov',
  'ncbi.nlm.nih.gov',
  'doi.org',
  'wiley.com',
  'springer.com',
  'sciencedirect.com',
  'nature.com',
  'ieee.org',
  'mdpi.com',
  'frontiersin.org',
  'oup.com',
  'tandfonline.com',
  'plos.org'
];

export const ALLOWED_RG_HOSTS = [
  'researchgate.net',
  'rgcdn.net',
  'openalex.org',
  'unpaywall.org',
  'doi.org',
  'wiley.com',
  'springer.com',
  'sciencedirect.com',
  'nature.com',
  'ieee.org',
  'mdpi.com',
  'frontiersin.org',
  'arxiv.org',
  'biorxiv.org',
  'medrxiv.org',
  'nih.gov',
  'ncbi.nlm.nih.gov',
  'core.ac.uk',
  'cloudfront.net',
  'amazonaws.com',
  'oup.com',
  'tandfonline.com',
  'plos.org'
];

/**
 * Validates a single hop during redirect traversal.
 * Hop 0 enforces the commercial/service allowlist.
 * Hop > 0 enforces strict HTTPS + full SSRF protection (blocking loopback/private/metadata IPs)
 * while allowing institutional repositories (e.g. dspace.mit.edu, repository.cam.ac.uk).
 */
export function validateAcademicHopUrl(
  hopUrl: string,
  hopIndex: number | undefined,
  allowedHop0Hosts: string[]
): string {
  let parsed: URL;
  try {
    parsed = new URL(hopUrl);
  } catch {
    throw new BadRequestError('Định dạng URL không hợp lệ');
  }

  if (parsed.protocol !== 'https:') {
    throw new BadRequestError('Chỉ cho phép liên kết HTTPS bảo mật');
  }

  if (!hopIndex || hopIndex === 0) {
    return validateSafeMediaUrl(hopUrl, allowedHop0Hosts);
  }

  return validateSafeMediaUrl(hopUrl);
}

/**
 * Resolves potential HTTP 3xx redirects using expandRedirectUrl.
 * Validates hop 0 against allowedHop0Hosts and subsequent hops with strict HTTPS + SSRF guard.
 */
export async function resolveAcademicPdfUrl(
  rawUrl: string,
  allowedHop0Hosts: string[]
): Promise<string> {
  return expandRedirectUrl(
    rawUrl,
    (hopUrl, hopIndex) => validateAcademicHopUrl(hopUrl, hopIndex, allowedHop0Hosts),
    {
      maxHops: 5,
      timeoutMs: 15000,
      method: 'HEAD'
    }
  );
}

/**
 * Asserts that the upstream response was successful and not an HTML/XHTML login or paywall page.
 * Cancels the response stream body if invalid to prevent connection leaks.
 */
export async function assertValidPdfResponse(
  res: Response,
  allowPartial: boolean = false
): Promise<void> {
  if (!res.ok && !(allowPartial && res.status === 206)) {
    if (res.body && typeof res.body.cancel === 'function') {
      try {
        await res.body.cancel();
      } catch {}
    }
    throw new BadRequestError(`Upstream PDF fetch failed with status ${res.status}`);
  }

  const rawContentType = (res.headers.get('content-type') || '').toLowerCase().trim();
  if (rawContentType.includes('html') || rawContentType.includes('xhtml')) {
    if (res.body && typeof res.body.cancel === 'function') {
      try {
        await res.body.cancel();
      } catch {}
    }
    throw new AppError(
      'Nguồn tài liệu trả về trang HTML/Login thay vì tệp PDF hợp lệ.',
      422,
      ErrorCodes.FILE_CORRUPTED
    );
  }
}

/**
 * Sanitizes the requested filename and formats a standards-compliant Content-Disposition header.
 */
export function formatPdfContentDisposition(
  filename: string | undefined,
  isDownload: boolean,
  defaultName: string
): string {
  const base = (filename || defaultName)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || defaultName;

  const cleanFilename = base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
  const disposition = isDownload ? 'attachment' : 'inline';
  return `${disposition}; filename*=UTF-8''${encodeURIComponent(cleanFilename)}`;
}

/**
 * End-to-end streaming handler for Fastify reply.
 */
export async function streamAcademicPdf(
  url: string,
  isDownload: boolean,
  filename: string,
  rangeHeader: string | undefined,
  reply: FastifyReply,
  allowedHop0Hosts: string[],
  defaultName: string
): Promise<void> {
  const resolvedUrl = await resolveAcademicPdfUrl(url, allowedHop0Hosts);

  const headers: Record<string, string> = {
    'User-Agent': DEFAULT_ACADEMIC_UA
  };
  if (rangeHeader) {
    headers['Range'] = rangeHeader;
  }

  const upstreamRes = await fetch(resolvedUrl, {
    headers,
    signal: AbortSignal.timeout(30000)
  });

  await assertValidPdfResponse(upstreamRes, true);

  const contentType = upstreamRes.headers.get('content-type') || 'application/pdf';
  const contentLength = upstreamRes.headers.get('content-length');
  const contentRange = upstreamRes.headers.get('content-range');

  const replyHeaders: Record<string, string | number> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Content-Disposition': formatPdfContentDisposition(filename, isDownload, defaultName)
  };

  if (contentLength) replyHeaders['Content-Length'] = contentLength;
  if (contentRange) replyHeaders['Content-Range'] = contentRange;

  reply.code(upstreamRes.status);
  reply.headers(replyHeaders);

  const readable = Readable.fromWeb(upstreamRes.body as any);
  return reply.send(readable);
}
