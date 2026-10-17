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
});
