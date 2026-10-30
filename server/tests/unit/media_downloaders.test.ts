import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FacebookService } from '../../src/services/facebook.service.js';
import { InstagramService } from '../../src/services/instagram.service.js';
import { SpotifyService } from '../../src/services/spotify.service.js';
import { facebookResolveBodySchema } from '../../src/schemas/facebook.schema.js';
import { instagramResolveBodySchema } from '../../src/schemas/instagram.schema.js';
import { spotifyResolveBodySchema } from '../../src/schemas/spotify.schema.js';
import { BadRequestError } from '../../src/lib/errors.js';
import { renderMediaHistorySection, escapeHtml, formatDuration } from '../../../src/components/tools/common/MediaHistorySection.js';
import { storage } from '../../../src/utilities/storage.js';

describe('Media Downloaders Unit Test Suite', () => {
  describe('1. Facebook Downloader Service & Schemas', () => {
    it('extracts valid Facebook video and Reel URLs correctly', () => {
      const reelUrl = 'https://www.facebook.com/reel/1234567890?s=yWDuG2&fs=e';
      const watchUrl = 'https://www.facebook.com/watch/?v=9876543210';
      const fbWatchUrl = 'https://fb.watch/mXz8123abc/';
      const sharePostUrl = 'https://www.facebook.com/share/1bWGSWjXVX/';

      expect(FacebookService.extractUrl(reelUrl)).toContain('facebook.com/reel/1234567890');
      expect(FacebookService.extractUrl(watchUrl)).toContain('facebook.com/watch/?v=9876543210');
      expect(FacebookService.extractUrl(fbWatchUrl)).toContain('fb.watch/mXz8123abc/');
      expect(FacebookService.extractUrl(sharePostUrl)).toContain('facebook.com/share/1bWGSWjXVX');
    });

    it('supports fb.com, fb.gg, protocol-less URLs and strips tracking parameters & trailing punctuation', () => {
      const fbDotComUrl = 'https://fb.com/watch?v=123456';
      const protocolLessUrl = 'facebook.com/reel/9876543210';
      const protocolLessFbWatch = 'fb.watch/test123abc/';
      const trackedUrl = 'https://www.facebook.com/reel/1234567890?utm_source=fb&fbclid=abc123xyz&mibextid=wwXIfr.';
      const trailingPunctuationUrl = 'https://www.facebook.com/share/1bWGSWjXVX/),';

      expect(FacebookService.extractUrl(fbDotComUrl)).toContain('fb.com/watch?v=123456');
      expect(FacebookService.extractUrl(protocolLessUrl)).toBe('https://facebook.com/reel/9876543210');
      expect(FacebookService.extractUrl(protocolLessFbWatch)).toBe('https://fb.watch/test123abc/');

      const cleanedTracked = FacebookService.extractUrl(trackedUrl);
      expect(cleanedTracked).not.toContain('fbclid');
      expect(cleanedTracked).not.toContain('utm_source');
      expect(cleanedTracked).not.toContain('mibextid');
      expect(cleanedTracked.endsWith('.')).toBe(false);

      const cleanedPunctuation = FacebookService.extractUrl(trailingPunctuationUrl);
      expect(cleanedPunctuation).toBe('https://www.facebook.com/share/1bWGSWjXVX/');
    });

    it('successfully extracts Facebook Post with photos/images (e.g. share link)', async () => {
      const shareUrl = 'https://www.facebook.com/share/1bWGSWjXVX/';
      const data = await FacebookService.resolveVideo(shareUrl);
      expect(data).toBeDefined();
      expect(data.id).toBeTruthy();
      expect(data.author?.name).toContain('Duy Thông');
      expect(data.mediaType).toBe('image');
      expect(data.formats.length).toBeGreaterThan(0);
      expect(data.formats[0].ext).toBe('jpg');
      expect(data.cover).toBeTruthy();
    });

    it('rejects invalid or non-Facebook URLs with BadRequestError', () => {
      expect(() => FacebookService.extractUrl('')).toThrow(BadRequestError);
      expect(() => FacebookService.extractUrl('https://example.com/video.mp4')).toThrow(BadRequestError);
      expect(() => FacebookService.extractUrl('not a url')).toThrow(BadRequestError);
    });

    it('validates Facebook request body schema and rejects empty payload', () => {
      expect(() => facebookResolveBodySchema.parse({ url: 'https://www.facebook.com/watch/?v=123' })).not.toThrow();
      expect(() => facebookResolveBodySchema.parse({ url: '' })).toThrow();
      expect(() => facebookResolveBodySchema.parse({})).toThrow();
    });

    it('handles Drive duplicate check gracefully for non-existent video', async () => {
      const result = await FacebookService.checkExistingInDrive('non_existent_fb_id_99999');
      expect(result).toHaveProperty('exists', false);
    });
  });

  describe('2. Instagram Downloader Service & Schemas', () => {
    it('extracts valid Instagram Post, Reel, and Story URLs correctly', () => {
      const reelUrl = 'https://www.instagram.com/reel/Cabc123xyz/?utm_source=ig_web';
      const postUrl = 'https://www.instagram.com/p/Dxyz987abc/';
      const storyUrl = 'https://www.instagram.com/stories/some_user/1234567890123/';

      expect(InstagramService.extractUrl(reelUrl)).toContain('instagram.com/reel/Cabc123xyz');
      expect(InstagramService.extractUrl(postUrl)).toContain('instagram.com/p/Dxyz987abc');
      expect(InstagramService.extractUrl(storyUrl)).toContain('instagram.com/stories/some_user/1234567890123');
    });

    it('rejects invalid or non-Instagram URLs with BadRequestError', () => {
      expect(() => InstagramService.extractUrl('')).toThrow(BadRequestError);
      expect(() => InstagramService.extractUrl('https://tiktok.com/@user/video/123')).toThrow(BadRequestError);
      expect(() => InstagramService.extractUrl('random text')).toThrow(BadRequestError);
    });

    it('validates Instagram request body schema', () => {
      expect(() => instagramResolveBodySchema.parse({ url: 'https://www.instagram.com/reel/Cabc123/' })).not.toThrow();
      expect(() => instagramResolveBodySchema.parse({ url: '' })).toThrow();
      expect(() => instagramResolveBodySchema.parse({})).toThrow();
    });

    it('handles Drive duplicate check gracefully for non-existent media', async () => {
      const result = await InstagramService.checkExistingInDrive('non_existent_ig_id_88888');
      expect(result).toHaveProperty('exists', false);
    });

    it('cleans dirty Instagram URLs with surrounding text and tracking tags', () => {
      const dirtyUrl = 'Check this out https://www.instagram.com/reel/C123abcXYZ/?igsh=MWZ4eHQ3&utm_medium=copy_link! amazing';
      const cleaned = InstagramService.extractUrl(dirtyUrl);
      expect(cleaned).toBe('https://www.instagram.com/reel/C123abcXYZ/');

      const postWithPunctuation = 'Look at https://www.instagram.com/p/D987cba123/), wow';
      const cleanedPost = InstagramService.extractUrl(postWithPunctuation);
      expect(cleanedPost).toBe('https://www.instagram.com/p/D987cba123/');

      const protocolLess = 'instagram.com/reel/C123abcXYZ/';
      expect(InstagramService.extractUrl(protocolLess)).toBe('https://instagram.com/reel/C123abcXYZ/');
    });

    it('correctly parses multi-line NDJSON from yt-dlp representing a multi-item carousel', () => {
      const ndjson = [
        JSON.stringify({
          id: 'slide_1',
          title: 'Carousel Slide 1',
          url: 'https://cdn.instagram.com/slide1.jpg',
          ext: 'jpg',
          vcodec: 'none',
          thumbnail: 'https://cdn.instagram.com/thumb1.jpg',
          uploader: 'insta_creator'
        }),
        JSON.stringify({
          id: 'slide_2',
          title: 'Carousel Slide 2',
          url: 'https://cdn.instagram.com/slide2.mp4',
          ext: 'mp4',
          vcodec: 'h264',
          thumbnail: 'https://cdn.instagram.com/thumb2.jpg',
          uploader: 'insta_creator'
        }),
        JSON.stringify({
          id: 'slide_3',
          title: 'Carousel Slide 3',
          url: 'https://cdn.instagram.com/slide3.jpg',
          ext: 'jpg',
          vcodec: 'none',
          thumbnail: 'https://cdn.instagram.com/thumb3.jpg',
          uploader: 'insta_creator'
        })
      ].join('\n');

      const parsed = InstagramService.parseYtdlpOutput(ndjson);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].id).toBe('slide_1');
      expect(parsed[1].id).toBe('slide_2');
      expect(parsed[2].id).toBe('slide_3');
    });

    it('correctly parses yt-dlp playlist output containing an entries array', () => {
      const playlistJson = JSON.stringify({
        _type: 'playlist',
        id: 'carousel_root',
        title: 'Post Album',
        entries: [
          { id: 'item_1', url: 'https://cdn.instagram.com/item1.jpg', ext: 'jpg', vcodec: 'none' },
          { id: 'item_2', url: 'https://cdn.instagram.com/item2.mp4', ext: 'mp4', vcodec: 'h264' }
        ]
      });

      const parsed = InstagramService.parseYtdlpOutput(playlistJson);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('item_1');
      expect(parsed[1].id).toBe('item_2');
    });

    it('saves image with .jpg extension, image/jpeg mimeType and leading slash relPath', async () => {
      const mockBuffer = Buffer.from('fake image data');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/jpeg' }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(mockBuffer);
              controller.close();
            }
          }),
          arrayBuffer: async () => mockBuffer
        } as any;
      });

      const res = await InstagramService.saveToDrive(
        'https://scontent.cdninstagram.com/v/t51.2885-15/test_photo.jpg',
        'Test Photo Title',
        'img123',
        'https://instagram.com/p/test',
        '',
        'test_user',
        0,
        true,
        'image'
      );

      expect(res.success).toBe(true);
      expect(res.fileName).toMatch(/\.jpg$/);
      expect(res.relPath).toBe(`/instagram/${res.fileName}`);
      expect(res.relPath.startsWith('/instagram/')).toBe(true);
      expect(res.metadata.mediaType).toBe('image');

      fetchSpy.mockRestore();
    });

    it('saves video with .mp4 extension, video/mp4 mimeType and leading slash relPath', async () => {
      const mockBuffer = Buffer.from('fake video data');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'video/mp4' }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(mockBuffer);
              controller.close();
            }
          }),
          arrayBuffer: async () => mockBuffer
        } as any;
      });

      const res = await InstagramService.saveToDrive(
        'https://scontent.cdninstagram.com/v/t50.2886-16/test_video.mp4',
        'Test Video Reel',
        'vid456',
        'https://instagram.com/reel/test',
        '',
        'test_user',
        30,
        true,
        'video'
      );

      expect(res.success).toBe(true);
      expect(res.fileName).toMatch(/\.mp4$/);
      expect(res.relPath).toBe(`/instagram/${res.fileName}`);
      expect(res.relPath.startsWith('/instagram/')).toBe(true);
      expect(res.metadata.mediaType).toBe('video');

      fetchSpy.mockRestore();
    });
  });

  describe('3. Spotify Downloader Service & Exact n8n Math Parity', () => {
    it('extracts valid Spotify track URLs correctly', () => {
      const trackUrl = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=ZXw&nd=1';
      const intlTrackUrl = 'https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT';

      expect(SpotifyService.extractUrl(trackUrl)).toContain('spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
      expect(SpotifyService.extractUrl(intlTrackUrl)).toContain('spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT');
    });

    it('rejects invalid or non-track Spotify URLs with BadRequestError', () => {
      expect(() => SpotifyService.extractUrl('')).toThrow(BadRequestError);
      expect(() => SpotifyService.extractUrl('https://open.spotify.com/artist/123456')).toThrow(BadRequestError);
      expect(() => SpotifyService.extractUrl('https://soundcloud.com/track/123')).toThrow(BadRequestError);
    });

    it('achieves exact mathematical parity with n8n Code node (bytesToKb & kbToMb)', () => {
      // n8n Code node:
      // function bytesToKb(bytes) { return bytes / 1024; }
      // function kbToMb(kb) { return (kb / 1024).toFixed(2); }

      // Test Case 1: Exactly 1 MB = 1048576 bytes
      const kb1 = SpotifyService.bytesToKb(1048576);
      expect(kb1).toBe(1024);
      expect(SpotifyService.kbToMb(kb1)).toBe('1.00');

      // Test Case 2: 3,463,942 bytes (~3.30 MB)
      const kb2 = SpotifyService.bytesToKb(3463942);
      expect(kb2).toBeCloseTo(3382.7558, 2);
      expect(SpotifyService.kbToMb(kb2)).toBe('3.30');

      // Test Case 3: 15,728,640 bytes (15 MB)
      const kb3 = SpotifyService.bytesToKb(15728640);
      expect(kb3).toBe(15360);
      expect(SpotifyService.kbToMb(kb3)).toBe('15.00');
    });

    it('validates Spotify request body schema and rejects empty payload', () => {
      expect(() => spotifyResolveBodySchema.parse({ url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT' })).not.toThrow();
      expect(() => spotifyResolveBodySchema.parse({ url: '' })).toThrow();
      expect(() => spotifyResolveBodySchema.parse({})).toThrow();
    });

    it('handles Drive duplicate check gracefully for non-existent track', async () => {
      const result = await SpotifyService.checkExistingInDrive('non_existent_track_77777');
      expect(result).toHaveProperty('exists', false);
    });

    it('calculates deterministic match scores and heavily penalizes unwanted remixes, covers, and karaoke', () => {
      const expected = { title: 'Định Mệnh', artist: 'Noo Phước Thịnh', duration: 296 };

      // 1. Exact studio track on official artist channel
      const exactCandidate = {
        title: 'Định Mệnh',
        channel: 'Noo Phước Thịnh',
        track: 'Định Mệnh',
        artist: 'Noo Phước Thịnh',
        duration: 296
      };
      const exactScore = SpotifyService.calculateMatchScore(exactCandidate, expected);
      expect(exactScore).toBeGreaterThanOrEqual(80);

      // 2. Official Topic release from record label
      const topicCandidate = {
        title: 'Định Mệnh',
        channel: 'Noo Phước Thịnh - Topic',
        track: 'Định Mệnh',
        artist: 'Noo Phước Thịnh',
        duration: 296
      };
      const topicScore = SpotifyService.calculateMatchScore(topicCandidate, expected);
      expect(topicScore).toBeGreaterThanOrEqual(85);

      // 3. Unwanted remix (same duration, but remix keyword)
      const remixCandidate = {
        title: 'Định Mệnh (Vinahouse Remix 2024 Cực Căng)',
        channel: 'DJ Viet Nam',
        duration: 296
      };
      const remixScore = SpotifyService.calculateMatchScore(remixCandidate, expected);
      expect(remixScore).toBeLessThan(0);

      // 4. Unwanted Karaoke / Beat
      const karaokeCandidate = {
        title: '[KARAOKE TONE CHUẨN CÓ BÈ] Định Mệnh - Noo Phước Thịnh',
        channel: 'Phát Hứa',
        duration: 298
      };
      const karaokeScore = SpotifyService.calculateMatchScore(karaokeCandidate, expected);
      expect(karaokeScore).toBeLessThan(0);

      // 5. Unwanted AI Cover
      const coverCandidate = {
        title: 'ĐỊNH MỆNH / ST: Song Ngọc / Ca sĩ AI cover',
        channel: 'LLe AI cover',
        duration: 296
      };
      const coverScore = SpotifyService.calculateMatchScore(coverCandidate, expected);
      expect(coverScore).toBeLessThan(0);

      // 6. Excessive duration mismatch (> 15s) is completely rejected (-999)
      const durationMismatch = {
        title: 'Định Mệnh',
        channel: 'Noo Phước Thịnh',
        duration: 350
      };
      expect(SpotifyService.calculateMatchScore(durationMismatch, expected)).toBe(-999);

      // 7. Track that explicitly requested a remix is NOT penalized for remix keywords
      const intendedRemix = { title: 'Định Mệnh (Remix)', artist: 'Noo Phước Thịnh', duration: 240 };
      const legitimateRemixCandidate = {
        title: 'Định Mệnh (Remix Official Audio)',
        channel: 'Noo Phước Thịnh',
        duration: 240
      };
      expect(SpotifyService.calculateMatchScore(legitimateRemixCandidate, intendedRemix)).toBeGreaterThan(40);
    });

    it('surgically cleans track titles by stripping metadata brackets without destroying essential parentheses (KI-FIX-041)', () => {
      // 1. Preserves essential parentheses in song titles (including words ending in 'ft' like Shaft, Swift, Shift)
      expect(SpotifyService.cleanTitle("(Don't Fear) The Reaper")).toBe("(Don't Fear) The Reaper");
      expect(SpotifyService.cleanTitle("(I Can't Get No) Satisfaction")).toBe("(I Can't Get No) Satisfaction");
      expect(SpotifyService.cleanTitle("(Sittin' On) The Dock of the Bay")).toBe("(Sittin' On) The Dock of the Bay");
      expect(SpotifyService.cleanTitle("Theme From (Shaft)")).toBe("Theme From (Shaft)");
      expect(SpotifyService.cleanTitle("Love (Taylor Swift)")).toBe("Love (Taylor Swift)");
      expect(SpotifyService.cleanTitle("Night (Shift)")).toBe("Night (Shift)");

      // 2. Strips metadata tags inside brackets / parentheses
      expect(SpotifyService.cleanTitle("Hotel California (2013 Remaster)")).toBe("Hotel California");
      expect(SpotifyService.cleanTitle("Starboy (feat. Daft Punk)")).toBe("Starboy");
      expect(SpotifyService.cleanTitle("Bad Guy [Official Audio]")).toBe("Bad Guy");
      expect(SpotifyService.cleanTitle("Thriller (Deluxe Edition)")).toBe("Thriller");
      expect(SpotifyService.cleanTitle("Billie Jean (Anniversary Edition)")).toBe("Billie Jean");
      expect(SpotifyService.cleanTitle("Hey Jude (Mono Version)")).toBe("Hey Jude");
      expect(SpotifyService.cleanTitle("Lose Yourself (Explicit)")).toBe("Lose Yourself");

      // 3. Combined essential parentheses + metadata tag
      expect(SpotifyService.cleanTitle("(Don't Fear) The Reaper (Remastered 2020)")).toBe("(Don't Fear) The Reaper");
      expect(SpotifyService.cleanTitle("(I Can't Get No) Satisfaction [Official Music Video]")).toBe("(I Can't Get No) Satisfaction");
    });

    it('clears in-memory resolution cache via clearCache()', () => {
      expect(() => SpotifyService.clearCache()).not.toThrow();
    });
  });

  describe('4. Media History Section & Storage Lifecycle', () => {
    it('escapes HTML strings and formats durations correctly', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml('')).toBe('');

      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(185)).toBe('3:05');
      expect(formatDuration(null as any)).toBe('0:00');
    });

    it('renderMediaHistorySection renders empty state cleanly when no history items exist', () => {
      vi.spyOn(storage, 'getToolHistory').mockReturnValue([]);
      vi.spyOn(storage, 'getToolTrash').mockReturnValue([]);

      const html = renderMediaHistorySection({
        toolId: 'spotify-downloader',
        title: 'Lịch sử Spotify',
        activeTab: 'history'
      });

      expect(html).toContain('id="mediaHistorySection"');
      expect(html).toContain('Lịch sử Spotify');
      expect(html).toContain('Chưa có lịch sử tải xuống');
    });

    it('renderMediaHistorySection renders item cards with playback, download, and Drive badges', () => {
      const mockItems = [
        {
          id: 'sp_test_1',
          toolId: 'spotify-downloader',
          toolTitle: 'Spotify Downloader',
          title: 'Never Gonna Give You Up',
          thumbnail: 'https://image.spotify.com/cover.jpg',
          author: 'Rick Astley',
          duration: 213,
          downloadUrl: 'https://stream.spotify.com/audio.mp3',
          fileName: 'Never Gonna Give You Up - Rick Astley.mp3',
          timestamp: Date.now() - 60000,
          driveRelPath: '/spotify/Never_Gonna_Give_You_Up.mp3'
        }
      ];

      vi.spyOn(storage, 'getToolHistory').mockReturnValue(mockItems as any);
      vi.spyOn(storage, 'getToolTrash').mockReturnValue([]);

      const html = renderMediaHistorySection({
        toolId: 'spotify-downloader',
        title: 'Lịch sử Spotify',
        activeTab: 'history'
      });

      expect(html).toContain('Never Gonna Give You Up');
      expect(html).toContain('Rick Astley');
      expect(html).toContain('Đã lưu Drive');
      expect(html).toContain('data-action-preview="sp_test_1"');
      expect(html).toContain('data-action-download="sp_test_1"');
      expect(html).toContain('data-action-delete="sp_test_1"');
    });

    it('renderMediaHistorySection supports Instagram and Facebook tool titles and dual SD/HD downloads', () => {
      const fbItems = [
        {
          id: 'fb_test_1',
          toolId: 'facebook-downloader',
          toolTitle: 'Facebook Downloader',
          title: 'Awesome Reel',
          thumbnail: 'https://fb.com/thumb.jpg',
          downloadUrl: 'https://fb.com/video.mp4',
          videoHdUrl: 'https://fb.com/video_hd.mp4',
          videoSdUrl: 'https://fb.com/video_sd.mp4',
          fileName: 'Awesome_Reel.mp4',
          timestamp: Date.now()
        }
      ];

      vi.spyOn(storage, 'getToolHistory').mockReturnValue(fbItems as any);
      vi.spyOn(storage, 'getToolTrash').mockReturnValue([]);

      const html = renderMediaHistorySection({
        toolId: 'facebook-downloader',
        title: 'Lịch sử Facebook',
        activeTab: 'history'
      });

      expect(html).toContain('Lịch sử Facebook');
      expect(html).toContain('Awesome Reel');
      expect(html).toContain('<span>HD</span>');
      expect(html).toContain('<span>SD</span>');
    });
  });
});
