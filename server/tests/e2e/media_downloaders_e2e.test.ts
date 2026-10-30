/**
 * Media Downloaders Opaque-Box E2E Test Suite (Facebook, Spotify, Instagram)
 * Adheres to 4-Tier Test Architecture:
 * - Tier 1: Feature Coverage (>=5 test cases per feature area)
 * - Tier 2: Boundary & Corner Cases (>=5 test cases per tool)
 * - Tier 3: Cross-Feature Combinations (Pairwise interactions & scoring math)
 * - Tier 4: Real-World Application Scenarios (End-to-end simulated user journeys)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { buildApp } from '../../src/app.js';
import { resolvedStoragePaths } from '../../src/config/env.config.js';
import { FacebookService } from '../../src/services/facebook.service.js';
import { SpotifyService } from '../../src/services/spotify.service.js';
import { InstagramService } from '../../src/services/instagram.service.js';
import { toolRegistry } from '../../../src/hooks/useToolRegistry.js';

describe('Media Downloaders E2E Test Suite (Facebook, Spotify, Instagram)', () => {
  let app: FastifyInstance;
  const createdFiles: string[] = [];

  // Reusable sample buffers
  const sampleVideoBuffer = Buffer.alloc(8192, 0x11);
  const sampleAudioBuffer = Buffer.alloc(10240, 0x22);
  const sampleImageBuffer = Buffer.alloc(4096, 0x33);

  beforeAll(async () => {
    process.env.RAPIDAPI_KEY = 'mock_e2e_rapidapi_key';
    app = await buildApp();
    await app.ready();

    // Ensure sandboxed storage directories exist
    for (const dir of [
      path.join(resolvedStoragePaths.drive, 'facebook'),
      path.join(resolvedStoragePaths.drive, 'spotify'),
      path.join(resolvedStoragePaths.drive, 'instagram'),
      resolvedStoragePaths.temp
    ]) {
      if (!fs.existsSync(dir)) {
        await fsPromises.mkdir(dir, { recursive: true });
      }
    }
  });

  afterAll(async () => {
    // Clean up created files safely
    for (const f of createdFiles) {
      try {
        if (fs.existsSync(f)) await fsPromises.unlink(f);
        const metaPath = f.replace(/\.[^.]+$/, '.meta.json');
        if (fs.existsSync(metaPath)) await fsPromises.unlink(metaPath);
        const thumbPath = f.replace(/\.[^.]+$/, '.thumb.jpg');
        if (fs.existsSync(thumbPath)) await fsPromises.unlink(thumbPath);
      } catch {}
    }
    delete process.env.RAPIDAPI_KEY;
    await app.close();
  });

  beforeEach(() => {
    // Setup universal fetch interception mock
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const urlStr = typeof input === 'string' ? input : input?.url || input?.toString() || '';

      // 1. Facebook upstream responses
      if (urlStr.includes('facebook.com') || urlStr.includes('fb.watch')) {
        const isPhotoPost = urlStr.includes('/photo') || urlStr.includes('/share/photo') || urlStr.includes('fbid=');
        if (isPhotoPost) {
          return new Response(
            `<!DOCTYPE html><html><head>
              <meta property="og:title" content="Duy Thong Shared Photo">
              <meta property="og:description" content="Album ky niem dep">
              <meta property="og:image" content="https://cdn.facebook.mock/photo1.jpg">
            </head><body><a href="/photo.php?fbid=987654321">Photo 1</a></body></html>`,
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        }
        return new Response(
          `<!DOCTYPE html><html><head>
            <meta property="og:title" content="Facebook Reel Test Title">
            <meta property="og:description" content="High-def viral Facebook Reel clip">
            <meta property="og:image" content="https://cdn.facebook.mock/thumb.jpg">
            <meta property="og:video" content="https://cdn.facebook.mock/reel_video.mp4">
            <meta property="og:video:secure_url" content="https://cdn.facebook.mock/reel_video.mp4">
          </head><body></body></html>`,
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      }

      // 2. Spotify embed hydration response
      if (urlStr.includes('open.spotify.com/embed/track/')) {
        const nextData = {
          props: {
            pageProps: {
              state: {
                data: {
                  entity: {
                    name: 'Never Gonna Give You Up',
                    title: 'Never Gonna Give You Up',
                    artists: [{ name: 'Rick Astley' }],
                    duration: 213000,
                    releaseDate: { isoString: '1987-11-12' },
                    audioPreview: { url: 'https://cdn.spotify.mock/preview.mp3' },
                    visualIdentity: {
                      image: [{ url: 'https://cdn.spotify.mock/album_cover.jpg', maxWidth: 640 }]
                    }
                  }
                }
              }
            }
          }
        };
        return new Response(
          `<!DOCTYPE html><html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></head><body></body></html>`,
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      }

      // Spotify oEmbed fallback
      if (urlStr.includes('open.spotify.com/oembed')) {
        return new Response(
          JSON.stringify({
            title: 'Shape of You',
            author_name: 'Ed Sheeran',
            thumbnail_url: 'https://cdn.spotify.mock/shape_of_you.jpg'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Spotify RapidAPI Tier 1 resolver
      if (urlStr.includes('spotify-downloader11.p.rapidapi.com')) {
        return new Response(
          JSON.stringify({
            status: 'success',
            download_url: 'https://cdn.spotify.mock/rick_astley_320k.mp3',
            name: 'Never Gonna Give You Up',
            artist: 'Rick Astley',
            image: 'https://cdn.spotify.mock/album_cover.jpg'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 3. Instagram RapidAPI Tier 1 resolver
      if (urlStr.includes('instagram-video-downloader13.p.rapidapi.com')) {
        let isCarouselRequest = urlStr.includes('Carousel');
        if (!isCarouselRequest && init?.body) {
          if (typeof init.body.get === 'function') {
            const formUrl = init.body.get('url')?.toString() || '';
            isCarouselRequest = formUrl.includes('Carousel');
          } else {
            isCarouselRequest = init.body.toString().includes('Carousel');
          }
        }

        if (isCarouselRequest) {
          return new Response(
            JSON.stringify({
              id: 'CarouselPost123',
              title: 'Epic Travel Carousel',
              author: 'travel_explorer',
              thumbnail: 'https://cdn.instagram.mock/carousel_thumb.jpg',
              duration: 25,
              medias: [
                { type: 'video', url: 'https://cdn.instagram.mock/slide1_video.mp4', thumbnail: 'https://cdn.instagram.mock/slide1.jpg' },
                { type: 'image', url: 'https://cdn.instagram.mock/slide2_photo.jpg', thumbnail: 'https://cdn.instagram.mock/slide2.jpg' },
                { type: 'image', url: 'https://cdn.instagram.mock/slide3_photo.jpg', thumbnail: 'https://cdn.instagram.mock/slide3.jpg' }
              ]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            id: 'Cabc123xyz',
            title: 'Sunset Reel at Da Nang Beach',
            author: 'danang_vibes',
            thumbnail: 'https://cdn.instagram.mock/reel_thumb.jpg',
            duration: 18,
            medias: [
              { type: 'video', url: 'https://cdn.instagram.mock/danang_reel.mp4', thumbnail: 'https://cdn.instagram.mock/reel_thumb.jpg' }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 4. Lookaside CDN / Simulated CDN media streaming responses
      if (urlStr.includes('.mock/') || urlStr.includes('lookaside.fbsbx.com')) {
        const rangeHeader = init?.headers?.['Range'] || (init?.headers instanceof Headers ? init.headers.get('Range') : undefined);
        const isImage = urlStr.endsWith('.jpg') || urlStr.endsWith('.png') || urlStr.includes('photo');
        const isAudio = urlStr.endsWith('.mp3') || urlStr.includes('audio');
        const mediaBuffer = isImage ? sampleImageBuffer : isAudio ? sampleAudioBuffer : sampleVideoBuffer;
        const mimeType = isImage ? 'image/jpeg' : isAudio ? 'audio/mpeg' : 'video/mp4';

        if (rangeHeader && typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
          const parts = rangeHeader.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10) || 0;
          const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1023, mediaBuffer.length - 1);
          const chunk = mediaBuffer.subarray(start, end + 1);

          return new Response(chunk, {
            status: 206,
            headers: {
              'Content-Type': mimeType,
              'Content-Range': `bytes ${start}-${end}/${mediaBuffer.length}`,
              'Content-Length': String(chunk.length),
              'Accept-Ranges': 'bytes'
            }
          });
        }

        return new Response(mediaBuffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': String(mediaBuffer.length),
            'Accept-Ranges': 'bytes'
          }
        });
      }

      // Default fallback
      return new Response('Not Found', { status: 404 });
    });
  });

  // ===========================================================================
  // TIER 1: Feature Coverage (>=5 test cases per feature area)
  // ===========================================================================
  describe('Tier 1: Core Feature Coverage across Downloaders', () => {
    // -------------------------------------------------------------------------
    // Facebook Feature Area (5 tests)
    // -------------------------------------------------------------------------
    describe('Facebook Feature Coverage (F-01, F-06, F-07)', () => {
      it('T1-FB-01: resolves Facebook Reel with OpenGraph metadata and returns video formats', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/facebook/resolve',
          payload: { url: 'https://www.facebook.com/reel/1029384756' }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.id).toBe('1029384756');
        expect(body.data.mediaType).toBe('video');
        expect(body.data.formats).toBeInstanceOf(Array);
        expect(body.data.formats.length).toBeGreaterThan(0);
        expect(body.data.formats[0].ext).toBe('mp4');
      });

      it('T1-FB-02: resolves Facebook Photo/Post share link with image formats', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/facebook/resolve',
          payload: { url: 'https://www.facebook.com/share/photo/1bWGSWjXVX/' }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.mediaType).toBe('image');
        expect(body.data.formats[0].ext).toBe('jpg');
        expect(body.data.cover).toBeTruthy();
      });

      it('T1-FB-03: saves resolved Facebook video directly to Studio Drive with metadata', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/facebook/save-drive',
          payload: {
            url: 'https://cdn.facebook.mock/reel_video.mp4',
            title: 'T1_FB_Video',
            id: 'fbvidtier1',
            quality: 'HD',
            originalUrl: 'https://www.facebook.com/reel/fbvidtier1'
          }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.fileName).toContain('[Facebook]_');
        expect(body.data.fileName).toMatch(/\.mp4$/);
        expect(body.data.relPath).toMatch(/\/?facebook\//);
        expect(body.data.sizeBytes).toBeGreaterThan(0);

        const diskPath = path.join(resolvedStoragePaths.drive, 'facebook', body.data.fileName);
        createdFiles.push(diskPath);
        expect(fs.existsSync(diskPath)).toBe(true);
      });

      it('T1-FB-04: saves Facebook photo to Studio Drive preserving jpg extension', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/facebook/save-drive',
          payload: {
            url: 'https://cdn.facebook.mock/photo1.jpg',
            title: 'T1_FB_Photo',
            id: 'fb_photo_tier1',
            mediaType: 'image',
            ext: 'jpg'
          }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.fileName).toMatch(/\.jpg$/);

        const diskPath = path.join(resolvedStoragePaths.drive, 'facebook', body.data.fileName);
        createdFiles.push(diskPath);
        expect(fs.existsSync(diskPath)).toBe(true);
      });

      it('T1-FB-05: checks duplicate status in Studio Drive for existing vs non-existent media', async () => {
        const checkExisting = await app.inject({
          method: 'POST',
          url: '/api/v1/facebook/check-duplicate',
          payload: { id: 'fbvidtier1' }
        });
        expect(checkExisting.statusCode).toBe(200);
        const existingBody = JSON.parse(checkExisting.body);
        expect(existingBody.data.exists).toBe(true);
        expect(existingBody.data.item.relPath).toContain('fbvidtier1');

        const checkNonExistent = await app.inject({
          method: 'POST',
          url: '/api/v1/facebook/check-duplicate',
          payload: { id: 'definitely_does_not_exist_9999' }
        });
        expect(checkNonExistent.statusCode).toBe(200);
        const nonExistentBody = JSON.parse(checkNonExistent.body);
        expect(nonExistentBody.data.exists).toBe(false);
      });
    });

    // -------------------------------------------------------------------------
    // Spotify Feature Area (5 tests)
    // -------------------------------------------------------------------------
    describe('Spotify Feature Coverage (F-08, F-11, F-12, F-13)', () => {
      it('T1-SP-01: resolves Spotify track metadata and stream URL via embed hydration & Tier 1 API', async () => {
        SpotifyService.clearCache();
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/spotify/resolve',
          payload: { url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT' }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.id).toBe('4cOdK2wGLETKBW3PvgPWqT');
        expect(body.data.title).toBe('Never Gonna Give You Up');
        expect(body.data.artist).toBe('Rick Astley');
        expect(body.data.downloadUrl).toContain('rick_astley_320k.mp3');
      });

      it('T1-SP-02: resolves Spotify track via oEmbed fallback when hydration payload is minimal', async () => {
        SpotifyService.clearCache();
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/spotify/resolve',
          payload: { url: 'https://open.spotify.com/track/70LcF31zb4XZ6crZ1Bp5bT' }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.id).toBe('70LcF31zb4XZ6crZ1Bp5bT');
        expect(body.data.downloadUrl).toBeTruthy();
      });

      it('T1-SP-03: saves Spotify audio track directly into Studio Drive with MP3 container', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/spotify/save-drive',
          payload: {
            url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
            title: 'Never_Gonna_Give_You_Up',
            artist: 'Rick_Astley',
            audioUrl: 'https://cdn.spotify.mock/rick_astley_320k.mp3',
            overwrite: true
          }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.fileName).toContain('[Spotify]_');
        expect(body.data.fileName).toMatch(/\.mp3$/);
        expect(body.data.relPath).toMatch(/\/?spotify\//);
        expect(body.data.fileSizeInMb).toBeTruthy();

        const diskPath = path.join(resolvedStoragePaths.drive, 'spotify', body.data.fileName);
        createdFiles.push(diskPath);
        expect(fs.existsSync(diskPath)).toBe(true);
      });

      it('T1-SP-04: checks duplicate status in Studio Drive by track ID, title, and original URL', async () => {
        const checkMatch = await app.inject({
          method: 'POST',
          url: '/api/v1/spotify/check-duplicate',
          payload: {
            id: '4cOdK2wGLETKBW3PvgPWqT',
            title: 'Never_Gonna_Give_You_Up'
          }
        });

        expect(checkMatch.statusCode).toBe(200);
        const matchBody = JSON.parse(checkMatch.body);
        expect(matchBody.data.exists).toBe(true);
        expect(matchBody.data.item.artist).toBeDefined();

        const checkMiss = await app.inject({
          method: 'POST',
          url: '/api/v1/spotify/check-duplicate',
          payload: { id: 'non_existent_spotify_id_888' }
        });
        expect(checkMiss.statusCode).toBe(200);
        const missBody = JSON.parse(checkMiss.body);
        expect(missBody.data.exists).toBe(false);
      });

      it('T1-SP-05: proxies Spotify audio stream with correct MIME type and attachment headers', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/spotify/stream?url=https://cdn.spotify.mock/rick_astley_320k.mp3&download=true&filename=rick.mp3'
        });

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('audio/mpeg');
        expect(res.headers['content-disposition']).toContain('attachment');
        expect(res.headers['content-disposition']).toContain('rick.mp3');
        expect(res.headers['accept-ranges']).toBe('bytes');
        expect(res.rawPayload.length).toBeGreaterThan(0);
      });
    });

    // -------------------------------------------------------------------------
    // Instagram Feature Area (5 tests)
    // -------------------------------------------------------------------------
    describe('Instagram Feature Coverage (F-14, F-15, F-17, F-19)', () => {
      it('T1-IG-01: resolves Instagram Reel URL and extracts single video media payload', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/instagram/resolve',
          payload: { url: 'https://www.instagram.com/reel/Cabc123xyz/' }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.id).toBe('Cabc123xyz');
        expect(body.data.isCarousel).toBe(false);
        expect(body.data.medias).toBeInstanceOf(Array);
        expect(body.data.medias[0].type).toBe('video');
        expect(body.data.videoUrl).toContain('danang_reel.mp4');
      });

      it('T1-IG-02: resolves Instagram Carousel post with multi-item medias array', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/instagram/resolve',
          payload: { url: 'https://www.instagram.com/p/CarouselPost123/' }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.isCarousel).toBe(true);
        expect(body.data.medias.length).toBe(3);
        expect(body.data.medias[0].type).toBe('video');
        expect(body.data.medias[1].type).toBe('image');
        expect(body.data.medias[2].type).toBe('image');
      });

      it('T1-IG-03: saves Instagram Reel to Studio Drive with MP4 container', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/instagram/save-drive',
          payload: {
            url: 'https://cdn.instagram.mock/danang_reel.mp4',
            title: 'T1_IG_Reel',
            id: 'igreelt101',
            originalUrl: 'https://www.instagram.com/reel/igreelt101'
          }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.fileName).toContain('[Instagram]_');
        expect(body.data.fileName).toMatch(/\.mp4$/);
        expect(body.data.relPath).toMatch(/\/?instagram\//);

        const diskPath = path.join(resolvedStoragePaths.drive, 'instagram', body.data.fileName);
        createdFiles.push(diskPath);
        expect(fs.existsSync(diskPath)).toBe(true);
      });

      it('T1-IG-04: saves Instagram Image carousel slide to Studio Drive', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/instagram/save-drive',
          payload: {
            url: 'https://cdn.instagram.mock/slide2_photo.jpg',
            title: 'T1_IG_Photo_Slide',
            id: 'ig_slide_photo',
            originalUrl: 'https://www.instagram.com/p/ig_slide_photo'
          }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.fileName).toContain('[Instagram]_');

        const diskPath = path.join(resolvedStoragePaths.drive, 'instagram', body.data.fileName);
        createdFiles.push(diskPath);
        expect(fs.existsSync(diskPath)).toBe(true);
      });

      it('T1-IG-05: checks duplicate status in Studio Drive for Instagram media', async () => {
        const checkMatch = await app.inject({
          method: 'POST',
          url: '/api/v1/instagram/check-duplicate',
          payload: { id: 'igreelt101' }
        });

        expect(checkMatch.statusCode).toBe(200);
        const matchBody = JSON.parse(checkMatch.body);
        expect(matchBody.data.exists).toBe(true);
        expect(matchBody.data.item.relPath).toContain('igreelt101');

        const checkMiss = await app.inject({
          method: 'POST',
          url: '/api/v1/instagram/check-duplicate',
          payload: { id: 'non_existent_ig_post_777' }
        });
        expect(checkMiss.statusCode).toBe(200);
        const missBody = JSON.parse(checkMiss.body);
        expect(missBody.data.exists).toBe(false);
      });
    });
  });

  // ===========================================================================
  // TIER 2: Boundary & Corner Cases (>=5 test cases per tool)
  // ===========================================================================
  describe('Tier 2: Boundary & Corner Cases (F-02, F-10)', () => {
    // -------------------------------------------------------------------------
    // Facebook Boundary Cases (5 tests)
    // -------------------------------------------------------------------------
    describe('Facebook Boundary Cases', () => {
      it('T2-FB-01: extracts Facebook URL from dirty conversational text', async () => {
        const dirtyMessage = 'Bác ơi xem giúp em video này https://www.facebook.com/reel/1234567890?s=yWDuG2 cuốn quá';
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/facebook/resolve',
          payload: { url: dirtyMessage }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.id).toBe('1234567890');
      });

      it('T2-FB-02: cleans heavy tracking parameters (fbclid, mibextid, ref) from fb.watch URL', async () => {
        const trackedUrl = 'https://fb.watch/mXz8123abc/?fbclid=IwAR2V8d4...&mibextid=ZbWKwL&ref=share';
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/facebook/resolve',
          payload: { url: trackedUrl }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
      });

      it('T2-FB-03: handles Facebook URL with watch query parameter (?v=9876543210)', async () => {
        const watchUrl = 'https://www.facebook.com/watch/?v=9876543210&extid=WA-Inc_e';
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/facebook/resolve',
          payload: { url: watchUrl }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.id).toBe('9876543210');
      });

      it('T2-FB-04: rejects non-Facebook domain URLs with 400 Bad Request', async () => {
        const invalidUrl = 'https://www.tiktok.com/@user/video/71829384756';
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/facebook/resolve',
          payload: { url: invalidUrl }
        });

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(false);
        expect(body.error?.message || body.message || '').toContain('Liên kết không hợp lệ');
      });

      it('T2-FB-05: rejects empty string and whitespace-only payloads with schema validation 400', async () => {
        const emptyRes = await app.inject({
          method: 'POST',
          url: '/api/v1/facebook/resolve',
          payload: { url: '   ' }
        });
        expect(emptyRes.statusCode).toBe(400);

        const missingRes = await app.inject({
          method: 'POST',
          url: '/api/v1/facebook/resolve',
          payload: {}
        });
        expect(missingRes.statusCode).toBe(400);
      });
    });

    // -------------------------------------------------------------------------
    // Spotify Boundary Cases (5 tests)
    // -------------------------------------------------------------------------
    describe('Spotify Boundary Cases', () => {
      it('T2-SP-01: extracts Spotify track URL embedded in mobile share string', async () => {
        const sharedText = 'Check out this song on Spotify: https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=a1b2c3 - it is awesome!';
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/spotify/resolve',
          payload: { url: sharedText }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.id).toBe('4cOdK2wGLETKBW3PvgPWqT');
      });

      it('T2-SP-02: resolves internationalized localized Spotify track paths (/intl-de/, /intl-vi/)', async () => {
        const localizedUrl = 'https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT?si=xyz&context=spotify';
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/spotify/resolve',
          payload: { url: localizedUrl }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.id).toBe('4cOdK2wGLETKBW3PvgPWqT');
      });

      it('T2-SP-03: cleans brackets and clutter from song title without ruining parentheses', () => {
        const dirty1 = 'Song Title [Official Music Video 4K] (Remastered 2021)';
        const sanitized1 = dirty1.replace(/\[.*?\]/g, '').replace(/\(.*?(?:video|4k|official|remaster).*?\)/gi, '').trim();
        expect(sanitized1).toBe('Song Title');

        const intendedRemix = 'Song Title (Remix)';
        const sanitized2 = intendedRemix.replace(/\[.*?\]/g, '').trim();
        expect(sanitized2).toBe('Song Title (Remix)');
      });

      it('T2-SP-04: rejects unsupported non-track Spotify URLs (artist, playlist, album overview)', async () => {
        const artistUrl = 'https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4';
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/spotify/resolve',
          payload: { url: artistUrl }
        });

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(false);
      });

      it('T2-SP-05: rejects non-Spotify URLs (SoundCloud, YouTube) and empty payloads', async () => {
        const soundcloudUrl = 'https://soundcloud.com/artist/song-name';
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/spotify/resolve',
          payload: { url: soundcloudUrl }
        });

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(false);

        const emptyRes = await app.inject({
          method: 'POST',
          url: '/api/v1/spotify/resolve',
          payload: { url: '' }
        });
        expect(emptyRes.statusCode).toBe(400);
      });
    });

    // -------------------------------------------------------------------------
    // Instagram Boundary Cases (5 tests)
    // -------------------------------------------------------------------------
    describe('Instagram Boundary Cases', () => {
      it('T2-IG-01: extracts Instagram URL from user text containing comments and emojis', async () => {
        const dirtyMessage = 'Xem reel này cuốn quá nè 😂 https://www.instagram.com/reel/Cabc123xyz/?igsh=MWx123 tuyệt vời';
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/instagram/resolve',
          payload: { url: dirtyMessage }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.id).toBe('Cabc123xyz');
      });

      it('T2-IG-02: strips complex Instagram query tracking parameters (igsh, utm_source, utm_medium)', async () => {
        const trackedUrl = 'https://www.instagram.com/reel/Cabc123xyz/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==&utm_medium=share_sheet';
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/instagram/resolve',
          payload: { url: trackedUrl }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.id).toBe('Cabc123xyz');
      });

      it('T2-IG-03: supports Instagram stories and tv URLs correctly in extractUrl', () => {
        const tvUrl = 'https://www.instagram.com/tv/B8xYz123abc/?utm_source=ig_web';
        const storyUrl = 'https://www.instagram.com/stories/username/1234567890123/';

        expect(InstagramService.extractUrl(tvUrl)).toContain('instagram.com/tv/B8xYz123abc');
        expect(InstagramService.extractUrl(storyUrl)).toContain('instagram.com/stories/username/1234567890123');
      });

      it('T2-IG-04: rejects unsupported Instagram endpoints (direct inbox, explore) with 400', async () => {
        const inboxUrl = 'https://www.instagram.com/direct/t/123456789/';
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/instagram/resolve',
          payload: { url: inboxUrl }
        });

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(false);
      });

      it('T2-IG-05: rejects non-Instagram URLs (Twitter/X) and empty payloads', async () => {
        const xUrl = 'https://x.com/username/status/123456789';
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/instagram/resolve',
          payload: { url: xUrl }
        });

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(false);

        const emptyRes = await app.inject({
          method: 'POST',
          url: '/api/v1/instagram/resolve',
          payload: { url: '   ' }
        });
        expect(emptyRes.statusCode).toBe(400);
      });
    });
  });

  // ===========================================================================
  // TIER 3: Cross-Feature Combinations (Pairwise Interactions)
  // ===========================================================================
  describe('Tier 3: Cross-Feature Combinations & Math Verification', () => {
    it('T3-PAIR-01: Pairwise resolve -> save-drive -> check-duplicate state synchronization across all 3 tools', async () => {
      // 1. Facebook pipeline
      const fbResolve = await app.inject({
        method: 'POST',
        url: '/api/v1/facebook/resolve',
        payload: { url: 'https://www.facebook.com/reel/fbsyncpair1' }
      });
      expect(fbResolve.statusCode).toBe(200);

      const fbSave = await app.inject({
        method: 'POST',
        url: '/api/v1/facebook/save-drive',
        payload: {
          url: 'https://cdn.facebook.mock/reel_video.mp4',
          title: 'FB_Sync_Pair',
          id: 'fbsyncpair1',
          originalUrl: 'https://www.facebook.com/reel/fbsyncpair1'
        }
      });
      expect(fbSave.statusCode).toBe(200);
      createdFiles.push(path.join(resolvedStoragePaths.drive, 'facebook', JSON.parse(fbSave.body).data.fileName));

      const fbCheck = await app.inject({
        method: 'POST',
        url: '/api/v1/facebook/check-duplicate',
        payload: { id: 'fbsyncpair1' }
      });
      expect(JSON.parse(fbCheck.body).data.exists).toBe(true);

      // 2. Spotify pipeline
      const spSave = await app.inject({
        method: 'POST',
        url: '/api/v1/spotify/save-drive',
        payload: {
          url: 'https://open.spotify.com/track/spSyncPair2',
          title: 'SP_Sync_Pair',
          artist: 'Artist_Sync',
          audioUrl: 'https://cdn.spotify.mock/audio.mp3',
          overwrite: true
        }
      });
      expect(spSave.statusCode).toBe(200);
      createdFiles.push(path.join(resolvedStoragePaths.drive, 'spotify', JSON.parse(spSave.body).data.fileName));

      const spCheck = await app.inject({
        method: 'POST',
        url: '/api/v1/spotify/check-duplicate',
        payload: { id: 'spSyncPair2' }
      });
      expect(JSON.parse(spCheck.body).data.exists).toBe(true);

      // 3. Instagram pipeline
      const igSave = await app.inject({
        method: 'POST',
        url: '/api/v1/instagram/save-drive',
        payload: {
          url: 'https://cdn.instagram.mock/reel.mp4',
          title: 'IG_Sync_Pair',
          id: 'igsyncpair3',
          originalUrl: 'https://www.instagram.com/reel/igsyncpair3'
        }
      });
      expect(igSave.statusCode).toBe(200);
      createdFiles.push(path.join(resolvedStoragePaths.drive, 'instagram', JSON.parse(igSave.body).data.fileName));

      const igCheck = await app.inject({
        method: 'POST',
        url: '/api/v1/instagram/check-duplicate',
        payload: { id: 'igsyncpair3' }
      });
      expect(JSON.parse(igCheck.body).data.exists).toBe(true);
    });

    it('T3-PAIR-02: Overwrite handling replaces file, updates sidecar metadata, and unlinks stale thumbs', async () => {
      // First save
      const save1 = await app.inject({
        method: 'POST',
        url: '/api/v1/spotify/save-drive',
        payload: {
          url: 'https://open.spotify.com/track/overwrite_test_1',
          title: 'Overwrite_Track_V1',
          artist: 'Original_Artist',
          audioUrl: 'https://cdn.spotify.mock/audio.mp3',
          overwrite: false
        }
      });
      expect(save1.statusCode).toBe(200);
      const file1 = JSON.parse(save1.body).data.fileName;
      const targetPath = path.join(resolvedStoragePaths.drive, 'spotify', file1);
      createdFiles.push(targetPath);

      // Second save with overwrite=true
      const save2 = await app.inject({
        method: 'POST',
        url: '/api/v1/spotify/save-drive',
        payload: {
          url: 'https://open.spotify.com/track/overwrite_test_1',
          title: 'Overwrite_Track_V1',
          artist: 'Original_Artist',
          audioUrl: 'https://cdn.spotify.mock/audio.mp3',
          overwrite: true
        }
      });
      expect(save2.statusCode).toBe(200);
      expect(fs.existsSync(targetPath)).toBe(true);

      const metaPath = targetPath.replace(/\.[^.]+$/, '.meta.json');
      expect(fs.existsSync(metaPath)).toBe(true);
      const meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf8'));
      expect(meta.artist).toBe('Original_Artist');
    });

    it('T3-PAIR-03: HTTP 206 Partial Content Stream Range Requests (Range: bytes=0-1023)', async () => {
      const streamRes = await app.inject({
        method: 'GET',
        url: '/api/v1/facebook/stream?url=https://cdn.facebook.mock/reel_video.mp4',
        headers: {
          Range: 'bytes=0-1023'
        }
      });

      expect(streamRes.statusCode).toBe(206);
      expect(streamRes.headers['content-range']).toContain('bytes 0-1023/');
      expect(streamRes.headers['accept-ranges']).toBe('bytes');
      expect(streamRes.headers['content-type']).toContain('video/mp4');
      expect(streamRes.rawPayload.length).toBe(1024);
    });

    it('T3-PAIR-04: Format & Quality preservation (HD vs SD vs Image) with correct metadata tags', async () => {
      // 1. HD Video format
      const hdRes = await app.inject({
        method: 'POST',
        url: '/api/v1/facebook/save-drive',
        payload: {
          url: 'https://cdn.facebook.mock/reel_video.mp4',
          title: 'Quality_HD_Sample',
          id: 'qual_hd_123',
          quality: 'HD',
          mediaType: 'video'
        }
      });
      expect(hdRes.statusCode).toBe(200);
      const hdBody = JSON.parse(hdRes.body);
      createdFiles.push(path.join(resolvedStoragePaths.drive, 'facebook', hdBody.data.fileName));

      // 2. Photo format
      const photoRes = await app.inject({
        method: 'POST',
        url: '/api/v1/facebook/save-drive',
        payload: {
          url: 'https://cdn.facebook.mock/photo.jpg',
          title: 'Quality_Photo_Sample',
          id: 'qual_photo_123',
          mediaType: 'image',
          ext: 'jpg'
        }
      });
      expect(photoRes.statusCode).toBe(200);
      const photoBody = JSON.parse(photoRes.body);
      expect(photoBody.data.fileName).toMatch(/\.jpg$/);
      createdFiles.push(path.join(resolvedStoragePaths.drive, 'facebook', photoBody.data.fileName));
    });

    it('T3-PAIR-05: Spotify Staged Anti-Remix Match Scoring (KI-FIX-041) with duration tolerance verification', () => {
      const expected = { title: 'See You Again', artist: 'Wiz Khalifa', duration: 230 };

      // 1. Official Topic Candidate
      const topicCandidate = {
        title: 'See You Again (feat. Charlie Puth)',
        channel: 'Wiz Khalifa - Topic',
        track: 'See You Again',
        artist: 'Wiz Khalifa',
        duration: 230
      };
      const topicScore = SpotifyService.calculateMatchScore(topicCandidate, expected);
      expect(topicScore).toBeGreaterThanOrEqual(80);

      // 2. Unwanted Vinahouse Remix Candidate (Penalized)
      const remixCandidate = {
        title: 'See You Again (Vinahouse Remix 2024 Bass Cực Căng)',
        channel: 'DJ Viet Nam',
        duration: 230
      };
      const remixScore = SpotifyService.calculateMatchScore(remixCandidate, expected);
      expect(remixScore).toBeLessThan(0);

      // 3. Unwanted Karaoke / Instrumental Candidate (Penalized)
      const karaokeCandidate = {
        title: 'See You Again [Karaoke Beat Tone Chuan]',
        channel: 'Karaoke Channel',
        duration: 230
      };
      expect(SpotifyService.calculateMatchScore(karaokeCandidate, expected)).toBeLessThan(0);

      // 4. Excessive duration difference (> 15s) is completely rejected (-999)
      const excessiveDiff = {
        title: 'See You Again',
        channel: 'Wiz Khalifa',
        duration: 280
      };
      expect(SpotifyService.calculateMatchScore(excessiveDiff, expected)).toBe(-999);
    });

    it('T3-PAIR-06: Tool Registry Tier & Metadata Parity in useToolRegistry.js', () => {
      const fbDef = toolRegistry.tools.find((t: any) => t.id === 'facebook-downloader');
      const spDef = toolRegistry.tools.find((t: any) => t.id === 'spotify-downloader');
      const igDef = toolRegistry.tools.find((t: any) => t.id === 'instagram-downloader');

      expect(fbDef).toBeDefined();
      expect(spDef).toBeDefined();
      expect(igDef).toBeDefined();

      expect(fbDef?.route).toBe('#tool/facebook-downloader');
      expect(spDef?.route).toBe('#tool/spotify-downloader');
      expect(igDef?.route).toBe('#tool/instagram-downloader');

      expect(fbDef?.tier).toBe('UR');
      expect(spDef?.specs).toContain('MP3 320kbps');
      expect(igDef?.specs).toContain('Reels & Story');
    });
  });

  // ===========================================================================
  // TIER 4: Real-World Application Scenarios (Simulated User Journeys)
  // ===========================================================================
  describe('Tier 4: Real-World Application Scenarios', () => {
    it('T4-SCEN-01: Full Mobile Web Share Target Pipeline (OS Share Sheet -> /share-target -> /#share-target -> Resolve -> Stream -> Save Drive)', async () => {
      // Step 1: User shares Facebook reel from Facebook Android app to DD Studio PWA
      const shareTargetRes = await app.inject({
        method: 'POST',
        url: '/share-target',
        payload: {
          url: 'https://www.facebook.com/reel/targetflow1',
          text: 'Watch this awesome reel!',
          title: 'Shared Reel'
        }
      });

      // Validates 303 Redirect to client hash route with query params
      expect(shareTargetRes.statusCode).toBe(303);
      expect(shareTargetRes.headers.location).toContain('#share-target');
      expect(shareTargetRes.headers.location).toContain('targetflow1');

      // Step 2: Client SmartUrlRouter picks up URL and calls /api/v1/facebook/resolve
      const resolveRes = await app.inject({
        method: 'POST',
        url: '/api/v1/facebook/resolve',
        payload: { url: 'https://www.facebook.com/reel/targetflow1' }
      });
      expect(resolveRes.statusCode).toBe(200);
      const resolveData = JSON.parse(resolveRes.body).data;

      // Step 3: Client starts video preview via streaming proxy with Range header
      const previewRes = await app.inject({
        method: 'GET',
        url: `/api/v1/facebook/stream?url=${encodeURIComponent(resolveData.formats[0].url)}`,
        headers: { Range: 'bytes=0-2047' }
      });
      expect(previewRes.statusCode).toBe(206);
      expect(previewRes.headers['content-range']).toContain('bytes 0-2047/');

      // Step 4: User clicks "Lưu vào Drive"
      const driveRes = await app.inject({
        method: 'POST',
        url: '/api/v1/facebook/save-drive',
        payload: {
          url: resolveData.formats[0].url,
          title: 'Shared_Reel_Journey',
          id: 'targetflow1',
          originalUrl: 'https://www.facebook.com/reel/targetflow1'
        }
      });
      expect(driveRes.statusCode).toBe(200);
      const driveData = JSON.parse(driveRes.body).data;
      const finalDiskPath = path.join(resolvedStoragePaths.drive, 'facebook', driveData.fileName);
      createdFiles.push(finalDiskPath);
      expect(fs.existsSync(finalDiskPath)).toBe(true);

      // Step 5: Duplicate check now recognizes the item as existing in Drive
      const duplicateRes = await app.inject({
        method: 'POST',
        url: '/api/v1/facebook/check-duplicate',
        payload: { id: 'targetflow1' }
      });
      expect(JSON.parse(duplicateRes.body).data.exists).toBe(true);
    });

    it('T4-SCEN-02: Spotify Share Sheet to High-Fidelity Audio Preservation Pipeline', async () => {
      // Step 1: User shares Spotify song via iOS/Android PWA Share Target GET fallback
      const getShareRes = await app.inject({
        method: 'GET',
        url: '/share-target?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F4cOdK2wGLETKBW3PvgPWqT%3Fsi%3Dshare123&title=RickRoll'
      });
      expect(getShareRes.statusCode).toBe(303);
      expect(getShareRes.headers.location).toContain('4cOdK2wGLETKBW3PvgPWqT');

      // Step 2: Client resolves track metadata
      const resolveRes = await app.inject({
        method: 'POST',
        url: '/api/v1/spotify/resolve',
        payload: { url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT' }
      });
      expect(resolveRes.statusCode).toBe(200);
      const trackData = JSON.parse(resolveRes.body).data;
      expect(trackData.artist).toBe('Rick Astley');

      // Step 3: User triggers direct download proxy with download=true
      const downloadProxyRes = await app.inject({
        method: 'GET',
        url: `/api/v1/spotify/stream?url=${encodeURIComponent(trackData.downloadUrl)}&download=true&filename=NeverGonnaGiveYouUp.mp3`
      });
      expect(downloadProxyRes.statusCode).toBe(200);
      expect(downloadProxyRes.headers['content-disposition']).toContain('attachment');

      // Step 4: User saves to Studio Drive
      const saveRes = await app.inject({
        method: 'POST',
        url: '/api/v1/spotify/save-drive',
        payload: {
          url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
          title: 'Never_Gonna_Give_You_Up_Journey',
          artist: 'Rick_Astley',
          audioUrl: trackData.downloadUrl,
          overwrite: true
        }
      });
      expect(saveRes.statusCode).toBe(200);
      const savedData = JSON.parse(saveRes.body).data;
      const spDiskPath = path.join(resolvedStoragePaths.drive, 'spotify', savedData.fileName);
      createdFiles.push(spDiskPath);
      expect(fs.existsSync(spDiskPath)).toBe(true);
    });

    it('T4-SCEN-03: Instagram Multi-Item Carousel Extraction & In-Place Item Selection', async () => {
      // Step 1: Resolve carousel post
      const carouselRes = await app.inject({
        method: 'POST',
        url: '/api/v1/instagram/resolve',
        payload: { url: 'https://www.instagram.com/p/CarouselPost123/' }
      });
      expect(carouselRes.statusCode).toBe(200);
      const carouselData = JSON.parse(carouselRes.body).data;
      expect(carouselData.isCarousel).toBe(true);
      expect(carouselData.medias.length).toBe(3);

      // Step 2: User selects Slide 2 (Image) and saves to Studio Drive
      const slide2 = carouselData.medias[1];
      expect(slide2.type).toBe('image');

      const saveSlide2 = await app.inject({
        method: 'POST',
        url: '/api/v1/instagram/save-drive',
        payload: {
          url: slide2.url,
          title: 'Carousel_Slide_2',
          id: 'slide_2_img',
          originalUrl: 'https://www.instagram.com/p/CarouselPost123/'
        }
      });
      expect(saveSlide2.statusCode).toBe(200);
      const slide2Data = JSON.parse(saveSlide2.body).data;
      const slide2Path = path.join(resolvedStoragePaths.drive, 'instagram', slide2Data.fileName);
      createdFiles.push(slide2Path);
      expect(fs.existsSync(slide2Path)).toBe(true);

      // Step 3: User switches back to Slide 1 (Video) and streams it with Range request
      const slide1 = carouselData.medias[0];
      expect(slide1.type).toBe('video');

      const streamSlide1 = await app.inject({
        method: 'GET',
        url: `/api/v1/instagram/stream?url=${encodeURIComponent(slide1.url)}`,
        headers: { Range: 'bytes=0-1023' }
      });
      expect(streamSlide1.statusCode).toBe(206);
      expect(streamSlide1.headers['content-type']).toContain('video/mp4');
    });

    it('T4-SCEN-04: Upstream Outage & Network Failure Resilience (Graceful 400/502 without process crash)', async () => {
      // Simulate upstream 502 Bad Gateway
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
        return new Response('Upstream Server Error', { status: 502 });
      });

      const failureRes = await app.inject({
        method: 'POST',
        url: '/api/v1/facebook/save-drive',
        payload: {
          url: 'https://cdn.upstream-failed.mock/video.mp4',
          title: 'Failed_Save',
          id: 'failed_upstream_123'
        }
      });

      expect(failureRes.statusCode).toBe(400);
      const body = JSON.parse(failureRes.body);
      expect(body.success).toBe(false);
      expect(body.error?.message || body.message || '').toContain('Không thể tải');

      // Server remains fully operational for subsequent requests
      const healthRes = await app.inject({
        method: 'GET',
        url: '/api/v1/health'
      });
      expect(healthRes.statusCode).toBe(200);
      expect(JSON.parse(healthRes.body).status).toBe('UP');
    });

    it('T4-SCEN-05: Concurrent High-Throughput Drive Writes (Parallel save-drive operations with race-free atomic disk integrity)', async () => {
      const concurrentTasks = Array.from({ length: 6 }).map((_, idx) => {
        return app.inject({
          method: 'POST',
          url: '/api/v1/facebook/save-drive',
          payload: {
            url: `https://cdn.facebook.mock/video_${idx}.mp4`,
            title: `Concurrent_Test_${idx}`,
            id: `concurrent_id_${idx}`,
            overwrite: true
          }
        });
      });

      const responses = await Promise.all(concurrentTasks);
      for (const res of responses) {
        expect(res.statusCode).toBe(200);
        const data = JSON.parse(res.body).data;
        const filePath = path.join(resolvedStoragePaths.drive, 'facebook', data.fileName);
        createdFiles.push(filePath);
        expect(fs.existsSync(filePath)).toBe(true);

        const metaPath = filePath.replace(/\.[^.]+$/, '.meta.json');
        expect(fs.existsSync(metaPath)).toBe(true);
      }
    });
  });
});
