/**
 * security.middleware.ts - Enterprise Defense-in-Depth Security Middleware
 * Handles signed HttpOnly cookies, API gatekeeping, CSRF double-submit validation,
 * and origin/Sec-Fetch-Site anti-hotlink enforcement.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../../services/auth.service.js';
import { logger } from '../../lib/logger.js';
import { BadRequestError } from '../../lib/errors.js';

export const ALLOWED_ORIGINS = [
  'https://studio.duydev.cloud',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://192.168.2.171:3000',
  'https://192.168.2.171:3443'
];

/**
 * Checks if the origin is explicitly allowed (Cloud domain, LAN, or local dev)
 */
export function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin || origin === 'null') return false;
  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.duydev.cloud')) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) return true;
  return false;
}

/**
 * Parses raw Cookie header string into key-value map
 */
export function parseCookies(cookieHeader?: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return result;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

/**
 * Serializes a cookie name/value pair with modern security attributes
 */
export function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
    path?: string;
  } = {}
): string {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);

  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);

  return parts.join('; ');
}

/**
 * Appends Set-Cookie headers cleanly onto FastifyReply
 */
export function appendSetCookie(reply: FastifyReply, cookieStr: string): void {
  const existing = reply.getHeader('Set-Cookie');
  if (!existing) {
    reply.header('Set-Cookie', cookieStr);
  } else if (Array.isArray(existing)) {
    reply.header('Set-Cookie', [...existing, cookieStr]);
  } else {
    reply.header('Set-Cookie', [String(existing), cookieStr]);
  }
}

/**
 * Checks if request is arriving through HTTPS (direct TLS or Cloudflare proxy)
 */
export function isRequestSecure(req: FastifyRequest): boolean {
  const proto = (req.headers['x-forwarded-proto'] as string) || '';
  const cfVisitor = (req.headers['cf-visitor'] as string) || '';
  if (proto.includes('https') || cfVisitor.includes('https') || req.protocol === 'https') {
    return true;
  }
  const host = String(req.headers.host || '').toLowerCase();
  return host.includes('studio.duydev.cloud');
}

/**
 * Heavy task in-memory rate limiter per IP (30 heavy operations/min)
 */
const heavyTaskRateLimits = new Map<string, { count: number; windowStart: number }>();
const HEAVY_TASK_WINDOW_MS = 60_000;
const MAX_HEAVY_TASKS_PER_MIN = 30;

function checkHeavyTaskRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = heavyTaskRateLimits.get(ip) || { count: 0, windowStart: now };

  if (now - record.windowStart > HEAVY_TASK_WINDOW_MS) {
    record.count = 1;
    record.windowStart = now;
    heavyTaskRateLimits.set(ip, record);
    return true;
  }

  record.count += 1;
  heavyTaskRateLimits.set(ip, record);
  return record.count <= MAX_HEAVY_TASKS_PER_MIN;
}

/**
 * Cookie Session Auto-Issuer Hook:
 * Inspects incoming request. If missing or invalid signed `ds_session`,
 * automatically issues a new cryptographically signed session cookie.
 */
