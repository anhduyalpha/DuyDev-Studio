/**
 * instagram_service.test.ts - Unit tests for Cookieless Embed/GraphQL Tier 1,
 * Redirect Expansion with SSRF Guard, BoundedTtlCache, and Hardened yt-dlp.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as childProcess from 'node:child_process';
import { InstagramService } from '../../src/services/instagram.service.js';
import { BadRequestError } from '../../src/lib/errors.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFile: vi.fn(actual.execFile)
  };
});

describe('InstagramService - Tier 1 Cookieless Embed, GraphQL, Cache & SSRF Suite', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.restoreAllMocks();
    if (typeof (InstagramService as any).clearCache === 'function') {
      (InstagramService as any).clearCache();
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. Redirect Expansion & SSRF Guard', () => {
    it('expands instagram.com/share/... redirect before shortcode parsing', async () => {
      const shareUrl = 'https://www.instagram.com/share/reel/CxShare123/?igsh=abc12345';
      const canonicalTarget = 'https://www.instagram.com/reel/CxResolved123/';

      globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
        const urlStr = String(input?.url || input);
        if (urlStr.includes('/share/reel/CxShare123/')) {
          return new Response(null, {
            status: 302,
            headers: { location: canonicalTarget }
          });
        }
        if (urlStr.includes('/reel/CxResolved123/embed') || urlStr.includes('/p/CxResolved123/embed')) {
          const embedHtml = `
            <!DOCTYPE html><html><body>
              <script>
                window.__additionalDataLoaded('/p/CxResolved123/', {
                  "shortcode_media": {
                    "id": "999888111",
                    "shortcode": "CxResolved123",
                    "title": "Expanded Reel",
                    "is_video": true,
                    "video_url": "https://cdninstagram.com/v/expanded_reel.mp4",
                    "display_url": "https://cdninstagram.com/v/expanded_cover.jpg",
                    "video_duration": 18.2,
                    "edge_media_to_caption": {
                      "edges": [{ "node": { "text": "Resolved via share redirect!" } }]
                    },
                    "owner": { "username": "share_creator", "full_name": "Share Creator" }
                  }
                });
              </script>
            </body></html>
          `;
          return new Response(embedHtml, { status: 200, headers: { 'content-type': 'text/html' } });
        }
        return new Response('Not found', { status: 404 });
      });

      const res = await (InstagramService as any).resolveMedia(shareUrl);
      expect(res).toBeDefined();
      expect(res.id).toBe('999888111');
      expect(res.videoUrl).toBe('https://cdninstagram.com/v/expanded_reel.mp4');
      expect(res.author.username).toBe('share_creator');
      expect(res.extractor).toBe('resolver');
    });

    it('expands instagr.am/... shortlink redirect', async () => {
      const shortUrl = 'https://instagr.am/p/CxShort999/';
      const targetUrl = 'https://www.instagram.com/p/CxTarget999/';

      globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
        const urlStr = String(input?.url || input);
        if (urlStr.includes('instagr.am/p/CxShort999/')) {
          return new Response(null, {
            status: 301,
            headers: { location: targetUrl }
          });
        }
        if (urlStr.includes('/p/CxTarget999/embed')) {
          const embedHtml = `
            <!DOCTYPE html><html><body>
              <script>
                window.__additionalDataLoaded('/p/CxTarget999/', {
                  "shortcode_media": {
                    "id": "777666555",
                    "shortcode": "CxTarget999",
                    "is_video": false,
                    "display_url": "https://cdninstagram.com/v/target_photo.jpg",
                    "edge_media_to_caption": {
                      "edges": [{ "node": { "text": "Shortlink post" } }]
                    },
                    "owner": { "username": "short_user" }
                  }
                });
              </script>
            </body></html>
          `;
          return new Response(embedHtml, { status: 200, headers: { 'content-type': 'text/html' } });
        }
        return new Response('Not found', { status: 404 });
      });

      const res = await (InstagramService as any).resolveMedia(shortUrl);
      expect(res).toBeDefined();
      expect(res.id).toBe('777666555');
      expect(res.mediaType).toBe('image');
      expect(res.imageUrl).toBe('https://cdninstagram.com/v/target_photo.jpg');
    });

    it('blocks SSRF redirect attempts to private IP / AWS metadata / unauthorized host', async () => {
      const ssrfUrl = 'https://www.instagram.com/share/p/CxSsrfAttack/';

      globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
        const urlStr = String(input?.url || input);
        if (urlStr.includes('CxSsrfAttack')) {
          return new Response(null, {
            status: 302,
            headers: { location: 'http://169.254.169.254/latest/meta-data/' }
          });
        }
        return new Response('Not found', { status: 404 });
      });

      await expect((InstagramService as any).resolveMedia(ssrfUrl)).rejects.toThrow(BadRequestError);
    });
  });

  describe('2. Tier 1A Cookieless Embed Parser', () => {
    it('extracts Reel video_url and metadata from embed JSON', async () => {
      const reelUrl = 'https://www.instagram.com/reel/CxReel12345/';

      globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
        const urlStr = String(input?.url || input);
        if (urlStr.includes('/embed')) {
          const embedHtml = `
            <!DOCTYPE html><html><body>
              <script>
                window.__additionalDataLoaded('/p/CxReel12345/', {
                  "shortcode_media": {
                    "id": "1122334455",
                    "shortcode": "CxReel12345",
                    "title": "Viral Dancing Reel",
                    "is_video": true,
                    "video_url": "https://cdninstagram.com/v/t50/dancing.mp4",
                    "display_url": "https://cdninstagram.com/v/t51/dancing_thumb.jpg",
                    "video_duration": 29.5,
                    "edge_media_to_caption": {
                      "edges": [{ "node": { "text": "Viral Dancing Reel #trend" } }]
                    },
                    "owner": {
                      "username": "dance_star",
                      "full_name": "Dance Star Official"
                    }
                  }
                });
              </script>
            </body></html>
          `;
          return new Response(embedHtml, { status: 200, headers: { 'content-type': 'text/html' } });
        }
        return new Response('Not found', { status: 404 });
      });

      const res = await (InstagramService as any).resolveMedia(reelUrl);
      expect(res.id).toBe('1122334455');
      expect(res.mediaType).toBe('video');
      expect(res.videoUrl).toBe('https://cdninstagram.com/v/t50/dancing.mp4');
      expect(res.cover).toBe('https://cdninstagram.com/v/t51/dancing_thumb.jpg');
      expect(res.duration).toBe(29.5);
      expect(res.author.username).toBe('dance_star');
      expect(res.author.fullName).toBe('Dance Star Official');
      expect(res.extractor).toBe('resolver');
    });

    it('extracts multi-item Carousel with mixed photo and video from edge_sidecar_to_children', async () => {
      const carouselUrl = 'https://www.instagram.com/p/CxCarouselMixed/';

      globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
        const urlStr = String(input?.url || input);
        if (urlStr.includes('/embed')) {
          const embedHtml = `
            <!DOCTYPE html><html><body>
              <script>
                window.__additionalDataLoaded('/p/CxCarouselMixed/', {
                  "shortcode_media": {
                    "id": "888999000",
                    "shortcode": "CxCarouselMixed",
                    "title": "Vacation Album",
                    "is_video": false,
                    "display_url": "https://cdninstagram.com/v/cover_vacation.jpg",
                    "edge_media_to_caption": {
                      "edges": [{ "node": { "text": "Vacation 2026 highlights" } }]
                    },
                    "owner": {
                      "username": "traveler_pro",
                      "full_name": "World Traveler"
                    },
                    "edge_sidecar_to_children": {
                      "edges": [
                        {
                          "node": {
                            "id": "sub_img_1",
                            "is_video": false,
                            "display_url": "https://cdninstagram.com/v/photo1.jpg"
                          }
                        },
                        {
                          "node": {
                            "id": "sub_vid_2",
                            "is_video": true,
                            "video_url": "https://cdninstagram.com/v/beach.mp4",
                            "display_url": "https://cdninstagram.com/v/beach_thumb.jpg"
                          }
                        },
                        {
                          "node": {
                            "id": "sub_img_3",
                            "is_video": false,
                            "display_url": "https://cdninstagram.com/v/photo3.jpg"
                          }
                        }
                      ]
                    }
                  }
                });
              </script>
            </body></html>
          `;
          return new Response(embedHtml, { status: 200, headers: { 'content-type': 'text/html' } });
        }
        return new Response('Not found', { status: 404 });
      });

      const res = await (InstagramService as any).resolveMedia(carouselUrl);
      expect(res.id).toBe('888999000');
      expect(res.mediaType).toBe('carousel');
      expect(res.isCarousel).toBe(true);
      expect(res.medias).toHaveLength(3);
      expect(res.medias[0].type).toBe('image');
      expect(res.medias[0].url).toBe('https://cdninstagram.com/v/photo1.jpg');
      expect(res.medias[1].type).toBe('video');
      expect(res.medias[1].url).toBe('https://cdninstagram.com/v/beach.mp4');
      expect(res.medias[2].type).toBe('image');
      expect(res.medias[2].url).toBe('https://cdninstagram.com/v/photo3.jpg');
    });

    it('falls back to HTML DOM <video> and <img class="EmbeddedMediaImage"> while excluding avatars', async () => {
      const postUrl = 'https://www.instagram.com/p/CxDomFallback/';

      globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
        const urlStr = String(input?.url || input);
        if (urlStr.includes('/embed')) {
          const domHtml = `
            <!DOCTYPE html><html><body>
              <div class="EmbeddedMedia">
                <div class="Header">
                  <img class="Avatar" src="https://cdninstagram.com/avatar_ignored.jpg" />
                  <span class="UsernameText">dom_artist</span>
                </div>
                <video src="https://cdninstagram.com/v/dom_extracted.mp4" controls></video>
                <img class="EmbeddedMediaImage" src="https://cdninstagram.com/v/poster_extracted.jpg" />
                <div class="CaptionText">Captioned text extracted from DOM</div>
              </div>
            </body></html>
          `;
          return new Response(domHtml, { status: 200, headers: { 'content-type': 'text/html' } });
        }
        return new Response('Not found', { status: 404 });
      });

      const res = await (InstagramService as any).resolveMedia(postUrl);
      expect(res.id).toBe('CxDomFallback');
      expect(res.videoUrl).toBe('https://cdninstagram.com/v/dom_extracted.mp4');
      expect(res.cover).toBe('https://cdninstagram.com/v/poster_extracted.jpg');
      expect(res.cover).not.toContain('avatar_ignored');
      expect(res.author.username).toBe('dom_artist');
      expect(res.caption).toBe('Captioned text extracted from DOM');
    });
  });

  describe('3. Tier 1B Anonymous Web GraphQL Fallback', () => {
    it('triggers anonymous web GraphQL when Tier 1A embed HTML lacks media, resolving without yt-dlp', async () => {
      const postUrl = 'https://www.instagram.com/p/CxGraphqlFallback/';
      const execFileSpy = vi.spyOn(childProcess, 'execFile');

      globalThis.fetch = vi.fn().mockImplementation(async (input: any, init?: any) => {
        const urlStr = String(input?.url || input);

        if (urlStr.includes('/embed')) {
          // Tier 1A: Returns HTML with LSD token but no gql_data or media tags
          const bareEmbedHtml = `
            <!DOCTYPE html><html><body>
              <input type="hidden" name="lsd" value="TEST_LSD_TOKEN_999" />
              <div class="NotAvailable">Content is protected or not rendered directly</div>
            </body></html>
          `;
          return new Response(bareEmbedHtml, { status: 200, headers: { 'content-type': 'text/html' } });
        }

        if (urlStr.includes('/graphql/query')) {
          // Tier 1B: Anonymous GraphQL query with X-IG-App-ID
          const headers = (init?.headers || {}) as Record<string, string>;
          expect(headers['X-IG-App-ID'] || headers['x-ig-app-id']).toBe('936619743392459');

          const gqlPayload = {
            data: {
              xdt_shortcode_media: {
                id: '444333222',
                shortcode: 'CxGraphqlFallback',
                title: 'Resolved via GraphQL',
                is_video: true,
                video_url: 'https://cdninstagram.com/v/graphql_reel.mp4',
                display_url: 'https://cdninstagram.com/v/graphql_thumb.jpg',
                video_duration: 45,
                edge_media_to_caption: {
                  edges: [{ node: { text: 'GraphQL Caption #pure' } }]
                },
                owner: {
                  username: 'graphql_native',
                  full_name: 'GraphQL Native'
                }
              }
            }
          };
          return new Response(JSON.stringify(gqlPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }

        return new Response('Not found', { status: 404 });
      });

      const res = await (InstagramService as any).resolveMedia(postUrl);
      expect(res.id).toBe('444333222');
      expect(res.videoUrl).toBe('https://cdninstagram.com/v/graphql_reel.mp4');
      expect(res.author.username).toBe('graphql_native');
      expect(res.extractor).toBe('resolver');
      expect(execFileSpy).not.toHaveBeenCalled();
    });
  });

  describe('4. BoundedTtlCache & Hardened yt-dlp Fallback', () => {
    it('returns cached result on repeated calls with 0 duplicate fetches', async () => {
      const postUrl = 'https://www.instagram.com/p/CxCacheHitTest/';
      let fetchCount = 0;

      globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
        fetchCount++;
        const urlStr = String(input?.url || input);
        if (urlStr.includes('/embed')) {
          const embedHtml = `
            <!DOCTYPE html><html><body>
              <script>
                window.__additionalDataLoaded('/p/CxCacheHitTest/', {
                  "shortcode_media": {
                    "id": "111000111",
                    "shortcode": "CxCacheHitTest",
                    "is_video": true,
                    "video_url": "https://cdninstagram.com/v/cache_test.mp4",
                    "display_url": "https://cdninstagram.com/v/cache_thumb.jpg",
                    "owner": { "username": "cache_user" }
                  }
                });
              </script>
            </body></html>
          `;
          return new Response(embedHtml, { status: 200, headers: { 'content-type': 'text/html' } });
        }
        return new Response('Not found', { status: 404 });
      });

      const res1 = await (InstagramService as any).resolveMedia(postUrl);
      expect(res1.id).toBe('111000111');
      const countAfterFirst = fetchCount;

      const res2 = await (InstagramService as any).resolveMedia(postUrl);
      expect(res2.id).toBe('111000111');
      expect(fetchCount).toBe(countAfterFirst); // Zero additional fetches!
    });

    it('does NOT cache failures and falls back to hardened yt-dlp flags', async () => {
      const postUrl = 'https://www.instagram.com/p/CxYtdlpFallback/';

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Failed embed', { status: 500, headers: { 'content-type': 'text/plain' } })
      );

      const ytdlpJson = JSON.stringify({
        id: 'ytdlp_123',
        title: 'Ytdlp Extracted Video',
        description: 'Hardened fallback caption',
        url: 'https://cdninstagram.com/v/ytdlp_video.mp4',
        ext: 'mp4',
        vcodec: 'h264',
        thumbnail: 'https://cdninstagram.com/v/ytdlp_thumb.jpg',
        uploader: 'ytdlp_creator'
      });

      const execFileSpy = vi.spyOn(childProcess, 'execFile').mockImplementation(((
        cmd: any,
        args: any,
        options: any,
        callback: any
      ) => {
        expect(cmd).toBe('yt-dlp');
        expect(args).toContain('--no-playlist');
        expect(args).toContain('--socket-timeout');
        expect(args).toContain('12');
        expect(args).toContain('--retries');
        expect(args).toContain('2');
        callback(null, ytdlpJson, '');
      }) as any);

      const res = await (InstagramService as any).resolveMedia(postUrl);
      expect(res.id).toBe('ytdlp_123');
      expect(res.videoUrl).toBe('https://cdninstagram.com/v/ytdlp_video.mp4');
      expect(res.extractor).toBe('ytdlp');
      expect(execFileSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. checkExistingInDrive with findExistingDriveMatch', () => {
    it('scans metadata concurrently using findExistingDriveMatch and matches by ID', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-ig-test-'));
      const originalDrivePath = (InstagramService as any).getDrivePath?.() || '';

      try {
        const metaContent = JSON.stringify({
          instagramId: 'target_id_999',
          originalUrl: 'https://www.instagram.com/reel/CxTargetId999/',
          title: 'Existing Reel Title',
          thumbnail: 'https://cdninstagram.com/v/thumb.jpg',
          duration: 25
        });

        fs.writeFileSync(path.join(tempDir, '[Instagram]_Reel_target_id_999.mp4'), Buffer.alloc(1024));
        fs.writeFileSync(path.join(tempDir, '[Instagram]_Reel_target_id_999.meta.json'), metaContent, 'utf8');

        // Test with directory path override or standard check
        const result = await (InstagramService as any).checkExistingInDrive(
          'target_id_999',
          'https://www.instagram.com/reel/CxTargetId999/',
          tempDir
        );

        expect(result.exists).toBe(true);
        expect(result.item?.fileName).toBe('[Instagram]_Reel_target_id_999.mp4');
        expect(result.item?.title).toBe('Existing Reel Title');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('6. Reel Poster-Image Downgrade Guard & ScheduledServerJS Video Extraction', () => {
    it('rejects poster-only <img> in Tier 1A embed for a Reel and escalates to GraphQL returning real MP4', async () => {
      const reelUrl = 'https://www.instagram.com/reel/CxPosterBugReel/';

      globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
        const urlStr = String(input?.url || input);
        if (urlStr.includes('/embed')) {
          const posterOnlyEmbed = `
            <!DOCTYPE html><html><body>
              <input type="hidden" name="lsd" value="LSD_REEL_BUG" />
              <div class="EmbedVideo">
                <img class="EmbeddedMediaImage" src="https://cdninstagram.com/v/reel_poster_cover.jpg" />
                <span>Watch on Instagram</span>
              </div>
            </body></html>
          `;
          return new Response(posterOnlyEmbed, { status: 200, headers: { 'content-type': 'text/html' } });
        }
        if (urlStr.includes('/graphql/query') || urlStr.includes('/api/graphql')) {
          return new Response(
            JSON.stringify({
              data: {
                xdt_shortcode_media: {
                  id: '9911223344',
                  is_video: true,
                  media_type: 2,
                  video_versions: [
                    { width: 480, height: 854, url: 'https://cdninstagram.com/v/reel_sd.mp4' },
                    { width: 1080, height: 1920, url: 'https://cdninstagram.com/v/reel_hd.mp4' }
                  ],
                  image_versions2: {
                    candidates: [{ url: 'https://cdninstagram.com/v/reel_poster_cover.jpg' }]
                  },
                  owner: { username: 'creator_hd' }
                }
              }
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }
        return new Response('Not found', { status: 404 });
      });

      const res = await (InstagramService as any).resolveMedia(reelUrl);
      expect(res.mediaType).toBe('video');
      expect(res.videoUrl).toBe('https://cdninstagram.com/v/reel_hd.mp4');
      expect(res.cover).toBe('https://cdninstagram.com/v/reel_poster_cover.jpg');
      expect(res.medias[0].type).toBe('video');
      expect(res.medias[0].url).toBe('https://cdninstagram.com/v/reel_hd.mp4');
    });

    it('formatShortcodeMedia refuses to substitute display_url JPG for a carousel video item lacking video_url', () => {
      const brokenCarousel = {
        id: '777888',
        display_url: 'https://cdninstagram.com/v/cover.jpg',
        edge_sidecar_to_children: {
          edges: [
            { node: { id: 'c1', is_video: false, display_url: 'https://cdninstagram.com/v/p1.jpg' } },
            { node: { id: 'c2', is_video: true, display_url: 'https://cdninstagram.com/v/v2_thumb.jpg' } }
          ]
        }
      };
      const out = (InstagramService as any).formatShortcodeMedia(brokenCarousel, 'CxBrokenCarousel', 'p');
      expect(out).toBeNull();
    });
  });

  describe('7. Audio Preservation & Split DASH Muxing in Tier 2 yt-dlp', () => {
    it('prefers muxed progressive MP4 ("1"/"2"/"3") with audio over silent DASH video-only 1080p stream', async () => {
      const reelUrl = 'https://www.instagram.com/reel/Dekx_rtB_wm/';

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Blocked embed', { status: 403, headers: { 'content-type': 'text/plain' } })
      );

      const ytdlpPayload = JSON.stringify({
        id: 'Dekx_rtB_wm',
        title: 'Local AI Reel',
        description: 'Full reel with audio',
        thumbnail: 'https://cdninstagram.com/v/cover.jpg',
        uploader: 'ai_creator',
        duration: 18,
        formats: [
          {
            format_id: 'dash-3974383976190376a',
            ext: 'm4a',
            vcodec: 'none',
            acodec: 'mp4a.40.5',
            tbr: 81.5,
            url: 'https://instagram.fsgn5-21.fna.fbcdn.net/v/audio_only.m4a'
          },
          {
            format_id: '1',
            ext: 'mp4',
            vcodec: null,
            acodec: null,
            url: 'https://instagram.fsgn5-21.fna.fbcdn.net/v/progressive_muxed_1.mp4'
          },
          {
            format_id: 'dash-3974405112854929v',
            ext: 'mp4',
            width: 1080,
            height: 1920,
            vcodec: 'vp09.00.40.08.00.01.01.01.00',
            acodec: 'none',
            format_note: 'DASH video',
            url: 'https://instagram.fsgn5-21.fna.fbcdn.net/v/silent_dash_1080p.mp4'
          }
        ]
      });

      vi.spyOn(childProcess, 'execFile').mockImplementation(((
        _cmd: any,
        _args: any,
        _options: any,
        callback: any
      ) => {
        callback(null, ytdlpPayload, '');
      }) as any);

      const res = await (InstagramService as any).resolveMedia(reelUrl);
      expect(res.mediaType).toBe('video');
      expect(res.videoUrl).toBe('https://instagram.fsgn5-21.fna.fbcdn.net/v/progressive_muxed_1.mp4');
      expect(res.audioUrl).toBe('https://instagram.fsgn5-21.fna.fbcdn.net/v/audio_only.m4a');
      expect(res.medias[0].url).toBe('https://instagram.fsgn5-21.fna.fbcdn.net/v/progressive_muxed_1.mp4');
    });

    it('creates a dash:// mux token when yt-dlp returns ONLY silent DASH video + separate DASH audio', async () => {
      const reelUrl = 'https://www.instagram.com/reel/CxDashOnly99/';

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Blocked embed', { status: 403, headers: { 'content-type': 'text/plain' } })
      );

      const ytdlpPayload = JSON.stringify({
        id: 'CxDashOnly99',
        title: 'DASH Only Reel',
        thumbnail: 'https://cdninstagram.com/v/cover.jpg',
        uploader: 'dash_creator',
        duration: 12,
        formats: [
          {
            format_id: 'dash-audio',
            ext: 'm4a',
            vcodec: 'none',
            acodec: 'mp4a.40.5',
            tbr: 96,
            url: 'https://cdninstagram.com/v/dash_audio.m4a'
          },
          {
            format_id: 'dash-video-1080p',
            ext: 'mp4',
            width: 1080,
            height: 1920,
            vcodec: 'vp09.00.40.08',
            acodec: 'none',
            format_note: 'DASH video',
            url: 'https://cdninstagram.com/v/dash_video_silent.mp4'
          }
        ]
      });

      vi.spyOn(childProcess, 'execFile').mockImplementation(((
        _cmd: any,
        _args: any,
        _options: any,
        callback: any
      ) => {
        callback(null, ytdlpPayload, '');
      }) as any);

      const res = await (InstagramService as any).resolveMedia(reelUrl);
      expect(res.mediaType).toBe('video');
      expect(res.videoUrl).toMatch(/^dash:\/\/[a-f0-9]{32}$/);
      expect(res.audioUrl).toBe('https://cdninstagram.com/v/dash_audio.m4a');
    });

    it('rejects expired or unknown dash:// tokens in proxyStream with BadRequestError', async () => {
      const mockReply: any = {
        status: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
        send: vi.fn()
      };
      await expect(
        InstagramService.proxyStream('dash://deadbeefexpired', false, 'ig.mp4', undefined, mockReply)
      ).rejects.toThrow(BadRequestError);
    });
  });
});
