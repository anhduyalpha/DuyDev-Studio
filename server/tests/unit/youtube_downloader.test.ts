import { describe, it, expect } from 'vitest';
import { YouTubeService } from '../../src/services/youtube.service.js';
import {
  youtubeResolveBodySchema,
  youtubeDownloadBodySchema,
  youtubeSaveDriveBodySchema
} from '../../src/schemas/youtube.schema.js';
import { BadRequestError, NotFoundError } from '../../src/lib/errors.js';

describe('YouTube Downloader Service & Schema Tests', () => {
  describe('YouTubeService.extractUrl', () => {
    it('extracts standard watch URLs', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(YouTubeService.extractUrl(url)).toBe(url);
    });

    it('extracts short youtu.be URLs and preserves query params', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ?si=abcdef123456';
      expect(YouTubeService.extractUrl(url)).toBe(url);
    });

    it('extracts YouTube Shorts URLs', () => {
      const url = 'https://www.youtube.com/shorts/aB1cD2eF3gH';
      expect(YouTubeService.extractUrl(url)).toBe(url);
    });

    it('extracts mobile m.youtube.com URLs', () => {
      const url = 'https://m.youtube.com/watch?v=jNQXAC9IVRw';
      expect(YouTubeService.extractUrl(url)).toBe(url);
    });

    it('extracts embed URLs', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      expect(YouTubeService.extractUrl(url)).toBe(url);
    });

    it('extracts YouTube link embedded within dirty text / message', () => {
      const text = 'Hey guys check out this tutorial: https://www.youtube.com/watch?v=dQw4w9WgXcQ and let me know!';
      expect(YouTubeService.extractUrl(text)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('throws BadRequestError for non-YouTube URLs or invalid strings', () => {
      expect(() => YouTubeService.extractUrl('https://facebook.com/watch?v=123')).toThrow(BadRequestError);
      expect(() => YouTubeService.extractUrl('https://tiktok.com/@user/video/123')).toThrow(BadRequestError);
      expect(() => YouTubeService.extractUrl('random text with no link')).toThrow(BadRequestError);
      expect(() => YouTubeService.extractUrl('')).toThrow(BadRequestError);
    });
  });

  describe('Zod Schema Validation', () => {
    it('validates youtubeResolveBodySchema', () => {
      const valid = youtubeResolveBodySchema.safeParse({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });
      expect(valid.success).toBe(true);

      const invalid = youtubeResolveBodySchema.safeParse({ url: '' });
      expect(invalid.success).toBe(false);
    });

    it('validates and applies defaults in youtubeDownloadBodySchema', () => {
      const parseResult = youtubeDownloadBodySchema.safeParse({
        url: 'https://youtu.be/dQw4w9WgXcQ'
      });
      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.type).toBe('video');
        expect(parseResult.data.quality).toBe('best');
        expect(parseResult.data.saveToDrive).toBe(false);
      }
    });

    it('accepts audio download configurations', () => {
      const parseMp3 = youtubeDownloadBodySchema.safeParse({
        url: 'https://youtu.be/dQw4w9WgXcQ',
        type: 'audio',
        quality: 'mp3-320',
        saveToDrive: true
      });
      expect(parseMp3.success).toBe(true);

      const parseM4a = youtubeDownloadBodySchema.safeParse({
        url: 'https://youtu.be/dQw4w9WgXcQ',
        type: 'audio',
        quality: 'm4a-aac'
      });
      expect(parseM4a.success).toBe(true);
    });

    it('validates youtubeSaveDriveBodySchema', () => {
      const valid = youtubeSaveDriveBodySchema.safeParse({
        url: 'https://youtu.be/dQw4w9WgXcQ',
        type: 'video',
        quality: '1080p',
        title: 'sample_video'
      });
      expect(valid.success).toBe(true);

      const invalid = youtubeSaveDriveBodySchema.safeParse({
        url: ''
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('YouTubeService.getDownloadedFilePath Path Traversal & Existence Guard', () => {
    it('guards against directory traversal attempts by throwing NotFoundError', () => {
      const malicious = '../../../../etc/passwd';
      expect(() => YouTubeService.getDownloadedFilePath(malicious)).toThrow(NotFoundError);
    });

    it('throws NotFoundError for non-existent files', () => {
      const nonExistent = 'non_existent_youtube_file_987654321.mp4';
      expect(() => YouTubeService.getDownloadedFilePath(nonExistent)).toThrow(NotFoundError);
    });
  });
});
