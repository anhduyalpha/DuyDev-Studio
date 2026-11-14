/**
 * media-url-cache.ts - Shared Media URL Pre-Resolver, Redirect SSRF Guard,
 * Bounded TTL Cache, and Concurrent Drive Scanner.
 */

import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { BadRequestError } from '../../lib/errors.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * High-performance, memory-bounded in-memory LRU cache with lazy TTL expiration.
 * Evicts the oldest entry when size exceeds maxEntries and refreshes recency on get().
 */
export class BoundedTtlCache<T> {
  private readonly map = new Map<string, CacheEntry<T>>();

  constructor(
    public readonly maxEntries: number = 200,
    public readonly defaultTtlMs: number = 10 * 60 * 1000
  ) {
    if (!Number.isFinite(maxEntries) || maxEntries <= 0) {
      throw new Error(`Invalid maxEntries: ${maxEntries}. Must be a positive number.`);
    }
    if (!Number.isFinite(defaultTtlMs) || defaultTtlMs <= 0) {
      throw new Error(`Invalid defaultTtlMs: ${defaultTtlMs}. Must be a positive number.`);
    }
  }

  /**
   * Retrieves value from cache. Expires items lazily past TTL and refreshes LRU recency.
   */
  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }

    // Refresh recency: re-insert at end of Map order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  /**
   * Stores value in cache with optional custom TTL.
   * Evicts oldest entry if capacity is reached.
   */
  set(key: string, value: T, customTtlMs?: number): this {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    const ttl =
      customTtlMs !== undefined && Number.isFinite(customTtlMs) && customTtlMs > 0
        ? customTtlMs
        : this.defaultTtlMs;

    this.map.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });

    return this;
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}

export type UrlValidatorFn = (
  url: string,
  hopIndex?: number
) => boolean | string | void | Promise<boolean | string | void>;

export interface ExpandRedirectOptions {
  maxHops?: number;
  timeoutMs?: number;
  allowedHosts?: string[] | Set<string>;
  headers?: Record<string, string>;
  fetchFn?: typeof fetch;
  method?: 'HEAD' | 'GET';
}

/**
 * Validates a candidate URL through validatorFn and optional allowedHosts check.
 */
async function runUrlValidator(
  validatorFn: UrlValidatorFn,
  url: string,
  hopIndex: number,
  allowedHosts?: string[] | Set<string>
): Promise<string> {
  const result = await validatorFn(url, hopIndex);
  if (result === false) {
    throw new BadRequestError(`URL validation rejected: ${url}`);
  }
  const validatedUrl = typeof result === 'string' ? result : url;

  if (allowedHosts) {
    let parsed: URL;
    try {
      parsed = new URL(validatedUrl);
    } catch {
      throw new BadRequestError(`Invalid URL structure: ${validatedUrl}`);
    }

    const host = parsed.hostname.toLowerCase();
    let isAllowed = false;

    if (Array.isArray(allowedHosts)) {
      isAllowed = allowedHosts.some(
        (suffix) => host === suffix.toLowerCase() || host.endsWith(`.${suffix.toLowerCase()}`)
      );
    } else if (allowedHosts instanceof Set) {
      isAllowed = allowedHosts.has(host);
    }

    if (!isAllowed) {
      throw new BadRequestError(`Host '${host}' is not in allowed hosts list`);
    }
  }

  return validatedUrl;
}

/**
 * Recursively follows HTTP 3xx redirects using manual redirection and strict SSRF inspection
 * on every intermediate hop before issuing network requests.
 */