export async function cookieSessionIssuerHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const cookies = parseCookies(req.headers.cookie);
  const rawSession = cookies['ds_session'];
  const sessionCheck = AuthService.verifyVisitorCookie(rawSession);
  const secure = isRequestSecure(req);

  let verifiedDeviceId: string;

  if (sessionCheck.valid && sessionCheck.deviceId) {
    verifiedDeviceId = sessionCheck.deviceId;
  } else {
    // Adopt valid existing device ID from client cookie or header, or generate clean one
    const candidateId = cookies['ds_device_id'] || (req.headers['x-device-id'] as string) || '';
    const safeDeviceId = (/^dev_[a-zA-Z0-9_-]{6,64}$/.test(candidateId))
      ? candidateId
      : `dev_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    const { sessionCookie, csrfToken, deviceId } = AuthService.generateVisitorCookie(safeDeviceId);
    verifiedDeviceId = deviceId;

    // Issue signed HttpOnly session cookie (30 days)
    appendSetCookie(
      reply,
      serializeCookie('ds_session', sessionCookie, {
        maxAge: 30 * 24 * 60 * 60,
        httpOnly: true,
        secure,
        sameSite: 'Lax',
        path: '/'
      })
    );

    // Issue readable CSRF token cookie (30 days)
    appendSetCookie(
      reply,
      serializeCookie('ds_csrf', csrfToken, {
        maxAge: 30 * 24 * 60 * 60,
        httpOnly: false,
        secure,
        sameSite: 'Lax',
        path: '/'
      })
    );

    // Issue persistent client device ID cookie (10 years)
    appendSetCookie(
      reply,
      serializeCookie('ds_device_id', verifiedDeviceId, {
        maxAge: 10 * 365 * 24 * 60 * 60,
        httpOnly: false,
        secure,
        sameSite: 'Lax',
        path: '/'
      })
    );
  }

  // Attach verified context onto request object and sanitize header
  (req as any).verifiedDeviceId = verifiedDeviceId;
  req.headers['x-device-id'] = verifiedDeviceId;

  // Also check admin session cookie if present
  const adminCookie = cookies['ds_admin_session'];
  if (adminCookie && AuthService.validateToken(adminCookie)) {
    (req as any).isAdmin = true;
  }
}

/**
 * API Security Gatekeeper PreHandler:
 * Defends all `/api/v1/*` routes against CSRF, cross-site hotlinking, and unauthorized scraper scripts.
 */
export async function apiSecurityGuard(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const url = req.raw.url || req.url || '';
  const pathname = url.split('?')[0];

  // Whitelisted endpoints that must remain accessible for bootstrapping or external webhooks
  if (
    pathname.startsWith('/api/v1/health') ||
    pathname.startsWith('/api/v1/auth/status') ||
    pathname.startsWith('/api/v1/auth/verify') ||
    pathname.startsWith('/api/v1/dynamic-qr/redirect') ||
    pathname.startsWith('/share-target')
  ) {
    return;
  }

  // 1. Origin / Referer / Sec-Fetch-Site verification
  const origin = req.headers.origin;
  if (origin && origin !== 'null') {
    if (!isAllowedOrigin(origin)) {
      logger.warn({ origin, url }, '[SecurityGuard] Rejected foreign Origin header');
      return reply.status(403).send({
        success: false,
        error: 'CROSS_SITE_FORBIDDEN',
        message: 'Yêu cầu từ tên miền bên ngoài bị từ chối truy cập.'
      });
    }
  }

  // Block explicit cross-site navigation attempts
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    logger.warn({ secFetchSite, url }, '[SecurityGuard] Rejected cross-site Sec-Fetch-Site request');
    return reply.status(403).send({
      success: false,
      error: 'CROSS_SITE_FORBIDDEN',
      message: 'Yêu cầu cross-site bị từ chối truy cập.'
    });
  }

  // 2. Validate Session Authenticity (Signed Cookie or Admin Token)
  const cookies = parseCookies(req.headers.cookie);
  const sessionCookie = cookies['ds_session'];
  const sessionCheck = AuthService.verifyVisitorCookie(sessionCookie);

  const authHeader = (req.headers['x-storage-auth'] as string) || (req.headers.authorization as string) || '';
  const adminCookie = cookies['ds_admin_session'];
  const isAdmin = AuthService.validateToken(authHeader) || AuthService.validateToken(adminCookie);

  if (!sessionCheck.valid && !isAdmin) {
    logger.warn({ url, ip: req.ip }, '[SecurityGuard] Rejected unauthenticated API request without valid session cookie');
    return reply.status(403).send({
      success: false,
      error: 'INVALID_SESSION',
      message: 'Phiên làm việc không hợp lệ hoặc đã hết hạn. Vui lòng tải lại trang web.'
    });
  }

  // 3. CSRF Double-Submit Validation for Mutating Requests
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  if (isMutating && !isAdmin) {
    const clientCsrfHeader = req.headers['x-ds-csrf'] as string;
    const cookieCsrf = cookies['ds_csrf'];
    const deviceId = sessionCheck.deviceId || (req as any).verifiedDeviceId;

    const isValidCsrf =
      (clientCsrfHeader && cookieCsrf && clientCsrfHeader === cookieCsrf) ||
      AuthService.verifyCsrfToken(clientCsrfHeader, deviceId);

    // If client supplied standard header or same-origin cookie matching
    if (!isValidCsrf) {
      // Allow multipart file uploads or internal fetch if origin is same-host
      const host = req.headers.host;
      const referer = req.headers.referer;
      const isSameHostReferer = referer && host && referer.includes(host);

      if (!isSameHostReferer) {
        logger.warn({ url, method: req.method }, '[SecurityGuard] Rejected mutating request with missing/invalid CSRF');
        return reply.status(403).send({
          success: false,
          error: 'CSRF_VALIDATION_FAILED',
          message: 'Xác thực CSRF không thành công. Vui lòng làm mới trang.'
        });
      }
    }
  }

  // 4. Rate Limit Heavy CPU/Bandwidth Operations
  const isHeavyTask =
    pathname.includes('/resolve') ||
    pathname.includes('/stream') ||
    pathname.includes('/convert') ||
    pathname.includes('/quiz/generate') ||
    pathname.includes('/save-drive');

  if (isHeavyTask && !isAdmin) {
    const cfIp = req.headers['cf-connecting-ip'] as string;
    const clientIp = (cfIp || ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) || req.ip || '127.0.0.1').replace(/^::ffff:/, '');
    if (!checkHeavyTaskRateLimit(clientIp)) {
      reply.header('Retry-After', '60');
      return reply.status(429).send({
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: 'Bạn đã thực hiện quá nhiều tác vụ tải/chuyển đổi trong thời gian ngắn. Vui lòng thử lại sau 1 phút.'
      });
    }
  }
}

/**
 * Validates external media URLs before proxying or saving to disk
 * Mitigates Server-Side Request Forgery (SSRF) and private network pivoting
 */
export function validateSafeMediaUrl(rawUrl: string, allowedHostSuffixes: string[]): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new BadRequestError('Đường dẫn media không hợp lệ');
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestError('Định dạng URL không hợp lệ');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BadRequestError('Giao thức URL không được phép');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost, private IPs, loopback, AWS metadata
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) {
    throw new BadRequestError('Truy cập mạng nội bộ bị từ chối (SSRF Protection)');
  }

  const isAllowed = allowedHostSuffixes.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
  if (!isAllowed) {
    throw new BadRequestError(`Tên miền nguồn '${hostname}' không nằm trong danh sách máy chủ được phép`);
  }

  return rawUrl;
}
