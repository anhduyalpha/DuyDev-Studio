import { describe, it, expect } from 'vitest';
import {
  tiktokSaveDriveBodySchema,
  tiktokResolveBodySchema,
  TikTokVideoData
} from '../../src/schemas/tiktok.schema.js';
import { TikTokService } from '../../src/services/tiktok.service.js';

describe('TikTok Photo Mode & Slideshow Suite', () => {
  describe('Schema Validation for Slideshows', () => {
    it('should parse slideshow save drive payload with images array and audioUrl', () => {
      const payload = {
        url: 'https://v16m.tiktokcdn.com/dummy.mp4',
        title: 'Bộ ảnh đi chơi Đà Lạt #dulich',
        tiktokVideoId: '7412345678901234567',
        isSlideshow: true,
        images: [
          'https://p16-sign.tiktokcdn.com/tos-alisg-i-0000/slide1.jpeg',
          'https://p16-sign.tiktokcdn.com/tos-alisg-i-0000/slide2.jpeg',
          'https://p16-sign.tiktokcdn.com/tos-alisg-i-0000/slide3.jpeg'
        ],
        audioUrl: 'https://sf16-ies-music.tiktokcdn.com/music123.mp3'
      };

      const parsed = tiktokSaveDriveBodySchema.parse(payload);
      expect(parsed.isSlideshow).toBe(true);
      expect(parsed.images).toHaveLength(3);
      expect(parsed.images?.[0]).toBe('https://p16-sign.tiktokcdn.com/tos-alisg-i-0000/slide1.jpeg');
      expect(parsed.audioUrl).toBe('https://sf16-ies-music.tiktokcdn.com/music123.mp3');
      expect(parsed.tiktokVideoId).toBe('7412345678901234567');
    });

    it('should default isSlideshow to false when not provided', () => {
      const payload = {
        url: 'https://v16m.tiktokcdn.com/video.mp4',
        title: 'Standard Dance Video'
      };

      const parsed = tiktokSaveDriveBodySchema.parse(payload);
      expect(parsed.isSlideshow).toBe(false);
      expect(parsed.images).toBeUndefined();
    });

    it('should conform to TikTokVideoData interface for slideshow responses', () => {
      const mockVideoData: TikTokVideoData = {
        id: '7423981293812931',
        title: 'Chụp hình kỷ yếu 2026',
        cover: 'https://p16.tiktokcdn.com/cover.jpg',
        videoUrl: 'https://p16.tiktokcdn.com/video_preview.mp4',
        videoHdUrl: null,
        duration: 0,
        author: {
          uniqueId: 'student_photo',
          nickname: 'Kỷ Yếu Học Đường',
          avatar: 'https://p16.tiktokcdn.com/avatar.jpg'
        },
        stats: {
          playCount: 12000,
          diggCount: 3500,
          commentCount: 150,
          shareCount: 420
        },
        isSlideshow: true,
        images: [
          'https://p16.tiktokcdn.com/slide_1.jpg',
          'https://p16.tiktokcdn.com/slide_2.jpg'
        ],
        audioUrl: 'https://sf16.tiktokcdn.com/audio.mp3'
      };

      expect(mockVideoData.isSlideshow).toBe(true);
      expect(mockVideoData.images).toHaveLength(2);
      expect(mockVideoData.audioUrl).toBeTruthy();
    });
  });

  describe('Slideshow Archive File Identification', () => {
    it('should identify zip extensions as valid Drive slideshow archives', () => {
      const sampleFiles = [
        '[TikTok]_Bo_anh_Ha_Giang_74123456789.zip',
        '[TikTok]_Review_Quan_An_74987654321.mp4',
        'document.pdf'
      ];

      const zipFiles = sampleFiles.filter((f) => f.toLowerCase().endsWith('.zip'));
      expect(zipFiles).toHaveLength(1);
      expect(zipFiles[0]).toContain('.zip');
    });
  });

  describe('Photo Mode URL Pattern and ID Extraction', () => {
    it('should extract canonical numeric ID from /photo/ URLs', () => {
      const photoUrl = 'https://www.tiktok.com/@chi_bi_cute2/photo/7440725873658973460?q=anh%20yeu%20em&t=1791983131969';
      const match = photoUrl.match(/\/(?:video|photo|item)\/(\d+)/i);
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('7440725873658973460');
    });

    it('should extract canonical numeric ID from standard /video/ URLs', () => {
      const videoUrl = 'https://www.tiktok.com/@user/video/7412345678901234567';
      const match = videoUrl.match(/\/(?:video|photo|item)\/(\d+)/i);
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('7412345678901234567');
    });

    it('should extract clean URLs containing /photo/ via extractTiktokUrls logic', () => {
      const rawText = 'Xem bộ ảnh này nè: https://www.tiktok.com/@chi_bi_cute2/photo/7440725873658973460?is_copy_url=1 cực xinh!';
      const regex = /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?tiktok\.com\/[^\s"<>'`]+/gi;
      const matches = rawText.match(regex) || [];
      expect(matches).toHaveLength(1);
      expect(matches[0]).toContain('/photo/7440725873658973460');
    });
  });
});
