import { describe, it, expect, vi } from 'vitest';
import { InstagramService } from '../../src/services/instagram.service.js';
import { BadRequestError } from '../../src/lib/errors.js';

describe('Adversarial Challenge: InstagramService Remediation', () => {

  describe('1. parseYtdlpOutput Stress-Testing', () => {
    it('handles single video output', () => {
      const singleVideoJson = JSON.stringify({
        id: 'single_vid_1',
        title: 'Solo Reel',
        url: 'https://cdn.instagram.com/solo.mp4',
        ext: 'mp4',
        vcodec: 'h264',
        thumbnail: 'https://cdn.instagram.com/thumb.jpg',
        uploader: 'creator_1'
      });

      const parsed = InstagramService.parseYtdlpOutput(singleVideoJson);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('single_vid_1');
      expect(parsed[0].ext).toBe('mp4');
      expect(parsed[0].vcodec).toBe('h264');
    });

    it('handles playlist entries array', () => {
      const playlistJson = JSON.stringify({
        _type: 'playlist',
        id: 'carousel_parent_99',
        title: 'Multi Album',
        entries: [
          { id: 'sub_1', url: 'https://cdn.instagram.com/1.jpg', ext: 'jpg', vcodec: 'none' },
          { id: 'sub_2', url: 'https://cdn.instagram.com/2.mp4', ext: 'mp4', vcodec: 'h264' },
          { id: 'sub_3', url: 'https://cdn.instagram.com/3.jpg', ext: 'jpg', vcodec: 'none' }
        ]
      });

      const parsed = InstagramService.parseYtdlpOutput(playlistJson);
      expect(parsed).toHaveLength(3);
      expect(parsed.map(p => p.id)).toEqual(['sub_1', 'sub_2', 'sub_3']);
    });

    it('handles multi-line NDJSON with mixed images and videos', () => {
      const ndjson = [
        JSON.stringify({ id: 'nd_1', url: 'https://cdn.instagram.com/img1.jpg', ext: 'jpg', vcodec: 'none' }),
        JSON.stringify({ id: 'nd_2', url: 'https://cdn.instagram.com/vid2.mp4', ext: 'mp4', vcodec: 'avc1' }),
        JSON.stringify({ id: 'nd_3', url: 'https://cdn.instagram.com/img3.webp', ext: 'webp', vcodec: 'none' })
      ].join('\n');

      const parsed = InstagramService.parseYtdlpOutput(ndjson);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].id).toBe('nd_1');
      expect(parsed[1].id).toBe('nd_2');
      expect(parsed[2].id).toBe('nd_3');
    });

    it('resiliently survives malformed lines, empty lines, and carriage returns interspersed with valid JSON', () => {
      const corruptedStream = [
        '',
        '   ',
        '{"id": "valid_1", "title": "Good Item 1"}',
        'WARNING: [instagram] Rate limit warning or garbage terminal output',
        '{"malformed_json_missing_brace',
        '{"id": "valid_2", "title": "Good Item 2"}',
        '',
        'null',
        '{"_type": "playlist", "entries": [null, {"id": "valid_3"}]}',
        '   '
      ].join('\r\n');

      const parsed = InstagramService.parseYtdlpOutput(corruptedStream);
      const ids = parsed.map(p => p?.id).filter(Boolean);
      expect(ids).toContain('valid_1');
      expect(ids).toContain('valid_2');
      expect(ids).toContain('valid_3');
    });

    it('safely handles empty string or whitespace-only without throwing', () => {
      expect(InstagramService.parseYtdlpOutput('')).toEqual([]);
      expect(InstagramService.parseYtdlpOutput('   \n\r\n   ')).toEqual([]);
      expect(InstagramService.parseYtdlpOutput(null as any)).toEqual([]);
      expect(InstagramService.parseYtdlpOutput(undefined as any)).toEqual([]);
    });
  });

  describe('2. saveToDrive MIME, Extension, and Path Verification', () => {
    it('confirms image items produce .jpg, image/jpeg, and leading slash /instagram/...', async () => {
      const mockBuffer = Buffer.from('adversarial test image stream');
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
        'https://scontent.cdninstagram.com/test_image_adversarial.jpg',
        'Adversarial Photo Title',
        'adv_img_999',
        'https://www.instagram.com/p/adv123/',
        'https://cdn.instagram.com/thumb.jpg',
        'adv_artist',
        0,
        true,
        'image'
      );

      expect(res.success).toBe(true);
      expect(res.fileName.endsWith('.jpg')).toBe(true);
      expect(res.fileName).toContain('[Instagram]_');
      expect(res.relPath.startsWith('/instagram/')).toBe(true);
      expect(res.relPath).toBe(`/instagram/${res.fileName}`);
      expect(res.metadata.mediaType).toBe('image');

      fetchSpy.mockRestore();
    });

    it('confirms video items produce .mp4, video/mp4, and leading slash /instagram/...', async () => {
      const mockBuffer = Buffer.from('adversarial test video stream');
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
        'https://scontent.cdninstagram.com/test_video_adversarial.mp4',
        'Adversarial Video Title',
        'adv_vid_888',
        'https://www.instagram.com/reel/adv456/',
        'https://cdn.instagram.com/thumb.jpg',
        'adv_artist',
        25,
        true,
        'video'
      );

      expect(res.success).toBe(true);
      expect(res.fileName.endsWith('.mp4')).toBe(true);
      expect(res.fileName).toContain('[Instagram]_');
      expect(res.relPath.startsWith('/instagram/')).toBe(true);
      expect(res.relPath).toBe(`/instagram/${res.fileName}`);
      expect(res.metadata.mediaType).toBe('video');

      fetchSpy.mockRestore();
    });

    it('infers image MIME and .jpg when mediaType is omitted but upstream content-type is image/jpeg', async () => {
      const mockBuffer = Buffer.from('adversarial image stream');
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
        'https://scontent.cdninstagram.com/photo_without_mediatype.jpg',
        'Implicit Photo',
        'adv_imp_111',
        'https://www.instagram.com/p/adv111/',
        '',
        'user_1',
        0,
        true
      );

      expect(res.success).toBe(true);
      expect(res.fileName.endsWith('.jpg')).toBe(true);
      expect(res.metadata.mediaType).toBe('image');
      expect(res.relPath).toBe(`/instagram/${res.fileName}`);

      fetchSpy.mockRestore();
    });
  });

  describe('3. Dirty URL Extraction Requirements', () => {
    it('extracts standard reel and post URLs cleanly', () => {
      const reelUrl = 'https://www.instagram.com/reel/C123456789/';
      expect(InstagramService.extractUrl(reelUrl)).toBe('https://www.instagram.com/reel/C123456789/');

      const postUrl = 'https://www.instagram.com/p/D987654321/';
      expect(InstagramService.extractUrl(postUrl)).toBe('https://www.instagram.com/p/D987654321/');
    });

    it('strips trailing punctuation without corrupting URL', () => {
      const urlWithExclamation = 'Check this out: https://www.instagram.com/reel/C123456789/!';
      expect(InstagramService.extractUrl(urlWithExclamation)).toBe('https://www.instagram.com/reel/C123456789/');

      const urlWithParen = 'Look at (https://www.instagram.com/p/D987654321/), amazing';
      expect(InstagramService.extractUrl(urlWithParen)).toBe('https://www.instagram.com/p/D987654321/');

      const urlWithAngleBrackets = '<https://www.instagram.com/reel/C123456789/>';
      expect(InstagramService.extractUrl(urlWithAngleBrackets)).toBe('https://www.instagram.com/reel/C123456789/');
    });

    it('strips tracking query parameters (igsh, utm_*)', () => {
      const urlWithTracking = 'https://www.instagram.com/reel/C123456789/?igsh=MTk3MWZ4eHQ3&utm_source=ig_web_copy_link';
      expect(InstagramService.extractUrl(urlWithTracking)).toBe('https://www.instagram.com/reel/C123456789/');
    });

    it('prepends https:// to protocol-less inputs', () => {
      const noProtocol = 'instagram.com/reel/C123456789/';
      expect(InstagramService.extractUrl(noProtocol)).toBe('https://instagram.com/reel/C123456789/');

      const noProtocolWww = 'www.instagram.com/p/D987654321/';
      expect(InstagramService.extractUrl(noProtocolWww)).toBe('https://www.instagram.com/p/D987654321/');
    });
  });
});
