/**
 * HTTP Utilities for RFC 7232 / RFC 7233 / RFC 9110 compliance
 */

/**
 * Evaluates whether a client ETag header (e.g. If-None-Match, If-Range)
 * matches the current server representation ETag according to RFC 7232 / RFC 9110.
 * Supports weak ETags (W/), wildcard (*), and comma-separated tag lists.
 */
export function checkETagMatch(clientHeader: string | string[] | undefined, serverETag: string | null): boolean {
  if (!clientHeader || !serverETag) return false;
  const rawHeader = Array.isArray(clientHeader) ? clientHeader.join(', ') : clientHeader;
  const cleanServerTag = serverETag.replace(/^W\//, '').replace(/"/g, '').trim();
  const trimmed = rawHeader.trim();
  if (trimmed === '*') return true;
  const candidates = trimmed.split(',').map(s => s.trim().replace(/^W\//, '').replace(/"/g, ''));
  return candidates.includes(cleanServerTag);
}
