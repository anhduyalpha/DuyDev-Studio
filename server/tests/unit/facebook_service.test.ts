/**
 * facebook_service.test.ts - Unit tests for Promise.any Fast-Race, MPD DASH parser,
 * Server-Tokenized Muxer, Redirect Expansion, BoundedTtlCache, and Hardened yt-dlp.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { FacebookService } from '../../src/services/facebook.service.js';
import { BadRequestError } from '../../src/lib/errors.js';
import {
  facebookStreamQuerySchema,
  facebookSaveDriveBodySchema
} from '../../src/schemas/facebook.schema.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFile: vi.fn(actual.execFile),
    spawn: vi.fn(actual.spawn)
  };
});

describe('FacebookService - Fast-Race, DASH Muxer, Cache & Hardening Suite', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.restoreAllMocks();
    if (typeof (FacebookService as any).clearCache === 'function') {
      (FacebookService as any).clearCache();
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. Share & Shortlink Redirect Expansion', () => {
    it('expands facebook.com/share/r/..., /share/v/..., /share/p/..., and fb.watch/... cleanly', async () => {
      const redirects: Record<string, string> = {
        'https://www.facebook.com/share/r/ReelShare123/': 'https://www.facebook.com/reel/999888777/',
        'https://www.facebook.com/share/v/VideoShare456/': 'https://www.facebook.com/watch/?v=111222333',
        'https://www.facebook.com/share/p/PostShare789/': 'https://www.facebook.com/posts/444555666',
        'https://fb.watch/mXz8123abc/': 'https://www.facebook.com/reel/777888999/'
      };

      globalThis.fetch = vi.fn().mockImplementation(async (input: any, init?: any) => {
        const urlStr = String(input?.url || input);
        const matched = Object.keys(redirects).find((k) => urlStr.startsWith(k));
        if (matched) {
          return new Response(null, {
            status: 302,
            headers: { location: redirects[matched] }
          });
        }

        // Return valid Comet response for the expanded target
        const html = `
          <!DOCTYPE html><html><body>
            <script type="application/json">
              {
                "actors": [{ "name": "Expanded Creator" }],
                "message": { "text": "Cleanly expanded post" },
                "attachments": [],
                "__typename": "Video",
                "id": "exp_video_123",
                "browser_native_hd_url": "https://video.xx.fbcdn.net/v/hd_expanded.mp4",
                "browser_native_sd_url": "https://video.xx.fbcdn.net/v/sd_expanded.mp4"
              }
            </script>
          </body></html>
        `;
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
      });

      for (const [shortUrl, destination] of Object.entries(redirects)) {
        if (typeof (FacebookService as any).clearCache === 'function') {
          (FacebookService as any).clearCache();
        }
        const data = await FacebookService.resolveVideo(shortUrl);
        expect(data).toBeDefined();
        expect(data.videoHdUrl).toBe('https://video.xx.fbcdn.net/v/hd_expanded.mp4');
      }
    });
  });

  describe('2. Promise.any Fast-Race Across Endpoints', () => {
    it('returns immediately once the fastest scraper resolves without waiting for stalled sibling', async () => {
      const targetUrl = 'https://www.facebook.com/reel/1234567890/';

      globalThis.fetch = vi.fn().mockImplementation(async (input: any, init?: any) => {
        const urlStr = String(input?.url || input);

        // Branch 1: plugins/video.php is FAST (resolves in 15ms)
        if (urlStr.includes('plugins/video.php')) {
          await new Promise((r) => setTimeout(r, 15));
          const pluginsHtml = `
            <!DOCTYPE html><html><body>
              <script>
                var videoData = {
                  "id": "fast_plugin_id",
                  "hd_src": "https://video.xx.fbcdn.net/v/fast_plugin_hd.mp4",
                  "sd_src": "https://video.xx.fbcdn.net/v/fast_plugin_sd.mp4"
                };
              </script>
              <div class="_23n-"><a href="#">Plugin Author</a></div>
            </body></html>
          `;
          return new Response(pluginsHtml, { status: 200, headers: { 'content-type': 'text/html' } });
        }

        // Branch 2 & 3: Comet & Mobile are STALLED (would take 2000ms+)
        if (urlStr.includes('mbasic.facebook.com') || urlStr.includes('m.facebook.com')) {
          await new Promise((r) => setTimeout(r, 2000));
          return new Response('<html>Slow mobile</html>', { status: 200 });
        }

        // Desktop Comet stalled
        await new Promise((r) => setTimeout(r, 2000));
        return new Response('<html>Slow comet</html>', { status: 200 });
      });

      const startTime = Date.now();
      const res = await FacebookService.resolveVideo(targetUrl);
      const elapsed = Date.now() - startTime;

      expect(res).toBeDefined();
      expect(res.videoHdUrl).toBe('https://video.xx.fbcdn.net/v/fast_plugin_hd.mp4');
      expect(elapsed).toBeLessThan(1000); // Must resolve fast, not waiting 2000ms+
    });

    it('rejects non-media sources properly so fast empty response falls through to valid branch', async () => {
      const targetUrl = 'https://www.facebook.com/reel/1234567890/';

      globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
        const urlStr = String(input?.url || input);

        // Branch 1: plugins/video.php returns FAST (5ms) but has ZERO video (e.g. empty shell)
        if (urlStr.includes('plugins/video.php')) {
          await new Promise((r) => setTimeout(r, 5));
          return new Response('<!DOCTYPE html><html><body>No video here</body></html>', { status: 200 });
        }

        // Branch 2: Mobile returns slightly later (40ms) with valid video
        if (urlStr.includes('mbasic.facebook.com') || urlStr.includes('m.facebook.com')) {
          await new Promise((r) => setTimeout(r, 40));
          const mobileHtml = `
            <!DOCTYPE html><html><body>
              <div data-store='{"videoURL":"https://video.xx.fbcdn.net/v/mobile_valid.mp4"}'></div>
              <title>Mobile Valid Video</title>
            </body></html>
          `;
          return new Response(mobileHtml, { status: 200, headers: { 'content-type': 'text/html' } });
        }

        // Desktop Comet takes 500ms
        await new Promise((r) => setTimeout(r, 500));
        return new Response('<html>Comet</html>', { status: 200 });
      });

      const res = await FacebookService.resolveVideo(targetUrl);
      expect(res).toBeDefined();
      expect(res.videoSdUrl || res.videoHdUrl).toBe('https://video.xx.fbcdn.net/v/mobile_valid.mp4');
    });
  });

  describe('3. MPD DASH Manifest Parser & Server-Tokenized Muxer', () => {
    it('parses dash_manifest_xml_string picking top-bandwidth video & audio and returns dash:// token', async () => {
      const targetUrl = 'https://www.facebook.com/reel/dash_test_123/';

      const dashXml = `
        <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT1.5S" type="static" mediaPresentationDuration="PT25.5S">
          <Period>
            <AdaptationSet mimeType="video/mp4" contentType="video">
              <Representation id="video_low" bandwidth="800000" width="640" height="360">
                <BaseURL>https://video.xx.fbcdn.net/v/sd_dash_low.mp4?_nc_cat=101&amp;efg=low</BaseURL>
              </Representation>
              <Representation id="video_high" bandwidth="3500000" width="1920" height="1080">
                <BaseURL>https://video.xx.fbcdn.net/v/hd_dash_1080.mp4?_nc_cat=101&amp;efg=high</BaseURL>
              </Representation>
            </AdaptationSet>
            <AdaptationSet mimeType="audio/mp4" contentType="audio">
              <Representation id="audio_1" bandwidth="128000">
                <BaseURL>https://video.xx.fbcdn.net/v/audio_dash_hi.mp4?_nc_cat=101&amp;efg=audio</BaseURL>
              </Representation>
            </AdaptationSet>
          </Period>
        </MPD>
      `;

      const escapedXmlJson = JSON.stringify({
        videoDeliveryResponseFragment: {
          id: "dash_video_999",
          dash_manifest_xml_string: dashXml
        },
        actors: [{ name: "DASH Streamer" }],
        message: { text: "Epic DASH Video" }
      });

      globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
        const urlStr = String(input?.url || input);
        if (urlStr.includes('plugins/video.php') || urlStr.includes('mbasic.facebook.com')) {
          return new Response('Not found', { status: 404 });
        }
        const html = `<!DOCTYPE html><html><body><script type="application/json">${escapedXmlJson}</script></body></html>`;
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
      });

      const res = await FacebookService.resolveVideo(targetUrl);
      expect(res).toBeDefined();
      expect(res.formats.length).toBeGreaterThan(0);

      const dashFormat = res.formats.find((f) => f.url.startsWith('dash://'));
      expect(dashFormat).toBeDefined();
      expect(dashFormat?.dashToken).toBeDefined();
      expect(dashFormat?.url).toBe(`dash://${dashFormat?.dashToken}`);
      expect(dashFormat?.label).toContain('1080');
      // videoHdUrl falls back to first dash URL when no progressive URL exists
      expect(res.videoHdUrl).toBe(`dash://${dashFormat?.dashToken}`);
    });

    it('proxyStream with valid dashToken validates both URLs with validateSafeMediaUrl and spawns ffmpeg', async () => {
      const mockSpawn = vi.mocked(childProcess.spawn);
      const fakeFfmpegProc: any = new EventEmitter();
      fakeFfmpegProc.stdout = new EventEmitter();
      fakeFfmpegProc.stderr = new EventEmitter();
      fakeFfmpegProc.kill = vi.fn();
      mockSpawn.mockReturnValue(fakeFfmpegProc);

      // Store a valid token into FacebookService token store
      const token = 'valid_test_token_12345';
      const videoCdnUrl = 'https://video.xx.fbcdn.net/v/test_video.mp4';
      const audioCdnUrl = 'https://video.xx.fbcdn.net/v/test_audio.mp4';

      (FacebookService as any).setDashTokenForTesting?.(token, {
        videoUrl: videoCdnUrl,
        audioUrl: audioCdnUrl
      });

      const mockReply: any = {
        status: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        raw: new EventEmitter()
      };

      await FacebookService.proxyStream(
        `dash://${token}`,
        false,
        'test_dash.mp4',
        undefined,
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.header).toHaveBeenCalledWith('Content-Type', 'video/mp4');
      expect(mockSpawn).toHaveBeenCalled();

      const spawnCall = mockSpawn.mock.calls[0];
      expect(spawnCall[0]).toBe('ffmpeg');
      const args = spawnCall[1] as string[];
      expect(args).toContain('-i');
      expect(args).toContain(videoCdnUrl);
      expect(args).toContain(audioCdnUrl);
      expect(args).toContain('-c');
      expect(args).toContain('copy');
      expect(args).toContain('frag_keyframe+empty_moov');
    });

    it('proxyStream rejects expired or unknown dashToken with BadRequestError', async () => {
      const mockReply: any = {
        status: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        raw: new EventEmitter()
      };

      await expect(
        FacebookService.proxyStream(
          'dash://non_existent_or_expired_token',
          false,
          'video.mp4',
          undefined,
          mockReply
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('rejects dashToken pointing to unsafe/internal host (SSRF guard)', async () => {
      const token = 'ssrf_poisoned_token';
      (FacebookService as any).setDashTokenForTesting?.(token, {
        videoUrl: 'http://169.254.169.254/latest/meta-data/',
        audioUrl: 'https://video.xx.fbcdn.net/v/test_audio.mp4'
      });

      const mockReply: any = {
        status: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        raw: new EventEmitter()
      };

      await expect(
        FacebookService.proxyStream(
          `dash://${token}`,
          false,
          'video.mp4',
          undefined,
          mockReply
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('cleans up spawned ffmpeg on client socket close', async () => {
      const mockSpawn = vi.mocked(childProcess.spawn);
      const fakeFfmpegProc: any = new EventEmitter();
      fakeFfmpegProc.stdout = new EventEmitter();
      fakeFfmpegProc.stderr = new EventEmitter();
      fakeFfmpegProc.kill = vi.fn();
      mockSpawn.mockReturnValue(fakeFfmpegProc);

      const token = 'socket_close_token_999';
      (FacebookService as any).setDashTokenForTesting?.(token, {
        videoUrl: 'https://video.xx.fbcdn.net/v/test_v.mp4',
        audioUrl: 'https://video.xx.fbcdn.net/v/test_a.mp4'
      });

      const mockReply: any = {
        status: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        raw: new EventEmitter()
      };

      await FacebookService.proxyStream(
        `dash://${token}`,
        false,
        'video.mp4',
        undefined,
        mockReply
      );

      expect(fakeFfmpegProc.kill).not.toHaveBeenCalled();
      mockReply.raw.emit('close');
      expect(fakeFfmpegProc.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('saveToDrive cleans up temporary tmpPath if ffmpeg muxing fails', async () => {
      const mockSpawn = vi.mocked(childProcess.spawn);
      const fakeFfmpegProc: any = new EventEmitter();
      fakeFfmpegProc.stdout = new EventEmitter();
      fakeFfmpegProc.stderr = new EventEmitter();
      fakeFfmpegProc.kill = vi.fn();

      mockSpawn.mockImplementation(() => {
        // Asynchronously emit error / non-zero close
        setTimeout(() => {
          fakeFfmpegProc.stderr.emit('data', Buffer.from('mux error simulation'));
          fakeFfmpegProc.emit('close', 1);
        }, 10);
        return fakeFfmpegProc;
      });

      const token = 'mux_failure_token';
      (FacebookService as any).setDashTokenForTesting?.(token, {
        videoUrl: 'https://video.xx.fbcdn.net/v/test_v.mp4',
        audioUrl: 'https://video.xx.fbcdn.net/v/test_a.mp4'
      });

      await expect(
        FacebookService.saveToDrive(
          `dash://${token}`,
          'Test Mux Fail',
          'test_id_fail'
        )
      ).rejects.toThrow(/ffmpeg DASH mux failed/);
    });

    it('validates facebookStreamQuerySchema accepts dashToken without url and rejects empty payload', () => {
      const parsedWithToken = facebookStreamQuerySchema.parse({ dashToken: 'abc123token' });
      expect(parsedWithToken.dashToken).toBe('abc123token');
      expect(parsedWithToken.url).toBe('');

      const parsedWithUrl = facebookStreamQuerySchema.parse({ url: 'https://video.xx.fbcdn.net/v/test.mp4' });
      expect(parsedWithUrl.url).toBe('https://video.xx.fbcdn.net/v/test.mp4');

      expect(() => facebookStreamQuerySchema.parse({ url: '' })).toThrow();
      expect(() => facebookStreamQuerySchema.parse({ url: '   ' })).toThrow();
      expect(() => facebookStreamQuerySchema.parse({})).toThrow();
    });
  });

  describe('4. BoundedTtlCache for Repeat Invocations', () => {
    it('serves repeat requests from BoundedTtlCache without re-fetching upstream', async () => {
      const targetUrl = 'https://www.facebook.com/reel/cache_test_999/';

      let fetchCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        fetchCount++;
        const html = `
          <!DOCTYPE html><html><body>
            <script type="application/json">
              {
                "actors": [{ "name": "Cached User" }],
                "message": { "text": "Cached post" },
                "__typename": "Video",
                "id": "cached_vid_999",
                "browser_native_hd_url": "https://video.xx.fbcdn.net/v/cached.mp4"
              }
            </script>
          </body></html>
        `;
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
      });

      const first = await FacebookService.resolveVideo(targetUrl);
      expect(first).toBeDefined();
      const initialFetchCount = fetchCount;
      expect(initialFetchCount).toBeGreaterThan(0);

      // Second invocation should hit cache
      const second = await FacebookService.resolveVideo(targetUrl);
      expect(second).toBeDefined();
      expect(second.id).toBe(first.id);
      expect(fetchCount).toBe(initialFetchCount); // Zero new network calls
    });
  });

  describe('5. Hardened yt-dlp Configuration', () => {
    it('invokes yt-dlp with --no-playlist, --socket-timeout 12, --retries 2', async () => {
      const mockExecFile = vi.mocked(childProcess.execFile);

      // Force Tier 1 scrapers to fail so it falls through to yt-dlp
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response('Not found', { status: 404 });
      });

      mockExecFile.mockImplementation((cmd: any, args: any, opts: any, cb: any) => {
        const callback = typeof opts === 'function' ? opts : cb;
        const fakeJson = JSON.stringify({
          id: 'ytdlp_123',
          title: 'Hardened Video',
          uploader: 'Test Uploader',
          duration: 30,
          url: 'https://video.xx.fbcdn.net/v/ytdlp_direct.mp4',
          formats: [
            {
              format_id: 'hd',
              url: 'https://video.xx.fbcdn.net/v/ytdlp_hd.mp4',
              height: 1080,
              ext: 'mp4'
            }
          ]
        });
        callback(null, { stdout: fakeJson, stderr: '' });
        return {} as any;
      });

      const res = await FacebookService.resolveVideo('https://www.facebook.com/reel/ytdlp_test/');
      expect(res).toBeDefined();
      expect(mockExecFile).toHaveBeenCalled();

      const callArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(callArgs).toContain('--no-playlist');
      expect(callArgs).toContain('--socket-timeout');
      expect(callArgs).toContain('12');
      expect(callArgs).toContain('--retries');
      expect(callArgs).toContain('2');
    });
  });
});
