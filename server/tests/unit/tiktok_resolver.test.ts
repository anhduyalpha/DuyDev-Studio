import { describe, it, expect, vi } from 'vitest';
import { TikTokService } from '../../src/services/tiktok.service.js';
import {
  tiktokResolveBodySchema,
  tiktokStreamQuerySchema,
  tiktokSaveDriveBodySchema
} from '../../src/schemas/tiktok.schema.js';
import { classifySharedPayload, SharePayloadType } from '../../../src/utilities/shareTargetHelper.js';
import { buildApp } from '../../src/app.js';

describe('TikTok Downloader Suite', () => {
  describe('URL Normalization & Validation', () => {
    it('should extract canonical TikTok video URL from dirty strings', () => {
      const raw = 'Check out this awesome clip! https://www.tiktok.com/@randomspamvideos25/video/7251387037834595630?is_from_webapp=1&sender_device=pc sent via DM';
      const extracted = TikTokService.extractUrl(raw);
      expect(extracted).toBe('https://www.tiktok.com/@randomspamvideos25/video/7251387037834595630?is_from_webapp=1&sender_device=pc');
    });

    it('should extract short vt.tiktok.com URLs', () => {
      const raw = 'https://vt.tiktok.com/ZS2xYwZ1q/';
      const extracted = TikTokService.extractUrl(raw);
      expect(extracted).toBe('https://vt.tiktok.com/ZS2xYwZ1q/');
    });

    it('should throw BadRequestError on invalid non-tiktok URLs', () => {
      expect(() => TikTokService.extractUrl('https://example.com/not-a-tiktok-video')).toThrow();
      expect(() => TikTokService.extractUrl('random text without url')).toThrow();
    });

    it('should validate schemas correctly', () => {
      const validBody = tiktokResolveBodySchema.parse({
        url: 'https://www.tiktok.com/@user/video/123456789'
      });
      expect(validBody.url).toBe('https://www.tiktok.com/@user/video/123456789');

      const validStream = tiktokStreamQuerySchema.parse({
        url: 'https://v16m.tiktokcdn-us.com/video.mp4',
        download: 'true',
        filename: 'my_clip.mp4'
      });
      expect(validStream.download).toBe('true');
      expect(validStream.filename).toBe('my_clip.mp4');

      const validDrive = tiktokSaveDriveBodySchema.parse({
        url: 'https://v16m.tiktokcdn-us.com/video.mp4',
        title: 'Awesome Dance'
      });
      expect(validDrive.title).toBe('Awesome Dance');
    });
  });

  describe('Share Target Classifier for TikTok', () => {
    it('should classify TikTok URL into SharePayloadType.TIKTOK_URL with primary action to tiktok-downloader', () => {
      const payload = {
        url: 'https://www.tiktok.com/@randomspamvideos25/video/7251387037834595630',
        title: 'Rickroll TikTok Video'
      };
      const res = classifySharedPayload(payload);
      expect(res.type).toBe(SharePayloadType.TIKTOK_URL);
      expect(res.recommendations[0].route).toBe('#tool/tiktok');
      expect(res.recommendations[0].isPrimary).toBe(true);
    });

    it('should classify short vt.tiktok.com URL into SharePayloadType.TIKTOK_URL', () => {
      const payload = {
        text: 'Look at this video https://vt.tiktok.com/ZS2xYwZ1q/'
      };
      const res = classifySharedPayload(payload);
      expect(res.type).toBe(SharePayloadType.TIKTOK_URL);
      expect(res.recommendations[0].route).toBe('#tool/tiktok');
    });
  });

  describe('TikWM Resolver & Fallback Logic', () => {
    it('should resolve a real TikTok video URL with metadata and watermark-free stream', async () => {
      const url = 'https://www.tiktok.com/@randomspamvideos25/video/7251387037834595630';
      const result = await TikTokService.resolveVideo(url);

      expect(result).toBeDefined();
      expect(result.id).toBe('7251387037834595630');
      expect(result.title).toBeTruthy();
      expect(result.author).toBeDefined();
      expect(result.author.nickname).toBeTruthy();
      expect(result.videoUrl).toMatch(/^https?:\/\//);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.stats).toBeDefined();
      expect(result.stats.views).toBeGreaterThan(0);
      expect(result.stats.likes).toBeGreaterThan(0);
      expect(result.stats.comments).toBeGreaterThan(0);
      expect(result.stats.shares).toBeGreaterThan(0);
      expect(result.stats.playCount).toBe(result.stats.views);
      expect(result.stats.diggCount).toBe(result.stats.likes);
    }, 15000);
  });

  describe('Fastify HTTP Route Integration', () => {
    it('should successfully resolve via POST /api/v1/tiktok/resolve endpoint', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tiktok/resolve',
        payload: {
          url: 'https://www.tiktok.com/@randomspamvideos25/video/7251387037834595630'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('7251387037834595630');
      expect(json.data.videoUrl).toBeTruthy();
      await app.close();
    }, 20000);
  });

  describe('UI Typography & Purging "bóc tách"', () => {
    it('TiktokWorkspace.js must contain clean labels and zero instances of "bóc tách"', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const workspaceFile = path.resolve(__dirname, '../../../src/components/tools/tiktok/TiktokWorkspace.js');
      const content = fs.readFileSync(workspaceFile, 'utf-8');

      // Must NOT contain "bóc tách"
      expect(content).not.toContain('bóc tách');
      expect(content).not.toContain('Bóc tách');

      // Must contain requested labels
      expect(content).toContain('Lịch Sử Tải Xuống');
      expect(content).toContain('Tải Video');
      expect(content).toContain('Tải Audio (mp3)');
    });

    it('useTiktok.js must NOT contain "bóc tách"', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const hookFile = path.resolve(__dirname, '../../../src/components/tools/tiktok/hooks/useTiktok.js');
      const content = fs.readFileSync(hookFile, 'utf-8');
      expect(content).not.toContain('bóc tách');
    });
  });

  describe('Drive /tiktok Directory Integration', () => {
    it('DriveService.listFiles("/tiktok") must succeed and auto-create folder if missing', async () => {
      const { DriveService } = await import('../../src/services/drive.service.js');
      const res = await DriveService.listFiles('/tiktok');
      expect(res).toBeDefined();
      expect(res.currentPath).toBe('/tiktok');
      expect(Array.isArray(res.items)).toBe(true);
    });
  });

  describe('Client Error Robustness & Universal Clipboard', () => {
    it('tiktokApi.js must extract error.message from server error objects and never produce [object Object]', async () => {
      const { tiktokApi } = await import('../../../src/components/tools/tiktok/services/tiktokApi.js');
      
      // Mock global fetch to return structured error object from Fastify global error handler
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: {
            code: 'BAD_REQUEST_PAYLOAD',
            message: 'Video TikTok không tồn tại hoặc đã bị xóa'
          }
        })
      });

      try {
        await expect(tiktokApi.resolveVideo('https://vt.tiktok.com/ZSgMxTbNA/')).rejects.toThrow('Video TikTok không tồn tại hoặc đã bị xóa');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('TiktokWorkspace.js must import readText from utilities/clipboard.js', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const workspaceFile = path.resolve(__dirname, '../../../src/components/tools/tiktok/TiktokWorkspace.js');
      const content = fs.readFileSync(workspaceFile, 'utf-8');
      expect(content).toContain("import { readText } from '../../../utilities/clipboard.js'");
    });
  });

  describe('Douyin Native _ROUTER_DATA & Shortlink Support', () => {
    it('extracts protocol-less and copy-pasted Douyin URLs and sets Douyin Referer for ByteDance CDNs', async () => {
      const { extractTiktokUrls } = await import('../../../src/components/tools/tiktok/hooks/useTiktok.js');
      const messy = '7.41 复制打开抖音 https://v.douyin.com/iYtest123/ 看看';
      expect(TikTokService.extractUrl(messy)).toBe('https://v.douyin.com/iYtest123/');
      expect(TikTokService.extractUrl('v.douyin.com/abcXYZ/')).toBe('https://v.douyin.com/abcXYZ/');
      expect(extractTiktokUrls(messy)).toEqual(['https://v.douyin.com/iYtest123/']);
      expect(TikTokService.isDouyinUrl('https://www.iesdouyin.com/share/video/1234567890123/')).toBe(true);
      expect(TikTokService.getStreamReferer('https://v5-dy.byteimg.com/video.mp4')).toBe('https://www.douyin.com/');
      expect(TikTokService.getStreamReferer('https://v16.tiktokcdn.com/video.mp4')).toBe('https://www.tiktok.com/');
    });

    it('resolves Douyin /note/ Live Photo albums & unwatermarked MP4 via native _ROUTER_DATA', async () => {
      const origFetch = globalThis.fetch;
      const sampleRouterJson = {
        loaderData: {
          'video_(id)/page': {
            videoInfoRes: {
              item_list: [
                {
                  aweme_id: '7398765432109876543',
                  desc: 'Douyin Note Album Test',
                  duration: 15000,
                  author: { nickname: 'Douyin Creator', unique_id: 'dy_01', avatar_thumb: { url_list: ['https://p3.douyinpic.com/av.jpg'] } },
                  music: { play_url: { url_list: ['https://sf3.byteimg.com/bgm.mp3'] } },
                  video: {
                    play_addr: { url_list: ['https://aweme.snssdk.com/aweme/v1/playwm/?video_id=123'] },
                    origin_cover: { url_list: ['https://p3.douyinpic.com/cover.jpg'] },
                    bit_rate: [{ bit_rate: 2000000, play_addr: { url_list: ['https://aweme.snssdk.com/aweme/v1/playwm/?video_id=123_hd'] } }]
                  },
                  images: [
                    {
                      url_list: ['https://p3.douyinpic.com/slide1.jpg'],
                      video: { play_addr: { url_list: ['https://aweme.snssdk.com/aweme/v1/playwm/?video_id=live1'] } }
                    },
                    { url_list: ['https://p3.douyinpic.com/slide2.jpg'] }
                  ],
                  statistics: { play_count: 5000, digg_count: 420, comment_count: 15, share_count: 9 }
                }
              ]
            }
          }
        }
      };

      globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
        const u = String(input?.url || input);
        if (u.includes('iesdouyin.com/share/video/')) {
          return new Response(
            `<html><script>window._ROUTER_DATA = ${JSON.stringify(sampleRouterJson)}</script></html>`,
            { status: 200, headers: { 'content-type': 'text/html' } }
          );
        }
        return new Response('Not found', { status: 404 });
      });

      try {
        const res = await TikTokService.resolveVideo('https://www.douyin.com/note/7398765432109876543');
        expect(res.platform).toBe('douyin');
        expect(res.extractor).toBe('douyin-router');
        expect(res.videoUrl).toBe('https://aweme.snssdk.com/aweme/v1/play/?video_id=123');
        expect(res.videoHdUrl).toBe('https://aweme.snssdk.com/aweme/v1/play/?video_id=123_hd');
        expect(res.isSlideshow).toBe(true);
        expect(res.images).toEqual(['https://p3.douyinpic.com/slide1.jpg', 'https://p3.douyinpic.com/slide2.jpg']);
        expect(res.livePhotoVideos).toEqual(['https://aweme.snssdk.com/aweme/v1/play/?video_id=live1']);
        expect(res.audioUrl).toBe('https://sf3.byteimg.com/bgm.mp3');
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });
});
