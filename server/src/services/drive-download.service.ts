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
    /\/file\/d\/([a-zA-Z0-9_-]{15,})/,
    /id=([a-zA-Z0-9_-]{15,})/,
    /\/d\/([a-zA-Z0-9_-]{15,})/,
    /open\?id=([a-zA-Z0-9_-]{15,})/,
    /uc\?.*id=([a-zA-Z0-9_-]{15,})/
  ];

  for (const regex of patterns) {
    const match = cleanUrl.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Direct ID check if alphanumeric string of length 20-50
  if (/^[a-zA-Z0-9_-]{20,50}$/.test(cleanUrl)) {
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
    throw new BadRequestError('Đường dẫn Google Drive không hợp lệ hoặc mã tệp (File ID) quá ngắn (mã tệp Google Drive thường dài từ 25-45 ký tự).');
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
    if (res.status === 404) {
      throw new BadRequestError('Tệp không tồn tại hoặc đã bị xóa khỏi Google Drive (HTTP 404).');
    }
    throw new BadRequestError(`Không thể kết nối đến Google Drive (HTTP ${res.status}). Vui lòng kiểm tra quyền chia sẻ công khai của tệp.`);
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

export interface ProbeDriveResult {
  valid: boolean;
  driveId?: string;
  fileSize?: number;
  mimeType?: string;
  fileName?: string;
  error?: string;
  message?: string;
}

/**
 * Rapid pre-flight probe (< 3s) checking accessibility and public permissions of a Google Drive URL.
 */
export async function probeGoogleDriveFile(driveUrl: string): Promise<ProbeDriveResult> {
  const driveId = extractGoogleDriveId(driveUrl);
  if (!driveId) {
    return {
      valid: false,
      error: 'INVALID_URL',
      message: 'Đường dẫn Google Drive không hợp lệ hoặc không tìm thấy mã tệp.'
    };
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

  try {
    const res = await fetch(downloadUrl, {
      method: 'GET',
      headers: { ...baseHeaders, 'Range': 'bytes=0-1024' },
      signal: AbortSignal.timeout(3500)
    });

    if (res.status === 404) {
      return {
        valid: false,
        error: 'NOT_FOUND',
        message: 'Tệp không tồn tại hoặc đã bị xóa khỏi Google Drive.'
      };
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const finalDisposition = res.headers.get('content-disposition');
    const contentLength = res.headers.get('content-length');

    if (contentType.includes('text/html')) {
      const text = await res.text();
      if (
        text.includes('accounts.google.com') ||
        text.includes('ServiceLogin') ||
        text.includes('Sign in') ||
        text.includes('Đăng nhập') ||
        text.includes('You need access') ||
        text.includes('Bạn cần quyền truy cập') ||
        text.includes('không thể mở tệp') ||
        text.includes('Yêu cầu quyền truy cập')
      ) {
        return {
          valid: false,
          error: 'PRIVATE_ACCESS_REQUIRED',
          message: 'Tệp chưa được mở quyền chia sẻ công khai. Vui lòng mở Google Drive -> Chia sẻ -> "Bất kỳ ai có đường liên kết đều có thể xem".'
        };
      }

      if (text.includes('confirm=') || text.includes('uc-download-link') || text.includes('download_warning')) {
        return {
          valid: true,
          driveId,
          fileName: extractFileNameFromDisposition(finalDisposition, driveId),
          mimeType: 'application/pdf'
        };
      }
    }

    if (!res.ok && res.status !== 206) {
      return {
        valid: false,
        error: 'HTTP_ERROR',
        message: `Máy chủ Google Drive phản hồi mã ${res.status}. Vui lòng kiểm tra quyền chia sẻ công khai.`
      };
    }

    return {
      valid: true,
      driveId,
      fileSize: contentLength ? parseInt(contentLength, 10) : undefined,
      mimeType: contentType.includes('pdf') ? 'application/pdf' : contentType,
      fileName: extractFileNameFromDisposition(finalDisposition, driveId)
    };
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
      return {
        valid: false,
        error: 'PROBE_TIMEOUT',
        message: 'Kết nối thăm dò Google Drive vượt quá 3 giây. Vui lòng kiểm tra lại liên kết.'
      };
    }
    return {
      valid: false,
      error: 'NETWORK_ERROR',
      message: 'Không thể kết nối đến máy chủ Google Drive. Vui lòng kiểm tra lại đường truyền.'
    };
  }
}
