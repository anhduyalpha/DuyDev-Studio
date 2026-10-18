import { describe, it, expect } from 'vitest';
import { validateTargetUrlForPreset } from '../../../src/components/tools/qr/hooks/useQrValidation.js';

describe('QR Studio URL Preset Validation Suite', () => {
  describe('1. Empty and Malformed URL Handling', () => {
    it('should reject empty or whitespace-only inputs', () => {
      const res = validateTargetUrlForPreset('', 'youtube');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('Vui lòng nhập');

      const resWhitespace = validateTargetUrlForPreset('   ', 'custom');
      expect(resWhitespace.valid).toBe(false);
    });

    it('should reject invalid domain strings without dot', () => {
      const res = validateTargetUrlForPreset('localhost-only', 'custom');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('Tên miền trang web không hợp lệ');
    });

    it('should automatically prepend https:// if missing', () => {
      const res = validateTargetUrlForPreset('youtube.com/watch?v=dQw4w9WgXcQ', 'youtube');
      expect(res.valid).toBe(true);
      expect(res.normalizedUrl).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ');
    });
  });

  describe('2. YouTube Preset Validation', () => {
    it('should accept valid standard YouTube desktop, mobile, shorts, and shortened youtu.be links', () => {
      const validLinks = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://m.youtube.com/shorts/abcdefgh',
        'https://youtu.be/dQw4w9WgXcQ',
        'http://youtube.com/channel/UC123456',
        'youtube.com/watch?v=999'
      ];

      for (const link of validLinks) {
        const res = validateTargetUrlForPreset(link, 'youtube');
        expect(res.valid, `Expected "${link}" to be valid for YouTube`).toBe(true);
        expect(res.message).toBe('');
      }
    });

    it('should reject non-YouTube URLs when YouTube is selected as preset', () => {
      const invalidLinks = [
        'https://facebook.com/watch?v=123',
        'https://tiktok.com/@creator/video/123',
        'https://example.com/youtube-video',
        'https://fake-youtube.com/watch?v=1',
        'https://google.com'
      ];

      for (const link of invalidLinks) {
        const res = validateTargetUrlForPreset(link, 'youtube');
        expect(res.valid, `Expected "${link}" to be rejected for YouTube`).toBe(false);
        expect(res.message).toContain('Bạn đang chọn dịch vụ YouTube');
      }
    });
  });

  describe('3. Facebook Preset Validation', () => {
    it('should accept valid Facebook links (facebook.com, fb.com, fb.watch, fb.me)', () => {
      const validLinks = [
        'https://www.facebook.com/profile.php?id=100',
        'https://facebook.com/duydev',
        'https://m.facebook.com/groups/12345',
        'https://fb.com/page',
        'https://fb.watch/xyz123',
        'https://fb.me/short'
      ];

      for (const link of validLinks) {
        const res = validateTargetUrlForPreset(link, 'facebook');
        expect(res.valid, `Expected "${link}" to be valid for Facebook`).toBe(true);
      }
    });

    it('should reject non-Facebook URLs', () => {
      const res = validateTargetUrlForPreset('https://youtube.com/watch?v=1', 'facebook');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('Bạn đang chọn dịch vụ Facebook');
    });
  });

  describe('4. TikTok Preset Validation', () => {
    it('should accept valid TikTok URLs', () => {
      const validLinks = [
        'https://www.tiktok.com/@duydev/video/78910',
        'https://tiktok.com/@creator',
        'https://m.tiktok.com/v/12345.html'
      ];

      for (const link of validLinks) {
        const res = validateTargetUrlForPreset(link, 'tiktok');
        expect(res.valid).toBe(true);
      }
    });

    it('should reject non-TikTok URLs', () => {
      const res = validateTargetUrlForPreset('https://instagram.com/p/123', 'tiktok');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('Bạn đang chọn dịch vụ TikTok');
    });
  });

  describe('5. Google Workspace Presets Validation', () => {
    it('should enforce Google Sheets URLs', () => {
      const valid = validateTargetUrlForPreset('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit', 'google-sheets');
      expect(valid.valid).toBe(true);

      const invalid = validateTargetUrlForPreset('https://docs.google.com/document/d/123', 'google-sheets');
      expect(invalid.valid).toBe(false);
      expect(invalid.message).toContain('Google Sheets');
    });

    it('should enforce Google Docs URLs', () => {
      const valid = validateTargetUrlForPreset('https://docs.google.com/document/d/123/edit', 'google-docs');
      expect(valid.valid).toBe(true);

      const invalid = validateTargetUrlForPreset('https://docs.google.com/spreadsheets/d/123', 'google-docs');
      expect(invalid.valid).toBe(false);
      expect(invalid.message).toContain('Google Docs');
    });

    it('should enforce Google Drive URLs', () => {
      const valid = validateTargetUrlForPreset('https://drive.google.com/drive/folders/12345', 'google-drive');
      expect(valid.valid).toBe(true);

      const invalid = validateTargetUrlForPreset('https://dropbox.com/s/123', 'google-drive');
      expect(invalid.valid).toBe(false);
      expect(invalid.message).toContain('Google Drive');
    });

    it('should enforce Google Forms URLs', () => {
      const validFormsGle = validateTargetUrlForPreset('https://forms.gle/abcXYZ123', 'google-forms');
      expect(validFormsGle.valid).toBe(true);

      const validDocsForm = validateTargetUrlForPreset('https://docs.google.com/forms/d/e/1FAIpQLSc/viewform', 'google-forms');
      expect(validDocsForm.valid).toBe(true);

      const invalid = validateTargetUrlForPreset('https://typeform.com/to/123', 'google-forms');
      expect(invalid.valid).toBe(false);
      expect(invalid.message).toContain('Google Forms');
    });
  });

  describe('6. Custom Preset (General Web URLs)', () => {
    it('should accept any valid web URL when preset is custom', () => {
      const validUrls = [
        'https://duydev.cloud',
        'https://github.com/anhduyalpha',
        'https://vnexpress.net/thoi-su',
        'http://internal-lan.company.vn:8080/dashboard',
        'my-cool-site.io/pricing'
      ];

      for (const url of validUrls) {
        const res = validateTargetUrlForPreset(url, 'custom');
        expect(res.valid, `Expected "${url}" to be accepted under custom preset`).toBe(true);
      }
    });
  });
});
