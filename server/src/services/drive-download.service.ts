/**
 * Drive Download Service (< 150 lines)
 * Reusable engine for resolving and downloading public files from Google Drive.
 */

import { BadRequestError } from '../lib/errors.js';

export interface DownloadDriveResult {
  buffer: Buffer;
  fileName: string;
  sizeBytes: number;
  driveId: string;
}

/**
 * Extracts a Google Drive file ID from various link formats.
 */
export function extractGoogleDriveId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /open\?id=([a-zA-Z0-9_-]+)/,
    /uc\?.*id=([a-zA-Z0-9_-]+)/
  ];

  for (const regex of patterns) {
    const match = cleanUrl.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Direct ID check if alphanumeric string of length 25-45
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(cleanUrl)) {
    return cleanUrl;
  }

  return null;
}

/**
 * Parses filename from Content-Disposition header.
 */
export function extractFileNameFromDisposition(disposition: string | null, fallbackId: string): string {
  if (!disposition) return `document_${fallbackId.substring(0, 8)}.pdf`;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/["']/g, ''));
    } catch {}
  }

  const standardMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (standardMatch && standardMatch[1]) {
    let raw = standardMatch[1].trim().replace(/^["']|["']$/g, '');
    // HTTP headers are read as ISO-8859-1 (Latin1). If Google Drive sent raw UTF-8 bytes, decode back to UTF-8.
    try {
      const fixed = Buffer.from(raw, 'latin1').toString('utf8');
      if (!fixed.includes('\uFFFD') && fixed.length > 0) {
        raw = fixed;
      }
    } catch {}
    return raw;
  }

  return `document_${fallbackId.substring(0, 8)}.pdf`;
}

/**
 * Extracts cookie pairs (name=value) from Response headers for Cookie header.
 */
function extractCookieHeader(res: Response): string {
  const getSetCookie = (res.headers as any).getSetCookie;
  const rawCookies: string[] = typeof getSetCookie === 'function'
    ? (res.headers as any).getSetCookie()
    : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []);

  return rawCookies
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

/**
 * Downloads a public file from Google Drive into a Buffer, handling confirmation tokens and cookies.
 */
export async function downloadGoogleDriveFile(driveUrl: string): Promise<DownloadDriveResult> {
  const driveId = extractGoogleDriveId(driveUrl);
  if (!driveId) {
    throw new BadRequestError('Đường dẫn Google Drive không hợp lệ hoặc không tìm thấy mã tệp.');
  }

  let downloadUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
  if (driveUrl.includes('docs.google.com/document')) {
    downloadUrl = `https://docs.google.com/document/d/${driveId}/export?format=pdf`;
  } else if (driveUrl.includes('docs.google.com/presentation')) {
    downloadUrl = `https://docs.google.com/presentation/d/${driveId}/export?format=pdf`;
  } else if (driveUrl.includes('docs.google.com/spreadsheets')) {
    downloadUrl = `https://docs.google.com/spreadsheets/d/${driveId}/export?format=pdf`;
  }

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  };

  const res = await fetch(downloadUrl, {
    headers: baseHeaders,
    signal: AbortSignal.timeout(30_000)
  });

  if (!res.ok) {
    throw new BadRequestError('Không thể kết nối đến Google Drive. Vui lòng kiểm tra quyền chia sẻ công khai của tệp.');
  }

  const cookieHeader = extractCookieHeader(res);
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  let finalDisposition = res.headers.get('content-disposition');
  let fileBuffer: Buffer;

  // Handle Google Drive virus scan warning / confirmation HTML page
  if (contentType.includes('text/html')) {
    const htmlText = await res.text();
    let confirmUrl: string | null = null;

    // 1. Inspect form and inputs (modern Google Drive virus warning page)
    const formMatch = htmlText.match(/<form[^>]+action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i);
    if (formMatch) {
      const formAction = formMatch[1].replace(/&amp;/g, '&');
      const formContent = formMatch[2];
      const params = new URLSearchParams();

      const inputRegex = /<input[^>]+(?:name="([^"]+)"[^>]+value="([^"]*)"|value="([^"]*)"[^>]+name="([^"]+)")/gi;
      let m: RegExpExecArray | null;
      while ((m = inputRegex.exec(formContent)) !== null) {
        const name = m[1] || m[4];
        const value = m[2] || m[3];
        if (name) {
          params.set(name, value || '');
        }
      }

      if (params.has('id') || params.has('confirm') || params.has('uuid')) {
        const baseUrl = formAction.startsWith('http')
          ? formAction
          : `https://drive.google.com${formAction.startsWith('/') ? '' : '/'}${formAction}`;
        confirmUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${params.toString()}`;
      }
    }

    // 2. Direct anchor links
    if (!confirmUrl) {
      const hrefMatch =
        htmlText.match(/href="(\/uc\?export=download[^"]+)"/i) ||
        htmlText.match(/href="(https:\/\/[^"]*drive\.google\.com\/uc\?export=download[^"]+)"/i) ||
        htmlText.match(/href="(https:\/\/drive\.usercontent\.google\.com\/download[^"]+)"/i);

      if (hrefMatch && hrefMatch[1]) {
        const rawHref = hrefMatch[1].replace(/&amp;/g, '&');
        confirmUrl = rawHref.startsWith('http')
          ? rawHref
          : `https://drive.google.com${rawHref.startsWith('/') ? '' : '/'}${rawHref}`;
      }
    }

    // 3. Fallback: query confirm token in text
    if (!confirmUrl) {
      const tokenMatch = htmlText.match(/confirm=([a-zA-Z0-9_-]+)/i);
      if (tokenMatch && tokenMatch[1]) {
        confirmUrl = `https://drive.google.com/uc?export=download&id=${driveId}&confirm=${tokenMatch[1]}`;
      }
    }

    if (confirmUrl) {
      const headersWithCookie: Record<string, string> = { ...baseHeaders };
      if (cookieHeader) {
        headersWithCookie['Cookie'] = cookieHeader;
      }

      const res2 = await fetch(confirmUrl, {
        headers: headersWithCookie,
        signal: AbortSignal.timeout(60_000)
      });

      if (!res2.ok) {
        throw new BadRequestError('Không thể tải tệp sau bước xác thực của Google Drive.');
      }

      finalDisposition = res2.headers.get('content-disposition') || finalDisposition;
      fileBuffer = Buffer.from(await res2.arrayBuffer());
    } else {
      // Check for common permission error cues in HTML
      if (htmlText.includes('Access denied') || htmlText.includes('Yêu cầu quyền truy cập') || htmlText.includes('requires permission')) {
        throw new BadRequestError('Tệp Google Drive yêu cầu quyền truy cập. Vui lòng mở quyền "Bất kỳ ai có đường liên kết đều có thể xem".');
      }
      throw new BadRequestError('Không thể tải tài liệu từ Google Drive. Tệp có thể không tồn tại hoặc đã bị khóa chia sẻ.');
    }
  } else {
    fileBuffer = Buffer.from(await res.arrayBuffer());
  }

  if (fileBuffer.length < 50) {
    throw new BadRequestError('Tệp tải từ Google Drive quá nhỏ hoặc rỗng.');
  }

  let fileName = extractFileNameFromDisposition(finalDisposition, driveId);
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    fileName = `${fileName}.pdf`;
  }

  return {
    buffer: fileBuffer,
    fileName,
    sizeBytes: fileBuffer.length,
    driveId
  };
}