export async function expandRedirectUrl(
  rawUrl: string,
  validatorFn: UrlValidatorFn,
  options?: ExpandRedirectOptions
): Promise<string> {
  const maxHops = options?.maxHops ?? 5;
  const timeoutMs = options?.timeoutMs ?? 4000;
  const fetchFn = options?.fetchFn ?? fetch;
  const defaultMethod = options?.method ?? 'HEAD';

  let currentUrl = await runUrlValidator(validatorFn, rawUrl, 0, options?.allowedHosts);
  let redirectCount = 0;

  while (true) {
    let method = defaultMethod;
    let res: Response;

    try {
      res = await fetchFn(currentUrl, {
        method,
        redirect: 'manual',
        headers: options?.headers,
        signal: AbortSignal.timeout(timeoutMs)
      });

      // Fallback to GET cleanly if HEAD returns 405 Method Not Allowed or 501 Not Implemented
      if (method === 'HEAD' && (res.status === 405 || res.status === 501)) {
        if (res.body && typeof res.body.cancel === 'function') {
          try {
            await res.body.cancel();
          } catch {}
        }
        method = 'GET';
        res = await fetchFn(currentUrl, {
          method,
          redirect: 'manual',
          headers: options?.headers,
          signal: AbortSignal.timeout(timeoutMs)
        });
      }
    } catch (err: any) {
      throw err;
    }

    const isRedirect = res.status >= 300 && res.status < 400;
    const location = res.headers?.get('location');

    // Cancel unused response body to avoid socket and connection leaks
    if (res.body && typeof res.body.cancel === 'function') {
      try {
        await res.body.cancel();
      } catch {}
    }

    if (!isRedirect || !location) {
      // Final non-redirect endpoint reached
      return currentUrl;
    }

    if (redirectCount >= maxHops) {
      throw new BadRequestError(`Redirect limit exceeded (max ${maxHops} hops)`);
    }

    redirectCount++;

    let nextUrl: string;
    try {
      nextUrl = new URL(location, currentUrl).toString();
    } catch {
      throw new BadRequestError(`Invalid redirect Location header: '${location}'`);
    }

    // SSRF Guard: Validate candidate redirect target BEFORE issuing fetch request
    currentUrl = await runUrlValidator(validatorFn, nextUrl, redirectCount, options?.allowedHosts);
  }
}

export type DriveMetaMatcher<T = any> = (
  meta: any,
  fileName: string,
  fullPath: string
) => T | boolean | null | undefined | Promise<T | boolean | null | undefined>;

/**
 * Concurrently scans metadata files (*.meta.json) in a directory using a bounded worker pool
 * and immediately short-circuits upon locating the first truthy match.
 */
export async function findExistingDriveMatch<T = any>(
  dirPath: string,
  matcherFn: DriveMetaMatcher<T>,
  concurrency: number = 8
): Promise<T | null> {
  try {
    if (!fs.existsSync(dirPath)) {
      return null;
    }
  } catch {
    return null;
  }

  let entries: fs.Dirent[];
  try {
    entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return null;
  }

  const metaFiles = entries.filter(
    (e) => !e.isDirectory() && !e.name.startsWith('.') && e.name.endsWith('.meta.json')
  );

  if (metaFiles.length === 0) {
    return null;
  }

  const poolSize = Math.min(8, Math.max(1, Number.isFinite(concurrency) ? Math.floor(concurrency) : 8));
  let matchedResult: T | null = null;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < metaFiles.length && !matchedResult) {
      const file = metaFiles[nextIndex++];
      if (!file) break;

      const fullPath = path.join(dirPath, file.name);
      try {
        const raw = await fsPromises.readFile(fullPath, 'utf8');
        if (matchedResult) break;

        const parsed = JSON.parse(raw);
        if (matchedResult) break;

        const result = await matcherFn(parsed, file.name, fullPath);
        if (result) {
          matchedResult = (
            result === true ? { meta: parsed, fileName: file.name, fullPath } : result
          ) as T;
          break;
        }
      } catch {
        // Skip corrupt or unreadable metadata file gracefully
      }
    }
  }

  const workers: Promise<void>[] = [];
  const workerCount = Math.min(poolSize, metaFiles.length);
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return matchedResult;
}
