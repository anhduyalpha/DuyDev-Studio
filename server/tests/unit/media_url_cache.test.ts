/**
 * media_url_cache.test.ts - Unit tests for BoundedTtlCache, expandRedirectUrl, and findExistingDriveMatch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  BoundedTtlCache,
  expandRedirectUrl,
  findExistingDriveMatch
} from '../../src/services/shared/media-url-cache.js';
import { validateSafeMediaUrl } from '../../src/api/middleware/security.middleware.js';
import { BadRequestError } from '../../src/lib/errors.js';

describe('Media URL Cache & Shared Resolver Suite', () => {
  describe('BoundedTtlCache', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('guards against invalid bounds on construction', () => {
      expect(() => new BoundedTtlCache(0)).toThrow();
      expect(() => new BoundedTtlCache(-5)).toThrow();
      expect(() => new BoundedTtlCache(NaN)).toThrow();
      expect(() => new BoundedTtlCache(100, 0)).toThrow();
      expect(() => new BoundedTtlCache(100, -1000)).toThrow();
    });

    it('stores and retrieves values within TTL', () => {
      const cache = new BoundedTtlCache<string>(10, 5000);
      cache.set('key1', 'val1');
      expect(cache.get('key1')).toBe('val1');
      expect(cache.size).toBe(1);

      // Advance time before TTL expiration
      vi.advanceTimersByTime(4000);
      expect(cache.get('key1')).toBe('val1');

      // Advance past TTL expiration
      vi.advanceTimersByTime(1001);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.size).toBe(0);
    });

    it('supports custom TTL per entry', () => {
      const cache = new BoundedTtlCache<number>(10, 10000);
      cache.set('short', 1, 1000);
      cache.set('long', 2, 20000);

      vi.advanceTimersByTime(2000);
      expect(cache.get('short')).toBeUndefined();
      expect(cache.get('long')).toBe(2);
    });

    it('evicts oldest entry when exceeding maxEntries (LRU behavior with get refresh)', () => {
      const cache = new BoundedTtlCache<number>(200, 60000);

      // Insert 200 items (0 to 199)
      for (let i = 0; i < 200; i++) {
        cache.set(`key_${i}`, i);
      }
      expect(cache.size).toBe(200);

      // Access key_0 to refresh its recency (making key_1 the oldest)
      expect(cache.get('key_0')).toBe(0);

      // Insert 201st item
      cache.set('key_200', 200);
      expect(cache.size).toBe(200);

      // key_0 must still be present because it was refreshed
      expect(cache.get('key_0')).toBe(0);

      // key_1 must have been evicted as the oldest
      expect(cache.get('key_1')).toBeUndefined();

      // key_200 must be present
      expect(cache.get('key_200')).toBe(200);
    });

    it('deletes and clears entries correctly', () => {
      const cache = new BoundedTtlCache<string>(10, 60000);
      cache.set('a', 'alpha');
      cache.set('b', 'beta');
      expect(cache.size).toBe(2);

      expect(cache.delete('a')).toBe(true);
      expect(cache.delete('non_existent')).toBe(false);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.size).toBe(1);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('b')).toBeUndefined();
    });
  });

  describe('expandRedirectUrl', () => {
    it('follows safe 3xx redirects (302 -> 301 -> 200) resolving relative locations', async () => {
      const cancelledBodies: string[] = [];

      const mockFetch = vi.fn(async (url: string, init?: any) => {
        const bodyMock = {
          cancel: vi.fn(async () => {
            cancelledBodies.push(url);
          })
        };

        if (url === 'https://fb.watch/shortlink1') {
          return {
            status: 302,
            headers: new Headers({ Location: '/intermediate-step' }),
            body: bodyMock
          } as any;
        }

        if (url === 'https://fb.watch/intermediate-step') {
          return {
            status: 301,
            headers: new Headers({ Location: 'https://www.facebook.com/reel/123456789' }),
            body: bodyMock
          } as any;
        }

        if (url === 'https://www.facebook.com/reel/123456789') {
          return {
            status: 200,
            headers: new Headers(),
            body: bodyMock
          } as any;
        }

        return new Response(null, { status: 404 }) as any;
      });

      const allowedHosts = ['fb.watch', 'facebook.com'];
      const validator = (u: string) => validateSafeMediaUrl(u, allowedHosts);

      const resolved = await expandRedirectUrl('https://fb.watch/shortlink1', validator, {
        fetchFn: mockFetch as any,
        allowedHosts
      });

      expect(resolved).toBe('https://www.facebook.com/reel/123456789');
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(cancelledBodies).toEqual([
        'https://fb.watch/shortlink1',
        'https://fb.watch/intermediate-step',
        'https://www.facebook.com/reel/123456789'
      ]);
    });

    it('supports validatorFn returning normalized string or false', async () => {
      const mockFetch = vi.fn(async (url: string) => {
        return new Response(null, { status: 200 }) as any;
      });

      // Normalizing validator
      const normalizingValidator = (u: string) => u.toLowerCase();
      const res = await expandRedirectUrl('HTTPS://FACEBOOK.COM/TEST', normalizingValidator, {
        fetchFn: mockFetch as any
      });
      expect(res).toBe('https://facebook.com/test');

      // Rejecting validator
      const rejectingValidator = () => false;
      await expect(
        expandRedirectUrl('https://facebook.com/test', rejectingValidator, {
          fetchFn: mockFetch as any
        })
      ).rejects.toThrow(/validation rejected/);
    });

    it('blocks SSRF on intermediate redirect hop before fetching it', async () => {
      const mockFetch = vi.fn(async (url: string) => {
        if (url === 'https://fb.watch/malicious') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'http://127.0.0.1/secret-admin' }
          }) as any;
        }
        return new Response(null, { status: 200 }) as any;
      });

      const allowedHosts = ['fb.watch', 'facebook.com'];
      const validator = (u: string) => validateSafeMediaUrl(u, allowedHosts);

      await expect(
        expandRedirectUrl('https://fb.watch/malicious', validator, {
          fetchFn: mockFetch as any,
          allowedHosts
        })
      ).rejects.toThrow(/SSRF Protection|máy chủ được phép|Truy cập mạng nội bộ/);

      // Verify fetch was NEVER called for the SSRF destination
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).not.toHaveBeenCalledWith('http://127.0.0.1/secret-admin', expect.anything());
    });

    it('rejects when redirects exceed maxHops (>5)', async () => {
      let callCount = 0;
      const mockFetch = vi.fn(async (url: string) => {
        callCount++;
        return new Response(null, {
          status: 302,
          headers: { Location: `https://facebook.com/hop-${callCount}` }
        }) as any;
      });

      const validator = (u: string) => validateSafeMediaUrl(u, ['facebook.com']);

      await expect(
        expandRedirectUrl('https://facebook.com/hop-0', validator, {
          fetchFn: mockFetch as any,
          maxHops: 5
        })
      ).rejects.toThrow(/Redirect limit exceeded/);

      // Must have stopped at maxHops (5)
      expect(callCount).toBeLessThanOrEqual(6);
    });

    it('falls back to GET cleanly if HEAD returns 405 Method Not Allowed', async () => {
      const mockFetch = vi.fn(async (url: string, init?: any) => {
        if (init?.method === 'HEAD') {
          return new Response(null, { status: 405 }) as any;
        }
        return new Response(null, {
          status: 200,
          headers: new Headers()
        }) as any;
      });

      const validator = (u: string) => validateSafeMediaUrl(u, ['facebook.com']);

      const resolved = await expandRedirectUrl('https://facebook.com/video/1', validator, {
        fetchFn: mockFetch as any,
        method: 'HEAD'
      });

      expect(resolved).toBe('https://facebook.com/video/1');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][1].method).toBe('HEAD');
      expect(mockFetch.mock.calls[1][1].method).toBe('GET');
    });
  });

  describe('findExistingDriveMatch', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-media-cache-test-'));
    });

    afterEach(async () => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    });

    it('gracefully returns null if directory does not exist', async () => {
      const nonExistent = path.join(tempDir, 'does-not-exist');
      const result = await findExistingDriveMatch(nonExistent, () => true);
      expect(result).toBeNull();
    });

    it('gracefully skips corrupt JSON .meta.json files and ignores non-meta files', async () => {
      // 1 valid file
      fs.writeFileSync(
        path.join(tempDir, 'valid1.meta.json'),
        JSON.stringify({ originalUrl: 'https://instagram.com/p/valid1', instagramId: '111' })
      );
      // 1 corrupt file
      fs.writeFileSync(path.join(tempDir, 'corrupt.meta.json'), '{ invalid json ...');
      // 1 non-meta file
      fs.writeFileSync(path.join(tempDir, 'random.txt'), 'hello world');
      // 1 hidden file
      fs.writeFileSync(path.join(tempDir, '.hidden.meta.json'), JSON.stringify({ instagramId: 'hidden' }));

      const match = await findExistingDriveMatch(tempDir, (meta) => meta.instagramId === '111');
      expect(match).not.toBeNull();
      expect(match.meta.instagramId).toBe('111');
    });

    it('enforces concurrency cap <= 8 during inspection', async () => {
      // Create 20 metadata files
      for (let i = 0; i < 20; i++) {
        fs.writeFileSync(
          path.join(tempDir, `file_${i}.meta.json`),
          JSON.stringify({ id: `item_${i}` })
        );
      }

      let inFlight = 0;
      let peakInFlight = 0;

      const result = await findExistingDriveMatch(
        tempDir,
        async (meta) => {
          inFlight++;
          peakInFlight = Math.max(peakInFlight, inFlight);
          // Simulate brief async I/O
          await new Promise((resolve) => setTimeout(resolve, 15));
          inFlight--;
          return meta.id === 'item_19';
        },
        16 // Deliberately pass > 8 to verify it caps at 8
      );

      expect(result).not.toBeNull();
      expect(result.meta.id).toBe('item_19');
      expect(peakInFlight).toBeLessThanOrEqual(8);
      expect(peakInFlight).toBeGreaterThanOrEqual(1);
    });

    it('short-circuits immediately when first truthy result is found', async () => {
      // Create 25 metadata files
      for (let i = 0; i < 25; i++) {
        fs.writeFileSync(
          path.join(tempDir, `file_${String(i).padStart(2, '0')}.meta.json`),
          JSON.stringify({ index: i })
        );
      }

      let inspectedCount = 0;

      const result = await findExistingDriveMatch(
        tempDir,
        async (meta) => {
          inspectedCount++;
          if (meta.index === 0) {
            return { matched: true, itemIndex: meta.index };
          }
          return null;
        },
        1 // Concurrency 1 ensures deterministic sequence
      );

      expect(result).toEqual({ matched: true, itemIndex: 0 });
      // Should short-circuit after inspecting the first match, not all 25
      expect(inspectedCount).toBe(1);
    });

    it('returns null when directory has no .meta.json files or no item matches', async () => {
      // Empty directory
      const emptyResult = await findExistingDriveMatch(tempDir, () => true);
      expect(emptyResult).toBeNull();

      // Only non-meta files
      fs.writeFileSync(path.join(tempDir, 'data.csv'), '1,2,3');
      const nonMetaResult = await findExistingDriveMatch(tempDir, () => true);
      expect(nonMetaResult).toBeNull();

      // Has meta file but matcher returns null/false
      fs.writeFileSync(path.join(tempDir, 'item.meta.json'), JSON.stringify({ id: 'none' }));
      const noMatchResult = await findExistingDriveMatch(tempDir, () => false);
      expect(noMatchResult).toBeNull();
    });

    it('returns default object with meta, fileName, fullPath when matcher returns true', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'sample.meta.json'),
        JSON.stringify({ title: 'My Video' })
      );

      const res = await findExistingDriveMatch(tempDir, (meta) => meta.title === 'My Video');
      expect(res).not.toBeNull();
      expect(res.fileName).toBe('sample.meta.json');
      expect(res.fullPath).toBe(path.join(tempDir, 'sample.meta.json'));
      expect(res.meta.title).toBe('My Video');
    });
  });
});
